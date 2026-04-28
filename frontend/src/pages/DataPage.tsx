import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConfirmModal } from "../components/common/ConfirmModal";
import { DataTable } from "../components/common/DataTable";
import { FormModal } from "../components/common/FormModal";
import { MeterDrilldownModal } from "../components/common/MeterDrilldownModal";
import { AnalyticsMixPanel } from "../components/analytics/AnalyticsMixPanel";
import { DataPageToolbar } from "../components/data/DataPageToolbar";
import { WalletAdminWorkspace } from "../components/data/WalletAdminWorkspace";
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
  const navigate = useNavigate();
  const isWalletAdminPage = page.workspace === "wallet-admin";
  const isExactAmrSection = [
    "token-record",
    "remote-operation-task",
    "data-report",
    "event",
  ].includes(page.sectionKey);
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
    live,
  } = useDataTable(page);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [drilldownMeterId, setDrilldownMeterId] = useState<string | null>(null);
  const [actionDetails, setActionDetails] = useState<Record<string, unknown> | null>(null);

  const caseAction = useMemo<ActionConfig | null>(
    () =>
      !isExactAmrSection && page.riskIntegration?.canOpenCase
        ? {
            key: "open-theft-case",
            label: "Open Case",
            endpoint: "/api/theft/cases/create",
            tone: "danger",
            operationKind: "theft-case-create",
            fields: [
              {
                key: "notes",
                label: "Notes",
                type: "textarea",
                placeholder: "Add initial investigation notes",
              },
            ],
          }
        : null,
    [isExactAmrSection, page.riskIntegration?.canOpenCase],
  );
  const rowActions = useMemo(
    () => (caseAction ? [...(page.rowActions ?? []), caseAction] : page.rowActions),
    [caseAction, page.rowActions],
  );
  const insightQuery = useMemo(
    () => Object.entries(appliedFilters).reduce<Record<string, string>>((accumulator, [key, value]) => {
      if (value.trim().length > 0) {
        accumulator[key] = value;
      }
      return accumulator;
    }, {}),
    [appliedFilters],
  );
  const insightPanels = useMemo(
    () =>
      !isExactAmrSection
        ? (page.insightPanels?.map((panel) => (
            <AnalyticsMixPanel
              key={panel.key}
              endpoint={panel.endpoint}
              query={{ ...panel.queryDefaults, ...insightQuery }}
            />
          )) ?? null)
        : null,
    [insightQuery, isExactAmrSection, page.insightPanels],
  );

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

      await printRowDetails(`${page.menuLabel} Print`, page.columns, options.row);
      setFeedback(`Opened print dialog for ${page.menuLabel}.`);
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

      const result = await runPageAction(action.endpoint, { records });
      setFeedback(result.message ?? `Imported ${records.length} record(s) into ${page.menuLabel}.`);
      setActionDetails(result.details ?? null);
      await refresh();
      return;
    }

    const result = await runPageAction(action.endpoint, mapping.payload);
    const traceSuffix = typeof result.__metaTraceId === "string" ? ` (trace: ${result.__metaTraceId})` : "";
    setFeedback((result.message ?? `${action.label} completed`) + traceSuffix);
    setActionDetails((result.details as Record<string, unknown> | undefined) ?? (result as Record<string, unknown>));
    await refresh();

    if (action.operationKind?.startsWith("token-generate") && action.successRedirectPath) {
      setTimeout(() => {
        navigate(action.successRedirectPath as string);
      }, 1200);
    }
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

  const handleRowClick = (row: DataRow) => {
    if (!page.meterDrilldown) {
      return;
    }

    const meterIdValue = row.meterId;
    const meterId =
      meterIdValue === null || meterIdValue === undefined
        ? ""
        : String(meterIdValue).trim();

    if (meterId.length === 0) {
      setFeedback("Selected row has no meter id for drilldown.");
      return;
    }

    setDrilldownMeterId(meterId);
  };

  if (isWalletAdminPage) {
    return (
      <WalletAdminWorkspace
        page={page}
        rows={rows}
        loading={loading}
        feedback={feedback}
        error={error}
        onRefresh={() => {
          void refresh()
            .then(() => setFeedback("Data refreshed"))
            .catch((caughtError) =>
              setFeedback(caughtError instanceof Error ? caughtError.message : "Refresh failed"),
            );
        }}
        onToolbarAction={(action) => void handleAction(action)}
        onRowAction={(action, row) => void handleAction(action, row)}
      />
    );
  }

  return (
    <section className={`page-stack ds-page${isWalletAdminPage ? " wallet-admin-data-page vendor-wallet-stack" : ""}`}>
      {isWalletAdminPage ? (
        <div className="vw-surface vw-surface--padded vw-fadeUp">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <div className="vw-page-title">{page.title}</div>
              <div className="vw-page-sub">{page.description}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="vw-badge vw-badge--gray">Admin Workspace</span>
              <span className="vw-badge vw-badge--lemon">{page.menuLabel}</span>
            </div>
          </div>
        </div>
      ) : null}

      <>
        {insightPanels}

        <DataPageToolbar
          draftFilters={draftFilters}
          error={error}
          feedback={feedback}
          hideLiveMeta={isExactAmrSection}
          hideQuotaNote={isExactAmrSection}
          onBulkAction={(action) => void handleAction(action, undefined, true)}
          onFilterChange={(key, value) =>
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
          onToolbarAction={(action) => void handleAction(action)}
          onRefresh={() => {
            void refresh()
              .then(() => setFeedback("Data refreshed"))
              .catch((caughtError) =>
                setFeedback(caughtError instanceof Error ? caughtError.message : "Refresh failed"),
              );
          }}
          live={live}
          page={page}
        />

        <DataTable
          columns={page.columns}
          getRowKey={getRowKeyValue}
          loading={loading}
          onPageChange={setPageNumber}
          onPageSizeChange={(nextSize) => {
            setPageNumber(1);
            setPageSize(nextSize);
          }}
          onRowClick={page.meterDrilldown ? handleRowClick : undefined}
          onRowAction={(action, row) => void handleAction(action, row)}
          onToggleAll={toggleAll}
          onToggleRow={toggleRow}
          pageNumber={pageNumber}
          pageSize={pageSize}
          rowActions={rowActions}
          rowActionDisplay={isExactAmrSection ? "inline" : "menu"}
          rows={rows}
          selectedKeys={selectedKeys}
          total={total}
          columnFilters={draftFilters}
          onColumnFilterChange={(key, value) => {
            setDraftFilters((curr) => ({ ...curr, [key]: value }));
          }}
          onColumnSearch={() => {
            setFeedback(null);
            search();
          }}
          title={page.title}
        />
      </>

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

      {actionDetails && Object.keys(actionDetails).length > 0 && !isExactAmrSection ? (
        <div className="status-banner ds-status-message">
          <strong>Last Action Result</strong>
          <pre className="action-result-json">{JSON.stringify(actionDetails, null, 2)}</pre>
        </div>
      ) : null}

      {drilldownMeterId && page.meterDrilldown ? (
        <MeterDrilldownModal
          appliedFilters={appliedFilters}
          meterId={drilldownMeterId}
          onClose={() => setDrilldownMeterId(null)}
          page={page}
        />
      ) : null}
    </section>
  );
}
