import { useEffect, useMemo, useRef, useState } from "react";
import { Surface } from "../../design-system";
import type { FilterField } from "../../types";

interface TokenToolbarAction {
  label: string;
  onClick: () => void;
  tone?: "primary" | "danger" | "neutral";
}

interface SortOption {
  key: string;
  label: string;
}

interface TokenReferenceToolbarProps {
  badge: string;
  title: string;
  subtitle: string;
  filters: FilterField[];
  values: Record<string, string>;
  total: number;
  feedback: string | null;
  error: string | null;
  sortName: string;
  sortDirection: "asc" | "desc";
  sortOptions: SortOption[];
  onFilterChange: (key: string, value: string) => void;
  onReset: () => void;
  onSearch: () => void;
  onSortChange: (sortName: string, sortDirection: "asc" | "desc") => void;
  actions?: TokenToolbarAction[];
  live?: {
    enabled: boolean;
    paused: boolean;
    setPaused: (paused: boolean) => void;
    lastUpdatedAt: number | null;
  };
}

function getLastUpdatedLabel(lastUpdatedAt: number | null) {
  if (lastUpdatedAt === null) {
    return "Not updated";
  }

  return new Date(lastUpdatedAt).toLocaleString();
}

function useOutsideClose(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleMouseDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [isOpen, onClose]);

  return containerRef;
}

function TokenToolbarFilterPopover({
  field,
  value,
  onApply,
}: {
  field: FilterField;
  value: string;
  onApply: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const containerRef = useOutsideClose(isOpen, () => setIsOpen(false));
  const active = value.trim().length > 0;

  useEffect(() => {
    setTempValue(value);
  }, [value]);

  return (
    <div className="token-toolbar-popover" ref={containerRef}>
      <button
        className={`token-toolbar-popover__trigger${active ? " is-active" : ""}`}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span>{field.label}</span>
        <span className="token-toolbar-popover__icon" aria-hidden="true">
          search
        </span>
      </button>

      {isOpen ? (
        <div className="token-toolbar-popover__panel">
          <input
            autoFocus
            className="token-toolbar-popover__input"
            onChange={(event) => setTempValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onApply(tempValue);
                setIsOpen(false);
              }
            }}
            placeholder={field.placeholder}
            type={field.type ?? "text"}
            value={tempValue}
          />

          <div className="token-toolbar-popover__actions">
            <button
              className="token-anchor-button"
              onClick={() => {
                setTempValue("");
                onApply("");
                setIsOpen(false);
              }}
              type="button"
            >
              Reset
            </button>
            <button
              className="token-anchor-button token-anchor-button--primary"
              onClick={() => {
                onApply(tempValue);
                setIsOpen(false);
              }}
              type="button"
            >
              Search
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TokenToolbarSortPopover({
  sortName,
  sortDirection,
  sortOptions,
  onApply,
}: {
  sortName: string;
  sortDirection: "asc" | "desc";
  sortOptions: SortOption[];
  onApply: (sortName: string, sortDirection: "asc" | "desc") => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempSortName, setTempSortName] = useState(sortName);
  const [tempSortDirection, setTempSortDirection] = useState<"asc" | "desc">(sortDirection);
  const containerRef = useOutsideClose(isOpen, () => setIsOpen(false));

  useEffect(() => {
    setTempSortName(sortName);
    setTempSortDirection(sortDirection);
  }, [sortDirection, sortName]);

  return (
    <div className="token-toolbar-popover" ref={containerRef}>
      <button className="token-toolbar-sort-button" onClick={() => setIsOpen((current) => !current)} type="button">
        Sort
      </button>

      {isOpen ? (
        <div className="token-toolbar-popover__panel token-toolbar-popover__panel--sort">
          <select
            className="token-toolbar-popover__input"
            onChange={(event) => setTempSortName(event.target.value)}
            value={tempSortName}
          >
            {sortOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>

          <div className="token-toolbar-sort-directions">
            <label>
              <input
                checked={tempSortDirection === "asc"}
                name="token-sort-direction"
                onChange={() => setTempSortDirection("asc")}
                type="radio"
              />
              Ascending
            </label>
            <label>
              <input
                checked={tempSortDirection === "desc"}
                name="token-sort-direction"
                onChange={() => setTempSortDirection("desc")}
                type="radio"
              />
              Descending
            </label>
          </div>

          <div className="token-toolbar-popover__actions">
            <button
              className="token-anchor-button token-anchor-button--primary"
              onClick={() => {
                onApply(tempSortName, tempSortDirection);
                setIsOpen(false);
              }}
              type="button"
            >
              Sort
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function TokenReferenceToolbar({
  badge,
  title,
  subtitle,
  filters,
  values,
  total,
  feedback,
  error,
  sortName,
  sortDirection,
  sortOptions,
  onFilterChange,
  onReset,
  onSearch,
  onSortChange,
  actions = [],
  live,
}: TokenReferenceToolbarProps) {
  const lastUpdatedLabel = getLastUpdatedLabel(live?.lastUpdatedAt ?? null);
  const searchFilter = useMemo(
    () => filters.find((field) => field.key === "searchTerm") ?? null,
    [filters],
  );
  const extraFilters = useMemo(
    () => filters.filter((field) => field.key !== "searchTerm"),
    [filters],
  );

  return (
    <Surface className="token-reference-toolbar" tone="default">
      <div className="token-reference-toolbar__top">
        <div className="token-reference-toolbar__copy">
          <span className="token-page-tag">{badge}</span>
          <h1 className="token-reference-toolbar__title">{title}</h1>
          <p className="token-page-header__subtitle">{subtitle}</p>
        </div>

        <div className="token-reference-toolbar__actions">
          <TokenToolbarSortPopover
            onApply={onSortChange}
            sortDirection={sortDirection}
            sortName={sortName}
            sortOptions={sortOptions}
          />
          {actions.map((action) => (
            <button
              className={[
                "token-anchor-button",
                action.tone === "primary" ? "token-anchor-button--primary" : "",
                action.tone === "danger" ? "token-anchor-button--danger" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={action.label}
              onClick={action.onClick}
              type="button"
            >
              {action.label}
            </button>
          ))}
          {live?.enabled ? (
            <button
              className="token-anchor-button"
              onClick={() => live.setPaused(!live.paused)}
              type="button"
            >
              {live.paused ? "Resume Live" : "Pause Live"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="token-reference-toolbar__meta">
        <span>{total.toLocaleString()} records</span>
        {live?.enabled ? <span>{live.paused ? "Live paused" : "Live running"}</span> : null}
        <span>{lastUpdatedLabel}</span>
      </div>

      <div className="token-reference-toolbar__filters">
        {searchFilter ? (
          <input
            className="token-reference-toolbar__search"
            onChange={(event) => onFilterChange(searchFilter.key, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSearch();
              }
            }}
            placeholder={searchFilter.placeholder}
            type="text"
            value={values[searchFilter.key] ?? ""}
          />
        ) : null}

        <div className="token-reference-toolbar__filter-pills">
          {extraFilters.map((field) => (
            <TokenToolbarFilterPopover
              field={field}
              key={field.key}
              onApply={(nextValue) => {
                onFilterChange(field.key, nextValue);
                onSearch();
              }}
              value={values[field.key] ?? ""}
            />
          ))}
        </div>

        <div className="token-reference-toolbar__filter-actions">
          <button className="token-anchor-button" onClick={onReset} type="button">
            Reset
          </button>
          <button className="token-anchor-button token-anchor-button--primary" onClick={onSearch} type="button">
            Search
          </button>
        </div>
      </div>

      {feedback ? <p className="status-banner">{feedback}</p> : null}
      {error ? <p className="status-banner status-banner-error">{error}</p> : null}
    </Surface>
  );
}
