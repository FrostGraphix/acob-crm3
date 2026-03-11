import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { TrendChart } from "../components/charts/TrendChart";
import { StatCard } from "../components/common/StatCard";
import { allPages } from "../config/pageCatalog";
import { downloadRowsAsCsv } from "../services/client-table-actions";
import { buildReportAnalytics } from "../services/report-analytics";
import type { DataPageSnapshot } from "./DataPage";
import { DataPage } from "./DataPage";
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
    reportConfigs.find((config) => config.path === location.pathname)?.path ??
    reportConfigs[0]?.path ??
    "";
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

  const showTrendMode = activeConfig?.path === "/data-report/consumption-statistics";

  return (
    <div className="reports-dashboard">
      <div className="reports-header">
        <div className="reports-tabs">
          {reportConfigs.map((config) => (
            <button
              key={config.path}
              className={`button ${activeTabPath === config.path ? "button-primary" : "button-ghost"}`}
              onClick={() => handleTabChange(config.path)}
              style={{ whiteSpace: "nowrap", fontSize: "0.875rem" }}
              type="button"
            >
              {config.menuLabel}
            </button>
          ))}
        </div>
        <div className="reports-header-actions">
          {showTrendMode ? (
            <div className="reports-toggle-group">
              <button
                className={`mini-button ${trendMode === "daily" ? "button-primary" : "button-ghost"}`}
                onClick={() => setTrendMode("daily")}
                style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}
                type="button"
              >
                Daily
              </button>
              <button
                className={`mini-button ${trendMode === "monthly" ? "button-primary" : "button-ghost"}`}
                onClick={() => setTrendMode("monthly")}
                style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}
                type="button"
              >
                Monthly
              </button>
            </div>
          ) : null}
          <div className="reports-toggle-group view-toggle">
            <button
              className={`mini-button ${viewMode === "data" ? "button-primary" : "button-ghost"}`}
              onClick={() => setViewMode("data")}
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}
              type="button"
            >
              Data
            </button>
            <button
              className={`mini-button ${viewMode === "chart" ? "button-primary" : "button-ghost"}`}
              onClick={() => setViewMode("chart")}
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}
              type="button"
            >
              Chart
            </button>
          </div>
          <button className="button button-outline" onClick={handleExport} type="button">
            <svg
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              style={{ width: "1.2rem", marginRight: "0.5rem" }}
              viewBox="0 0 24 24"
            >
              <path
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Export
          </button>
        </div>
      </div>

      <div className="stat-grid reports-stat-grid">
        {stats.map((stat) => (
          <StatCard key={stat.label} accent={stat.accent} label={stat.label} value={stat.value} />
        ))}
      </div>

      <div className="reports-content-area">
        {!activeConfig ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
            Select a report to view data
          </div>
        ) : viewMode === "data" ? (
          <DataPage page={activeConfig} onTableStateChange={setReportSnapshot} />
        ) : (
          <div className="analytics-view">
            {reportSnapshot.loading ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "var(--text-muted)",
                }}
              >
                Loading chart data...
              </div>
            ) : chartData ? (
              <TrendChart
                labels={chartData.labels}
                title={`${activeConfig.menuLabel} Distribution`}
                type={chartData.type}
                values={chartData.values}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "var(--text-muted)",
                }}
              >
                No chartable values are available for the current result set.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
