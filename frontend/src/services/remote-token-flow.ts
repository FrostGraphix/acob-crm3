import type { ActionResponse, DataRow } from "../types/index.ts";
import { formatNaira, formatNumber } from "./currency.ts";
import { buildBrandedReceiptDocument } from "./receipt-branding.ts";
import type { RechargeQuote } from "./token-generate-flow.ts";

export type RemoteTokenOperation = "send-credit" | "clear-credit";
export type RemoteTokenLoadMode = "naira" | "unit";
export type RemoteTokenReceiptStatus = "success" | "partial";

export interface RemoteTokenFormState {
  operation: RemoteTokenOperation;
  loadMode: RemoteTokenLoadMode;
  amount: string;
}

export interface RemoteTokenReceipt {
  receiptNumber: string;
  customerId: string | null;
  customerName: string;
  meterId: string;
  stationId: string | null;
  operation: RemoteTokenOperation;
  loadMode: RemoteTokenLoadMode | null;
  amountNaira: number | null;
  units: number | null;
  tokenValue: string | null;
  remoteSendRef: string | null;
  processedAt: string | null;
  pricingSource: string | null;
  message: string;
  status: RemoteTokenReceiptStatus;
  deliveryPath: string | null;
  deliveryMode: string | null;
}

interface MappingResult {
  ok: boolean;
  payload?: Record<string, unknown>;
  message?: string;
}

function sanitizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function compactRow(row: DataRow | undefined) {
  if (!row) {
    return undefined;
  }

  return Object.entries(row).reduce<Record<string, unknown>>((accumulator, [key, value]) => {
    if (value !== null && value !== "") {
      accumulator[key] = value;
    }

    return accumulator;
  }, {});
}

function readRowString(row: DataRow | undefined, keys: string[]) {
  if (!row) {
    return null;
  }

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

function readRecordString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function readRecordNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
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

function asDetails(result: ActionResponse) {
  return typeof result.details === "object" && result.details !== null
    ? (result.details as Record<string, unknown>)
    : {};
}

function formatEnteredAmount(form: RemoteTokenFormState) {
  const trimmed = sanitizeString(form.amount);
  if (!trimmed) {
    return "--";
  }

  if (form.loadMode === "naira") {
    return `NGN ${trimmed}`;
  }

  return `${trimmed} units`;
}

export function createDefaultRemoteTokenForm(): RemoteTokenFormState {
  return {
    operation: "send-credit",
    loadMode: "naira",
    amount: "",
  };
}

export function getRemoteTokenAmountLabel(loadMode: RemoteTokenLoadMode) {
  return loadMode === "naira" ? "Amount (NGN)" : "Units";
}

export function formatRemoteTokenValue(value: string | null) {
  if (!value) {
    return "--";
  }

  const digits = value.replace(/\s+/g, "");
  if (digits.length < 4) {
    return value;
  }

  return digits.replace(/(.{4})/g, "$1 ").trim();
}

export function buildRemoteTokenSendPayload(
  row: DataRow | undefined,
  form: RemoteTokenFormState,
): MappingResult {
  const compact = compactRow(row);
  if (!compact) {
    return {
      ok: false,
      message: "Select a meter before sending a token.",
    };
  }

  const meterId = readRowString(row, ["meterId", "meterNo"]);
  if (!meterId) {
    return {
      ok: false,
      message: "The selected row is missing a meter id.",
    };
  }

  if (form.operation === "clear-credit") {
    return {
      ok: true,
      payload: {
        row: compact,
        operation: "clear-credit",
      },
    };
  }

  const numericAmount = Number(sanitizeString(form.amount));
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return {
      ok: false,
      message: form.loadMode === "naira"
        ? "Enter a valid naira amount."
        : "Enter a valid unit amount.",
    };
  }

  return {
    ok: true,
    payload: {
      row: compact,
      operation: "send-credit",
      loadMode: form.loadMode,
      amount: numericAmount,
    },
  };
}

export function buildRemoteTokenConfirmationLines(
  row: DataRow | undefined,
  form: RemoteTokenFormState,
  options?: {
    quote?: RechargeQuote | null;
    tariffRate?: number | null;
  },
) {
  const meterId = readRowString(row, ["meterId", "meterNo"]) ?? "--";
  const customerName =
    readRowString(row, ["customerName", "consumerName", "name"]) ?? "Unknown customer";
  const stationId = readRowString(row, ["stationId", "site", "station"]) ?? "No station";
  const operationLabel =
    form.operation === "clear-credit" ? "Clear credit" : "Send credit token";
  const quote = options?.quote ?? null;
  const tariffRate = options?.tariffRate ?? null;

  return [
    `Target meter: ${meterId} (${customerName})`,
    `Station: ${stationId}`,
    `Operation: ${operationLabel}`,
    ...(form.operation === "send-credit"
      ? [
          `Load by: ${form.loadMode === "naira" ? "Naira" : "Unit"}`,
          `Entered value: ${formatEnteredAmount(form)}`,
          ...(quote
            ? [
                `Translated units: ${formatNumber(quote.units)} units`,
                `Translated amount: ${quote.amountNaira !== null ? formatNaira(quote.amountNaira) : "--"}`,
              ]
            : []),
          ...(tariffRate !== null && Number.isFinite(tariffRate)
            ? [`Tariff rate: ${formatNaira(tariffRate)}/unit`]
            : []),
        ]
      : []),
    "Delivery: Generate token and push remotely",
  ];
}

export function shouldOpenRemoteTokenReceipt(result: ActionResponse) {
  const details = asDetails(result);
  return Boolean(readRecordString(details, ["tokenValue", "tokenValueMasked", "receiptNumber"]));
}

export function buildRemoteTokenReceipt(
  result: ActionResponse,
  row: DataRow | undefined,
  form: RemoteTokenFormState,
): RemoteTokenReceipt {
  const details = asDetails(result);
  const receiptNumber =
    readRecordString(details, ["receiptNumber"]) ?? `RMT-${Date.now()}`;
  const status: RemoteTokenReceiptStatus = result.success ? "success" : "partial";

  return {
    receiptNumber,
    customerId:
      readRecordString(details, ["customerId"]) ??
      readRowString(row, ["customerId", "customerNo"]),
    customerName:
      readRecordString(details, ["customerName"]) ??
      readRowString(row, ["customerName", "consumerName", "name"]) ??
      "Unknown customer",
    meterId:
      readRecordString(details, ["meterId"]) ??
      readRowString(row, ["meterId", "meterNo"]) ??
      "Unknown meter",
    stationId:
      readRecordString(details, ["stationId"]) ??
      readRowString(row, ["stationId", "site", "station"]),
    operation:
      readRecordString(details, ["operation"]) === "clear-credit"
        ? "clear-credit"
        : form.operation,
    loadMode:
      readRecordString(details, ["loadMode"]) === "unit"
        ? "unit"
        : readRecordString(details, ["loadMode"]) === "naira"
          ? "naira"
          : form.operation === "send-credit"
            ? form.loadMode
            : null,
    amountNaira: readRecordNumber(details, ["resolvedAmount", "requestedAmount", "amount"]),
    units: readRecordNumber(details, ["resolvedUnit", "unit", "totalUnit"]),
    tokenValue: readRecordString(details, ["tokenValue", "tokenValueMasked"]),
    remoteSendRef: readRecordString(details, ["remoteSendRef", "deliveredBy"]),
    processedAt: readRecordString(details, ["processedAt"]),
    pricingSource: readRecordString(details, ["pricingSource"]),
    message:
      sanitizeString(result.message) ||
      (status === "success"
        ? "Remote token sent successfully."
        : "Token generated. Complete delivery from the task monitor or use the token manually."),
    status,
    deliveryPath: readRecordString(details, ["deliveryPath"]),
    deliveryMode: readRecordString(details, ["deliveryMode"]),
  };
}

function buildRemoteTokenReceiptHtml(pageTitle: string, receipt: RemoteTokenReceipt) {
  return buildBrandedReceiptDocument({
    documentTitle: `${pageTitle} Receipt`,
    receiptTitle: `${pageTitle} Receipt`,
    subtitle: receipt.message,
    badgeText: receipt.status === "success"
      ? receipt.operation === "clear-credit" ? "Clear Credit" : "Remote Send"
      : "Manual Follow-up",
    tokenValue: formatRemoteTokenValue(receipt.tokenValue),
    footerNote: "For delivery verification, contact ACOB Lighting support with the receipt number.",
    rows: [
      { label: "Receipt Number", value: receipt.receiptNumber },
      { label: "Customer", value: receipt.customerName },
      { label: "Customer Id", value: receipt.customerId ?? "--" },
      { label: "Meter Id", value: receipt.meterId },
      { label: "Station", value: receipt.stationId ?? "--" },
      { label: "Operation", value: receipt.operation === "clear-credit" ? "Clear credit" : "Send credit token" },
      { label: "Status", value: receipt.status === "success" ? "Remote delivery completed" : "Token generated, delivery follow-up required" },
      { label: "Load Mode", value: receipt.loadMode ? receipt.loadMode.toUpperCase() : "--" },
      { label: "Units", value: receipt.units !== null ? formatNumber(receipt.units) : "--" },
      { label: "Amount", value: receipt.amountNaira !== null ? formatNaira(receipt.amountNaira) : "--" },
      { label: "Remote Ref", value: receipt.remoteSendRef ?? "--" },
      { label: "Delivery Path", value: receipt.deliveryPath ?? receipt.deliveryMode ?? "--" },
      { label: "Processed At", value: receipt.processedAt ?? "--" },
      { label: "Pricing Source", value: receipt.pricingSource ?? "--" },
    ],
  });
}

export function printRemoteTokenReceipt(pageTitle: string, receipt: RemoteTokenReceipt) {
  const printableWindow = window.open("", "_blank");
  if (!printableWindow) {
    return;
  }

  printableWindow.document.open();
  printableWindow.document.write(buildRemoteTokenReceiptHtml(pageTitle, receipt));
  printableWindow.document.close();
  printableWindow.focus();
  window.setTimeout(() => printableWindow.print(), 50);
}
