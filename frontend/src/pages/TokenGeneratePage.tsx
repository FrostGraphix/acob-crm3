import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable } from "../components/common/DataTable";
import { TokenReceiptDrawer } from "../components/token/TokenReceiptDrawer";
import { TokenReferenceToolbar } from "../components/token/TokenReferenceToolbar";
import { Button, Surface } from "../design-system";
import { useDataTable } from "../hooks/useDataTable";
import { loadTableData, runPageAction } from "../services/api";
import { formatNaira, formatNumber } from "../services/currency";
import {
  buildCreditTokenPayload,
  buildRechargeQuote,
  readCreditTokenContext,
  type CreditTokenFormState,
  type CreditTokenOptions,
  inferTariffRate,
  type RechargeEntryMode,
} from "../services/token-generate-flow";
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
}

interface TokenPageVariant {
  actionLabel: string;
  resultTitle: string;
  resultBadge: string;
  subtitle: string;
  selectionTitle: string;
  selectionEmpty: string;
  successActionLabel: string;
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

function buildConfirmSummary(
  selectedRow: DataRow,
  options: {
    isCreditFlow: boolean;
    isMeterKeyFlow: boolean;
    rechargeQuote: ReturnType<typeof buildRechargeQuote>;
    numericEntryValue: number;
    entryMode: RechargeEntryMode;
    creditOptions: CreditTokenOptions;
    creditForm: CreditTokenFormState;
    oldMeterKey: string;
    newMeterKey: string;
  },
) {
  const customer = String(selectedRow.customerName ?? "--");
  const meter = String(selectedRow.meterId ?? "--");

  if (options.isMeterKeyFlow) {
    return `Customer: ${customer} Meter: ${meter} Old Key: ${options.oldMeterKey || "--"} New Key: ${options.newMeterKey || "--"}`;
  }

  const amount =
    options.isCreditFlow && options.rechargeQuote?.amountNaira != null
      ? formatNaira(options.rechargeQuote.amountNaira)
      : Number.isFinite(options.numericEntryValue)
        ? options.entryMode === "naira"
          ? formatNaira(options.numericEntryValue)
          : "--"
        : "--";
  const units =
    options.isCreditFlow && options.rechargeQuote
      ? formatNumber(options.rechargeQuote.units)
      : Number.isFinite(options.numericEntryValue) && options.entryMode === "unit"
        ? formatNumber(options.numericEntryValue)
        : "--";

  return `Customer: ${customer} Meter: ${meter} Amount: ${amount} Units: ${units} Payment: ${options.creditForm.paymentMethod} Preview: ${options.creditOptions.isPreview ? "Yes" : "No"}`;
}

function buildTransactionConfirmationFields(
  selectedRow: DataRow,
  options: {
    rechargeQuote: ReturnType<typeof buildRechargeQuote>;
    creditContext: ReturnType<typeof readCreditTokenContext> | null;
    creditForm: CreditTokenFormState;
  },
) {
  return [
    ["Customer Id", readRowValue(selectedRow, ["customerId"])],
    [
      "Customer Name",
      formatStaticValue(options.creditContext?.customerName ?? readRowValue(selectedRow, ["customerName"])),
    ],
    ["Meter Id", formatStaticValue(options.creditContext?.meterId ?? readRowValue(selectedRow, ["meterId"]))],
    [
      "Pay Debt(MMK)",
      options.creditContext?.totalDebt != null ? formatNumber(options.creditContext.totalDebt) : "0",
    ],
    [
      "Monthly Charge(MMK)",
      options.creditContext?.monthlyCharge != null ? formatNumber(options.creditContext.monthlyCharge) : "0",
    ],
    ["Total Unit(kWh)", options.rechargeQuote ? formatNumber(options.rechargeQuote.units) : "--"],
    [
      "Total Paid(MMK)",
      options.rechargeQuote?.amountNaira != null ? formatNumber(options.rechargeQuote.amountNaira) : "--",
    ],
    ["Payment Method", options.creditForm.paymentMethod],
  ] as const;
}

function buildReceiptHtml(pageTitle: string, receipt: TokenReceipt, variant: TokenPageVariant) {
  const rows = [
    ["Receipt Id", receipt.receiptId],
    ["Customer", receipt.customerName],
    ["Customer Id", receipt.customerId ?? "--"],
    ["Meter Id", receipt.meterId],
    ["Meter Type", receipt.meterType ?? "--"],
    ["Tariff", receipt.tariffId ?? "--"],
    ["Station", receipt.stationId ?? "--"],
    ["Units", receipt.totalUnit !== null ? formatNumber(receipt.totalUnit) : "--"],
    ["Amount", receipt.totalPaid !== null ? formatNaira(receipt.totalPaid) : "--"],
    ["Issued By", receipt.createdBy ?? "--"],
    ["Issued At", receipt.createdAt ?? "--"],
  ]
    .map(([label, value]) => `<tr><th>${label}</th><td>${value}</td></tr>`)
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${pageTitle}</title>
    <style>
      @page { size: 60mm auto; margin: 8mm; }
      body { margin: 0; padding: 12px; background: #f5f5f5; color: #111827; font-family: Arial, sans-serif; }
      .receipt { width: 60mm; margin: 0 auto; background: #fff; border: 1px solid #d1d5db; border-radius: 14px; overflow: hidden; }
      .head { padding: 14px 16px; border-bottom: 1px solid #e5e7eb; }
      .kicker { margin: 0 0 6px; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #4b5563; }
      .title { margin: 0; font-size: 18px; }
      .subtitle { margin: 6px 0 0; font-size: 11px; color: #6b7280; }
      .token { margin: 14px 16px 0; padding: 12px; border: 1px solid #d1d5db; border-radius: 12px; background: #f9fafb; text-align: center; font-size: 20px; font-weight: 800; letter-spacing: 0.16em; }
      table { width: calc(100% - 32px); margin: 14px 16px 16px; border-collapse: collapse; }
      th, td { padding: 8px 6px; border-bottom: 1px solid #e5e7eb; text-align: left; vertical-align: top; }
      th { width: 38%; font-size: 10px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.08em; }
      td { font-size: 12px; font-weight: 600; }
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="head">
        <p class="kicker">${variant.resultBadge}</p>
        <h1 class="title">${variant.resultTitle}</h1>
        <p class="subtitle">${variant.subtitle}</p>
      </div>
      <div class="token">${formatTokenValue(receipt.token)}</div>
      <table>${rows}</table>
    </div>
  </body>
</html>`;
}

function printReceipt(pageTitle: string, receipt: TokenReceipt, variant: TokenPageVariant) {
  const printableWindow = window.open("", "_blank");
  if (!printableWindow) {
    return;
  }

  printableWindow.document.open();
  printableWindow.document.write(buildReceiptHtml(pageTitle, receipt, variant));
  printableWindow.document.close();
  printableWindow.focus();
  window.setTimeout(() => printableWindow.print(), 50);
}

function readPrimaryAction(page: DataPageConfig) {
  return page.rowActions?.[0] as ActionConfig | undefined;
}

function readPageVariant(page: DataPageConfig): TokenPageVariant {
  switch (page.path) {
    case "/token-generate/credit-token":
      return {
        actionLabel: "Recharge",
        resultTitle: "Credit Token Receipt",
        resultBadge: "Credit Token",
        subtitle: "Generate and print the vend receipt exactly from the selected account.",
        selectionTitle: "Recharge",
        selectionEmpty: "Select a customer row to begin the credit token flow.",
        successActionLabel: "Print Receipt",
      };
    case "/token-generate/clear-tamper-token":
      return {
        actionLabel: "Generate Token",
        resultTitle: "Clear Tamper Token Result",
        resultBadge: "Clear Tamper",
        subtitle: "Generate a clear tamper token for the selected account.",
        selectionTitle: "Clear Tamper",
        selectionEmpty: "Select a customer row to begin the clear tamper token flow.",
        successActionLabel: "Print Result",
      };
    case "/token-generate/clear-credit-token":
      return {
        actionLabel: "Generate Token",
        resultTitle: "Clear Credit Token Result",
        resultBadge: "Clear Credit",
        subtitle: "Generate a clear credit token for the selected account.",
        selectionTitle: "Clear Credit",
        selectionEmpty: "Select a customer row to begin the clear credit token flow.",
        successActionLabel: "Print Result",
      };
    case "/token-generate/set-max-power-limit-token":
      return {
        actionLabel: "Generate Token",
        resultTitle: "Maximum Power Limit Token Result",
        resultBadge: "Power Limit",
        subtitle: "Generate a maximum power limit token for the selected account.",
        selectionTitle: "Maximum Power Limit",
        selectionEmpty: "Select a customer row to begin the maximum power limit token flow.",
        successActionLabel: "Print Result",
      };
    case "/token-generate/set-maximum-phase-power-unbalance-limit-token":
      return {
        actionLabel: "Generate Token",
        resultTitle: "Maximum Phase Power Unbalance Limit Token Result",
        resultBadge: "Phase Unbalance",
        subtitle: "Generate a phase power unbalance limit token for the selected account.",
        selectionTitle: "Phase Power Unbalance Limit",
        selectionEmpty: "Select a customer row to begin the phase power unbalance token flow.",
        successActionLabel: "Print Result",
      };
    case "/token-generate/change-meter-key-token":
      return {
        actionLabel: "Generate Token",
        resultTitle: "Change Meter Key Token Result",
        resultBadge: "Change Meter Key",
        subtitle: "Generate a change meter key token for the selected account.",
        selectionTitle: "Change Meter Key Token",
        selectionEmpty: "Select a customer row to begin the change meter key token flow.",
        successActionLabel: "Print Result",
      };
    case "/token-generate/set-maximum-overdraft-limit-token":
      return {
        actionLabel: "Generate Token",
        resultTitle: "Maximum Overdraft Limit Token Result",
        resultBadge: "Overdraft Limit",
        subtitle: "Generate a maximum overdraft limit token for the selected account.",
        selectionTitle: "Maximum Overdraft Limit",
        selectionEmpty: "Select a customer row to begin the maximum overdraft limit token flow.",
        successActionLabel: "Print Result",
      };
    case "/token-generate/update-meter-key":
      return {
        actionLabel: "Update Key",
        resultTitle: "Meter Key Update Result",
        resultBadge: "Meter Key",
        subtitle: "Submit a meter key update against the selected account.",
        selectionTitle: "Meter Key Update",
        selectionEmpty: "Select a customer row to begin the meter key update flow.",
        successActionLabel: "Print Result",
      };
    default:
      return {
        actionLabel: "Generate Token",
        resultTitle: `${page.title} Result`,
        resultBadge: page.menuLabel,
        subtitle: page.description,
        selectionTitle: page.title,
        selectionEmpty: `Select a customer row to begin the ${page.title.toLowerCase()} flow.`,
        successActionLabel: "Print Result",
      };
  }
}

function readRowValue(row: DataRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "--";
}

function renderGenerateAnchorSummary(row: DataRow, isCreditFlow: boolean) {
  if (isCreditFlow) {
    return [
      ["Customer Id", readRowValue(row, ["customerId"])],
      ["Meter Type", readRowValue(row, ["meterType"])],
      ["Tariff", readRowValue(row, ["tariffId"])],
      ["Protocol", readRowValue(row, ["protocolVersion"])],
    ] as const;
  }

  return [
    ["Customer Id", readRowValue(row, ["customerId"])],
    ["Meter Type", readRowValue(row, ["meterType"])],
    ["Station", readRowValue(row, ["stationId"])],
    ["Created", readRowValue(row, ["createTime"])],
  ] as const;
}

function getGeneratePrimaryColumns(page: DataPageConfig) {
  switch (page.path) {
    case "/token-generate/update-meter-key":
      return [
        { label: "Customer", primaryKeys: ["customerName", "customerId"], secondaryKeys: ["customerId"] },
        { label: "Meter", primaryKeys: ["meterId"], secondaryKeys: ["meterType"] },
        { label: "Station", primaryKeys: ["stationId"] },
        { label: "Created", primaryKeys: ["createTime"] },
      ] as const;
    default:
      return [
        { label: "Customer", primaryKeys: ["customerName", "customerId"], secondaryKeys: ["customerId"] },
        { label: "Meter", primaryKeys: ["meterId"], secondaryKeys: ["meterType"] },
        { label: "Tariff", primaryKeys: ["tariffId"] },
        { label: "Created", primaryKeys: ["createTime"] },
      ] as const;
  }
}

function getSuccessFields(page: DataPageConfig, receipt: TokenReceipt) {
  switch (page.path) {
    case "/token-generate/credit-token":
      return [
        ["Receipt Id", receipt.receiptId],
        ["Customer Id", receipt.customerId ?? "--"],
        ["Meter Type", receipt.meterType ?? "--"],
        ["Tariff", receipt.tariffId ?? "--"],
        ["Station", receipt.stationId ?? "--"],
        ["Issued At", receipt.createdAt ?? "--"],
        ["Issued By", receipt.createdBy ?? "--"],
        ["Token", formatTokenValue(receipt.token)],
      ] as const;
    case "/token-generate/set-max-power-limit-token":
      return [
        ["Receipt Id", receipt.receiptId],
        ["Customer Id", receipt.customerId ?? "--"],
        ["Meter Type", receipt.meterType ?? "--"],
        ["Station", receipt.stationId ?? "--"],
        ["Issued At", receipt.createdAt ?? "--"],
        ["Issued By", receipt.createdBy ?? "--"],
        ["Token", formatTokenValue(receipt.token)],
      ] as const;
    case "/token-generate/set-maximum-phase-power-unbalance-limit-token":
      return [
        ["Receipt Id", receipt.receiptId],
        ["Customer Id", receipt.customerId ?? "--"],
        ["Meter Type", receipt.meterType ?? "--"],
        ["Station", receipt.stationId ?? "--"],
        ["Issued At", receipt.createdAt ?? "--"],
        ["Issued By", receipt.createdBy ?? "--"],
        ["Token", formatTokenValue(receipt.token)],
      ] as const;
    case "/token-generate/set-maximum-overdraft-limit-token":
      return [
        ["Receipt Id", receipt.receiptId],
        ["Customer Id", receipt.customerId ?? "--"],
        ["Meter Type", receipt.meterType ?? "--"],
        ["Station", receipt.stationId ?? "--"],
        ["Issued At", receipt.createdAt ?? "--"],
        ["Issued By", receipt.createdBy ?? "--"],
        ["Token", formatTokenValue(receipt.token)],
      ] as const;
    case "/token-generate/change-meter-key-token":
    case "/token-generate/update-meter-key":
      return [
        ["Receipt Id", receipt.receiptId],
        ["Customer Id", receipt.customerId ?? "--"],
        ["Meter Id", receipt.meterId],
        ["Station", receipt.stationId ?? "--"],
        ["Issued At", receipt.createdAt ?? "--"],
        ["Issued By", receipt.createdBy ?? "--"],
        ["Token", formatTokenValue(receipt.token)],
      ] as const;
    default:
      return [
        ["Receipt Id", receipt.receiptId],
        ["Customer Id", receipt.customerId ?? "--"],
        ["Meter Type", receipt.meterType ?? "--"],
        ["Station", receipt.stationId ?? "--"],
        ["Issued At", receipt.createdAt ?? "--"],
        ["Issued By", receipt.createdBy ?? "--"],
        ["Token", formatTokenValue(receipt.token)],
      ] as const;
  }
}

function getSuccessHeroFields(receipt: TokenReceipt) {
  return [
    ["Customer", receipt.customerName],
    ["Meter", receipt.meterId],
    ["Amount", receipt.totalPaid !== null ? formatNaira(receipt.totalPaid) : "--"],
    ["Units", receipt.totalUnit !== null ? formatNumber(receipt.totalUnit) : "--"],
  ].map(([label, value]) => ({ label, value }));
}

function formatStaticValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "--";
  }

  return String(value);
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
    sortName,
    sortDirection,
    setSortName,
    setSortDirection,
    setPageNumber,
    setPageSize,
    search,
    reset,
    refresh,
    getRowKeyValue,
    live,
  } = useDataTable(page);
  const [tariffs, setTariffs] = useState<DataRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<DataRow | null>(null);
  const [authorizationPassword, setAuthorizationPassword] = useState("");
  const [entryMode, setEntryMode] = useState<RechargeEntryMode>("naira");
  const [entryValue, setEntryValue] = useState("");
  const [oldMeterKey, setOldMeterKey] = useState("");
  const [newMeterKey, setNewMeterKey] = useState("");
  const [creditOptions, setCreditOptions] = useState<CreditTokenOptions>({
    isPreview: false,
    isVendByTotalPaid: true,
    payDebtPercent: null,
    isS2: false,
  });
  const [creditForm, setCreditForm] = useState<CreditTokenFormState>({
    paymentMethod: "cash",
    quotaEnabled: false,
    quotaValue: null,
    remark: "",
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<TokenReceipt | null>(null);

  const primaryAction = readPrimaryAction(page);
  const pageVariant = readPageVariant(page);
  const useGenerateAnchorLayout = page.sectionKey === "token-generate";
  const isCreditFlow = primaryAction?.operationKind === "token-generate-credit";
  const isLimitFlow = primaryAction?.operationKind === "token-generate-limit";
  const isMeterKeyFlow = page.path === "/token-generate/update-meter-key";

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
  const creditContext = useMemo(
    () => (selectedRow ? readCreditTokenContext(selectedRow) : null),
    [selectedRow],
  );
  const numericEntryValue = entryValue.trim().length > 0 ? Number(entryValue) : Number.NaN;
  const rechargeQuote = useMemo(
    () =>
      isCreditFlow && tariffResolution
        ? buildRechargeQuote(entryMode, numericEntryValue, tariffResolution.pricePerUnit)
        : null,
    [entryMode, isCreditFlow, numericEntryValue, tariffResolution],
  );
  const creditEntryValid = Number.isFinite(numericEntryValue) && numericEntryValue > 0;
  const quotaValid =
    !creditForm.quotaEnabled ||
    (creditForm.quotaValue !== null && Number.isFinite(creditForm.quotaValue) && creditForm.quotaValue > 0);
  const canContinue =
    selectedRow !== null &&
    primaryAction !== undefined &&
    (isMeterKeyFlow
      ? oldMeterKey.trim().length > 0 && newMeterKey.trim().length > 0
      : !isCreditFlow
      ? !isLimitFlow || (Number.isFinite(numericEntryValue) && numericEntryValue > 0)
      : creditEntryValid && quotaValid);
  const canConfirm = canContinue && authorizationPassword.trim().length > 0;

  const actionLabel = pageVariant.actionLabel;

  const openDialog = (row: DataRow) => {
    setSelectedRow(row);
    setFeedback(null);
    setConfirmOpen(false);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setConfirmOpen(false);
    setEntryMode("naira");
    setEntryValue("");
    setOldMeterKey("");
    setNewMeterKey("");
    setAuthorizationPassword("");
    setCreditOptions({
      isPreview: false,
      isVendByTotalPaid: true,
      payDebtPercent: null,
      isS2: false,
    });
    setCreditForm({
      paymentMethod: "cash",
      quotaEnabled: false,
      quotaValue: null,
      remark: "",
    });
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
        if (!creditEntryValid) {
          throw new Error("Enter a valid recharge amount.");
        }

        payload = buildCreditTokenPayload(
          selectedRow,
          {
            entryMode,
            entryValue: numericEntryValue,
            quote: rechargeQuote,
          },
          authorizationPassword,
          creditOptions,
          creditForm,
        );
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
          oldMeterKey: oldMeterKey.trim() || undefined,
          newMeterKey: newMeterKey.trim() || undefined,
          oldKey: oldMeterKey.trim() || undefined,
          newKey: newMeterKey.trim() || undefined,
        };
      }

      const result = await runPageAction(primaryAction.endpoint, payload);
      setSuccessReceipt(buildTokenReceipt(result as Record<string, unknown>, selectedRow));
      setFeedback(result.message ?? `${page.title} completed.`);
      setDialogOpen(false);
      setConfirmOpen(false);
      await refresh();
    } catch (caughtError) {
      setFeedback(caughtError instanceof Error ? caughtError.message : "Token generation failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page-stack token-module-page">
      <TokenReferenceToolbar
        actions={[
          ...(primaryAction?.successRedirectPath
            ? [
                {
                  label: "Open Record",
                  onClick: () => navigate(primaryAction.successRedirectPath as string),
                },
              ]
            : []),
          {
            label: "Refresh",
            onClick: () => {
              void refresh()
                .then(() => setFeedback("Data refreshed"))
                .catch((caughtError) =>
                  setFeedback(caughtError instanceof Error ? caughtError.message : "Refresh failed"),
                );
            },
          },
        ]}
        badge={pageVariant.resultBadge}
        error={error}
        feedback={feedback}
        filters={page.filters}
        live={live}
        onFilterChange={(key, value) => {
          setDraftFilters((current) => ({ ...current, [key]: value }));
        }}
        onReset={() => {
          setFeedback(null);
          reset();
        }}
        onSearch={() => {
          setFeedback(null);
          search();
        }}
        onSortChange={(nextSortName, nextSortDirection) => {
          setSortName(nextSortName);
          setSortDirection(nextSortDirection);
        }}
        subtitle={pageVariant.subtitle}
        title={page.title}
        total={total}
        values={draftFilters}
        sortDirection={sortDirection}
        sortName={sortName}
        sortOptions={page.columns.map((column) => ({ key: column.key, label: String(column.label) }))}
      />

      {successReceipt ? (
        <TokenReceiptDrawer
          detailFields={getSuccessFields(page, successReceipt).map(([label, value]) => ({
            label,
            value,
          }))}
          eyebrow={pageVariant.resultBadge}
          heroFields={getSuccessHeroFields(successReceipt)}
          onClose={() => setSuccessReceipt(null)}
          open
          primaryAction={{
            label: pageVariant.successActionLabel,
            onClick: () => printReceipt(page.title, successReceipt, pageVariant),
            tone: "neutral",
          }}
          secondaryActions={[
            ...(primaryAction?.successRedirectPath
              ? [
                  {
                    label: "Open Record",
                    onClick: () => navigate(primaryAction.successRedirectPath as string),
                    tone: "ghost" as const,
                  },
                ]
              : []),
            {
              label: "Done",
              onClick: () => setSuccessReceipt(null),
              tone: "primary",
            },
          ]}
          subtitle={pageVariant.subtitle}
          title={pageVariant.resultTitle}
          tokenValue={formatTokenValue(successReceipt.token)}
        />
      ) : null}

      {useGenerateAnchorLayout ? (
        <div className="token-anchor-grid">
          <Surface className="token-anchor-panel" tone="default">
            <div className="token-anchor-panel__header">
              <div>
                <p className="token-anchor-panel__eyebrow">Account List</p>
                <h2 className="token-anchor-panel__title">{page.title} accounts</h2>
              </div>
              <span className="token-anchor-panel__meta">{total.toLocaleString()} record(s)</span>
            </div>

            <div className="token-anchor-table-wrap">
              <table className="token-anchor-table">
                <thead>
                  <tr>
                    {getGeneratePrimaryColumns(page).map((column) => (
                      <th key={column.label}>{column.label}</th>
                    ))}
                    <th aria-label="Action" />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={getGeneratePrimaryColumns(page).length + 1}>Loading accounts...</td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={getGeneratePrimaryColumns(page).length + 1}>No accounts found.</td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const rowKey = getRowKeyValue(row);
                      const active = selectedRow ? getRowKeyValue(selectedRow) === rowKey : false;

                      return (
                        <tr
                          className={active ? "is-active" : undefined}
                          key={rowKey}
                          onClick={() => setSelectedRow(row)}
                        >
                          {getGeneratePrimaryColumns(page).map((column) => (
                            <td key={column.label}>
                              <strong>{readRowValue(row, [...column.primaryKeys])}</strong>
                              {"secondaryKeys" in column && column.secondaryKeys.length ? (
                                <span>{readRowValue(row, [...column.secondaryKeys])}</span>
                              ) : null}
                            </td>
                          ))}
                          <td className="token-anchor-table__action">
                            <button
                              className="token-anchor-button token-anchor-button--primary"
                              onClick={(event) => {
                                event.stopPropagation();
                                openDialog(row);
                              }}
                              type="button"
                            >
                              {actionLabel}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="token-anchor-pagination">
              <span>
                Page {pageNumber} of {Math.max(1, Math.ceil(total / pageSize))}
              </span>
              <div className="token-anchor-pagination__actions">
                <button
                  className="token-anchor-button"
                  disabled={pageNumber <= 1}
                  onClick={() => setPageNumber(pageNumber - 1)}
                  type="button"
                >
                  Previous
                </button>
                <button
                  className="token-anchor-button"
                  disabled={pageNumber * pageSize >= total}
                  onClick={() => setPageNumber(pageNumber + 1)}
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          </Surface>

          <Surface className="token-anchor-panel token-anchor-panel--summary" tone="default">
            <div className="token-anchor-panel__header">
              <div>
                <p className="token-anchor-panel__eyebrow">{pageVariant.resultBadge}</p>
                <h2 className="token-anchor-panel__title">{pageVariant.selectionTitle}</h2>
              </div>
            </div>

            {selectedRow ? (
              <div className="token-anchor-summary">
                <div className="token-anchor-summary__hero">
                  <strong>{readRowValue(selectedRow, ["customerName", "customerId"])}</strong>
                  <span>{readRowValue(selectedRow, ["meterId"])}</span>
                </div>
                <div className="token-anchor-summary__grid">
                  {renderGenerateAnchorSummary(selectedRow, isCreditFlow).map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                <button
                  className="token-anchor-button token-anchor-button--primary token-anchor-button--wide"
                  onClick={() => openDialog(selectedRow)}
                  type="button"
                >
                  {actionLabel}
                </button>
              </div>
            ) : (
              <div className="token-anchor-empty">
                <strong>No account selected</strong>
                <span>{pageVariant.selectionEmpty}</span>
              </div>
            )}
          </Surface>
        </div>
      ) : (
        <DataTable
          columns={page.columns}
          getRowKey={getRowKeyValue}
          loading={loading}
          onPageChange={setPageNumber}
          onPageSizeChange={(nextSize: number) => {
            setPageNumber(1);
            setPageSize(nextSize);
          }}
          onRowAction={(action: ActionConfig, row: DataRow) => {
            if (action.key === primaryAction?.key) {
              openDialog(row);
            }
          }}
          onRowClick={(row: DataRow) => setSelectedRow(row)}
          onToggleAll={() => undefined}
          onToggleRow={() => undefined}
          pageNumber={pageNumber}
          pageSize={pageSize}
          rowActions={primaryAction ? [{ ...primaryAction, label: actionLabel }] : []}
          rowActionDisplay="inline"
          rows={rows}
          selectedKeys={selectedRow ? [getRowKeyValue(selectedRow)] : []}
          selectionMode="none"
          total={total}
          columnFilters={draftFilters}
          onColumnFilterChange={(key: string, value: string) => {
            setDraftFilters((current) => ({ ...current, [key]: value }));
          }}
          onColumnSearch={() => {
            setFeedback(null);
            search();
          }}
          title={page.title}
        />
      )}

      {dialogOpen && selectedRow ? (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && closeDialog()}>
          <Surface as="div" className="modal-card ds-modal-card token-neutral-surface" tone="default">
            <div className="modal-header">
              <div className="modal-header-info">
                <span className="modal-eyebrow">{page.menuLabel}</span>
                <h3 className="modal-title">{actionLabel}</h3>
                <p className="modal-confirm-message">
                  {String(selectedRow.customerName ?? "Unknown customer")} / {String(selectedRow.meterId ?? "--")}
                </p>
              </div>
              <Button aria-label="Close" className="modal-close" onClick={closeDialog} size="icon" tone="ghost">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Button>
            </div>

            <div className="modal-body">
              <div className="modal-grid">
                {isCreditFlow ? (
                  <>
                    <label className="modal-field">
                      <span className="modal-field-label">Customer Id</span>
                      <input
                        className="modal-input"
                        readOnly
                        value={String(selectedRow.customerId ?? creditContext?.customerId ?? "")}
                      />
                    </label>

                    <label className="modal-field">
                      <span className="modal-field-label">Customer Name</span>
                      <input
                        className="modal-input"
                        readOnly
                        value={String(selectedRow.customerName ?? creditContext?.customerName ?? "")}
                      />
                    </label>

                    <label className="modal-field">
                      <span className="modal-field-label">Meter Id</span>
                      <input
                        className="modal-input"
                        readOnly
                        value={String(selectedRow.meterId ?? creditContext?.meterId ?? "")}
                      />
                    </label>

                    <label className="modal-field">
                      <span className="modal-field-label">Tariff Id</span>
                      <input
                        className="modal-input"
                        readOnly
                        value={String(
                          tariffResolution?.tariffName ??
                            tariffResolution?.tariffId ??
                            selectedRow.tariffId ??
                            creditContext?.tariffId ??
                            "",
                        )}
                      />
                    </label>

                    <label className="modal-field">
                      <span className="modal-field-label">Debt Percent</span>
                      <select
                        className="modal-input"
                        onChange={(event) =>
                          setCreditOptions((current) => ({
                            ...current,
                            payDebtPercent:
                              event.target.value.trim().length > 0 ? Number(event.target.value) : null,
                          }))
                        }
                        value={String(creditOptions.payDebtPercent ?? 0)}
                      >
                        {[0, 25, 50, 75, 100].map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="modal-field">
                      <span className="modal-field-label">Purchase Way</span>
                      <select
                        className="modal-input"
                        onChange={(event) =>
                          {
                            const nextValue = event.target.value as RechargeEntryMode;
                            setEntryMode(nextValue);
                            setCreditOptions((current) => ({
                              ...current,
                              isVendByTotalPaid: nextValue === "naira",
                            }));
                          }
                        }
                        value={entryMode}
                      >
                        <option value="naira">Vend By Total Paid</option>
                        <option value="unit">Vend By Total Unit</option>
                      </select>
                    </label>

                    <label className="modal-field">
                      <span className="modal-field-label">
                        {entryMode === "naira" ? "Total Paid(MMK)" : "Total Unit(kWh)"}
                      </span>
                      <input
                        className="modal-input"
                        min="0"
                        onChange={(event) => setEntryValue(event.target.value)}
                        placeholder={entryMode === "naira" ? "350" : "1"}
                        step="0.01"
                        type="number"
                        value={entryValue}
                      />
                    </label>

                    <div className="token-flow-modal__summary" style={{ gridColumn: "1 / -1" }}>
                      <div>
                        <span>Total Debt</span>
                        <strong>
                          {creditContext?.totalDebt != null ? formatNaira(creditContext.totalDebt) : "--"}
                        </strong>
                      </div>
                      <div>
                        <span>Monthly Charge</span>
                        <strong>
                          {creditContext?.monthlyCharge != null ? formatNaira(creditContext.monthlyCharge) : "--"}
                        </strong>
                      </div>
                      <div>
                        <span>Total Recharge</span>
                        <strong>
                          {rechargeQuote?.amountNaira != null ? formatNaira(rechargeQuote.amountNaira) : "--"}
                        </strong>
                      </div>
                      <div>
                        <span>Total Unit</span>
                        <strong>{rechargeQuote ? `${formatNumber(rechargeQuote.units)} kWh` : "--"}</strong>
                      </div>
                    </div>

                    <div className="token-flow-modal__summary token-flow-modal__summary--sts" style={{ gridColumn: "1 / -1" }}>
                      <div>
                        <span>SGC</span>
                        <strong>{formatStaticValue(creditContext?.sts.sgc)}</strong>
                      </div>
                      <div>
                        <span>TI</span>
                        <strong>{formatStaticValue(creditContext?.sts.ti)}</strong>
                      </div>
                      <div>
                        <span>KEN</span>
                        <strong>{formatStaticValue(creditContext?.sts.ken)}</strong>
                      </div>
                      <div>
                        <span>KRN</span>
                        <strong>{formatStaticValue(creditContext?.sts.krn)}</strong>
                      </div>
                    </div>
                  </>
                ) : isMeterKeyFlow ? (
                  <>
                    <label className="modal-field">
                      <span className="modal-field-label">Old Meter Key</span>
                      <input
                        className="modal-input"
                        onChange={(event) => setOldMeterKey(event.target.value)}
                        placeholder="Enter old meter key"
                        value={oldMeterKey}
                      />
                    </label>

                    <label className="modal-field">
                      <span className="modal-field-label">New Meter Key</span>
                      <input
                        className="modal-input"
                        onChange={(event) => setNewMeterKey(event.target.value)}
                        placeholder="Enter new meter key"
                        value={newMeterKey}
                      />
                    </label>

                    <div className="token-flow-modal__summary" style={{ gridColumn: "1 / -1" }}>
                      <div>
                        <span>Customer</span>
                        <strong>{String(selectedRow.customerName ?? "--")}</strong>
                      </div>
                      <div>
                        <span>Meter</span>
                        <strong>{String(selectedRow.meterId ?? "--")}</strong>
                      </div>
                      <div>
                        <span>Station</span>
                        <strong>{String(selectedRow.stationId ?? "--")}</strong>
                      </div>
                    </div>
                  </>
                ) : isLimitFlow ? (
                  <label className="modal-field">
                    <span className="modal-field-label">Limit Value</span>
                    <input
                      className="modal-input"
                      min="0"
                      onChange={(event) => setEntryValue(event.target.value)}
                      placeholder="Enter limit"
                      step="0.01"
                      type="number"
                      value={entryValue}
                    />
                  </label>
                ) : null}

              </div>
            </div>

            <div className="modal-footer">
              <Button className="modal-btn modal-btn--ghost" onClick={closeDialog} tone="ghost">
                Cancel
              </Button>
              <Button
                className="modal-btn modal-btn--primary"
                disabled={!canContinue || submitting}
                onClick={() => setConfirmOpen(true)}
                tone="neutral"
              >
                Confirm
              </Button>
            </div>
          </Surface>
        </div>
      ) : null}

      {confirmOpen && selectedRow ? (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setConfirmOpen(false)}>
          <Surface as="div" className="token-confirm-modal ds-modal-card token-neutral-surface" tone="default">
            <div className="token-confirm-modal__header">
              <div>
                <p className="token-confirm-modal__eyebrow">Credit Token</p>
                <h3 className="token-confirm-modal__title">
                  {isCreditFlow ? "Transaction Confirmation" : actionLabel}
                </h3>
              </div>
              <Button aria-label="Close" className="modal-close" onClick={() => setConfirmOpen(false)} size="icon" tone="ghost">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Button>
            </div>

            <div className="token-confirm-modal__body">
              {isCreditFlow ? (
                <div className="token-transaction-confirmation">
                  <div className="token-transaction-confirmation__details">
                    {buildTransactionConfirmationFields(selectedRow, {
                      rechargeQuote,
                      creditContext,
                      creditForm,
                    }).map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="token-transaction-confirmation__inputs">
                    <label className="modal-field">
                      <span className="modal-field-label">Payment Method</span>
                      <select
                        className="modal-input"
                        onChange={(event) =>
                          setCreditForm((current) => ({
                            ...current,
                            paymentMethod: event.target.value,
                          }))
                        }
                        value={creditForm.paymentMethod}
                      >
                        <option value="cash">Cash</option>
                        <option value="wallet">Wallet</option>
                        <option value="transfer">Transfer</option>
                        <option value="pos">POS</option>
                      </select>
                    </label>

                    <label className="modal-field">
                      <span className="modal-field-label">Authorization Password</span>
                      <input
                        autoComplete="current-password"
                        className="modal-input"
                        onChange={(event) => setAuthorizationPassword(event.target.value)}
                        placeholder="Password"
                        type="password"
                        value={authorizationPassword}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <p className="token-confirm-modal__summary">
                  {buildConfirmSummary(selectedRow, {
                    isCreditFlow,
                    isMeterKeyFlow,
                    rechargeQuote,
                    numericEntryValue,
                    entryMode,
                    creditOptions,
                    creditForm,
                    oldMeterKey,
                    newMeterKey,
                  })}
                </p>
              )}
            </div>

            <div className="token-confirm-modal__actions">
              <Button className="modal-btn modal-btn--ghost" onClick={() => setConfirmOpen(false)} tone="ghost">
                Cancel
              </Button>
              <Button
                className="modal-btn token-confirm-modal__confirm"
                disabled={!canConfirm || submitting}
                onClick={() => void executeTokenGenerate()}
                tone="neutral"
              >
                Confirm
              </Button>
            </div>
          </Surface>
        </div>
      ) : null}
    </section>
  );
}

export default TokenGeneratePage;
