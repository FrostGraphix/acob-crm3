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
  insights?: ReactNode;
  table: ReactNode;
}

export function CreditTokenRecordWorkspace({
  page,
  appliedFilters,
  rows,
  total,
  feedback,
  error,
  onGenerate,
  onExport,
  insights,
  table,
}: CreditTokenRecordWorkspaceProps) {
  return (
    <section className="token-record-page">
      <div className="token-record-hero">
        <div className="token-record-hero__copy">
          <h2 className="token-record-hero__title">Token Management</h2>
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
        </div>
      </div>

      <TokenRecordStats appliedFilters={appliedFilters} page={page} rows={rows} total={total} />

      {feedback ? <p className="status-banner">{feedback}</p> : null}
      {error ? <p className="status-banner status-banner-error">{error}</p> : null}
      {insights}

      {table}
    </section>
  );
}
