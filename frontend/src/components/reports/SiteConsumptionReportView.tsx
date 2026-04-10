import { useEffect, useMemo, useRef, useState } from "react";
import type { EChartsOption } from "echarts";
import { ReactEChartsCore, echarts } from "../../services/echarts";
import { MetricCard } from "../../design-system";
import {
  SITE_CONSUMPTION_SITES,
  createDefaultSiteConsumptionQuery,
  loadSiteConsumptionReport,
  type SiteConsumptionCompareMode,
  type SiteConsumptionGranularity,
  type SiteConsumptionReportQuery,
  type SiteConsumptionReportResponse,
} from "../../services/site-consumption-report";
import type { DataRow } from "../../types";
import type { DataPageSnapshot } from "../../pages/DataPage";

interface SiteConsumptionReportViewProps {
  onSnapshotChange: (snapshot: DataPageSnapshot) => void;
}

const siteColors = ["#16a34a", "#3b82f6", "#f59e0b", "#8b5cf6", "#14b8a6"];

function formatDateLabel(value: string | null) {
  if (!value) {
    return "Awaiting successful sync";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatValue(value: number | null, unitLabel: string) {
  if (value == null) {
    return "--";
  }

  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${unitLabel}`;
}

function buildTrendOption(
  report: SiteConsumptionReportResponse,
  query: SiteConsumptionReportQuery,
): EChartsOption {
  const selectedSeries = report.series.series.filter((entry) => query.sites.includes(entry.site));
  const unitLabel = report.units.label;

  if (query.compareMode === "combined") {
    const combinedValues = report.series.labels.map((_, index) =>
      selectedSeries.reduce((total, entry) => total + (entry.values[index] ?? 0), 0),
    );

    return {
      animationDuration: 500,
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
          typeof value === "number" ? `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${unitLabel}` : "",
      },
      grid: { top: 12, right: 14, bottom: 24, left: 52, containLabel: true },
      xAxis: {
        type: "category",
        data: report.series.labels,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "rgba(148, 163, 184, 0.18)" } },
        axisLabel: { color: "#94a3b8" },
      },
      yAxis: {
        type: "value",
        name: unitLabel,
        nameTextStyle: { color: "#94a3b8" },
        splitLine: { lineStyle: { color: "rgba(71, 85, 105, 0.42)", type: "dashed" } },
        axisLabel: { color: "#94a3b8" },
      },
      series: [
        {
          name: "Combined Consumption",
          type: "line",
          smooth: true,
          showSymbol: false,
          data: combinedValues,
          lineStyle: { width: 3, color: "#fbbf24" },
          itemStyle: { color: "#fbbf24" },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(251, 191, 36, 0.22)" },
              { offset: 1, color: "transparent" },
            ]),
          },
        },
      ],
    };
  }

  return {
    animationDuration: 500,
    legend: {
      bottom: 0,
      data: selectedSeries.map((entry) => entry.site),
      textStyle: { color: "#94a3b8" },
      icon: "circle",
    },
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
        typeof value === "number" ? `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${unitLabel}` : "",
    },
    grid: { top: 12, right: 14, bottom: 42, left: 52, containLabel: true },
    xAxis: {
      type: "category",
      data: report.series.labels,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "rgba(148, 163, 184, 0.18)" } },
      axisLabel: {
        color: "#94a3b8",
        rotate: report.series.labels.length > 10 ? 28 : 0,
      },
    },
    yAxis: {
      type: "value",
      name: unitLabel,
      nameTextStyle: { color: "#94a3b8" },
      splitLine: { lineStyle: { color: "rgba(71, 85, 105, 0.42)", type: "dashed" } },
      axisLabel: { color: "#94a3b8" },
    },
    series: selectedSeries.map((entry, index) => ({
      name: entry.site,
      type: "line",
      smooth: true,
      showSymbol: false,
      data: entry.values.map((value) => value ?? null),
      lineStyle: { width: 3, color: siteColors[index % siteColors.length] },
      itemStyle: { color: siteColors[index % siteColors.length] },
    })),
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

function toDataRows(report: SiteConsumptionReportResponse): DataRow[] {
  return report.rows.map((row) => ({
    periodLabel: row.periodLabel,
    site: row.site,
    consumption: row.consumption,
    unitLabel: row.unitLabel,
  }));
}

export function SiteConsumptionReportView({ onSnapshotChange }: SiteConsumptionReportViewProps) {
  const [query, setQuery] = useState<SiteConsumptionReportQuery>(createDefaultSiteConsumptionQuery);
  const [draftQuery, setDraftQuery] = useState<SiteConsumptionReportQuery>(createDefaultSiteConsumptionQuery);
  const [report, setReport] = useState<SiteConsumptionReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSuccessfulReport = useRef<SiteConsumptionReportResponse | null>(null);

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
        const next = await loadSiteConsumptionReport(query);
        if (!cancelled) {
          setReport(next);
          lastSuccessfulReport.current = next;
          const exportRows = toDataRows(next);
          onSnapshotChange({
            rows: exportRows,
            total: exportRows.length,
            loading: false,
            error: next.refreshStatus.lastError ?? null,
            appliedFilters: {
              fromDate: next.requestedRange.fromDate,
              toDate: next.requestedRange.toDate,
              granularity: next.granularity,
              sites: next.selectedSites.join(","),
              compareMode: next.compareMode,
            },
          });
        }
      } catch (caughtError) {
        if (!cancelled) {
          const message =
            caughtError instanceof Error ? caughtError.message : "Failed to load site consumption report.";
          setError(message);
          const preservedReport = lastSuccessfulReport.current;
          const exportRows = preservedReport ? toDataRows(preservedReport) : [];
          onSnapshotChange({
            rows: exportRows,
            total: exportRows.length,
            loading: false,
            error: message,
            appliedFilters: {
              fromDate: draftQuery.fromDate ?? "",
              toDate: draftQuery.toDate ?? "",
              granularity: draftQuery.granularity,
              sites: draftQuery.sites.join(","),
              compareMode: draftQuery.compareMode,
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
  }, [onSnapshotChange, query]);

  const totalConsumption = useMemo(
    () => report?.summary.reduce((total, entry) => total + (entry.totalConsumption ?? 0), 0) ?? 0,
    [report],
  );

  const visibleIssues = report?.issues ?? [];
  const trendOption = report ? buildTrendOption(report, query) : null;
  const selectedSiteCount = report?.selectedSites.length ?? draftQuery.sites.length;
  const compareModeLabel = draftQuery.compareMode === "combined" ? "Combined total" : "Compare sites";

  const applyDraftQuery = () => {
    setQuery({
      ...draftQuery,
      sites: draftQuery.sites.length > 0 ? draftQuery.sites : SITE_CONSUMPTION_SITES.slice(),
    });
  };

  const resetToDefault = () => {
    const defaults = createDefaultSiteConsumptionQuery();
    setDraftQuery(defaults);
    setQuery(defaults);
  };

  return (
    <section className="site-consumption-report" aria-live="polite">
      <div className="premium-card site-report-controls">
        <div className="site-report-simple-header">
          <div className="site-report-simple-copy">
            <strong>Simple flow</strong>
            <span>Choose dates and sites, click Show Result, then export if you need the rows.</span>
          </div>
          <div className="site-report-compact-meta">
            <span>{selectedSiteCount} site(s)</span>
            <span>{compareModeLabel}</span>
            <span>{refreshing ? "Updating result..." : `Last sync ${formatDateLabel(report?.lastUpdatedAt ?? null)}`}</span>
          </div>
        </div>
        <div className="site-report-control-grid">
          <label className="site-report-field">
            <span>From date</span>
            <input
              type="date"
              value={draftQuery.fromDate ?? ""}
              onChange={(event) =>
                setDraftQuery((current) => ({
                  ...current,
                  fromDate: event.target.value,
                }))
              }
            />
          </label>
          <label className="site-report-field">
            <span>To date</span>
            <input
              type="date"
              value={draftQuery.toDate ?? ""}
              onChange={(event) =>
                setDraftQuery((current) => ({
                  ...current,
                  toDate: event.target.value,
                }))
              }
            />
          </label>
          <label className="site-report-field">
            <span>Show by</span>
            <select
              value={draftQuery.granularity}
              onChange={(event) =>
                setDraftQuery((current) => ({
                  ...current,
                  granularity: event.target.value as SiteConsumptionGranularity,
                }))
              }
            >
              <option value="daily">Daily</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
          <label className="site-report-field">
            <span>Chart view</span>
            <select
              value={draftQuery.compareMode}
              onChange={(event) =>
                setDraftQuery((current) => ({
                  ...current,
                  compareMode: event.target.value as SiteConsumptionCompareMode,
                }))
              }
            >
              <option value="compare">Compare each site</option>
              <option value="combined">Add all sites together</option>
            </select>
          </label>
        </div>

        <div className="site-report-site-section">
          <p className="site-report-helper-copy">Pick one or more sites.</p>
          <div className="site-report-site-picker">
            {SITE_CONSUMPTION_SITES.map((site) => {
              const selected = draftQuery.sites.includes(site);
              return (
                <button
                  key={site}
                  className={`button ${selected ? "button-primary" : "button-ghost"}`}
                  onClick={() =>
                    setDraftQuery((current) => {
                      const sites = current.sites.includes(site)
                        ? current.sites.filter((entry) => entry !== site)
                        : [...current.sites, site];

                      return {
                        ...current,
                        sites,
                      };
                    })
                  }
                  type="button"
                >
                  {site}
                </button>
              );
            })}
          </div>
        </div>

        <div className="site-report-actions">
          <button
            className="button button-primary"
            onClick={applyDraftQuery}
            type="button"
            disabled={loading || refreshing}
          >
            {refreshing ? "Updating..." : "Show Result"}
          </button>
          <button
            className="button button-ghost"
            onClick={resetToDefault}
            type="button"
          >
            Start Over
          </button>
        </div>
      </div>

      {error ? <p className="status-banner status-banner-error">{error}</p> : null}
      {visibleIssues.length > 0 ? <p className="status-banner">{visibleIssues.join(" ")}</p> : null}

      <div className="site-report-kpi-grid">
        <MetricCard
          className="site-report-kpi"
          icon={<EnergyIcon />}
          label="Total consumption"
          meta={`${report?.units.label ?? "kWh"} across the current result`}
          tone="success"
          value={totalConsumption.toLocaleString("en-US", { maximumFractionDigits: 2 })}
        />
        <MetricCard
          className="site-report-kpi"
          icon={<SiteIcon />}
          label="Top site"
          meta={formatValue(report?.topSite?.totalConsumption ?? null, report?.units.label ?? "kWh")}
          tone="info"
          value={report?.topSite?.site ?? "--"}
        />
        <MetricCard
          className="site-report-kpi"
          icon={<CompareIcon />}
          label="Sites shown"
          meta={compareModeLabel}
          tone="neutral"
          value={selectedSiteCount}
        />
      </div>

      <section className="premium-chart-card">
        <div className="chart-header">
          <div>
            <h3 className="chart-title">Usage trend</h3>
            <span className="site-consumption-note">
              {query.compareMode === "combined"
                ? "One line showing the total for the selected sites."
                : "A simple comparison line for each selected site."}
            </span>
          </div>
        </div>
        <div className="site-report-chart-shell">
          {trendOption && report && report.series.labels.length > 0 ? (
            <ReactEChartsCore echarts={echarts} lazyUpdate notMerge option={trendOption} style={{ height: "100%", width: "100%" }} />
          ) : (
            <div className="site-report-empty">No trend data is available for the selected filters.</div>
          )}
        </div>
      </section>

      <section className="premium-card site-report-table-card">
        <div className="chart-header">
          <div>
            <h3 className="chart-title">Exportable Period Rows</h3>
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
                <th>Site</th>
                <th className="cell-align-end">Consumption</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {loading && !report ? (
                <tr>
                  <td className="table-empty" colSpan={4}>
                    Loading site consumption report...
                  </td>
                </tr>
              ) : report?.rows.length ? (
                report.rows.slice(0, 50).map((row) => (
                  <tr key={`${row.periodLabel}-${row.site}`}>
                    <td data-label="Period">{row.periodLabel}</td>
                    <td data-label="Site">{row.site}</td>
                    <td className="cell-align-end" data-label="Consumption">
                      {row.consumption?.toLocaleString("en-US", { maximumFractionDigits: 2 }) ?? "--"}
                    </td>
                    <td data-label="Unit">{row.unitLabel}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="table-empty" colSpan={4}>
                    No period rows are available for the selected filters.
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

function SiteIcon() {
  return <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h.01M15 10h.01M9 14h.01M15 14h.01" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function CompareIcon() {
  return <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M4 7h10M4 12h16M4 17h7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
