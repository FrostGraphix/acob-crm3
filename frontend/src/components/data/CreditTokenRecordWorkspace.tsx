import type { ReactNode } from "react";
import type { DataPageConfig, DataRow } from "../../types";
import { TokenRecordStats } from "./TokenRecordStats";

interface CreditTokenRecordWorkspaceProps {
  page: DataPageConfig;
  appliedFilters: Record<string, string>;
  rows: DataRow[];
  total: number;
  feedback: string | null;
  error: string | null;
  live?: {
    enabled: boolean;
    paused: boolean;
    setPaused: (paused: boolean) => void;
    lastUpdatedAt: number | null;
  };
  onGenerate: () => void;
  onExport?: () => void;
  onRefresh: () => void;
  table: ReactNode;
}

export function CreditTokenRecordWorkspace({
  page,
  appliedFilters,
  rows,
  total,
  feedback,
  error,
  live,
  onGenerate,
  onExport,
  onRefresh,
  table,
}: CreditTokenRecordWorkspaceProps) {
  const lastUpdatedLabel =
    live?.lastUpdatedAt != null ? new Date(live.lastUpdatedAt).toLocaleString() : "Waiting for first sync";

  return (
    <section className="token-record-page">
      <div className="token-record-hero">
        <div className="token-record-hero__copy">
          <p className="token-record-hero__eyebrow">Tokens</p>
          <div className="token-record-hero__title-row">
            <h2 className="token-record-hero__title">Token Management</h2>
            <span className={`token-record-live-pill${live?.enabled && !live.paused ? " is-live" : ""}`}>
              {live?.enabled ? (live.paused ? "Live paused" : "Live syncing") : "Static view"}
            </span>
          </div>
          <p className="token-record-hero__description">
            Clean credit token records with quick totals, visible search fields, and fast operator actions.
          </p>
          <div className="token-record-hero__meta">
            <span>{total.toLocaleString()} total records</span>
            <span>{rows.length.toLocaleString()} loaded on this page</span>
            <span>Last updated: {lastUpdatedLabel}</span>
          </div>
        </div>

        <div className="token-record-hero__actions">
          <button className="button button-primary token-record-hero__button" onClick={onGenerate} type="button">
            Generate Token
          </button>
          {onExport ? (
            <button className="button button-ghost token-record-hero__button" onClick={onExport} type="button">
              Export
            </button>
          ) : null}
          <button className="button button-ghost token-record-hero__button" onClick={onRefresh} type="button">
            Refresh
          </button>
          {live?.enabled ? (
            <button
              className="button button-ghost token-record-hero__button"
              onClick={() => live.setPaused(!live.paused)}
              type="button"
            >
              {live.paused ? "Resume Live" : "Pause Live"}
            </button>
          ) : null}
        </div>
      </div>

      <TokenRecordStats appliedFilters={appliedFilters} page={page} rows={rows} total={total} />

      {feedback ? <p className="status-banner">{feedback}</p> : null}
      {error ? <p className="status-banner status-banner-error">{error}</p> : null}

      {table}
    </section>
  );
}
