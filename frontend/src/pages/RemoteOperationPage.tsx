import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConfirmModal } from "../components/common/ConfirmModal";
import { DataTable } from "../components/common/DataTable";
import { QuickMeterReadModal } from "../components/common/QuickMeterReadModal";
import { SearchBar } from "../components/common/SearchBar";
import { useDataTable } from "../hooks/useDataTable";
import { loadTableData, runPageAction } from "../services/api";
import { formatNaira, formatNumber } from "../services/currency";
import { createInitialFormValues } from "../services/form-values";
import {
  buildMeterReadingChoices,
  CUSTOM_METER_READING_CHOICE_KEY,
  DEFAULT_METER_READING_CHOICE_KEY,
  resolveDefaultMeterReadingChoice,
  type MeterReadingChoiceKey,
} from "../services/meter-reading-options";
import { buildActionPayload } from "../services/payload-mapper";
import {
  buildRemoteTokenConfirmationLines,
  buildRemoteTokenReceipt,
  buildRemoteTokenSendPayload,
  createDefaultRemoteTokenForm,
  formatRemoteTokenValue,
  getRemoteTokenAmountLabel,
  printRemoteTokenReceipt,
  shouldOpenRemoteTokenReceipt,
  type RemoteTokenReceipt,
  type RemoteTokenFormState,
} from "../services/remote-token-flow";
import {
  getRemotePresetLabel,
  getRemotePresets,
  getRemoteTaskFriendlyName,
} from "../services/remote-operation-presets";
import { buildRechargeQuote, inferTariffRate } from "../services/token-generate-flow";
import type { ActionConfig, DataPageConfig, DataRow } from "../types";

interface RemoteOperationPageProps {
  page: DataPageConfig;
}

function getRiskCopy(action: ActionConfig) {
  if (action.dangerLevel === "high") {
    return {
      eyebrow: "High-risk command",
      body: "This command can change device state or send raw meter instructions. Review the target and payload carefully before submitting.",
    };
  }

  if (action.dangerLevel === "medium") {
    return {
      eyebrow: "Protected command",
      body: "This command modifies remote meter configuration. Confirm the exact parameter and value before sending it upstream.",
    };
  }

  return {
    eyebrow: "Read operation",
    body: "This task retrieves data from the target meter and has the lowest operational risk in this workflow.",
  };
}

function formatReviewValue(action: ActionConfig, key: string, value: string) {
  if (!value) {
    return "--";
  }

  if (action.remoteTaskType === "token" && key === "tokenValue") {
    return `${"*".repeat(Math.min(8, value.length))} (${value.length} chars)`;
  }

  if (action.remoteTaskType === "transparent-forwarding" && key === "commandPayload") {
    return `${value.slice(0, 18)}${value.length > 18 ? "..." : ""} (${value.length} chars)`;
  }

  return value;
}

function createDefaultCommandValues(action: ActionConfig) {
  const baseValues = createInitialFormValues(action);

  if (action.remoteTaskType !== "reading") {
    return baseValues;
  }

  const quickReadPreset = getRemotePresets(action).find((preset) => preset.key === "instant-read");

  return {
    ...baseValues,
    ...quickReadPreset?.values,
  };
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

  const commandAction = useMemo(() => page.toolbarActions?.[0] ?? null, [page]);
  const activeAction = commandAction;
  const [commandValues, setCommandValues] = useState<Record<string, string>>(
    () => (commandAction ? createDefaultCommandValues(commandAction) : {}),
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [quickReadOpen, setQuickReadOpen] = useState(false);
  const [quickReadChoiceKey, setQuickReadChoiceKey] = useState<MeterReadingChoiceKey | typeof CUSTOM_METER_READING_CHOICE_KEY>(
    DEFAULT_METER_READING_CHOICE_KEY,
  );
  const [submitting, setSubmitting] = useState(false);
  const [catalogOptions, setCatalogOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogHelp, setCatalogHelp] = useState<string | null>(null);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [tokenTariffs, setTokenTariffs] = useState<DataRow[]>([]);
  const [tokenForm, setTokenForm] = useState<RemoteTokenFormState>(() =>
    createDefaultRemoteTokenForm(),
  );
  const [tokenSuccessReceipt, setTokenSuccessReceipt] = useState<RemoteTokenReceipt | null>(null);

  const selectedTarget =
    rows.find((row) => selectedKeys.includes(getRowKeyValue(row))) ??
    rows.find((row) => getRowKeyValue(row) === selectedKeys[0]) ??
    null;

  const riskCopy = activeAction ? getRiskCopy(activeAction) : null;
  const presets = activeAction ? getRemotePresets(activeAction) : [];
  const presetLabel = activeAction ? getRemotePresetLabel(activeAction.remoteTaskType) : "";
  const friendlyTaskName = activeAction ? getRemoteTaskFriendlyName(activeAction.remoteTaskType) : "";
  const isSimpleReadingFlow = activeAction?.remoteTaskType === "reading";
  const isTokenDeliveryFlow = activeAction?.remoteTaskType === "token";
  const useSimpleLayout = isSimpleReadingFlow || isTokenDeliveryFlow;
  const numericTokenAmount =
    tokenForm.amount.trim().length > 0 ? Number(tokenForm.amount) : Number.NaN;
  const tokenTariffResolution = useMemo(
    () => (isTokenDeliveryFlow && selectedTarget ? inferTariffRate(selectedTarget, tokenTariffs) : null),
    [isTokenDeliveryFlow, selectedTarget, tokenTariffs],
  );
  const tokenQuote = useMemo(
    () =>
      isTokenDeliveryFlow && tokenForm.operation === "send-credit"
        ? buildRechargeQuote(
            tokenForm.loadMode,
            numericTokenAmount,
            tokenTariffResolution?.pricePerUnit ?? null,
          )
        : null,
    [isTokenDeliveryFlow, numericTokenAmount, tokenForm.loadMode, tokenForm.operation, tokenTariffResolution],
  );
  const meterReadingChoices = useMemo(
    () => buildMeterReadingChoices(catalogOptions, selectedTarget?.protocolVersion),
    [catalogOptions, selectedTarget?.protocolVersion],
  );
  const defaultReadingChoice = useMemo(
    () => resolveDefaultMeterReadingChoice(meterReadingChoices),
    [meterReadingChoices],
  );

  useEffect(() => {
    if (!activeAction) {
      return;
    }

    setCommandValues(createDefaultCommandValues(activeAction));
    setQuickReadOpen(false);
    setQuickReadChoiceKey(DEFAULT_METER_READING_CHOICE_KEY);
    setTokenModalOpen(false);
    setTokenForm(createDefaultRemoteTokenForm());
    setTokenSuccessReceipt(null);
    setReviewOpen(false);
    setFeedback(null);
  }, [activeAction]);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      if (!activeAction || activeAction.remoteTaskType !== "reading" || !selectedTarget) {
        setCatalogLoading(false);
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

      setCatalogLoading(true);
      setCatalogHelp(
        endpoint === "/api/dlms/Read"
          ? "Loaded from the DLMS item catalog for this meter."
          : endpoint === "/api/dlt645/read"
            ? "Loaded from the DLT645 data identifier catalog for this meter."
            : "Loaded from the generic item catalog because the meter protocol is not explicit.",
      );

      try {
        const result = await loadTableData(endpoint, {
          pageNumber: 1,
          pageSize: 50,
        });

        if (cancelled) {
          return;
        }

        const options = result.rows
          .map((row) => {
            const primary =
              typeof row.obisCode === "string"
                ? row.obisCode
                : typeof row.dataIdentifier === "string"
                  ? row.dataIdentifier
                  : typeof row.id === "string"
                    ? row.id
                    : typeof row.name === "string"
                      ? row.name
                      : "";
            const name =
              typeof row.name === "string"
                ? row.name
                : typeof row.obisCode === "string"
                  ? row.obisCode
                  : typeof row.dataIdentifier === "string"
                    ? row.dataIdentifier
                    : primary;

            return primary
              ? {
                  value: primary,
                  label: primary === name ? name : `${name} (${primary})`,
                }
              : null;
          })
          .filter((option): option is { label: string; value: string } => Boolean(option))
          .slice(0, 20);

        setCatalogOptions(options);
      } catch {
        if (!cancelled) {
          setCatalogOptions([]);
          setCatalogHelp(
            "Saved reading options are not available for this meter right now. The default reading will still work.",
          );
        }
      } finally {
        if (!cancelled) {
          setCatalogLoading(false);
        }
      }
    }

    void loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [activeAction, selectedTarget]);

  useEffect(() => {
    let cancelled = false;

    if (!isTokenDeliveryFlow) {
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
  }, [isTokenDeliveryFlow]);

  useEffect(() => {
    if (!selectedTarget) {
      setQuickReadOpen(false);
      setTokenModalOpen(false);
    }
  }, [selectedTarget]);

  useEffect(() => {
    if (!activeAction || !isSimpleReadingFlow || !selectedTarget) {
      return;
    }

    if (quickReadChoiceKey === CUSTOM_METER_READING_CHOICE_KEY) {
      return;
    }

    const activeChoice =
      meterReadingChoices.find((choice) => choice.key === quickReadChoiceKey) ??
      defaultReadingChoice;
    if (!activeChoice) {
      return;
    }

    setCommandValues((current) => {
      if (current.dataItem?.trim() === activeChoice.value) {
        return current;
      }

      return {
        ...current,
        dataItem: activeChoice.value,
      };
    });
  }, [activeAction, defaultReadingChoice, isSimpleReadingFlow, meterReadingChoices, quickReadChoiceKey, selectedTarget]);

  if (!activeAction || !riskCopy) {
    return (
      <section className="page-stack">
        <p className="status-banner status-banner-error">Remote action configuration is missing.</p>
      </section>
    );
  }

  const selectSingleTarget = (row: DataRow) => {
    const rowKey = getRowKeyValue(row);
    const selectedSet = new Set(selectedKeys);

    for (const selectedKey of selectedKeys) {
      if (selectedKey === rowKey) {
        continue;
      }

      const selectedRow = rows.find((entry) => getRowKeyValue(entry) === selectedKey);
      if (selectedRow) {
        toggleRow(selectedRow);
      }
    }

    if (!selectedSet.has(rowKey)) {
      toggleRow(row);
    }
  };

  const handleSelectTarget = (row: DataRow) => {
    selectSingleTarget(row);

    if (!isSimpleReadingFlow) {
      if (isTokenDeliveryFlow) {
        setFeedback(null);
        setTokenSuccessReceipt(null);
        setTokenForm(createDefaultRemoteTokenForm());
        setTokenModalOpen(true);
      }
      return;
    }

    const nextValues = createDefaultCommandValues(activeAction);
    nextValues.dataItem = defaultReadingChoice?.value ?? "";

    setFeedback(null);
    setQuickReadChoiceKey(DEFAULT_METER_READING_CHOICE_KEY);
    setCommandValues(nextValues);
    setQuickReadOpen(true);
  };

  const submitTokenDelivery = async () => {
    const mapping = buildRemoteTokenSendPayload(selectedTarget ?? undefined, tokenForm);
    if (!mapping.ok || !mapping.payload) {
      setFeedback(mapping.message ?? "Token request is invalid");
      return;
    }

    setSubmitting(true);
    try {
      const result = await runPageAction(activeAction.endpoint, mapping.payload);
      setFeedback(
        result.message ??
          `Remote token request processed for ${String(selectedTarget?.meterId ?? "--")}.`,
      );
      setReviewOpen(false);
      if (shouldOpenRemoteTokenReceipt(result)) {
        setTokenSuccessReceipt(
          buildRemoteTokenReceipt(result, selectedTarget ?? undefined, tokenForm),
        );
        setTokenModalOpen(false);
      }
      if (result.success) {
        setTokenForm(createDefaultRemoteTokenForm());
      }
      await refresh();
    } catch (caughtError) {
      setFeedback(caughtError instanceof Error ? caughtError.message : "Token delivery failed");
    } finally {
      setSubmitting(false);
    }
  };

  const submitCommand = async () => {
    if (isTokenDeliveryFlow) {
      await submitTokenDelivery();
      return;
    }

    const mapping = buildActionPayload(activeAction, {
      row: selectedTarget ?? undefined,
      values: {
        ...commandValues,
        reviewConfirmed: "true",
      },
    });

    if (!mapping.ok || !mapping.payload) {
      setFeedback(mapping.message ?? "Command payload is invalid");
      return;
    }

    setSubmitting(true);
    try {
      const result = await runPageAction(activeAction.endpoint, mapping.payload);
      setFeedback(
        result.message ??
          (isSimpleReadingFlow && selectedTarget
            ? `Meter reading started for ${String(selectedTarget.meterId ?? "--")}.`
            : `${page.menuLabel} task created successfully.`),
      );
      setReviewOpen(false);
      if (isSimpleReadingFlow) {
        setQuickReadOpen(false);
        setCommandValues(createDefaultCommandValues(activeAction));
      }
      await refresh();
    } catch (caughtError) {
      setFeedback(caughtError instanceof Error ? caughtError.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitClick = () => {
    if (isTokenDeliveryFlow) {
      const mapping = buildRemoteTokenSendPayload(selectedTarget ?? undefined, tokenForm);
      if (!mapping.ok) {
        setFeedback(mapping.message ?? "Token request is invalid");
        return;
      }

      setReviewOpen(true);
      return;
    }

    const mapping = buildActionPayload(activeAction, {
      row: selectedTarget ?? undefined,
      values: {
        ...commandValues,
        reviewConfirmed: "true",
      },
    });

    if (!mapping.ok) {
      setFeedback(mapping.message ?? "Command payload is invalid");
      return;
    }

    if (activeAction.requiresReviewStep || activeAction.confirmMessage) {
      setReviewOpen(true);
      return;
    }

    void submitCommand();
  };

  const applyPreset = (values: Record<string, string>) => {
    setCommandValues((current) => ({
      ...current,
      ...values,
    }));
  };

  const visibleFields = (activeAction.fields ?? []).map((field) => {
    if (activeAction.remoteTaskType === "reading" && field.key === "dataItem" && catalogOptions.length > 0) {
      return {
        ...field,
        type: "select" as const,
        placeholder: catalogLoading ? "Loading item catalog..." : "Select a meter register or item",
        options: catalogOptions,
        helpText: catalogHelp ?? field.helpText,
      };
    }

    return field;
  });
  const quickReadField = visibleFields.find((field) => field.key === "dataItem");
  const commandFields = isSimpleReadingFlow ? visibleFields.filter((field) => field.key === "dataItem") : visibleFields;
  const tokenCanContinue =
    tokenForm.operation === "clear-credit" ||
    (Number.isFinite(numericTokenAmount) && numericTokenAmount > 0);
  const tokenRateLabel =
    tokenTariffResolution?.pricePerUnit !== null && tokenTariffResolution?.pricePerUnit !== undefined
      ? `${formatNaira(tokenTariffResolution.pricePerUnit)}/unit`
      : "Estimating from backend";

  return (
    <section className={`page-stack remote-ops-page${useSimpleLayout ? " remote-ops-page--simple" : ""}`}>
      <div className={`remote-ops-risk remote-ops-risk--${activeAction.dangerLevel ?? "low"}`}>
        <div>
          <p className="remote-ops-risk__eyebrow">
            {isSimpleReadingFlow
              ? "Quick meter reading"
              : isTokenDeliveryFlow
                ? "Remote token delivery"
                : riskCopy.eyebrow}
          </p>
          <h2 className="remote-ops-risk__title">{page.title}</h2>
          <p className="remote-ops-risk__body">
            {isSimpleReadingFlow
              ? "Click any meter in the table. A small popup will open so you can choose what to read and start immediately."
              : isTokenDeliveryFlow
                ? "Click any meter or customer to open a simple recharge modal. Choose credit or clear credit, see the naira or unit translation instantly, review, confirm, and finish with a receipt."
                : riskCopy.body}
          </p>
          {useSimpleLayout ? null : (
            <div className="remote-ops-steps">
              <span>1. Choose meter</span>
              <span>2. Pick a template</span>
              <span>3. Review and submit</span>
            </div>
          )}
        </div>
        <button
          className="button button-ghost"
          onClick={() =>
            navigate(
              activeAction.successRedirectPath ??
                `${page.path.replace("/remote-operation/", "/remote-operation-task/")}-task`,
            )
          }
          type="button"
        >
          Open Task Monitor
        </button>
      </div>

      <div className={`remote-ops-layout${useSimpleLayout ? " remote-ops-layout--simple" : ""}`}>
        <div className="remote-ops-panel table-panel table-panel-vercel">
          <div className="table-panel-header">
            <div>
              <p className="table-panel-eyebrow">
                {useSimpleLayout ? "Tap a meter" : "Target selection"}
              </p>
              <div className="table-panel-title-row">
                <strong className="table-panel-title">{total.toLocaleString()} meters</strong>
                <span className="table-panel-range">
                  {isSimpleReadingFlow
                    ? "Click once to open the reading popup"
                    : isTokenDeliveryFlow
                      ? "Click once to open the token send sheet"
                      : "Choose a single target meter"}
                </span>
              </div>
            </div>
          </div>

          <div className="remote-ops-search">
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
          </div>

          <DataTable
            columns={page.columns}
            columnFilters={draftFilters}
            getRowKey={getRowKeyValue}
            loading={loading}
            onColumnFilterChange={(key, value) =>
              setDraftFilters((current) => ({
                ...current,
                [key]: value,
              }))
            }
            onColumnSearch={() => {
              setFeedback(null);
              search();
            }}
            onPageChange={setPageNumber}
            onPageSizeChange={(nextSize) => {
              setPageNumber(1);
              setPageSize(nextSize);
            }}
            onRowAction={() => undefined}
            onToggleAll={() => undefined}
            onToggleRow={handleSelectTarget}
            pageNumber={pageNumber}
            pageSize={pageSize}
            onRowClick={useSimpleLayout ? handleSelectTarget : undefined}
            rowActions={[]}
            rows={rows}
            selectedKeys={selectedKeys}
            selectionMode="single"
            total={total}
          />

          {useSimpleLayout ? (
            <div className="remote-ops-feedback">
              {feedback ? <p className="status-banner">{feedback}</p> : null}
              {error ? <p className="status-banner status-banner-error">{error}</p> : null}
            </div>
          ) : null}
        </div>

        {useSimpleLayout ? null : (
          <aside className="remote-ops-panel remote-ops-command-card">
          <div className="remote-ops-command-card__header">
            <div>
              <p className="remote-ops-command-card__eyebrow">Command builder</p>
              <h3 className="remote-ops-command-card__title">{friendlyTaskName}</h3>
            </div>
            <span className={`remote-ops-risk-chip remote-ops-risk-chip--${activeAction.dangerLevel ?? "low"}`}>
              {activeAction.dangerLevel ?? "low"} risk
            </span>
          </div>

          {presets.length > 0 ? (
            <div className="remote-ops-presets">
              <span className="remote-ops-presets__label">{presetLabel}</span>
              <div className="remote-ops-presets__grid">
                {presets.map((preset) => (
                  <button
                    className="remote-ops-preset"
                    key={preset.key}
                    onClick={() => applyPreset(preset.values)}
                    type="button"
                  >
                    <strong>{preset.label}</strong>
                    <span>{preset.description}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="remote-ops-target-summary">
            <span className="remote-ops-target-summary__label">Selected meter</span>
            {selectedTarget ? (
              <div className="remote-ops-target-summary__grid">
                <strong>{String(selectedTarget.meterId ?? "--")}</strong>
                <span>{String(selectedTarget.customerName ?? "Unknown customer")}</span>
                <span>{String(selectedTarget.stationId ?? "No station")}</span>
              </div>
            ) : (
              <p className="remote-ops-target-summary__empty">
                Select a meter from the table before submitting a command.
              </p>
            )}
          </div>

          <div className="remote-ops-command-fields">
            {commandFields.map((field) => {
              const isTextarea = field.type === "textarea";
              const isSelect = field.type === "select";

              return (
                <label
                  className="modal-field"
                  data-span={isTextarea ? "full" : undefined}
                  key={field.key}
                >
                  <span className="modal-field-label">
                    {field.label}
                    {field.required ? <span className="modal-field-required"> *</span> : null}
                  </span>
                  {isTextarea ? (
                    <textarea
                      className="modal-input modal-textarea"
                      onChange={(event) =>
                        setCommandValues((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }))
                      }
                      placeholder={field.placeholder}
                      rows={6}
                      value={commandValues[field.key] ?? ""}
                    />
                  ) : isSelect ? (
                    <select
                      className="modal-input"
                      onChange={(event) =>
                        setCommandValues((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }))
                      }
                      value={commandValues[field.key] ?? ""}
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
                        setCommandValues((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }))
                      }
                      placeholder={field.placeholder}
                      type={field.type ?? "text"}
                      value={commandValues[field.key] ?? ""}
                    />
                  )}
                  {field.helpText ? <span className="modal-field-help">{field.helpText}</span> : null}
                </label>
              );
            })}
          </div>

          <div className="remote-ops-command-card__footer">
            <button
              className="button button-ghost"
              onClick={() => setCommandValues(createDefaultCommandValues(activeAction))}
              type="button"
            >
              Reset Command
            </button>
            <button
              className={`button ${activeAction.dangerLevel === "high" ? "button-danger" : "button-primary"}`}
              disabled={submitting || !selectedTarget}
              onClick={handleSubmitClick}
              type="button"
            >
              {submitting ? "Submitting..." : activeAction.requiresReviewStep ? "Review Command" : "Submit Command"}
            </button>
          </div>

          {feedback ? <p className="status-banner">{feedback}</p> : null}
          {error ? <p className="status-banner status-banner-error">{error}</p> : null}
          </aside>
        )}
      </div>

      {isSimpleReadingFlow && quickReadOpen && selectedTarget ? (
        <QuickMeterReadModal
          catalogHelp={catalogHelp}
          catalogLoading={catalogLoading}
          catalogOptions={catalogOptions}
          feedback={feedback}
          onChoiceChange={(choiceKey) => {
            setFeedback(null);
            setQuickReadChoiceKey(choiceKey);

            if (choiceKey === CUSTOM_METER_READING_CHOICE_KEY) {
              return;
            }

            const selectedChoice = meterReadingChoices.find((choice) => choice.key === choiceKey);
            if (!selectedChoice) {
              return;
            }

            setCommandValues((current) => ({
              ...current,
              dataItem: selectedChoice.value,
            }));
          }}
          onCustomValueChange={(value) => {
            setFeedback(null);
            setQuickReadChoiceKey(CUSTOM_METER_READING_CHOICE_KEY);
            setCommandValues((current) => ({
              ...current,
              dataItem: value,
            }));
          }}
          onClose={() => setQuickReadOpen(false)}
          onSubmit={handleSubmitClick}
          placeholder={quickReadField?.placeholder ?? "Register / OBIS / item code"}
          readingChoices={meterReadingChoices}
          selectedChoiceKey={quickReadChoiceKey}
          selectedTarget={selectedTarget}
          submitting={submitting}
          value={commandValues.dataItem ?? ""}
        />
      ) : null}

      {isTokenDeliveryFlow && tokenModalOpen && selectedTarget ? (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setTokenModalOpen(false);
            }
          }}
        >
          <section className="token-flow-modal" role="dialog" aria-modal="true" aria-label="Remote token delivery">
            <div className="token-flow-modal__header">
              <div>
                <p className="token-flow-modal__eyebrow">Recharge Customer</p>
                <h2>{String(selectedTarget.customerName ?? "Selected meter")}</h2>
                <p className="token-flow-modal__sub">
                  {String(selectedTarget.meterId ?? "--")} - {String(selectedTarget.customerId ?? "No customer id")}
                </p>
              </div>
              <button
                className="modal-close"
                onClick={() => setTokenModalOpen(false)}
                type="button"
              >
                <span className="sr-only">Close</span>
                x
              </button>
            </div>

            <div className="token-flow-modal__body">
              <div className="token-flow-modal__summary">
                <div>
                  <span>Tariff</span>
                  <strong>
                    {tokenTariffResolution?.tariffName ??
                      tokenTariffResolution?.tariffId ??
                      String(selectedTarget.tariffId ?? "--")}
                  </strong>
                </div>
                <div>
                  <span>Rate</span>
                  <strong>{tokenRateLabel}</strong>
                </div>
                <div>
                  <span>Station</span>
                  <strong>{String(selectedTarget.stationId ?? "No station")}</strong>
                </div>
              </div>

              <div className="token-flow-form-grid">
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
                    <option value="send-credit">Send credit token</option>
                    <option value="clear-credit">Clear credit</option>
                  </select>
                </label>

                {tokenForm.operation === "send-credit" ? (
                  <label className="modal-field">
                    <span className="modal-field-label">Recharge by</span>
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
                      <option value="naira">Naira amount</option>
                      <option value="unit">Unit quantity</option>
                    </select>
                  </label>
                ) : (
                  <div className="token-flow-quote-card">
                    <span>Action</span>
                    <strong>Clear the current credit balance remotely.</strong>
                  </div>
                )}
              </div>

              {tokenForm.operation === "send-credit" ? (
                <>
                  <div className="token-flow-form-grid">
                    <label className="modal-field">
                      <span className="modal-field-label">{getRemoteTokenAmountLabel(tokenForm.loadMode)}</span>
                      <input
                        className="modal-input"
                        inputMode="decimal"
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
                      <span className="modal-field-help">
                        {tokenForm.loadMode === "naira"
                          ? "Enter the money to collect. Units are calculated instantly."
                          : "Enter the units to vend. Naira is calculated instantly."}
                      </span>
                    </label>

                    <div className="token-flow-quote-card">
                      <span>{tokenForm.loadMode === "naira" ? "Estimated units" : "Estimated naira"}</span>
                      <strong>
                        {tokenQuote
                          ? tokenForm.loadMode === "naira"
                            ? `${formatNumber(tokenQuote.units)} units`
                            : tokenQuote.amountNaira !== null
                              ? formatNaira(tokenQuote.amountNaira)
                              : "Waiting for rate"
                          : "Enter amount to quote"}
                      </strong>
                    </div>
                  </div>

                  <div className="token-flow-modal__summary">
                    <div>
                      <span>Units to vend</span>
                      <strong>{tokenQuote ? `${formatNumber(tokenQuote.units)} units` : "Calculated on send"}</strong>
                    </div>
                    <div>
                      <span>Naira to collect</span>
                      <strong>
                        {tokenQuote?.amountNaira !== null && tokenQuote?.amountNaira !== undefined
                          ? formatNaira(tokenQuote.amountNaira)
                          : tokenForm.loadMode === "unit" && Number.isFinite(numericTokenAmount) && numericTokenAmount > 0
                            ? "Calculated on send"
                            : "--"}
                      </strong>
                    </div>
                    <div>
                      <span>Pricing source</span>
                      <strong>{tokenTariffResolution?.source ?? "backend estimate"}</strong>
                    </div>
                  </div>
                </>
              ) : (
                <div className="token-flow-confirm-card">
                  <p className="token-flow-confirm-card__eyebrow">Clear Credit</p>
                  <h3>Generate a clear-credit token and deliver it remotely</h3>
                  <p className="modal-field-help">
                    This flow skips the recharge amount and goes straight to confirmation.
                  </p>
                </div>
              )}

              <div className="token-flow-modal__actions">
                <button
                  className="button button-ghost"
                  onClick={() => {
                    setFeedback(null);
                    setTokenForm(createDefaultRemoteTokenForm());
                  }}
                  type="button"
                >
                  Reset
                </button>
                <button
                  className="button button-primary"
                  disabled={submitting || !tokenCanContinue}
                  onClick={handleSubmitClick}
                  type="button"
                >
                  {submitting ? "Sending..." : "Continue to Confirm"}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {tokenSuccessReceipt ? (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setTokenSuccessReceipt(null);
            }
          }}
        >
          <section className="token-success-modal" role="dialog" aria-modal="true" aria-label="Remote token success receipt">
            <div className="token-success-modal__header">
              <div>
                <p className="token-success-modal__eyebrow">{tokenSuccessReceipt.status === "success" ? "Transaction Successful" : "Token Generated"}</p>
                <h2>{tokenSuccessReceipt.status === "success" ? "Receipt ready" : "Delivery follow-up needed"}</h2>
              </div>
              <span className={`remote-ops-risk-chip remote-ops-risk-chip--${tokenSuccessReceipt.status === "success" ? "low" : "medium"}`}>{tokenSuccessReceipt.status === "success" ? "Success" : "Pending"}</span>
            </div>

            <div className="token-success-token">
              {formatRemoteTokenValue(tokenSuccessReceipt.tokenValue)}
            </div>

            <div className="token-success-grid">
              <div>
                <span>Receipt</span>
                <strong>{tokenSuccessReceipt.receiptNumber}</strong>
              </div>
              <div>
                <span>Customer</span>
                <strong>{tokenSuccessReceipt.customerName}</strong>
              </div>
              <div>
                <span>Meter</span>
                <strong>{tokenSuccessReceipt.meterId}</strong>
              </div>
              <div>
                <span>Operation</span>
                <strong>{tokenSuccessReceipt.operation === "clear-credit" ? "Clear credit" : "Send credit"}</strong>
              </div>
              <div>
                <span>Units</span>
                <strong>{tokenSuccessReceipt.units !== null ? formatNumber(tokenSuccessReceipt.units) : "--"}</strong>
              </div>
              <div>
                <span>Amount</span>
                <strong>{tokenSuccessReceipt.amountNaira !== null ? formatNaira(tokenSuccessReceipt.amountNaira) : "--"}</strong>
              </div>
              <div>
                <span>Station</span>
                <strong>{tokenSuccessReceipt.stationId ?? "--"}</strong>
              </div>
              <div>
                <span>Remote Ref</span>
                <strong>{tokenSuccessReceipt.remoteSendRef ?? "--"}</strong>
              </div>
              <div>
                <span>Processed</span>
                <strong>{tokenSuccessReceipt.processedAt ?? "--"}</strong>
              </div>
            </div>

            <p className="status-banner">{tokenSuccessReceipt.message}</p>

            <div className="token-success-modal__actions">
              <button
                className="button button-ghost"
                onClick={() => printRemoteTokenReceipt(page.title, tokenSuccessReceipt)}
                type="button"
              >
                Print Receipt
              </button>
              <button
                className="button button-ghost"
                onClick={() =>
                  navigate(
                    activeAction.successRedirectPath ??
                      `${page.path.replace("/remote-operation/", "/remote-operation-task/")}-task`,
                  )
                }
                type="button"
              >
                {tokenSuccessReceipt.status === "success" ? "Open Task Monitor" : "Track Delivery"}
              </button>
              <button
                className="button button-primary"
                onClick={() => setTokenSuccessReceipt(null)}
                type="button"
              >
                Done
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {reviewOpen ? (
        <ConfirmModal
          message={(
            isTokenDeliveryFlow
              ? buildRemoteTokenConfirmationLines(selectedTarget ?? undefined, tokenForm, {
                  quote: tokenQuote,
                  tariffRate: tokenTariffResolution?.pricePerUnit ?? null,
                })
              : [
                  activeAction.confirmMessage ?? "Review this command carefully before sending it.",
                  selectedTarget
                    ? `Target meter: ${String(selectedTarget.meterId ?? "--")} (${String(selectedTarget.customerName ?? "Unknown customer")})`
                    : "Target meter: --",
                  ...(activeAction.fields ?? []).map(
                    (field) => `${field.label}: ${formatReviewValue(activeAction, field.key, commandValues[field.key] ?? "")}`,
                  ),
                ]
          ).join("\n")}
          onCancel={() => setReviewOpen(false)}
          onConfirm={() => void submitCommand()}
          title={isTokenDeliveryFlow ? "Review remote token send" : `Review ${page.menuLabel}`}
        />
      ) : null}
    </section>
  );
}



