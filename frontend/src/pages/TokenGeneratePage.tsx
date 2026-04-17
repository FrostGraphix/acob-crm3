import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Field, Surface } from "../design-system";
import { DataTable } from "../components/common/DataTable";
import { useDataTable } from "../hooks/useDataTable";
import { loadTableData, runPageAction } from "../services/api";
import { formatNaira, formatNumber } from "../services/currency";
import {
  buildCreditTokenPayload,
  buildRechargeQuote,
  inferTariffRate,
  type RechargeEntryMode,
  type RechargeQuote,
} from "../services/token-generate-flow";
import { buildBrandedReceiptDocument } from "../services/receipt-branding";
import type { ActionConfig, DataPageConfig, DataRow } from "../types";

interface TokenReceipt {
  receiptId: string;
  customerId: string | null;
  customerName: string;
  meterId: string;
  meterType: string | null;
  tariffId: string | null;
  stationId: string | null;
  totalUnit: number | null;
  totalPaid: number | null;
  token: string | null;
  createdBy: string | null;
  createdAt: string | null;
  remark: string | null;
}

function readString(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function readNumber(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function buildTokenReceipt(result: Record<string, unknown>, selectedRow: DataRow): TokenReceipt {
  return {
    receiptId: readString(result, ["receiptId", "id"]) ?? `local-${Date.now()}`,
    customerId:
      readString(result, ["customerId"]) ??
      (typeof selectedRow.customerId === "string" ? selectedRow.customerId : null),
    customerName:
      readString(result, ["customerName"]) ??
      (typeof selectedRow.customerName === "string" ? selectedRow.customerName : "Unknown customer"),
    meterId:
      readString(result, ["meterId", "MeterId"]) ??
      (typeof selectedRow.meterId === "string" ? selectedRow.meterId : "Unknown meter"),
    meterType:
      readString(result, ["meterType"]) ??
      (typeof selectedRow.meterType === "string" ? selectedRow.meterType : null),
    tariffId:
      readString(result, ["tariffId"]) ??
      (typeof selectedRow.tariffId === "string" ? selectedRow.tariffId : null),
    stationId:
      readString(result, ["stationId", "siteId"]) ??
      (typeof selectedRow.stationId === "string" ? selectedRow.stationId : null),
    totalUnit: readNumber(result, ["totalUnit", "amount", "unit"]),
    totalPaid: readNumber(result, ["totalPaid", "price", "totalPrice"]),
    token: readString(result, ["token", "tokenRecharge"]),
    createdBy: readString(result, ["createId", "createdBy"]),
    createdAt: readString(result, ["createDate", "createTime", "createdAt"]),
    remark: readString(result, ["remark"]),
  };
}

function formatTokenValue(value: string | null) {
  if (!value) {
    return "--";
  }

  const digits = value.replace(/\s+/g, "");
  if (digits.length < 4) {
    return value;
  }

  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function buildReceiptHtml(pageTitle: string, receipt: TokenReceipt) {
  return buildBrandedReceiptDocument({
    documentTitle: `${pageTitle} Receipt`,
    receiptTitle: `${pageTitle} Receipt`,
    subtitle: "Recharge completed successfully.",
    badgeText: "Credit Token",
    tokenValue: formatTokenValue(receipt.token),
    footerNote: "This receipt was issued by ACOB Lighting Technology Limited.",
    rows: [
      { label: "Receipt Id", value: receipt.receiptId },
      { label: "Customer", value: receipt.customerName },
      { label: "Customer Id", value: receipt.customerId ?? "--" },
      { label: "Meter Id", value: receipt.meterId },
      { label: "Meter Type", value: receipt.meterType ?? "--" },
      { label: "Tariff", value: receipt.tariffId ?? "--" },
      { label: "Station", value: receipt.stationId ?? "--" },
      { label: "Units", value: receipt.totalUnit !== null ? formatNumber(receipt.totalUnit) : "--" },
      { label: "Amount", value: receipt.totalPaid !== null ? formatNaira(receipt.totalPaid) : "--" },
      { label: "Issued By", value: receipt.createdBy ?? "--" },
      { label: "Issued At", value: receipt.createdAt ?? "--" },
    ],
  });
}

function printReceipt(pageTitle: string, receipt: TokenReceipt) {
  const printableWindow = window.open("", "_blank");
  if (!printableWindow) {
    return;
  }

  printableWindow.document.open();
  printableWindow.document.write(buildReceiptHtml(pageTitle, receipt));
  printableWindow.document.close();
  printableWindow.focus();
  window.setTimeout(() => printableWindow.print(), 50);
}

export function TokenGeneratePage({ page }: { page: DataPageConfig }) {
  const navigate = useNavigate();
  const {
    draftFilters,
    setDraftFilters,
    rows,
    total,
    loading,
    error,
    pageNumber,
    pageSize,
    setPageNumber,
    setPageSize,
    search,
    refresh,
    getRowKeyValue,
  } = useDataTable(page);
  const [tariffs, setTariffs] = useState<DataRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<DataRow | null>(null);
  const [authorizationPassword, setAuthorizationPassword] = useState("");
  const [entryMode, setEntryMode] = useState<RechargeEntryMode>("naira");
  const [entryValue, setEntryValue] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<TokenReceipt | null>(null);

  const primaryAction = page.rowActions?.[0] as ActionConfig | undefined;
  const isCreditFlow = primaryAction?.operationKind === "token-generate-credit";
  const isLimitFlow = primaryAction?.operationKind === "token-generate-limit";

  useEffect(() => {
    let cancelled = false;

    if (!isCreditFlow) {
      setTariffs([]);
      return;
    }

    void loadTableData("/api/tariff/read", { pageNumber: 1, pageSize: 200 })
      .then((result) => {
        if (!cancelled) {
          setTariffs(result.rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTariffs([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isCreditFlow]);

  const tariffResolution = useMemo(
    () => (selectedRow ? inferTariffRate(selectedRow, tariffs) : null),
    [selectedRow, tariffs],
  );

  const numericEntryValue = entryValue.trim().length > 0 ? Number(entryValue) : NaN;
  const rechargeQuote: RechargeQuote | null = useMemo(
    () =>
      isCreditFlow && tariffResolution
        ? buildRechargeQuote(entryMode, numericEntryValue, tariffResolution.pricePerUnit)
        : null,
    [entryMode, isCreditFlow, numericEntryValue, tariffResolution],
  );

  const canProceed =
    selectedRow !== null &&
    primaryAction !== undefined &&
    authorizationPassword.trim().length > 0 &&
    (!isCreditFlow
      ? !isLimitFlow || (Number.isFinite(numericEntryValue) && numericEntryValue > 0)
      : rechargeQuote !== null);

  const openMeterFlow = (row: DataRow) => {
    setSelectedRow(row);
    setEntryMode("naira");
    setEntryValue("");
    setConfirmOpen(false);
    setFeedback(null);
  };

  const closeFlow = () => {
    setSelectedRow(null);
    setConfirmOpen(false);
    setEntryValue("");
  };

  const executeTokenGenerate = async () => {
    if (!selectedRow || !primaryAction) {
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      let payload: Record<string, unknown>;

      if (isCreditFlow) {
        if (!rechargeQuote) {
          throw new Error("Enter a valid recharge amount.");
        }
        payload = buildCreditTokenPayload(selectedRow, rechargeQuote, authorizationPassword);
      } else if (isLimitFlow) {
        const limitValue = Number(entryValue);
        if (!Number.isFinite(limitValue) || limitValue <= 0) {
          throw new Error("Enter a valid limit value.");
        }
        payload = {
          row: selectedRow,
          limitValue,
          authorizationPassword: authorizationPassword.trim(),
          AuthorizationPassword: authorizationPassword.trim(),
          authPassword: authorizationPassword.trim(),
          password2: authorizationPassword.trim(),
        };
      } else {
        payload = {
          row: selectedRow,
          authorizationPassword: authorizationPassword.trim(),
          AuthorizationPassword: authorizationPassword.trim(),
          authPassword: authorizationPassword.trim(),
          password2: authorizationPassword.trim(),
        };
      }

      const result = await runPageAction(primaryAction.endpoint, payload);
      const receipt = buildTokenReceipt(result as Record<string, unknown>, selectedRow);
      setSuccessReceipt(receipt);
      setConfirmOpen(false);
      setSelectedRow(null);
      setEntryValue("");
      await refresh();
    } catch (caughtError) {
      setFeedback(caughtError instanceof Error ? caughtError.message : "Token generation failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page-stack token-generate-flow-page ds-page">
      {error || feedback ? (
        <div className={`p-4 rounded-xl mb-4 ${error ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-odyssey-electric/10 text-odyssey-electric border border-odyssey-electric/20'}`}>
          {error || feedback}
        </div>
      ) : null}

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
        onRowClick={openMeterFlow}
        onToggleAll={() => undefined}
        onToggleRow={() => undefined}
        pageNumber={pageNumber}
        pageSize={pageSize}
        rowActions={[]}
        rows={rows}
        selectedKeys={[]}
        selectionMode="none"
        total={total}
        columnFilters={draftFilters}
        onColumnFilterChange={(key, value) => {
          setDraftFilters((current) => ({ ...current, [key]: value }));
        }}
        onColumnSearch={() => search()}
      />

      {selectedRow ? (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && closeFlow()}>
          <Surface as="div" className="token-flow-modal" tone="raised">
            <div className="token-flow-modal__header">
              <div>
                <p className="token-flow-modal__eyebrow">Recharge Customer</p>
                <h2>{typeof selectedRow.customerName === "string" ? selectedRow.customerName : "Selected meter"}</h2>
                <p className="token-flow-modal__sub">
                  {typeof selectedRow.meterId === "string" ? selectedRow.meterId : "--"} • {typeof selectedRow.customerId === "string" ? selectedRow.customerId : "No customer id"}
                </p>
              </div>
              <Button onClick={closeFlow} size="icon" tone="ghost">×</Button>
            </div>

            {!confirmOpen ? (
              <div className="token-flow-modal__body">
                <div className="token-flow-modal__summary">
                  <div>
                    <span>Tariff</span>
                    <strong>{tariffResolution?.tariffName ?? tariffResolution?.tariffId ?? (typeof selectedRow.tariffId === "string" ? selectedRow.tariffId : "--")}</strong>
                  </div>
                  <div>
                    <span>Rate</span>
                    <strong>
                      {tariffResolution?.pricePerUnit !== null && tariffResolution?.pricePerUnit !== undefined
                        ? `${formatNaira(tariffResolution.pricePerUnit)}/unit`
                        : "Unavailable"}
                    </strong>
                  </div>
                  <div>
                    <span>Station</span>
                    <strong>{typeof selectedRow.stationId === "string" ? selectedRow.stationId : "--"}</strong>
                  </div>
                </div>

                {isCreditFlow ? (
                  <div className="token-flow-form-grid">
                    <Field label="Recharge by" required>
                      <select
                        className="ds-select"
                        onChange={(event) => setEntryMode(event.target.value as RechargeEntryMode)}
                        value={entryMode}
                      >
                        <option value="naira">Naira amount</option>
                        <option value="unit">Unit quantity</option>
                      </select>
                    </Field>

                    <Field
                      label={entryMode === "naira" ? "Amount in Naira" : "Amount in Unit"}
                      required
                      helpText={
                        entryMode === "naira"
                          ? "Enter the money to collect. Units are calculated automatically."
                          : "Enter the units to vend. Naira is calculated automatically."
                      }
                    >
                      <input
                        className="ds-input"
                        min="0"
                        onChange={(event) => setEntryValue(event.target.value)}
                        placeholder={entryMode === "naira" ? "3500" : "10"}
                        step="0.01"
                        type="number"
                        value={entryValue}
                      />
                    </Field>

                    <Field
                      label="Authorization Password"
                      required
                      helpText="Required by the meter system before it issues the token."
                      full
                    >
                      <input
                        autoComplete="current-password"
                        className="ds-input"
                        onChange={(event) => setAuthorizationPassword(event.target.value)}
                        placeholder="Enter authorization password"
                        type="password"
                        value={authorizationPassword}
                      />
                    </Field>

                    <div className="token-flow-quote-card">
                      <span>Units to vend</span>
                      <strong>{rechargeQuote ? `${formatNumber(rechargeQuote.units)} units` : "--"}</strong>
                    </div>
                    <div className="token-flow-quote-card">
                      <span>Naira to collect</span>
                      <strong>
                        {rechargeQuote?.amountNaira !== null && rechargeQuote?.amountNaira !== undefined
                          ? formatNaira(rechargeQuote.amountNaira)
                          : "Needs tariff rate"}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <div className="token-flow-form-grid">
                    {isLimitFlow ? (
                      <Field label="Limit Value" required>
                        <input
                          className="ds-input"
                          min="0"
                          onChange={(event) => setEntryValue(event.target.value)}
                          placeholder="Enter limit value"
                          step="0.01"
                          type="number"
                          value={entryValue}
                        />
                      </Field>
                    ) : null}

                    <Field label="Authorization Password" required full>
                      <input
                        autoComplete="current-password"
                        className="ds-input"
                        onChange={(event) => setAuthorizationPassword(event.target.value)}
                        placeholder="Enter authorization password"
                        type="password"
                        value={authorizationPassword}
                      />
                    </Field>
                  </div>
                )}

                <div className="token-flow-modal__actions">
                  <Button onClick={closeFlow} tone="ghost">Cancel</Button>
                  <Button disabled={!canProceed} onClick={() => setConfirmOpen(true)} tone="primary">
                    Continue to Confirm
                  </Button>
                </div>
              </div>
            ) : (
              <div className="token-flow-modal__body">
                <div className="token-flow-confirm-card">
                  <p className="token-flow-confirm-card__eyebrow">Confirm Vend</p>
                  <h3>Review before generating token</h3>
                  <div className="token-flow-confirm-grid">
                    <div>
                      <span>Customer</span>
                      <strong>{typeof selectedRow.customerName === "string" ? selectedRow.customerName : "--"}</strong>
                    </div>
                    <div>
                      <span>Meter</span>
                      <strong>{typeof selectedRow.meterId === "string" ? selectedRow.meterId : "--"}</strong>
                    </div>
                    <div>
                      <span>Units</span>
                      <strong>
                        {isCreditFlow && rechargeQuote ? `${formatNumber(rechargeQuote.units)} units` : formatNumber(Number(entryValue) || 0)}
                      </strong>
                    </div>
                    <div>
                      <span>Amount</span>
                      <strong>
                        {isCreditFlow && rechargeQuote?.amountNaira !== null && rechargeQuote?.amountNaira !== undefined
                          ? formatNaira(rechargeQuote.amountNaira)
                          : isCreditFlow
                            ? "Calculated upstream"
                            : "--"}
                      </strong>
                    </div>
                    <div>
                      <span>Tariff Rate</span>
                      <strong>
                        {tariffResolution?.pricePerUnit !== null && tariffResolution?.pricePerUnit !== undefined
                          ? `${formatNaira(tariffResolution.pricePerUnit)}/unit`
                          : "--"}
                      </strong>
                    </div>
                    <div>
                      <span>Password</span>
                      <strong>{"•".repeat(Math.max(6, authorizationPassword.trim().length))}</strong>
                    </div>
                  </div>
                </div>

                <div className="token-flow-modal__actions">
                  <Button disabled={submitting} onClick={() => setConfirmOpen(false)} tone="ghost">
                    Back
                  </Button>
                  <Button disabled={submitting || !canProceed} onClick={() => void executeTokenGenerate()} tone="primary">
                    {submitting ? "Generating..." : "Generate Token"}
                  </Button>
                </div>
              </div>
            )}
          </Surface>
        </div>
      ) : null}

      {successReceipt ? (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setSuccessReceipt(null)}>
          <Surface as="div" className="token-success-modal" tone="raised">
            <div className="token-success-modal__header">
              <div>
                <p className="token-success-modal__eyebrow">Transaction Successful</p>
                <h2>Receipt ready</h2>
              </div>
              <Badge tone="success">Success</Badge>
            </div>

            <div className="token-success-token">{formatTokenValue(successReceipt.token)}</div>

            <div className="token-success-grid">
              <div><span>Receipt Id</span><strong>{successReceipt.receiptId}</strong></div>
              <div><span>Customer</span><strong>{successReceipt.customerName}</strong></div>
              <div><span>Meter Id</span><strong>{successReceipt.meterId}</strong></div>
              <div><span>Units</span><strong>{successReceipt.totalUnit !== null ? formatNumber(successReceipt.totalUnit) : "--"}</strong></div>
              <div><span>Amount</span><strong>{successReceipt.totalPaid !== null ? formatNaira(successReceipt.totalPaid) : "--"}</strong></div>
              <div><span>Issued At</span><strong>{successReceipt.createdAt ?? "--"}</strong></div>
            </div>

            <div className="token-success-modal__actions">
              <Button onClick={() => printReceipt(page.title, successReceipt)} tone="secondary">Print Receipt</Button>
              {primaryAction?.successRedirectPath ? (
                <Button onClick={() => navigate(primaryAction.successRedirectPath as string)} tone="ghost">
                  Open Records
                </Button>
              ) : null}
              <Button onClick={() => setSuccessReceipt(null)} tone="primary">Done</Button>
            </div>
          </Surface>
        </div>
      ) : null}
    </section>
  );
}

export default TokenGeneratePage;
