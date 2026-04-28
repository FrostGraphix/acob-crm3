import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConfirmModal } from "../components/common/ConfirmModal";
import { DataTable } from "../components/common/DataTable";
import { SearchBar } from "../components/common/SearchBar";
import { Button, Surface } from "../design-system";
import { useDataTable } from "../hooks/useDataTable";
import { loadTableData, runPageAction } from "../services/api";
import { formatNaira, formatNumber } from "../services/currency";
import { createInitialFormValues } from "../services/form-values";
import {
  buildMeterReadingChoices,
  resolveDefaultMeterReadingChoice,
} from "../services/meter-reading-options";
import { buildActionPayload } from "../services/payload-mapper";
import {
  buildRemoteTokenConfirmationLines,
  buildRemoteTokenSendPayload,
  createDefaultRemoteTokenForm,
  getRemoteTokenAmountLabel,
  type RemoteTokenFormState,
} from "../services/remote-token-flow";
import { buildRechargeQuote, inferTariffRate } from "../services/token-generate-flow";
import type { ActionConfig, ActionField, DataPageConfig, DataRow } from "../types";

interface RemoteOperationPageProps {
  page: DataPageConfig;
}

function readActionLabel(action: ActionConfig) {
  if (action.remoteTaskType === "reading") {
    return "Create Reading Task";
  }

  if (action.remoteTaskType === "setting") {
    return "Create Setting Task";
  }

  if (action.remoteTaskType === "control") {
    return "Create Control Task";
  }

  if (action.remoteTaskType === "token") {
    return "Create Token Task";
  }

  if (action.payloadBuilderKey === "transparent-forwarding") {
    return "Create Transparent Forwarding Task";
  }

  return action.label;
}

function buildReviewMessage(
  page: DataPageConfig,
  action: ActionConfig,
  selectedTarget: DataRow | null,
  actionValues: Record<string, string>,
  tokenForm: RemoteTokenFormState,
  tokenQuote: ReturnType<typeof buildRechargeQuote>,
  tokenRate: number | null,
) {
  if (action.remoteTaskType === "token") {
    return buildRemoteTokenConfirmationLines(selectedTarget ?? undefined, tokenForm, {
      quote: tokenQuote,
      tariffRate: tokenRate,
    }).join("\n");
  }

  const targetMeter = String(selectedTarget?.meterId ?? "--");
  const targetCustomer = String(selectedTarget?.customerName ?? "Unknown customer");
  const lines = [
    action.confirmMessage ?? `Confirm ${page.title}.`,
    `Target meter: ${targetMeter} (${targetCustomer})`,
  ];

  for (const field of action.fields ?? []) {
    lines.push(`${field.label}: ${actionValues[field.key] ?? "--"}`);
  }

  return lines.join("\n");
}

export function RemoteOperationPage({ page }: RemoteOperationPageProps) {
  const navigate = useNavigate();
  const {
    draftFilters,
    setDraftFilters,
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
    getRowKeyValue,
  } = useDataTable(page);

  const action = page.toolbarActions?.[0] ?? null;
  const [modalOpen, setModalOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [catalogOptions, setCatalogOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [catalogHelp, setCatalogHelp] = useState<string | null>(null);
  const [actionValues, setActionValues] = useState<Record<string, string>>(() =>
    action ? createInitialFormValues(action) : {},
  );
  const [tokenForm, setTokenForm] = useState<RemoteTokenFormState>(() =>
    createDefaultRemoteTokenForm(),
  );
  const [tokenTariffs, setTokenTariffs] = useState<DataRow[]>([]);

  const selectedTargets = useMemo(
    () => rows.filter((row) => selectedKeys.includes(getRowKeyValue(row))),
    [getRowKeyValue, rows, selectedKeys],
  );
  const selectedTarget = selectedTargets[0] ?? null;
  const isBatchTokenMode = action?.remoteTaskType === "token";
  const tokenAmount =
    tokenForm.amount.trim().length > 0 ? Number(tokenForm.amount) : Number.NaN;
  const tokenTariffResolution = useMemo(
    () => (selectedTarget ? inferTariffRate(selectedTarget, tokenTariffs) : null),
    [selectedTarget, tokenTariffs],
  );
  const tokenQuote = useMemo(
    () =>
      action?.remoteTaskType === "token" && tokenForm.operation === "send-credit"
        ? buildRechargeQuote(
            tokenForm.loadMode,
            tokenAmount,
            tokenTariffResolution?.pricePerUnit ?? null,
          )
        : null,
    [action?.remoteTaskType, tokenAmount, tokenForm.loadMode, tokenForm.operation, tokenTariffResolution],
  );
  const visibleFields = useMemo(() => {
    const actionFields = action?.fields ?? [];
    if (action?.remoteTaskType !== "reading" || catalogOptions.length === 0) {
      return actionFields;
    }

    return actionFields.map((field) =>
      field.key === "dataItem"
        ? {
            ...field,
            type: "select" as const,
            options: catalogOptions,
            helpText: catalogHelp ?? field.helpText,
          }
        : field,
    );
  }, [action, catalogHelp, catalogOptions]);

  useEffect(() => {
    if (!action) {
      return;
    }

    setActionValues(createInitialFormValues(action));
    setTokenForm(createDefaultRemoteTokenForm());
    setModalOpen(false);
    setReviewOpen(false);
  }, [action, page.path]);

  useEffect(() => {
    let cancelled = false;

    if (action?.remoteTaskType !== "reading" || !selectedTarget) {
      setCatalogOptions([]);
      setCatalogHelp(null);
      return;
    }

    const protocolVersion = String(selectedTarget.protocolVersion ?? "").toLowerCase();
    const endpoint = protocolVersion.includes("dlms")
      ? "/api/dlms/Read"
      : protocolVersion.includes("645")
        ? "/api/dlt645/read"
        : "/api/item/readItemList";

    setCatalogHelp(
      endpoint === "/api/item/readItemList"
        ? "Loaded from the item list used by the reference AMR task pages."
        : "Loaded from the protocol catalog for the selected meter.",
    );

    void loadTableData(endpoint, { pageNumber: 1, pageSize: 50 })
      .then((result) => {
        if (cancelled) {
          return;
        }

        const options = result.rows
          .map((row) => {
            const value =
              typeof row.obisCode === "string"
                ? row.obisCode
                : typeof row.dataIdentifier === "string"
                  ? row.dataIdentifier
                  : typeof row.id === "string"
                    ? row.id
                    : typeof row.name === "string"
                      ? row.name
                      : "";
            const label =
              typeof row.name === "string" && row.name.trim().length > 0
                ? row.name
                : value;

            return value ? { value, label } : null;
          })
          .filter((entry): entry is { label: string; value: string } => Boolean(entry));

        setCatalogOptions(options);
      })
      .catch(() => {
        if (!cancelled) {
          setCatalogOptions([]);
          setCatalogHelp("Saved read items are not available right now.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [action?.remoteTaskType, selectedTarget]);

  useEffect(() => {
    let cancelled = false;

    if (action?.remoteTaskType !== "token") {
      setTokenTariffs([]);
      return;
    }

    void loadTableData("/api/tariff/read", { pageNumber: 1, pageSize: 200 })
      .then((result) => {
        if (!cancelled) {
          setTokenTariffs(result.rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTokenTariffs([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [action?.remoteTaskType]);

  useEffect(() => {
    if (action?.remoteTaskType !== "reading" || !selectedTarget || catalogOptions.length === 0) {
      return;
    }

    const defaults = buildMeterReadingChoices(catalogOptions, selectedTarget.protocolVersion);
    const defaultChoice = resolveDefaultMeterReadingChoice(defaults);
    if (!defaultChoice) {
      return;
    }

    setActionValues((current) =>
      current.dataItem?.trim().length > 0
        ? current
        : {
            ...current,
            dataItem: defaultChoice.value,
          },
    );
  }, [action?.remoteTaskType, catalogOptions, selectedTarget]);

  if (!action) {
    return (
      <section className="page-stack">
        <p className="status-banner status-banner-error">Remote action configuration is missing.</p>
      </section>
    );
  }

  const actionLabel = readActionLabel(action);

  const openDialog = () => {
    if (!selectedTarget) {
      setFeedback(
        isBatchTokenMode ? "Select at least one target meter first." : "Select a single target meter first.",
      );
      return;
    }

    setFeedback(null);
    setReviewOpen(false);
    setModalOpen(true);
  };

  const closeDialog = () => {
    setModalOpen(false);
    setReviewOpen(false);
    setActionValues(createInitialFormValues(action));
    setTokenForm(createDefaultRemoteTokenForm());
  };

  const executeSubmit = async () => {
    if (!selectedTarget) {
      setFeedback("Select a target meter first.");
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      if (action.remoteTaskType === "token") {
        const targets = selectedTargets.length > 0 ? selectedTargets : selectedTarget ? [selectedTarget] : [];
        if (targets.length === 0) {
          throw new Error("Select at least one target meter first.");
        }

        const protocolVersions = new Set(
          targets
            .map((row) => String(row.protocolVersion ?? "").trim())
            .filter((value) => value.length > 0),
        );
        if (protocolVersions.size > 1) {
          throw new Error("Batch tasks require consistent Protocol Version.");
        }

        const results = [];
        for (const target of targets) {
          const mapping = buildRemoteTokenSendPayload(target, tokenForm);
          if (!mapping.ok || !mapping.payload) {
            throw new Error(mapping.message ?? "Token task payload is invalid.");
          }

          results.push(await runPageAction(action.endpoint, mapping.payload));
        }

        setFeedback(
          targets.length > 1
            ? `${results.length} remote token tasks created successfully.`
            : (results[0]?.message ?? `${page.title} created successfully.`),
        );
      } else {
        const mapping = buildActionPayload(action, {
          row: selectedTarget,
          values: {
            ...actionValues,
            reviewConfirmed: "true",
          },
        });

        if (!mapping.ok || !mapping.payload) {
          throw new Error(mapping.message ?? "Task payload is invalid.");
        }

        const result = await runPageAction(action.endpoint, mapping.payload);
        setFeedback(result.message ?? `${page.title} created successfully.`);
      }

      setModalOpen(false);
      setReviewOpen(false);
      setActionValues(createInitialFormValues(action));
      setTokenForm(createDefaultRemoteTokenForm());
      await refresh();
    } catch (caughtError) {
      setFeedback(caughtError instanceof Error ? caughtError.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrimarySubmit = () => {
    if (!selectedTarget) {
      setFeedback(
        isBatchTokenMode ? "Select at least one target meter first." : "Select a single target meter first.",
      );
      return;
    }

    if (action.remoteTaskType === "token") {
      const mapping = buildRemoteTokenSendPayload(selectedTarget, tokenForm);
      if (!mapping.ok) {
        setFeedback(mapping.message ?? "Token task payload is invalid.");
        return;
      }
    } else {
      const mapping = buildActionPayload(action, {
        row: selectedTarget,
        values: {
          ...actionValues,
          reviewConfirmed: "true",
        },
      });

      if (!mapping.ok) {
        setFeedback(mapping.message ?? "Task payload is invalid.");
        return;
      }
    }

    if (action.requiresReviewStep || action.confirmMessage) {
      setReviewOpen(true);
      return;
    }

    void executeSubmit();
  };

  return (
    <section className="page-stack ds-page">
      <Surface className="data-view-header ds-toolbar" tone="raised">
        <div className="data-page-toolbar-row ds-toolbar__row">
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

          <div className="action-strip data-page-action-strip ds-toolbar__actions">
            <Button onClick={openDialog} size="sm" tone="primary">
              {actionLabel}
            </Button>
            <Button
              onClick={() => navigate(action.successRedirectPath ?? "/remote-operation-task/remote-meter-reading-task")}
              size="sm"
              tone="ghost"
            >
              Open Task Monitor
            </Button>
            <Button
              onClick={() => {
                void refresh()
                  .then(() => setFeedback("Data refreshed"))
                  .catch((caughtError) =>
                    setFeedback(caughtError instanceof Error ? caughtError.message : "Refresh failed"),
                  );
              }}
              size="sm"
              tone="ghost"
            >
              Refresh
            </Button>
          </div>
        </div>

        {feedback ? <p className="status-banner ds-status-message">{feedback}</p> : null}
        {error ? <p className="status-banner status-banner-error ds-status-message ds-status-message--danger">{error}</p> : null}
      </Surface>

      <DataTable
        columns={page.columns}
        getRowKey={getRowKeyValue}
        loading={loading}
        onPageChange={setPageNumber}
        onPageSizeChange={(nextSize) => {
          setPageNumber(1);
          setPageSize(nextSize);
        }}
        onRowAction={() => undefined}
        onRowClick={(row) => {
          if (!selectedKeys.includes(getRowKeyValue(row))) {
            if (!isBatchTokenMode && selectedTarget && getRowKeyValue(selectedTarget) !== getRowKeyValue(row)) {
              toggleRow(selectedTarget);
            }
            toggleRow(row);
          }
        }}
        onToggleAll={() => undefined}
        onToggleRow={(row) => {
          if (!isBatchTokenMode && selectedTarget && getRowKeyValue(selectedTarget) !== getRowKeyValue(row)) {
            toggleRow(selectedTarget);
          }
          toggleRow(row);
        }}
        pageNumber={pageNumber}
        pageSize={pageSize}
        rowActions={[]}
        rowActionDisplay="inline"
        rows={rows}
        selectedKeys={selectedKeys}
        selectionMode={isBatchTokenMode ? "multiple" : "single"}
        total={total}
        columnFilters={draftFilters}
        onColumnFilterChange={(key, value) => {
          setDraftFilters((current) => ({ ...current, [key]: value }));
        }}
        onColumnSearch={() => {
          setFeedback(null);
          search();
        }}
        title={page.title}
      />

      {modalOpen && selectedTarget ? (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && closeDialog()}>
          <Surface as="div" className="modal-card ds-modal-card" tone="raised">
            <div className="modal-header">
              <div className="modal-header-info">
                <span className="modal-eyebrow">{page.menuLabel}</span>
                <h3 className="modal-title">{actionLabel}</h3>
                <p className="modal-confirm-message">
                  {isBatchTokenMode && selectedTargets.length > 1
                    ? `${selectedTargets.length} selected meters`
                    : `Meter ${String(selectedTarget.meterId ?? "--")} / ${String(selectedTarget.customerName ?? "Unknown customer")}`}
                </p>
              </div>
              <Button aria-label="Close" className="modal-close" onClick={closeDialog} size="icon" tone="ghost">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Button>
            </div>

            <div className="modal-body">
              {action.remoteTaskType === "token" ? (
                <div className="modal-grid">
                  <label className="modal-field">
                    <span className="modal-field-label">Name</span>
                    <input
                      className="modal-input"
                      onChange={(event) =>
                        setTokenForm((current) => ({
                          ...current,
                          taskName: event.target.value,
                        }))
                      }
                      placeholder="Task name"
                      value={tokenForm.taskName}
                    />
                  </label>

                  <label className="modal-field">
                    <span className="modal-field-label">Schedule Date</span>
                    <input
                      className="modal-input"
                      onChange={(event) =>
                        setTokenForm((current) => ({
                          ...current,
                          scheduleDate: event.target.value,
                        }))
                      }
                      type="date"
                      value={tokenForm.scheduleDate}
                    />
                  </label>

                  <label className="modal-field">
                    <span className="modal-field-label">Action</span>
                    <select
                      className="modal-input"
                      onChange={(event) =>
                        setTokenForm((current) => ({
                          ...current,
                          operation: event.target.value === "clear-credit" ? "clear-credit" : "send-credit",
                        }))
                      }
                      value={tokenForm.operation}
                    >
                      <option value="send-credit">Send Credit</option>
                      <option value="clear-credit">Clear Credit</option>
                    </select>
                  </label>

                  {tokenForm.operation === "send-credit" ? (
                    <>
                      <label className="modal-field">
                        <span className="modal-field-label">Recharge By</span>
                        <select
                          className="modal-input"
                          onChange={(event) =>
                            setTokenForm((current) => ({
                              ...current,
                              loadMode: event.target.value === "unit" ? "unit" : "naira",
                            }))
                          }
                          value={tokenForm.loadMode}
                        >
                          <option value="naira">Naira</option>
                          <option value="unit">Unit</option>
                        </select>
                      </label>

                      <label className="modal-field">
                        <span className="modal-field-label">{getRemoteTokenAmountLabel(tokenForm.loadMode)}</span>
                        <input
                          className="modal-input"
                          min="0"
                          onChange={(event) =>
                            setTokenForm((current) => ({
                              ...current,
                              amount: event.target.value,
                            }))
                          }
                          placeholder={tokenForm.loadMode === "naira" ? "5000" : "100"}
                          step="0.01"
                          type="number"
                          value={tokenForm.amount}
                        />
                      </label>

                      <div className="token-flow-modal__summary" style={{ gridColumn: "1 / -1" }}>
                        <div>
                          <span>Tariff Rate</span>
                          <strong>
                            {tokenTariffResolution?.pricePerUnit != null
                              ? `${formatNaira(tokenTariffResolution.pricePerUnit)}/unit`
                              : "--"}
                          </strong>
                        </div>
                        <div>
                          <span>Units</span>
                          <strong>{tokenQuote ? `${formatNumber(tokenQuote.units)} units` : "--"}</strong>
                        </div>
                        <div>
                          <span>Amount</span>
                          <strong>
                            {tokenQuote?.amountNaira != null ? formatNaira(tokenQuote.amountNaira) : "--"}
                          </strong>
                        </div>
                      </div>
                    </>
                  ) : null}

                  <label className="modal-field" data-span="full">
                    <span className="modal-field-label">Reason</span>
                    <textarea
                      className="modal-input modal-textarea"
                      onChange={(event) =>
                        setTokenForm((current) => ({
                          ...current,
                          operatorReason: event.target.value,
                        }))
                      }
                      placeholder="Reason"
                      rows={4}
                      value={tokenForm.operatorReason}
                    />
                  </label>
                </div>
              ) : (
                <div className="modal-grid">
                  {visibleFields.map((field: ActionField) => {
                    const isTextarea = field.type === "textarea";
                    const isSelect = field.type === "select";

                    return (
                      <label className="modal-field" key={field.key}>
                        <span className="modal-field-label">{field.label}</span>
                        {isTextarea ? (
                          <textarea
                            className="modal-input modal-textarea"
                            onChange={(event) =>
                              setActionValues((current) => ({
                                ...current,
                                [field.key]: event.target.value,
                              }))
                            }
                            placeholder={field.placeholder}
                            rows={6}
                            value={actionValues[field.key] ?? ""}
                          />
                        ) : isSelect ? (
                          <select
                            className="modal-input"
                            onChange={(event) =>
                              setActionValues((current) => ({
                                ...current,
                                [field.key]: event.target.value,
                              }))
                            }
                            value={actionValues[field.key] ?? ""}
                          >
                            <option value="">{field.placeholder}</option>
                            {(field.options ?? []).map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className="modal-input"
                            onChange={(event) =>
                              setActionValues((current) => ({
                                ...current,
                                [field.key]: event.target.value,
                              }))
                            }
                            placeholder={field.placeholder}
                            type={field.type ?? "text"}
                            value={actionValues[field.key] ?? ""}
                          />
                        )}
                        {field.helpText ? <span className="modal-field-help">{field.helpText}</span> : null}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <Button className="modal-btn modal-btn--ghost" onClick={closeDialog} tone="ghost">
                Cancel
              </Button>
              <Button
                className="modal-btn modal-btn--primary"
                disabled={submitting}
                onClick={handlePrimarySubmit}
                tone="primary"
              >
                {submitting ? "Processing..." : action.requiresReviewStep || action.confirmMessage ? "Review" : "Confirm"}
              </Button>
            </div>
          </Surface>
        </div>
      ) : null}

      {reviewOpen ? (
        <ConfirmModal
          message={buildReviewMessage(
            page,
            action,
            selectedTarget,
            actionValues,
            tokenForm,
            tokenQuote,
            tokenTariffResolution?.pricePerUnit ?? null,
          )}
          onCancel={() => setReviewOpen(false)}
          onConfirm={() => void executeSubmit()}
          title={actionLabel}
        />
      ) : null}
    </section>
  );
}

export default RemoteOperationPage;
