import type { DataPageConfig } from "../../types";
import { Button, Surface } from "../../design-system";

interface ReportControlPanelProps {
  activeConfig?: DataPageConfig;
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
  activeConfig,
  total,
  viewMode,
  trendMode,
  onViewModeChange,
  onTrendModeChange,
  stats,
}: ReportControlPanelProps) {
  const analyticsMode = activeConfig?.reportDisplayMode === "analytics";

  return (
    <Surface className="premium-card reports-control-panel" tone="raised">
      <div className="reports-control-row">
        {analyticsMode ? (
          <div className="reports-control-groups">
            <span className="reports-record-count">
              Guided analytics report. Use the quick actions inside the page for the easiest result path.
            </span>
          </div>
        ) : (
          <div className="reports-control-groups">
            <div className="reports-toggle-group view-toggle">
              <Button
                active={viewMode === "data"}
                className="mini-button"
                onClick={() => onViewModeChange("data")}
                size="sm"
                tone={viewMode === "data" ? "primary" : "ghost"}
              >
                Data
              </Button>
              <Button
                active={viewMode === "chart"}
                className="mini-button"
                onClick={() => onViewModeChange("chart")}
                size="sm"
                tone={viewMode === "chart" ? "primary" : "ghost"}
              >
                Chart
              </Button>
            </div>

            <div className="reports-toggle-group view-toggle">
              <Button
                active={trendMode === "daily"}
                className="mini-button"
                onClick={() => onTrendModeChange("daily")}
                size="sm"
                tone={trendMode === "daily" ? "primary" : "ghost"}
              >
                Daily
              </Button>
              <Button
                active={trendMode === "monthly"}
                className="mini-button"
                onClick={() => onTrendModeChange("monthly")}
                size="sm"
                tone={trendMode === "monthly" ? "primary" : "ghost"}
              >
                Monthly
              </Button>
            </div>
          </div>
        )}

        <span className="reports-record-count">{total} records loaded</span>
      </div>

      {stats.length > 0 ? (
        <div className="reports-stats-grid">
          {stats.map((stat) => (
            <Surface key={stat.label} className="premium-card reports-stat-card" tone="muted">
              <div className="stat-content">
                <div className="stat-info">
                  <span className="stat-label-tiny">{stat.label}</span>
                  <strong className="reports-stat-value">{stat.value}</strong>
                </div>
                <div className={`stat-icon-square ${mapAccentClass(stat.accent)}`} />
              </div>
            </Surface>
          ))}
        </div>
      ) : null}
    </Surface>
  );
}
