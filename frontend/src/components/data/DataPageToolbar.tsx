import type { ActionConfig, DataPageConfig } from "../../types";
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
}: DataPageToolbarProps) {
  return (
    <div className="data-view-header">
      <div className="data-page-toolbar-row">
        <SearchBar
          fields={page.filters}
          onChange={onFilterChange}
          onReset={onReset}
          onSearch={onSearch}
          values={draftFilters}
        />

        <div className="action-strip data-page-action-strip">
          {(page.toolbarActions ?? []).map((action) => (
            <button
              className={`button ${action.tone === "primary" ? "button-primary" : "button-ghost"}`}
              key={action.key}
              onClick={() => onToolbarAction(action)}
              type="button"
            >
              {action.label}
            </button>
          ))}
          {(page.bulkActions ?? []).map((action) => (
            <button
              className={`button ${action.tone === "danger" ? "button-danger" : "button-ghost"}`}
              key={action.key}
              onClick={() => onBulkAction(action)}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {page.showQuota ? (
        <div className="data-page-quota data-page-quota-muted">
          Quota information is not exposed by the upstream API yet.
        </div>
      ) : null}

      {feedback ? <p className="status-banner">{feedback}</p> : null}
      {error ? <p className="status-banner status-banner-error">{error}</p> : null}
    </div>
  );
}
