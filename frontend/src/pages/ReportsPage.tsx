import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, PageHeader, Surface } from "../design-system";
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
    (page): page is DataPageConfig =>
      page.kind === "data" &&
      (page.sectionKey === "data-report" || page.sectionKey === "load-profile"),
  );

  const activeTabPath =
    reportConfigs.find((config) => config.path === location.pathname)?.path ?? reportConfigs[0]?.path ?? "";
  const activeConfig = reportConfigs.find((config) => config.path === activeTabPath);
  const minimalSiteConsumptionShell =
    activeConfig?.reportDisplayMode === "analytics" &&
    activeConfig.reportAnalyticsKey === "site-consumption";
  const groupedReportConfigs = {
    dataReports: reportConfigs.filter((config) => config.sectionKey === "data-report"),
    loadProfiles: reportConfigs.filter((config) => config.sectionKey === "load-profile"),
  };

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

  const exportDisabled = reportSnapshot.rows.length === 0 || reportSnapshot.loading;

  return (
    <div className="premium-dashboard ds-page">
      <PageHeader
        actions={(
          <Button disabled={exportDisabled} onClick={handleExport} tone="primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            Export Current Result
          </Button>
        )}
        className="reports-hero"
        description={
          minimalSiteConsumptionShell
            ? "Open a report, set the few options you need, and export when the result looks right."
            : "Pick a report, use the quick options inside it, and export the result when you are done."
        }
        eyebrow="Reporting workspace"
        meta={
          minimalSiteConsumptionShell ? (
            <label className="reports-picker-field reports-picker-field--compact">
              <span>Open report</span>
              <select value={activeTabPath} onChange={(event) => handleTabChange(event.target.value)}>
                <optgroup label="Data Reports">
                  {groupedReportConfigs.dataReports.map((config) => (
                    <option key={config.path} value={config.path}>
                      {config.menuLabel}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Load Profile">
                  {groupedReportConfigs.loadProfiles.map((config) => (
                    <option key={config.path} value={config.path}>
                      {config.menuLabel}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          ) : null
        }
        title="Data Reports"
      />

      {!minimalSiteConsumptionShell ? (
        <>
          <Surface className="premium-card reports-guide-card" tone="hero">
            <div className="reports-guide-steps" aria-label="Simple report steps">
              <span>1. Pick a report</span>
              <span>2. Use a quick button or dropdown</span>
              <span>3. Export the result if needed</span>
            </div>
            <div className="reports-picker-row">
              <label className="reports-picker-field">
                <span>Open report</span>
                <select value={activeTabPath} onChange={(event) => handleTabChange(event.target.value)}>
                  <optgroup label="Data Reports">
                    {groupedReportConfigs.dataReports.map((config) => (
                      <option key={config.path} value={config.path}>
                        {config.menuLabel}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Load Profile">
                    {groupedReportConfigs.loadProfiles.map((config) => (
                      <option key={config.path} value={config.path}>
                        {config.menuLabel}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>

              {activeConfig ? (
                <div className="reports-current-card">
                  <strong>{activeConfig.menuLabel}</strong>
                  <span>{activeConfig.description}</span>
                </div>
              ) : null}
            </div>
          </Surface>

          <ReportTabStrip activePath={activeTabPath} configs={reportConfigs} onChange={handleTabChange} />

          <ReportControlPanel
            activeConfig={activeConfig}
            onTrendModeChange={setTrendMode}
            onViewModeChange={setViewMode}
            stats={stats}
            total={reportSnapshot.total}
            trendMode={trendMode}
            viewMode={viewMode}
          />
        </>
      ) : null}

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
