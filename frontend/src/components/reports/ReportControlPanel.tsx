interface ReportControlPanelProps {
  total: number;
  viewMode: "data" | "chart";
  trendMode: "daily" | "monthly";
  onViewModeChange: (mode: "data" | "chart") => void;
  onTrendModeChange: (mode: "daily" | "monthly") => void;
  stats: Array<{
    label: string;
    value: string;
    accent: "teal" | "blue" | "green" | "orange";
  }>;
}

function mapAccentClass(accent: "teal" | "blue" | "green" | "orange") {
  if (accent === "teal") {
    return "emerald";
  }

  if (accent === "blue") {
    return "sapphire";
  }

  if (accent === "green") {
    return "amethyst";
  }

  return "amber";
}

export function ReportControlPanel({
  total,
  viewMode,
  trendMode,
  onViewModeChange,
  onTrendModeChange,
  stats,
}: ReportControlPanelProps) {
  return (
    <div className="premium-card reports-control-panel">
      <div className="reports-control-row">
        <div className="reports-control-groups">
          <div className="reports-toggle-group view-toggle">
            <button
              className={`mini-button ${viewMode === "data" ? "button-primary" : "button-ghost"}`}
              onClick={() => onViewModeChange("data")}
              type="button"
            >
              Data
            </button>
            <button
              className={`mini-button ${viewMode === "chart" ? "button-primary" : "button-ghost"}`}
              onClick={() => onViewModeChange("chart")}
              type="button"
            >
              Chart
            </button>
          </div>

          <div className="reports-toggle-group view-toggle">
            <button
              className={`mini-button ${trendMode === "daily" ? "button-primary" : "button-ghost"}`}
              onClick={() => onTrendModeChange("daily")}
              type="button"
            >
              Daily
            </button>
            <button
              className={`mini-button ${trendMode === "monthly" ? "button-primary" : "button-ghost"}`}
              onClick={() => onTrendModeChange("monthly")}
              type="button"
            >
              Monthly
            </button>
          </div>
        </div>

        <span className="reports-record-count">{total} records loaded</span>
      </div>

      {stats.length > 0 ? (
        <div className="reports-stats-grid">
          {stats.map((stat) => (
            <div key={stat.label} className="premium-card reports-stat-card">
              <div className="stat-content">
                <div className="stat-info">
                  <span className="stat-label-tiny">{stat.label}</span>
                  <strong className="reports-stat-value">{stat.value}</strong>
                </div>
                <div className={`stat-icon-square ${mapAccentClass(stat.accent)}`} />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
