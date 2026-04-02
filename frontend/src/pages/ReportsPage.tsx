import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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

  const reportConfigs = allPages.filter(
    (page): page is DataPageConfig => page.kind === "data" && page.sectionKey === "data-report",
  );

  const activeTabPath =
    reportConfigs.find((config) => config.path === location.pathname)?.path ?? reportConfigs[0]?.path ?? "";
  const activeConfig = reportConfigs.find((config) => config.path === activeTabPath);

  const { stats, chartData } = buildReportAnalytics(
    activeConfig,
    reportSnapshot.rows,
    reportSnapshot.total,
    reportSnapshot.appliedFilters,
    trendMode,
  );

  const handleTabChange = (path: string) => {
    navigate(path);
  };

  const handleExport = () => {
    if (!activeConfig) {
      return;
    }

    downloadRowsAsCsv(activeConfig.title, activeConfig.columns, reportSnapshot.rows);
  };

  return (
    <div className="premium-dashboard">
      <div className="reports-hero">
        <div className="reports-hero-copy">
          <h1 className="reports-title">Data Reports</h1>
          <p className="reports-description">
            Filters and search are available in the selected report table. This shell only switches
            views and exports the current rows.
          </p>
        </div>
        <button
          className="button button-primary"
          onClick={handleExport}
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          Export CSV
        </button>
      </div>

      <ReportTabStrip activePath={activeTabPath} configs={reportConfigs} onChange={handleTabChange} />

      <ReportControlPanel
        onTrendModeChange={setTrendMode}
        onViewModeChange={setViewMode}
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
