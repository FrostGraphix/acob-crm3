import { TrendChart } from "../charts/TrendChart";
import { DataPage, type DataPageSnapshot } from "../../pages/DataPage";
import type { DataPageConfig, ReportChartData } from "../../types";

interface ReportContentPanelProps {
  activeConfig?: DataPageConfig;
  chartData: ReportChartData | null;
  reportSnapshot: DataPageSnapshot;
  setReportSnapshot: (snapshot: DataPageSnapshot) => void;
  trendMode: "daily" | "monthly";
  viewMode: "data" | "chart";
}

export function ReportContentPanel({
  activeConfig,
  chartData,
  reportSnapshot,
  setReportSnapshot,
  trendMode,
  viewMode,
}: ReportContentPanelProps) {
  return (
    <div className="premium-card reports-content-panel">
      {!activeConfig ? (
        <div className="reports-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
            <path d="M10 9H8" />
          </svg>
          <p>Select a report to view data</p>
        </div>
      ) : (
        <div className="reports-panel-body">
          <div className="reports-panel-meta">
            <span>{reportSnapshot.total} records</span>
          </div>

          {viewMode === "data" ? (
            <DataPage page={activeConfig} onTableStateChange={setReportSnapshot} />
          ) : (
            <div className="analytics-view reports-chart-view">
              {reportSnapshot.loading ? (
                <div className="reports-chart-placeholder">Loading chart data...</div>
              ) : chartData ? (
                <TrendChart
                  averageValue={chartData.averageValue}
                  labels={chartData.labels}
                  title={`${activeConfig.menuLabel} (${trendMode === "monthly" ? "Monthly" : "Daily"})`}
                  type={chartData.type}
                  seriesName={chartData.seriesName}
                  values={chartData.values}
                />
              ) : (
                <div className="reports-chart-placeholder">No chartable values available.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
