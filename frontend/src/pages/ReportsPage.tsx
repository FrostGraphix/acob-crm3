import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnalyticsMixPanel } from "../components/analytics/AnalyticsMixPanel";
import { ReportContentPanel } from "../components/reports/ReportContentPanel";
import { ReportControlPanel } from "../components/reports/ReportControlPanel";
import { ReportTabStrip } from "../components/reports/ReportTabStrip";
import { allPages } from "../config/pageCatalog";
import { downloadRowsAsCsv } from "../services/client-table-actions";
import { buildReportAnalytics } from "../services/report-analytics";
import type { DataPageSnapshot } from "./DataPage";
import type { DataPageConfig } from "../types";

const emptySnapshot: DataPageSnapshot = {
  rows: [],
  total: 0,
  loading: false,
  error: null,
  appliedFilters: {},
};

export function ReportsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"data" | "chart">("data");
  const [trendMode, setTrendMode] = useState<"daily" | "monthly">("daily");
  const [reportSnapshot, setReportSnapshot] = useState<DataPageSnapshot>(emptySnapshot);

  const dashboardMixQuery = {
    from: "2000-01-01T00:00:00.000Z",
    to: new Date().toISOString(),
  };

  const reportConfigs = allPages.filter(
    (page): page is DataPageConfig =>
      page.kind === "data" &&
      (page.sectionKey === "data-report" || page.sectionKey === "load-profile"),
  );

  const activeTabPath =
    reportConfigs.find((config) => config.path === location.pathname)?.path ?? reportConfigs[0]?.path ?? "";
  const activeConfig = reportConfigs.find((config) => config.path === activeTabPath);
  const isAnalyticsReport = activeConfig?.reportDisplayMode === "analytics";
  const isConsumptionStatistics = activeConfig?.path === "/data-report/consumption-statistics";
  const isSiteConsumption = activeConfig?.path === "/data-report/site-consumption";

  const { stats: rawStats, chartData } = buildReportAnalytics(
    activeConfig,
    reportSnapshot.rows,
    reportSnapshot.total,
    reportSnapshot.appliedFilters,
    trendMode,
  );

  const stats = isSiteConsumption ? [] : rawStats;

  const handleTabChange = (path: string) => {
    navigate(path);
  };

  const handleExport = () => {
    if (!activeConfig) {
      return;
    }

    downloadRowsAsCsv(activeConfig.title, activeConfig.columns, reportSnapshot.rows);
  };

  const exportDisabled = reportSnapshot.rows.length === 0 || reportSnapshot.loading;

  return (
    <div className="premium-dashboard ds-page">
      {isConsumptionStatistics && (
        <div className="analytics-mix-grid mb-6">
          <AnalyticsMixPanel endpoint="/api/dashboard/risk-overlay" query={dashboardMixQuery} />
          <AnalyticsMixPanel endpoint="/api/dashboard/revenue-vs-usage" query={dashboardMixQuery} />
          <AnalyticsMixPanel endpoint="/api/dashboard/portfolio-health" query={dashboardMixQuery} />
          <AnalyticsMixPanel endpoint="/api/notifications/correlated-feed" query={{ limit: "8", ...dashboardMixQuery }} />
        </div>
      )}

      {!isAnalyticsReport && (
        <ReportTabStrip activePath={activeTabPath} configs={reportConfigs} onChange={handleTabChange} />
      )}

      <ReportControlPanel
        activeConfig={activeConfig}
        onTrendModeChange={setTrendMode}
        onViewModeChange={setViewMode}
        onExport={isSiteConsumption ? undefined : handleExport}
        exportDisabled={exportDisabled}
        stats={stats}
        total={reportSnapshot.total}
        trendMode={trendMode}
        viewMode={viewMode}
      />

      <ReportContentPanel
        activeConfig={activeConfig}
        chartData={chartData}
        reportSnapshot={reportSnapshot}
        setReportSnapshot={setReportSnapshot}
        trendMode={trendMode}
        viewMode={viewMode}
      />
    </div>
  );
}
