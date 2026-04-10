import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConfirmModal } from "../components/common/ConfirmModal";
import { DataTable } from "../components/common/DataTable";
import { QuickMeterReadModal } from "../components/common/QuickMeterReadModal";
import { SearchBar } from "../components/common/SearchBar";
import { useDataTable } from "../hooks/useDataTable";
import { loadTableData, runPageAction } from "../services/api";
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
  getRemotePresetLabel,
  getRemotePresets,
  getRemoteTaskFriendlyName,
} from "../services/remote-operation-presets";
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

  const selectedTarget =
    rows.find((row) => selectedKeys.includes(getRowKeyValue(row))) ??
    rows.find((row) => getRowKeyValue(row) === selectedKeys[0]) ??
    null;

  if (!commandAction) {
    return (
      <section className="page-stack">
        <p className="status-banner status-banner-error">Remote action configuration is missing.</p>
      </section>
    );
  }

  const activeAction = commandAction;
  const riskCopy = getRiskCopy(activeAction);
  const presets = getRemotePresets(activeAction);
  const presetLabel = getRemotePresetLabel(activeAction.remoteTaskType);
  const friendlyTaskName = getRemoteTaskFriendlyName(activeAction.remoteTaskType);
  const isSimpleReadingFlow = activeAction.remoteTaskType === "reading";
  const meterReadingChoices = useMemo(
    () => buildMeterReadingChoices(catalogOptions, selectedTarget?.protocolVersion),
    [catalogOptions, selectedTarget?.protocolVersion],
  );
  const defaultReadingChoice = useMemo(
    () => resolveDefaultMeterReadingChoice(meterReadingChoices),
    [meterReadingChoices],
  );

  useEffect(() => {
    setCommandValues(createDefaultCommandValues(activeAction));
    setQuickReadOpen(false);
    setQuickReadChoiceKey(DEFAULT_METER_READING_CHOICE_KEY);
    setReviewOpen(false);
    setFeedback(null);
  }, [activeAction]);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      if (activeAction.remoteTaskType !== "reading" || !selectedTarget) {
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
  }, [activeAction.remoteTaskType, selectedTarget]);

  useEffect(() => {
    if (!selectedTarget) {
      setQuickReadOpen(false);
    }
  }, [selectedTarget]);

  useEffect(() => {
    if (!isSimpleReadingFlow || !selectedTarget) {
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
  }, [defaultReadingChoice?.value, isSimpleReadingFlow, meterReadingChoices, quickReadChoiceKey, selectedTarget]);

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
      return;
    }

    const nextValues = createDefaultCommandValues(activeAction);
    nextValues.dataItem = defaultReadingChoice?.value ?? "";

    setFeedback(null);
    setQuickReadChoiceKey(DEFAULT_METER_READING_CHOICE_KEY);
    setCommandValues(nextValues);
    setQuickReadOpen(true);
  };

  const submitCommand = async () => {
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

  return (
    <section className={`page-stack remote-ops-page${isSimpleReadingFlow ? " remote-ops-page--simple" : ""}`}>
      <div className={`remote-ops-risk remote-ops-risk--${activeAction.dangerLevel ?? "low"}`}>
        <div>
          <p className="remote-ops-risk__eyebrow">
            {isSimpleReadingFlow ? "Quick meter reading" : riskCopy.eyebrow}
          </p>
          <h2 className="remote-ops-risk__title">{page.title}</h2>
          <p className="remote-ops-risk__body">
            {isSimpleReadingFlow
              ? "Click any meter in the table. A small popup will open so you can choose what to read and start immediately."
              : riskCopy.body}
          </p>
          {isSimpleReadingFlow ? null : (
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

      <div className={`remote-ops-layout${isSimpleReadingFlow ? " remote-ops-layout--simple" : ""}`}>
        <div className="remote-ops-panel table-panel table-panel-vercel">
          <div className="table-panel-header">
            <div>
              <p className="table-panel-eyebrow">
                {isSimpleReadingFlow ? "Tap a meter" : "Target selection"}
              </p>
              <div className="table-panel-title-row">
                <strong className="table-panel-title">{total.toLocaleString()} meters</strong>
                <span className="table-panel-range">
                  {isSimpleReadingFlow ? "Click once to open the reading popup" : "Choose a single target meter"}
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
            onRowClick={isSimpleReadingFlow ? handleSelectTarget : undefined}
            rowActions={[]}
            rows={rows}
            selectedKeys={selectedKeys}
            selectionMode="single"
            total={total}
          />

          {isSimpleReadingFlow ? (
            <div className="remote-ops-feedback">
              {feedback ? <p className="status-banner">{feedback}</p> : null}
              {error ? <p className="status-banner status-banner-error">{error}</p> : null}
            </div>
          ) : null}
        </div>

        {isSimpleReadingFlow ? null : (
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

      {reviewOpen ? (
        <ConfirmModal
          message={[
            activeAction.confirmMessage ?? "Review this command carefully before sending it.",
            selectedTarget
              ? `Target meter: ${String(selectedTarget.meterId ?? "--")} (${String(selectedTarget.customerName ?? "Unknown customer")})`
              : "Target meter: --",
            ...(activeAction.fields ?? []).map(
              (field) => `${field.label}: ${formatReviewValue(activeAction, field.key, commandValues[field.key] ?? "")}`,
            ),
          ].join("\n")}
          onCancel={() => setReviewOpen(false)}
          onConfirm={() => void submitCommand()}
          title={`Review ${page.menuLabel}`}
        />
      ) : null}
    </section>
  );
}
