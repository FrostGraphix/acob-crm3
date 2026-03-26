import { useEffect, useState } from "react";
import { ConfirmModal } from "../components/common/ConfirmModal";
import { DataTable } from "../components/common/DataTable";
import { FormModal } from "../components/common/FormModal";
import { SearchBar } from "../components/common/SearchBar";
import { useDataTable } from "../hooks/useDataTable";
import { runPageAction } from "../services/api";
import { downloadRowsAsCsv, printRowDetails } from "../services/client-table-actions";
import { buildActionPayload } from "../services/payload-mapper";
import type { ActionConfig, DataPageConfig, DataRow } from "../types";

interface PendingAction {
  action: ActionConfig;
  row?: DataRow;
  isBulk?: boolean;
}

export interface DataPageSnapshot {
  rows: DataRow[];
  total: number;
  loading: boolean;
  error: string | null;
  appliedFilters: Record<string, string>;
}

interface DataPageProps {
  page: DataPageConfig;
  onTableStateChange?: (snapshot: DataPageSnapshot) => void;
}

export function DataPage({ page, onTableStateChange }: DataPageProps) {
  const {
    draftFilters,
    setDraftFilters,
    appliedFilters,
    rows,
    total,
    loading,
    error,
    selectedKeys,
    pageNumber,
    pageSize,
    setPageNumber,
    setPageSize,
    search,
    reset,
    refresh,
    toggleRow,
    toggleAll,
    getRowKeyValue,
  } = useDataTable(page);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  useEffect(() => {
    onTableStateChange?.({
      rows,
      total,
      loading,
      error,
      appliedFilters,
    });
  }, [appliedFilters, error, loading, onTableStateChange, rows, total]);

  const executeAction = async (
    action: ActionConfig,
    options: {
      row?: DataRow;
      isBulk?: boolean;
      values?: Record<string, string>;
    } = {},
  ) => {
    if (action.operationKind === "client-export") {
      downloadRowsAsCsv(page.title, page.columns, rows);
      setFeedback(`Exported ${rows.length} row(s) from ${page.menuLabel}.`);
      return;
    }

    if (action.operationKind === "client-print") {
      if (!options.row) {
        throw new Error(`${action.label} requires a selected row`);
      }

      printRowDetails(`${page.menuLabel} Print`, page.columns, options.row);
      setFeedback(`Opened print preview for ${page.menuLabel}.`);
      return;
    }

    const mapping = buildActionPayload(action, {
      row: options.row,
      values: options.values,
      selectedKeys: options.isBulk ? selectedKeys : [],
    });

    if (!mapping.ok || !mapping.payload) {
      throw new Error(mapping.message ?? "Invalid action payload");
    }

    if (action.operationKind === "management-import") {
      const records = Array.isArray(mapping.payload.records)
        ? (mapping.payload.records as Record<string, unknown>[])
        : [];

      for (const record of records) {
        await runPageAction(action.endpoint, record);
      }

      setFeedback(`Imported ${records.length} record(s) into ${page.menuLabel}.`);
      await refresh();
      return;
    }

    const result = await runPageAction(action.endpoint, mapping.payload);
    setFeedback(result.message ?? `${action.label} completed`);
    await refresh();
  };

  const handleAction = async (action: ActionConfig, row?: DataRow, isBulk = false) => {
    if (isBulk && selectedKeys.length === 0) {
      setFeedback("Select at least one row before running a bulk action.");
      return;
    }

    if (action.fields?.length || action.confirmMessage) {
      setPendingAction({ action, row, isBulk });
      return;
    }

    try {
      await executeAction(action, { row, isBulk });
    } catch (caughtError) {
      setFeedback(caughtError instanceof Error ? caughtError.message : "Action failed");
    }
  };

  return (
    <section className="page-stack">
      <div className="data-view-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <SearchBar
            fields={page.filters}
            onChange={(key, value) =>
              setDraftFilters((current) => ({
                ...current,
                [key]: value,
              }))
            }
            onReset={() => {
              setFeedback(null);
              reset();
            }}
            onSearch={() => {
              setFeedback(null);
              search();
            }}
            values={draftFilters}
          />
          
          <div className="action-strip" style={{ margin: 0, padding: 0, border: 'none', background: 'none' }}>
            {(page.toolbarActions ?? []).map((action) => (
              <button
                className={`button ${action.tone === "primary" ? "button-primary" : "button-ghost"}`}
                style={{ borderRadius: '999px' }}
                key={action.key}
                onClick={() => void handleAction(action)}
                type="button"
              >
                {action.label}
              </button>
            ))}
            {(page.bulkActions ?? []).map((action) => (
              <button
                className={`button ${action.tone === "danger" ? "button-danger" : "button-ghost"}`}
                style={{ borderRadius: '999px' }}
                key={action.key}
                onClick={() => void handleAction(action, undefined, true)}
                type="button"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {page.showQuota ? (
          <div className="data-page-quota" style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Quota(kw/h): 0/0
          </div>
        ) : null}

        {feedback ? <p className="status-banner" style={{ marginTop: '0.5rem' }}>{feedback}</p> : null}
        {error ? <p className="status-banner status-banner-error" style={{ marginTop: '0.5rem' }}>{error}</p> : null}
      </div>

      <DataTable
        columns={page.columns}
        getRowKey={getRowKeyValue}
        loading={loading}
        onPageChange={setPageNumber}
        onPageSizeChange={(nextSize) => {
          setPageNumber(1);
          setPageSize(nextSize);
        }}
        onRowAction={(action, row) => void handleAction(action, row)}
        onToggleAll={toggleAll}
        onToggleRow={toggleRow}
        pageNumber={pageNumber}
        pageSize={pageSize}
        rowActions={page.rowActions}
        rows={rows}
        selectedKeys={selectedKeys}
        total={total}
        columnFilters={draftFilters}
        onColumnFilterChange={(key, value) => {
          setDraftFilters(curr => ({ ...curr, [key]: value }));
        }}
        onColumnSearch={() => {
          setFeedback(null);
          search();
        }}
      />

      {pendingAction?.action.fields?.length ? (
        <FormModal
          action={pendingAction.action}
          row={pendingAction.row}
          onCancel={() => setPendingAction(null)}
          onSubmit={(values) => {
            void executeAction(pendingAction.action, {
              row: pendingAction.row,
              isBulk: pendingAction.isBulk,
              values,
            })
              .then(() => setPendingAction(null))
              .catch((caughtError) => {
                setFeedback(caughtError instanceof Error ? caughtError.message : "Action failed");
                setPendingAction(null);
              });
          }}
        />
      ) : null}

      {pendingAction?.action.confirmMessage ? (
        <ConfirmModal
          message={pendingAction.action.confirmMessage}
          onCancel={() => setPendingAction(null)}
          onConfirm={() => {
            void executeAction(pendingAction.action, {
              row: pendingAction.row,
              isBulk: pendingAction.isBulk,
            })
              .then(() => setPendingAction(null))
              .catch((caughtError) => {
                setFeedback(caughtError instanceof Error ? caughtError.message : "Action failed");
                setPendingAction(null);
              });
          }}
          title={pendingAction.action.label}
        />
      ) : null}
    </section>
  );
}
