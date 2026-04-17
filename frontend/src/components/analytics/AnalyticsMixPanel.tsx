import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsMixChartSeries, AnalyticsMixResponse } from "../../../../common/types/index";
import { Badge, Button } from "../../design-system";
import { downloadRowsAsCsv } from "../../services/client-table-actions";
import { loadAnalyticsMix } from "../../services/analytics-mixes";
import type { DataRow, TableColumn } from "../../types";

interface AnalyticsMixPanelProps {
  endpoint: string;
  query?: Record<string, string>;
}

type MetricKind = "currency" | "percent" | "boolean" | "date" | "datetime" | "number" | "text";

const SERIES_COLORS = ["#10b981", "#0ea5e9", "#f59e0b", "#ef4444"];

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: Math.abs(value) >= 1000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
  }).format(value);
}

function looksLikeDateTime(value: string) {
  return /^\d{4}-\d{2}-\d{2}T/.test(value) || /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value);
}

function looksLikeDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{2}\/\d{2}\/\d{4}$/.test(value);
}

function detectMetricKind(
  fieldKey: string,
  label: string,
  unit: string | undefined,
  sampleValue: unknown,
): MetricKind {
  if (typeof sampleValue === "boolean") {
    return "boolean";
  }

  const lowerKey = fieldKey.toLowerCase();
  const lowerLabel = label.toLowerCase();
  const lowerUnit = (unit ?? "").toLowerCase();

  if (
    lowerUnit.includes("ngn") ||
    lowerLabel.includes("revenue") ||
    lowerLabel.includes("vend") ||
    lowerLabel.includes("amount") ||
    lowerLabel.includes("yield") ||
    lowerKey.includes("revenue") ||
    lowerKey.includes("amount") ||
    lowerKey.includes("vend")
  ) {
    return "currency";
  }

  if (
    lowerUnit.includes("%") ||
    lowerLabel.includes("%") ||
    lowerKey.endsWith("pct") ||
    lowerKey.includes("percent")
  ) {
    return "percent";
  }

  if (typeof sampleValue === "string") {
    if (looksLikeDateTime(sampleValue)) {
      return "datetime";
    }

    if (looksLikeDate(sampleValue)) {
      return "date";
    }
  }

  return typeof sampleValue === "number" ? "number" : "text";
}

function formatMetricValue(
  value: unknown,
  fieldKey: string,
  label: string,
  unit?: string,
) {
  if (value === null || value === undefined || value === "") {
    return "--";
  }

  const kind = detectMetricKind(fieldKey, label, unit, value);

  if (kind === "boolean") {
    return value === true ? "Yes" : "No";
  }

  if (typeof value === "number") {
    if (kind === "currency") {
      return `₦${value.toLocaleString(undefined, {
        maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
      })}`;
    }

    if (kind === "percent") {
      return `${value.toLocaleString(undefined, {
        maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
      })}%`;
    }

    return value.toLocaleString(undefined, {
      maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
    });
  }

  if (typeof value === "string" && (kind === "date" || kind === "datetime")) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return kind === "datetime" ? parsed.toLocaleString() : parsed.toLocaleDateString();
    }
  }

  return String(value);
}

function buildChartData(chart: NonNullable<AnalyticsMixResponse["chart"]>) {
  return chart.labels.map((label, index) => {
    const entry: Record<string, string | number> = { label };

    for (const series of chart.series) {
      entry[series.key] = series.values[index] ?? 0;
    }

    return entry;
  });
}

function normalizeQuery(query: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(query)
      .filter(([, value]) => value.trim().length > 0)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function formatSeriesValue(series: AnalyticsMixChartSeries | undefined, value: unknown) {
  if (typeof value !== "number") {
    return String(value ?? "--");
  }

  return formatMetricValue(value, series?.key ?? "value", series?.label ?? "Value");
}

export function AnalyticsMixPanel({ endpoint, query = {} }: AnalyticsMixPanelProps) {
  const [data, setData] = useState<AnalyticsMixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const stableQuery = useMemo(() => normalizeQuery(query), [query]);
  const queryKey = useMemo(() => JSON.stringify(stableQuery), [stableQuery]);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      setLoading(true);
      setError(null);

      try {
        const result = await loadAnalyticsMix(endpoint, stableQuery);
        if (!cancelled) {
          setData(result);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "Failed to load analytics mix");
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [endpoint, queryKey, stableQuery]);

  const chartData = useMemo(
    () => (data?.chart ? buildChartData(data.chart) : []),
    [data?.chart],
  );
  const metadataEntries = useMemo(
    () =>
      Object.entries(data?.metadata ?? {}).filter(([, value]) => value !== null && value !== undefined && value !== ""),
    [data?.metadata],
  );
  const hasRows = (data?.rows.length ?? 0) > 0;
  const hasChart = Boolean(data?.chart && chartData.length > 0);

  return (
    <section className="analytics-mix-panel premium-card">
      <div className="analytics-mix-panel__header">
        <div className="analytics-mix-panel__copy">
          <h3 className="analytics-mix-panel__title">{data?.title ?? "Analytics Mix"}</h3>
          <p className="analytics-mix-panel__description">
            {data?.description ?? "Loading verified composite analytics."}
          </p>
        </div>

        <div className="analytics-mix-panel__actions">
          {metadataEntries.map(([key, value]) => (
            <Badge key={key} tone="neutral">
              {key}: {formatMetricValue(value, key, key)}
            </Badge>
          ))}
          <Button
            disabled={!hasRows}
            onClick={() =>
              data
                ? downloadRowsAsCsv(
                    data.title,
                    data.columns as TableColumn[],
                    data.rows as DataRow[],
                  )
                : undefined
            }
            size="sm"
            tone="ghost"
          >
            Export CSV
          </Button>
        </div>
      </div>

      {error ? <p className="status-banner status-banner-error">{error}</p> : null}

      <div className="analytics-mix-panel__summary">
        {(data?.summary ?? []).map((item) => (
          <article key={item.key} className={`analytics-mix-summary-card tone-${item.tone ?? "info"}`}>
            <span className="analytics-mix-summary-card__label">{item.label}</span>
            <strong className="analytics-mix-summary-card__value">
              {formatMetricValue(item.value, item.key, item.label, item.unit)}
            </strong>
            {item.helper ? <span className="analytics-mix-summary-card__helper">{item.helper}</span> : null}
          </article>
        ))}
        {loading && !data ? <div className="analytics-mix-panel__loading">Loading analytics...</div> : null}
      </div>

      {hasChart ? (
        <div className="analytics-mix-panel__chart">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatCompactNumber(Number(value) || 0)} />
              <Tooltip
                formatter={(value, _name, details) => {
                  const dataKey = String(details.dataKey ?? "");
                  const series = data?.chart?.series.find((entry) => entry.key === dataKey);
                  return [formatSeriesValue(series, value), series?.label ?? dataKey];
                }}
              />
              <Legend />
              {data?.chart?.series.map((series, index) =>
                (series.type ?? "bar") === "line" ? (
                  <Line
                    key={series.key}
                    type="monotone"
                    dataKey={series.key}
                    name={series.label}
                    stroke={series.color ?? SERIES_COLORS[index % SERIES_COLORS.length]}
                    strokeWidth={2.5}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                ) : (
                  <Bar
                    key={series.key}
                    dataKey={series.key}
                    name={series.label}
                    fill={series.color ?? SERIES_COLORS[index % SERIES_COLORS.length]}
                    radius={[4, 4, 0, 0]}
                  />
                ),
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {hasRows ? (
        <div className="analytics-mix-panel__table-wrap">
          <table className="data-table analytics-mix-panel__table">
            <thead>
              <tr>
                {data?.columns.map((column) => (
                  <th key={column.key} className={column.align === "end" ? "cell-align-end" : ""}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.rows.map((row, index) => (
                <tr key={`${data.mixKey}-${index}`}>
                  {data.columns.map((column) => (
                    <td key={column.key} className={column.align === "end" ? "cell-align-end" : ""}>
                      {formatMetricValue(row[column.key], column.key, column.label)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && !error && !hasRows ? (
        <div className="analytics-mix-panel__empty">
          <p>No composite rows matched the current filters.</p>
        </div>
      ) : null}
    </section>
  );
}
