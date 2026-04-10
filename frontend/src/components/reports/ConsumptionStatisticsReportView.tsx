import { useEffect, useMemo, useRef, useState } from "react";
import type { EChartsOption } from "echarts";
import { ReactEChartsCore, echarts } from "../../services/echarts";
import { MetricCard } from "../../design-system";
import {
  applyConsumptionStatisticsRangePreset,
  createConsumptionStatisticsRange,
  createDefaultConsumptionStatisticsQuery,
  loadConsumptionStatisticsReport,
  type ConsumptionStatisticsChartGranularity,
  type ConsumptionStatisticsMetric,
  type ConsumptionStatisticsQuery,
  type ConsumptionStatisticsRangePreset,
  type ConsumptionStatisticsReport,
} from "../../services/consumption-statistics-report";
import type { DataPageSnapshot } from "../../pages/DataPage";
import type { DataPageConfig, DataRow } from "../../types";

interface ConsumptionStatisticsReportViewProps {
  page: DataPageConfig;
  onSnapshotChange: (snapshot: DataPageSnapshot) => void;
}

type ConsumptionStatisticsUiRangePreset = ConsumptionStatisticsRangePreset | "custom";

interface QuickResultOption {
  key: string;
  label: string;
  description: string;
  buildQuery: (referenceDate: Date) => ConsumptionStatisticsQuery;
}

function formatDateLabel(value: string | null) {
  if (!value) {
    return "--";
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(parsed);
}

function formatMetricLabel(metric: ConsumptionStatisticsMetric) {
  return metric === "totalEnergy" ? "Total Energy" : "Consumption";
}

function formatMetricPrompt(metric: ConsumptionStatisticsMetric) {
  return metric === "totalEnergy" ? "Total energy used" : "How much power was used";
}

function formatRangePresetLabel(preset: ConsumptionStatisticsUiRangePreset) {
  if (preset === "thisMonth") {
    return "This month";
  }

  if (preset === "last30Days") {
    return "Last 30 days";
  }

  if (preset === "thisYear") {
    return "This year";
  }

  return "Custom dates";
}

function formatNumber(value: number | null, suffix = "") {
  if (value == null) {
    return "--";
  }

  const formatted = value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });

  return suffix ? `${formatted} ${suffix}` : formatted;
}

function toSnapshotRows(report: ConsumptionStatisticsReport): DataRow[] {
  return report.rows.map((row) => ({
    periodLabel: row.periodLabel,
    customerId: row.customerId,
    customerName: row.customerName,
    meterId: row.meterId,
    consumption: row.consumption,
    totalEnergy: row.totalEnergy,
  }));
}

function buildTrendOption(report: ConsumptionStatisticsReport): EChartsOption {
  const metricLabel = formatMetricLabel(report.metric);

  return {
    animationDuration: 450,
    tooltip: {
      trigger: "axis",
      backgroundColor: "#111b31",
      borderColor: "rgba(148, 163, 184, 0.18)",
      borderWidth: 1,
      extraCssText: "border-radius: 14px; box-shadow: 0 18px 44px rgba(2, 6, 23, 0.34);",
      textStyle: {
        color: "#e5eefc",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      },
      valueFormatter: (value) =>
        typeof value === "number"
          ? `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} kWh`
          : "",
    },
    grid: { top: 12, right: 14, bottom: 24, left: 52, containLabel: true },
    xAxis: {
      type: "category",
      data: report.chart.labels,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "rgba(148, 163, 184, 0.18)" } },
      axisLabel: {
        color: "#94a3b8",
        rotate: report.chart.labels.length > 10 ? 28 : 0,
      },
    },
    yAxis: {
      type: "value",
      name: "kWh",
      nameTextStyle: { color: "#94a3b8" },
      splitLine: { lineStyle: { color: "rgba(71, 85, 105, 0.42)", type: "dashed" } },
      axisLabel: { color: "#94a3b8" },
    },
    series: [
      {
        name: metricLabel,
        type: "line",
        smooth: true,
        showSymbol: false,
        data: report.chart.values,
        lineStyle: { width: 3, color: "#fbbf24" },
        itemStyle: { color: "#fbbf24" },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(251, 191, 36, 0.22)" },
            { offset: 1, color: "transparent" },
          ]),
        },
        markLine: {
          silent: true,
          symbol: "none",
          label: {
            formatter: `Avg ${metricLabel}`,
            color: "#94a3b8",
          },
          lineStyle: {
            color: "#60a5fa",
            type: "dashed",
          },
          data: [{ yAxis: report.chart.averageValue }],
        },
      },
    ],
  };
}

function buildRankingOption(report: ConsumptionStatisticsReport): EChartsOption {
  const metricLabel = formatMetricLabel(report.metric);

  return {
    animationDuration: 450,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "#111b31",
      borderColor: "rgba(148, 163, 184, 0.18)",
      borderWidth: 1,
      extraCssText: "border-radius: 14px; box-shadow: 0 18px 44px rgba(2, 6, 23, 0.34);",
      textStyle: {
        color: "#e5eefc",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      },
      valueFormatter: (value) =>
        typeof value === "number"
          ? `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} kWh`
          : "",
    },
    grid: { top: 14, right: 18, bottom: 16, left: 18, containLabel: true },
    xAxis: {
      type: "value",
      name: "kWh",
      nameTextStyle: { color: "#94a3b8" },
      splitLine: { lineStyle: { color: "rgba(71, 85, 105, 0.42)", type: "dashed" } },
      axisLabel: { color: "#94a3b8" },
    },
    yAxis: {
      type: "category",
      data: report.ranking.map((entry) => entry.label),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "rgba(148, 163, 184, 0.18)" } },
      axisLabel: { color: "#94a3b8" },
    },
    series: [
      {
        name: metricLabel,
        type: "bar",
        data: report.ranking.map((entry) => entry.value),
        barMaxWidth: 26,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
            { offset: 0, color: "#84cc16" },
            { offset: 1, color: "#16a34a" },
          ]),
          borderRadius: [0, 10, 10, 0],
        },
      },
    ],
  };
}

function createEmptySnapshot(): DataPageSnapshot {
  return {
    rows: [],
    total: 0,
    loading: true,
    error: null,
    appliedFilters: {},
  };
}

function hasAdvancedSearch(query: ConsumptionStatisticsQuery) {
  return query.customerId.trim().length > 0 || query.meterId.trim().length > 0;
}

function inferRangePreset(
  query: ConsumptionStatisticsQuery,
  referenceDate: Date,
): ConsumptionStatisticsUiRangePreset {
  for (const preset of ["thisMonth", "last30Days", "thisYear"] as const) {
    const range = createConsumptionStatisticsRange(preset, referenceDate);
    if (range.fromDate === query.fromDate && range.toDate === query.toDate) {
      return preset;
    }
  }

  return "custom";
}

function createQuickResultOptions(): QuickResultOption[] {
  return [
    {
      key: "overview",
      label: "Quick Overview",
      description: "Best first answer for the whole year.",
      buildQuery: (referenceDate) => ({
        ...createDefaultConsumptionStatisticsQuery(referenceDate),
        metric: "consumption",
        chartGranularity: "monthly",
      }),
    },
    {
      key: "month",
      label: "This Month",
      description: "See daily usage for the current month.",
      buildQuery: (referenceDate) => ({
        ...applyConsumptionStatisticsRangePreset(
          createDefaultConsumptionStatisticsQuery(referenceDate),
          "thisMonth",
          referenceDate,
        ),
        metric: "consumption",
        chartGranularity: "daily",
      }),
    },
    {
      key: "energy",
      label: "Energy Check",
      description: "Switch to total energy with one click.",
      buildQuery: (referenceDate) => ({
        ...createDefaultConsumptionStatisticsQuery(referenceDate),
        metric: "totalEnergy",
        chartGranularity: "monthly",
      }),
    },
    {
      key: "last30",
      label: "Last 30 Days",
      description: "Short recent trend without extra setup.",
      buildQuery: (referenceDate) => ({
        ...applyConsumptionStatisticsRangePreset(
          createDefaultConsumptionStatisticsQuery(referenceDate),
          "last30Days",
          referenceDate,
        ),
        metric: "consumption",
        chartGranularity: "daily",
      }),
    },
  ];
}

export function ConsumptionStatisticsReportView({
  page,
  onSnapshotChange,
}: ConsumptionStatisticsReportViewProps) {
  const referenceDateRef = useRef(new Date());
  const [query, setQuery] = useState<ConsumptionStatisticsQuery>(createDefaultConsumptionStatisticsQuery);
  const [draftQuery, setDraftQuery] = useState<ConsumptionStatisticsQuery>(createDefaultConsumptionStatisticsQuery);
  const [rangePreset, setRangePreset] = useState<ConsumptionStatisticsUiRangePreset>("thisYear");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [report, setReport] = useState<ConsumptionStatisticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSuccessfulReport = useRef<ConsumptionStatisticsReport | null>(null);
  const quickResultOptions = useMemo(() => createQuickResultOptions(), []);

  useEffect(() => {
    onSnapshotChange(createEmptySnapshot());
  }, [onSnapshotChange]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(lastSuccessfulReport.current == null);
      setRefreshing(lastSuccessfulReport.current != null);
      setError(null);

      try {
        const next = await loadConsumptionStatisticsReport(page, query);
        if (!cancelled) {
          setReport(next);
          lastSuccessfulReport.current = next;
          const rows = toSnapshotRows(next);
          onSnapshotChange({
            rows,
            total: rows.length,
            loading: false,
            error: null,
            appliedFilters: {
              customerId: query.customerId,
              meterId: query.meterId,
              fromDate: query.fromDate,
              toDate: query.toDate,
              metric: query.metric,
              chartGranularity: query.chartGranularity,
            },
          });
        }
      } catch (caughtError) {
        if (!cancelled) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Failed to load consumption statistics.";
          setError(message);
          const preservedReport = lastSuccessfulReport.current;
          const rows = preservedReport ? toSnapshotRows(preservedReport) : [];
          onSnapshotChange({
            rows,
            total: rows.length,
            loading: false,
            error: message,
            appliedFilters: {
              customerId: draftQuery.customerId,
              meterId: draftQuery.meterId,
              fromDate: draftQuery.fromDate,
              toDate: draftQuery.toDate,
              metric: draftQuery.metric,
              chartGranularity: draftQuery.chartGranularity,
            },
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [onSnapshotChange, page, query]);

  const trendOption = useMemo(
    () => (report && report.chart.labels.length > 0 ? buildTrendOption(report) : null),
    [report],
  );
  const rankingOption = useMemo(
    () => (report && report.ranking.length > 0 ? buildRankingOption(report) : null),
    [report],
  );

  const applyDraftQuery = () => {
    setRangePreset(inferRangePreset(draftQuery, referenceDateRef.current));
    setQuery({ ...draftQuery });
  };

  const metricLabel = formatMetricLabel(report?.metric ?? draftQuery.metric);
  const activeRangeLabel = formatRangePresetLabel(rangePreset);
  const currentMetricPrompt = formatMetricPrompt(draftQuery.metric);

  const handleQuickResult = (option: QuickResultOption) => {
    const next = option.buildQuery(referenceDateRef.current);
    setRangePreset(inferRangePreset(next, referenceDateRef.current));
    setShowAdvancedFilters(false);
    setDraftQuery(next);
    setQuery(next);
  };

  const handleMetricChange = (metric: ConsumptionStatisticsMetric) => {
    setDraftQuery((current) => ({
      ...current,
      metric,
    }));
  };

  const handleGranularityChange = (chartGranularity: ConsumptionStatisticsChartGranularity) => {
    setDraftQuery((current) => ({
      ...current,
      chartGranularity,
    }));
  };

  const handleRangePresetChange = (preset: ConsumptionStatisticsRangePreset) => {
    setRangePreset(preset);
    setDraftQuery((current) =>
      applyConsumptionStatisticsRangePreset(current, preset, referenceDateRef.current),
    );
  };

  const resetToDefault = () => {
    const defaults = createDefaultConsumptionStatisticsQuery(referenceDateRef.current);
    setRangePreset("thisYear");
    setShowAdvancedFilters(false);
    setDraftQuery(defaults);
    setQuery(defaults);
  };

  return (
    <section className="site-consumption-report" aria-live="polite">
      <div className="site-report-hero">
        <div>
          <span className="site-report-eyebrow">Endpoint Analytics</span>
          <h2 className="site-report-title">{page.title}</h2>
          <p className="site-report-description">
            {page.description} Use the quick buttons below for the fastest path, then open advanced search only if
            you need one customer, one meter, or custom dates.
          </p>
        </div>
        <div className="site-report-meta">
          <span className="dashboard-meta-pill dashboard-meta-pill-monitor">
            Range {activeRangeLabel}
          </span>
          <span className="dashboard-meta-pill dashboard-meta-pill-stable">
            Result {metricLabel}
          </span>
          <span className="dashboard-meta-pill dashboard-meta-pill-stable">
            View {query.chartGranularity}
          </span>
          {refreshing ? (
            <span className="dashboard-meta-pill dashboard-meta-pill-critical">Refreshing</span>
          ) : null}
        </div>
      </div>

      <div className="premium-card site-report-quick-start">
        <div className="site-report-quick-start-copy">
          <strong>Need a result fast?</strong>
          <span>Pick one quick result and the report updates right away.</span>
        </div>
        <div className="site-report-quick-grid">
          {quickResultOptions.map((option) => (
            <button
              key={option.key}
              className="site-report-quick-card"
              onClick={() => handleQuickResult(option)}
              title={option.description}
              type="button"
            >
              <strong>{option.label}</strong>
              <span>{option.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="premium-card site-report-controls">
        <div className="site-report-flow-row">
          <div className="site-report-flow-copy">
            <strong>Simple flow</strong>
            <span>1. Pick a quick result or choose dropdowns. 2. Click Show Result. 3. Export if needed.</span>
          </div>
          <button
            className="button button-ghost"
            onClick={() => setShowAdvancedFilters((current) => !current)}
            type="button"
          >
            {showAdvancedFilters || hasAdvancedSearch(draftQuery)
              ? "Hide Advanced Search"
              : "Advanced Search & Custom Dates"}
          </button>
        </div>

        <div className="site-report-simple-grid">
          <label className="site-report-field">
            <span>Show me</span>
            <select
              value={draftQuery.metric}
              onChange={(event) => handleMetricChange(event.target.value as ConsumptionStatisticsMetric)}
            >
              <option value="consumption">How much power was used</option>
              <option value="totalEnergy">Total energy used</option>
            </select>
            <small className="site-report-field-hint">Choose the answer you want to see.</small>
          </label>
          <label className="site-report-field">
            <span>Show it by</span>
            <select
              value={draftQuery.chartGranularity}
              onChange={(event) =>
                handleGranularityChange(event.target.value as ConsumptionStatisticsChartGranularity)
              }
            >
              <option value="daily">Daily</option>
              <option value="monthly">Monthly</option>
            </select>
            <small className="site-report-field-hint">Pick how the chart should group the result.</small>
          </label>
          <label className="site-report-field">
            <span>Time range</span>
            <div className="site-report-preset-row">
              {([
                { key: "thisMonth", label: "This Month" },
                { key: "last30Days", label: "Last 30 Days" },
                { key: "thisYear", label: "This Year" },
              ] as const).map((preset) => (
                <button
                  key={preset.key}
                  className={`mini-button ${
                    rangePreset === preset.key ? "button-primary" : "button-ghost"
                  }`}
                  onClick={() => handleRangePresetChange(preset.key)}
                  type="button"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <small className="site-report-field-hint">Need exact dates? Open advanced search.</small>
          </label>
        </div>

        {showAdvancedFilters || hasAdvancedSearch(draftQuery) || rangePreset === "custom" ? (
          <div className="site-report-advanced-grid">
            <label className="site-report-field">
              <span>Customer Id (optional)</span>
              <input
                type="text"
                value={draftQuery.customerId}
                onChange={(event) =>
                  setDraftQuery((current) => ({
                    ...current,
                    customerId: event.target.value,
                  }))
                }
              />
            </label>
            <label className="site-report-field">
              <span>Meter Id (optional)</span>
              <input
                type="text"
                value={draftQuery.meterId}
                onChange={(event) =>
                  setDraftQuery((current) => ({
                    ...current,
                    meterId: event.target.value,
                  }))
                }
              />
            </label>
            <label className="site-report-field">
              <span>From date</span>
              <input
                type="date"
                value={draftQuery.fromDate}
                onChange={(event) => {
                  setRangePreset("custom");
                  setDraftQuery((current) => ({
                    ...current,
                    fromDate: event.target.value,
                  }));
                }}
              />
            </label>
            <label className="site-report-field">
              <span>To date</span>
              <input
                type="date"
                value={draftQuery.toDate}
                onChange={(event) => {
                  setRangePreset("custom");
                  setDraftQuery((current) => ({
                    ...current,
                    toDate: event.target.value,
                  }));
                }}
              />
            </label>
          </div>
        ) : (
          <p className="site-report-helper-copy">
            Current setup: <strong>{currentMetricPrompt}</strong> for <strong>{activeRangeLabel}</strong>. Open
            advanced search only when you want one customer, one meter, or exact custom dates.
          </p>
        )}

        <div className="site-report-actions">
          <button className="button button-primary" onClick={applyDraftQuery} type="button" disabled={loading}>
            Show Result
          </button>
          <button
            className="button button-ghost"
            onClick={resetToDefault}
            type="button"
          >
            Start Over
          </button>
          <button
            className="button button-ghost"
            onClick={() => setQuery((current) => ({ ...current }))}
            type="button"
            disabled={refreshing}
          >
            Reload
          </button>
        </div>
      </div>

      {error ? <p className="status-banner status-banner-error">{error}</p> : null}

      <div className="site-report-kpi-grid">
        <MetricCard
          className="site-report-kpi"
          icon={<EnergyIcon />}
          label={`Total ${metricLabel.toLowerCase()}`}
          meta="kWh across loaded endpoint rows"
          tone="success"
          value={formatNumber(report?.summary.totalValue ?? null)}
        />
        <MetricCard
          className="site-report-kpi"
          icon={<AverageIcon />}
          label="Average row value"
          meta={`Average ${metricLabel.toLowerCase()} per loaded row`}
          tone="info"
          value={formatNumber(report?.summary.averageValue ?? null)}
        />
        <MetricCard
          className="site-report-kpi"
          icon={<PeakIcon />}
          label="Peak period"
          meta={formatNumber(report?.summary.peakPeriodValue ?? null, "kWh")}
          tone="warning"
          value={report?.summary.peakPeriodLabel ? formatDateLabel(report.summary.peakPeriodLabel) : "--"}
        />
        <MetricCard
          className="site-report-kpi"
          icon={<MeterIcon />}
          label="Distinct meters"
          meta={`${report?.distinctCustomers ?? 0} distinct customers in rows`}
          tone="neutral"
          value={report?.distinctMeters ?? 0}
        />
      </div>

      <div className="site-report-chart-grid">
        <section className="premium-chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">{metricLabel} Trend</h3>
              <span className="site-consumption-note">
                Grouped {report?.chartGranularity ?? draftQuery.chartGranularity} from the endpoint response.
              </span>
            </div>
          </div>
          <div className="site-report-chart-shell">
            {trendOption ? (
              <ReactEChartsCore
                echarts={echarts}
                lazyUpdate
                notMerge
                option={trendOption}
                style={{ height: "100%", width: "100%" }}
              />
            ) : (
              <div className="site-report-empty">No trend data is available for the selected filters.</div>
            )}
          </div>
        </section>

        <section className="premium-chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Top Meter Ranking</h3>
              <span className="site-consumption-note">
                Highest contributing meters across the current filtered dataset.
              </span>
            </div>
          </div>
          <div className="site-report-chart-shell">
            {rankingOption ? (
              <ReactEChartsCore
                echarts={echarts}
                lazyUpdate
                notMerge
                option={rankingOption}
                style={{ height: "100%", width: "100%" }}
              />
            ) : (
              <div className="site-report-empty">No ranking data is available for the selected filters.</div>
            )}
          </div>
        </section>
      </div>

      <section className="premium-card site-report-table-card">
        <div className="chart-header">
          <div>
            <h3 className="chart-title">Exportable Endpoint Rows</h3>
            <span className="site-consumption-note">
              The shared report export button downloads these filtered rows as CSV.
            </span>
          </div>
        </div>
        <div className="site-report-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Customer Id</th>
                <th>Customer Name</th>
                <th>Meter Id</th>
                <th className="cell-align-end">Consumption</th>
                <th className="cell-align-end">Total Energy</th>
              </tr>
            </thead>
            <tbody>
              {loading && !report ? (
                <tr>
                  <td className="table-empty" colSpan={6}>
                    Loading consumption statistics...
                  </td>
                </tr>
              ) : report?.rows.length ? (
                report.rows.slice(0, 50).map((row, index) => (
                  <tr key={`${row.periodLabel}-${row.meterId}-${index}`}>
                    <td data-label="Period">{formatDateLabel(row.periodLabel)}</td>
                    <td data-label="Customer Id">{row.customerId || "--"}</td>
                    <td data-label="Customer Name">{row.customerName || "--"}</td>
                    <td data-label="Meter Id">{row.meterId || "--"}</td>
                    <td className="cell-align-end" data-label="Consumption">
                      {row.consumption?.toLocaleString("en-US", { maximumFractionDigits: 2 }) ?? "--"}
                    </td>
                    <td className="cell-align-end" data-label="Total Energy">
                      {row.totalEnergy?.toLocaleString("en-US", { maximumFractionDigits: 2 }) ?? "--"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="table-empty" colSpan={6}>
                    No endpoint rows are available for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function EnergyIcon() {
  return <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function AverageIcon() {
  return <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M4 12h4l2.5-6 4 12 2.5-6H20" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function PeakIcon() {
  return <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M7 17 17 7M10 7h7v7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function MeterIcon() {
  return <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M6 4h12v16H6zM9 8h6M9 12h6M12 16h.01" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
