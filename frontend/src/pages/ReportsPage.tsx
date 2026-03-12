import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { TrendChart } from "../components/charts/TrendChart";
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
  const [trendMode] = useState<"daily" | "monthly">("daily");
  const [reportSnapshot, setReportSnapshot] = useState<DataPageSnapshot>(emptySnapshot);

  const reportConfigs = allPages.filter(
    (page): page is DataPageConfig => page.kind === "data" && page.sectionKey === "data-report",
  );

  const activeTabPath =
    reportConfigs.find((config) => config.path === location.pathname)?.path ??
    reportConfigs[0]?.path ??
    "";
  const activeConfig = reportConfigs.find((config) => config.path === activeTabPath);
  const { chartData } = buildReportAnalytics(
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Data Reports</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Overview of all data and legacy STS tokens.
          </p>
        </div>
        <button className="button button-primary" style={{ padding: '0.5rem 1rem', borderRadius: '10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          Legacy STS
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '1rem' }} className="no-scrollbar">
        {reportConfigs.map((config) => (
          <button
            key={config.path}
            className={`button ${activeTabPath === config.path ? "button-primary" : "button-ghost"}`}
            onClick={() => handleTabChange(config.path)}
            style={{ 
              whiteSpace: "nowrap", 
              fontSize: "0.75rem", 
              fontWeight: 600, 
              padding: '0.5rem 1rem',
              borderRadius: '8px'
            }}
            type="button"
          >
            {config.menuLabel}
          </button>
        ))}
      </div>

      <div className="premium-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flex: 1, minWidth: '300px' }}>
            <select className="select" style={{ minWidth: '140px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '0.85rem', padding: '0.5rem' }}>
              <option>All Sites</option>
            </select>
            <div style={{ position: 'relative', flex: 1 }}>
              <input 
                type="text" 
                placeholder="Search" 
                className="input" 
                style={{ width: '100%', paddingLeft: '2.5rem', height: '40px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', borderRadius: '8px' }}
              />
              <svg style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="button button-ghost" style={{ borderRadius: '8px', fontSize: '0.85rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
              Filter
            </button>
            <button className="button button-ghost" onClick={handleExport} style={{ borderRadius: '8px', fontSize: '0.85rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5 5 5-5m-5 5V3"/></svg>
              Export PDF
            </button>
          </div>
        </div>
      </div>

      <div className="premium-card" style={{ minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
        {!activeConfig ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ opacity: 0.3, marginBottom: '1rem' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
            <p>Select a report to view data</p>
          </div>
        ) : (
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{reportSnapshot.total} records</span>
              <div className="reports-toggle-group view-toggle">
                <button
                  className={`mini-button ${viewMode === "data" ? "button-primary" : "button-ghost"}`}
                  onClick={() => setViewMode("data")}
                  style={{ padding: "0.4rem 0.8rem", fontSize: "0.75rem", borderRadius: '6px' }}
                  type="button"
                >
                  Data
                </button>
                <button
                  className={`mini-button ${viewMode === "chart" ? "button-primary" : "button-ghost"}`}
                  onClick={() => setViewMode("chart")}
                  style={{ padding: "0.4rem 0.8rem", fontSize: "0.75rem", borderRadius: '6px' }}
                  type="button"
                >
                  Chart
                </button>
              </div>
            </div>
            
            {viewMode === "data" ? (
              <DataPage page={activeConfig} onTableStateChange={setReportSnapshot} />
            ) : (
              <div className="analytics-view" style={{ padding: '2rem' }}>
                {reportSnapshot.loading ? (
                  <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading chart data...</div>
                ) : chartData ? (
                  <TrendChart
                    labels={chartData.labels}
                    title={`${activeConfig.menuLabel} Distribution`}
                    type={chartData.type}
                    values={chartData.values}
                  />
                ) : (
                  <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No chartable values available.</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

