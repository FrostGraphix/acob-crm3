import { useEffect, useMemo, useRef, useState } from "react";
import type { EChartsOption } from "echarts";
import { ReactEChartsCore, echarts } from "../../services/echarts";
import { MetricCard } from "../../design-system";
import { AnalyticsMixPanel } from "../analytics/AnalyticsMixPanel";
import { Modal } from "../ui/Modal";
import {
  loadManagementMeterConsumption,
  type ManagementMeterConsumptionRow,
} from "../../services/management-analytics";
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

function toCustomerSnapshotRows(rows: ManagementMeterConsumptionRow[]): DataRow[] {
  return rows.map((row) => ({
    customerName: row.customerName,
    meterId: row.meterId,
    site: row.site,
    totalKwh: row.totalKwh,
    dayKwh: row.dayKwh,
    nightKwh: row.nightKwh,
    percentDay: row.percentDay,
    snapshotDate: row.snapshotDate,
    updatedAt: row.updatedAt,
  }));
}

export function SiteConsumptionReportView({ onSnapshotChange }: SiteConsumptionReportViewProps) {
  const customerTableLimit = 500;
  const [query, setQuery] = useState<SiteConsumptionReportQuery>(createDefaultSiteConsumptionQuery);
  const [draftQuery, setDraftQuery] = useState<SiteConsumptionReportQuery>(createDefaultSiteConsumptionQuery);
  const [report, setReport] = useState<SiteConsumptionReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerSite, setCustomerSite] = useState<string>("ALL");
  const [customerRows, setCustomerRows] = useState<ManagementMeterConsumptionRow[]>([]);
  const [customerLoading, setCustomerLoading] = useState(true);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [customerSites, setCustomerSites] = useState<string[]>(SITE_CONSUMPTION_SITES.slice());
  const [selectedCustomer, setSelectedCustomer] = useState<ManagementMeterConsumptionRow | null>(null);
  const lastSuccessfulReport = useRef<SiteConsumptionReportResponse | null>(null);
  const lastSuccessfulCustomerRows = useRef<ManagementMeterConsumptionRow[]>([]);
  const draftAppliedFilters = useMemo(
    () => ({
      fromDate: draftQuery.fromDate ?? "",
      toDate: draftQuery.toDate ?? "",
      granularity: draftQuery.granularity,
      sites: draftQuery.sites.join(","),
      compareMode: draftQuery.compareMode,
    }),
    [draftQuery.compareMode, draftQuery.fromDate, draftQuery.granularity, draftQuery.sites, draftQuery.toDate],
  );

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
        }
      } catch (caughtError) {
        if (!cancelled) {
          const message =
            caughtError instanceof Error ? caughtError.message : "Failed to load site consumption report.";
          setError(message);
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
  }, [draftAppliedFilters, onSnapshotChange, query]);

  useEffect(() => {
    let cancelled = false;

    async function loadCustomerConsumption() {
      setCustomerLoading(true);
      setCustomerError(null);

      try {
        const next = await loadManagementMeterConsumption(
          customerSite === "ALL" ? null : customerSite,
          customerTableLimit,
        );
        if (!cancelled) {
          const availableSites =
            next.availableSites.length > 0 ? next.availableSites : SITE_CONSUMPTION_SITES.slice();
          setCustomerSites(availableSites);
          setCustomerRows(next.rows);
          lastSuccessfulCustomerRows.current = next.rows;
          onSnapshotChange({
            rows: toCustomerSnapshotRows(next.rows),
            total: next.rows.length,
            loading: false,
            error: null,
            appliedFilters: {
              site: customerSite,
              fromDate: query.fromDate ?? "",
              toDate: query.toDate ?? "",
              granularity: query.granularity,
              compareMode: query.compareMode,
              exportSource: "customer-consumption-by-site",
            },
          });
        }
      } catch (caughtError) {
        if (!cancelled) {
          const message =
            caughtError instanceof Error ? caughtError.message : "Failed to load customer consumption table.";
          const preservedRows = lastSuccessfulCustomerRows.current;
          setCustomerError(message);
          setCustomerRows(preservedRows);
          onSnapshotChange({
            rows: toCustomerSnapshotRows(preservedRows),
            total: preservedRows.length,
            loading: false,
            error: message,
            appliedFilters: {
              site: customerSite,
              fromDate: query.fromDate ?? "",
              toDate: query.toDate ?? "",
              granularity: query.granularity,
              compareMode: query.compareMode,
              exportSource: "customer-consumption-by-site",
            },
          });
        }
      } finally {
        if (!cancelled) {
          setCustomerLoading(false);
        }
      }
    }

    void loadCustomerConsumption();

    return () => {
      cancelled = true;
    };
  }, [customerSite, onSnapshotChange, query.compareMode, query.fromDate, query.granularity, query.toDate]);

  useEffect(() => {
    if (!selectedCustomer) {
      return;
    }

    const stillVisible = customerRows.some(
      (row) => row.meterId === selectedCustomer.meterId && row.site === selectedCustomer.site,
    );

    if (!stillVisible) {
      setSelectedCustomer(null);
    }
  }, [customerRows, selectedCustomer]);

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
      {error ? <p className="status-banner status-banner-error">{error}</p> : null}
      {customerError ? <p className="status-banner status-banner-error">{customerError}</p> : null}
      {visibleIssues.length > 0 ? <p className="status-banner">{visibleIssues.join(" ")}</p> : null}

      <section className="premium-card site-report-table-card">
        <div className="chart-header">
          <div>
            <h3 className="chart-title">Customer Consumption by Site</h3>
            <span className="site-consumption-note">
              The shared report export button now downloads this customer table as CSV.
            </span>
          </div>
          <div className="site-report-table-meta">
            <span>{customerSite === "ALL" ? "All sites" : customerSite}</span>
            <span>{customerRows.length.toLocaleString("en-US")} customers</span>
          </div>
        </div>
        <div className="site-report-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Meter Id</th>
                <th>Site</th>
                <th className="cell-align-end">Total kWh</th>
                <th className="cell-align-end">Day kWh</th>
                <th className="cell-align-end">Night kWh</th>
                <th className="cell-align-end">Day %</th>
                <th>Snapshot</th>
              </tr>
            </thead>
            <tbody>
              {customerLoading ? (
                <tr>
                  <td className="table-empty" colSpan={8}>
                    Loading customer consumption table...
                  </td>
                </tr>
              ) : customerRows.length ? (
                customerRows.map((row) => (
                  <tr
                    key={`${row.meterId}-${row.site}`}
                    className="table-row-clickable site-customer-row"
                    onClick={() => setSelectedCustomer(row)}
                  >
                    <td data-label="Customer">
                      <button className="site-customer-link" type="button" onClick={() => setSelectedCustomer(row)}>
                        {row.customerName || "Unnamed customer"}
                      </button>
                    </td>
                    <td data-label="Meter Id">{row.meterId || "--"}</td>
                    <td data-label="Site">{row.site || "--"}</td>
                    <td className="cell-align-end" data-label="Total kWh">
                      {row.totalKwh.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="cell-align-end" data-label="Day kWh">
                      {row.dayKwh.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="cell-align-end" data-label="Night kWh">
                      {row.nightKwh.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="cell-align-end" data-label="Day %">
                      {row.percentDay.toLocaleString("en-US", { maximumFractionDigits: 0 })}%
                    </td>
                    <td data-label="Snapshot">{row.snapshotDate ?? "--"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="table-empty" colSpan={8}>
                    No customer consumption rows are available for the selected site.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={selectedCustomer != null}
        onClose={() => setSelectedCustomer(null)}
        size="xl"
        subtitle={
          selectedCustomer
            ? `${selectedCustomer.site || "Unknown site"} • Meter ${selectedCustomer.meterId || "--"}`
            : undefined
        }
        title={selectedCustomer?.customerName || "Customer analytics"}
      >
        {selectedCustomer ? (
          <div className="site-customer-modal">
            <div className="site-customer-modal__summary">
              <MetricCard
                className="site-report-kpi"
                icon={<EnergyIcon />}
                label="Total consumption"
                meta="Current selected site snapshot"
                tone="success"
                value={selectedCustomer.totalKwh.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              />
              <MetricCard
                className="site-report-kpi"
                icon={<DayIcon />}
                label="Day consumption"
                meta={`${selectedCustomer.percentDay}% of total`}
                tone="info"
                value={selectedCustomer.dayKwh.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              />
              <MetricCard
                className="site-report-kpi"
                icon={<NightIcon />}
                label="Night consumption"
                meta={selectedCustomer.snapshotDate ?? "No snapshot date"}
                tone="neutral"
                value={selectedCustomer.nightKwh.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              />
            </div>
            <AnalyticsMixPanel endpoint="/api/customer/360-lite" query={{ meterId: selectedCustomer.meterId }} />
          </div>
        ) : null}
      </Modal>
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

function DayIcon() {
  return <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364-1.414-1.414M7.05 7.05 5.636 5.636m12.728 0L16.95 7.05M7.05 16.95l-1.414 1.414M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function NightIcon() {
  return <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
