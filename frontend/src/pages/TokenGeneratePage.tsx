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
              <div className="token-flow-modal__header-titles">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="token-flow-modal__eyebrow !mb-0 text-[10px]">Recharge Customer</p>
                  <Badge tone="success" className="h-4 text-[9px] px-1.5">ACTIVE</Badge>
                </div>
                <h2 className="text-xl leading-tight">{typeof selectedRow.customerName === "string" ? selectedRow.customerName : "Selected meter"}</h2>
                <p className="token-flow-modal__sub text-xs">
                   {typeof selectedRow.meterId === "string" ? selectedRow.meterId : "--"} <span className="mx-1 opacity-30">•</span> {typeof selectedRow.customerId === "string" ? selectedRow.customerId : "No customer id"}
                </p>
              </div>
              <Button onClick={closeFlow} size="icon" tone="ghost" className="rounded-full w-8 h-8">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </Button>
            </div>

            {!confirmOpen ? (
              <div className="token-flow-modal__body">
                <div className="token-flow-modal__summary !gap-2">
                  <div>
                    <span className="text-[10px]">Tariff</span>
                    <strong className="text-sm truncate block">{tariffResolution?.tariffName ?? tariffResolution?.tariffId ?? (typeof selectedRow.tariffId === "string" ? selectedRow.tariffId : "--")}</strong>
                  </div>
                  <div>
                    <span className="text-[10px]">Base Rate</span>
                    <strong className="text-sm">
                      {tariffResolution?.pricePerUnit !== null && tariffResolution?.pricePerUnit !== undefined
                        ? `${formatNaira(tariffResolution.pricePerUnit)}/u`
                        : "N/A"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px]">Station</span>
                    <strong className="text-sm">{typeof selectedRow.stationId === "string" ? selectedRow.stationId : "--"}</strong>
                  </div>
                </div>

                {isCreditFlow ? (
                  <div className="token-flow-form-grid">
                    <Field label="Recharge by" required className="!gap-1">
                      <select
                        className="ds-select !h-10 text-sm"
                        onChange={(event) => setEntryMode(event.target.value as RechargeEntryMode)}
                        value={entryMode}
                      >
                        <option value="naira">Naira (NGN)</option>
                        <option value="unit">Units (kWh)</option>
                      </select>
                    </Field>

                    <Field
                      label={entryMode === "naira" ? "Amount (₦)" : "Units (kWh)"}
                      required
                      className="!gap-1"
                    >
                      <input
                        className="ds-input !h-10 text-sm"
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
                      className="!gap-1"
                      full
                    >
                      <input
                        autoComplete="current-password"
                        className="ds-input !h-10 text-sm"
                        onChange={(event) => setAuthorizationPassword(event.target.value)}
                        placeholder="••••••••"
                        type="password"
                        value={authorizationPassword}
                      />
                    </Field>

                    <div className="token-flow-quote-card !gap-0">
                      <span className="text-[10px]">Units to vend</span>
                      <div className="flex items-baseline gap-1">
                        <strong className="text-base">
                          {rechargeQuote ? formatNumber(rechargeQuote.units) : "--"}
                        </strong>
                        <span className="text-[9px] font-bold opacity-60">KWH</span>
                      </div>
                    </div>
                    <div className="token-flow-quote-card !gap-0">
                      <span className="text-[10px]">Naira to collect</span>
                      <strong className="text-base truncate">
                        {rechargeQuote?.amountNaira !== null && rechargeQuote?.amountNaira !== undefined
                          ? formatNaira(rechargeQuote.amountNaira)
                          : "Rate required"}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <div className="token-flow-form-grid">
                    {isLimitFlow ? (
                      <Field label="Limit Value" required className="!gap-1">
                        <input
                          className="ds-input !h-10 text-sm"
                          min="0"
                          onChange={(event) => setEntryValue(event.target.value)}
                          placeholder="Enter limit"
                          step="0.01"
                          type="number"
                          value={entryValue}
                        />
                      </Field>
                    ) : null}

                    <Field label="Password" required full className="!gap-1">
                      <input
                        autoComplete="current-password"
                        className="ds-input !h-10 text-sm"
                        onChange={(event) => setAuthorizationPassword(event.target.value)}
                        placeholder="••••••••"
                        type="password"
                        value={authorizationPassword}
                      />
                    </Field>
                  </div>
                )}

                <div className="token-flow-modal__actions pt-3 border-t border-dashed border-border-light">
                  <Button onClick={closeFlow} tone="ghost" className="px-6 h-9 text-sm">Cancel</Button>
                  <Button disabled={!canProceed} onClick={() => setConfirmOpen(true)} tone="primary" className="px-6 h-9 text-sm">
                    Continue
                  </Button>
                </div>
              </div>
            ) : (
              <div className="token-flow-modal__body">
                <div className="token-flow-confirm-card !p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center text-warning flex-shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="token-flow-confirm-card__eyebrow !mb-0 text-[10px]">Review Summary</p>
                      <h3 className="text-sm font-bold">Confirm Vend Request</h3>
                    </div>
                  </div>

                  <div className="token-flow-confirm-grid !grid-cols-2 !gap-2">
                    <div>
                      <span className="text-[10px]">Customer</span>
                      <strong className="text-xs truncate block">{typeof selectedRow.customerName === "string" ? selectedRow.customerName : "--"}</strong>
                    </div>
                    <div>
                      <span className="text-[10px]">Meter Num</span>
                      <strong className="text-xs">{typeof selectedRow.meterId === "string" ? selectedRow.meterId : "--"}</strong>
                    </div>
                    <div>
                      <span className="text-[10px]">Units</span>
                      <strong className="text-sm text-acob-green">
                        {isCreditFlow && rechargeQuote ? `${formatNumber(rechargeQuote.units)} kWh` : formatNumber(Number(entryValue) || 0)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px]">Collect</span>
                      <strong className="text-sm text-acob-green">
                        {isCreditFlow && rechargeQuote?.amountNaira !== null && rechargeQuote?.amountNaira !== undefined
                          ? formatNaira(rechargeQuote.amountNaira)
                          : isCreditFlow
                            ? "Calculated"
                            : "--"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px]">Rate</span>
                      <strong className="text-xs">
                        {tariffResolution?.pricePerUnit !== null && tariffResolution?.pricePerUnit !== undefined
                          ? `${formatNaira(tariffResolution.pricePerUnit)}/u`
                          : "--"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px]">Password</span>
                      <strong className="text-xs tracking-widest leading-none">{"•".repeat(Math.max(6, authorizationPassword.trim().length))}</strong>
                    </div>
                  </div>
                </div>

                <div className="token-flow-modal__actions pt-2">
                  <Button disabled={submitting} onClick={() => setConfirmOpen(false)} tone="ghost" className="h-9 px-4 text-xs">
                    Back
                  </Button>
                  <Button disabled={submitting || !canProceed} onClick={() => void executeTokenGenerate()} tone="primary" className="h-9 px-6 text-xs shadow-lg">
                    {submitting ? "Processing..." : "Generate Now"}
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
