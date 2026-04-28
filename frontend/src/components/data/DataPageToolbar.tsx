import type { ActionConfig, DataPageConfig } from "../../types";
import { Badge, Button, Surface } from "../../design-system";
import { SearchBar } from "../common/SearchBar";

interface DataPageToolbarProps {
  page: DataPageConfig;
  draftFilters: Record<string, string>;
  feedback: string | null;
  error: string | null;
  onFilterChange: (key: string, value: string) => void;
  onReset: () => void;
  onSearch: () => void;
  onToolbarAction: (action: ActionConfig) => void;
  onBulkAction: (action: ActionConfig) => void;
  onRefresh: () => void;
  live?: {
    enabled: boolean;
    paused: boolean;
    setPaused: (paused: boolean) => void;
    lastUpdatedAt: number | null;
  };
  hideLiveMeta?: boolean;
  hideQuotaNote?: boolean;
}

export function DataPageToolbar({
  page,
  draftFilters,
  feedback,
  error,
  onFilterChange,
  onReset,
  onSearch,
  onToolbarAction,
  onBulkAction,
  onRefresh,
  live,
  hideLiveMeta = false,
  hideQuotaNote = false,
}: DataPageToolbarProps) {
  const lastUpdatedLabel =
    live?.lastUpdatedAt != null ? new Date(live.lastUpdatedAt).toLocaleString() : "Not yet";

  return (
    <Surface className="data-view-header ds-toolbar" tone="raised">
      <div className="data-page-toolbar-row ds-toolbar__row">
        <SearchBar
          fields={page.filters}
          onChange={onFilterChange}
          onReset={onReset}
          onSearch={onSearch}
          values={draftFilters}
        />

        <div className="action-strip data-page-action-strip ds-toolbar__actions">
          {(page.toolbarActions ?? []).map((action) => (
            <Button
              key={action.key}
              onClick={() => onToolbarAction(action)}
              size="sm"
              tone={action.tone === "primary" ? "primary" : "ghost"}
            >
              {action.label}
            </Button>
          ))}
          {(page.bulkActions ?? []).map((action) => (
            <Button
              key={action.key}
              onClick={() => onBulkAction(action)}
              size="sm"
              tone={action.tone === "danger" ? "danger" : "ghost"}
            >
              {action.label}
            </Button>
          ))}
          <Button onClick={onRefresh} size="sm" tone="ghost">
            Refresh
          </Button>
          {live?.enabled && !hideLiveMeta ? (
            <Button
              active={!live.paused}
              onClick={() => live.setPaused(!live.paused)}
              size="sm"
              tone="ghost"
            >
              {live.paused ? "Resume Live" : "Pause Live"}
            </Button>
          ) : null}
        </div>
      </div>

      {live?.enabled && !hideLiveMeta ? (
        <div className="data-page-live-meta">
          <Badge tone={live.paused ? "warning" : "success"}>Live: {live.paused ? "Paused" : "Running"}</Badge>
          <Badge>Last updated: {lastUpdatedLabel}</Badge>
        </div>
      ) : null}

      {page.showQuota && !hideQuotaNote ? (
        <div className="data-page-quota data-page-quota-muted">
          Quota information is not exposed by the upstream API yet.
        </div>
      ) : null}

      {feedback ? <p className="status-banner ds-status-message">{feedback}</p> : null}
      {error ? <p className="status-banner status-banner-error ds-status-message ds-status-message--danger">{error}</p> : null}
    </Surface>
  );
}
