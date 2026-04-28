import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConfirmModal } from "../components/common/ConfirmModal";
import { DataTable } from "../components/common/DataTable";
import { FormModal } from "../components/common/FormModal";
import { TokenReceiptDrawer } from "../components/token/TokenReceiptDrawer";
import { TokenReferenceToolbar } from "../components/token/TokenReferenceToolbar";
import { Button, Surface } from "../design-system";
import { useDataTable } from "../hooks/useDataTable";
import { runPageAction } from "../services/api";
import { downloadRowsAsCsv } from "../services/client-table-actions";
import { buildActionPayload } from "../services/payload-mapper";
import type { ActionConfig, DataPageConfig, DataRow } from "../types";

interface PendingAction {
  action: ActionConfig;
  row?: DataRow;
  isBulk?: boolean;
}

interface TokenRecordVariant {
  badge: string;
  subtitle: string;
  generatePath: string | null;
  generateLabel: string | null;
  secondaryPath: string | null;
  secondaryLabel: string | null;
  selectedTitle: string;
  printLabel: string;
}

function isCreditRecordPage(page: DataPageConfig) {
  return (
    page.path === "/token-record/credit-token-record" ||
    page.path === "/token-record/credit-token-cancel-record"
  );
}

function SearchIconSmall() {
  return (
    <svg fill="none" height="15" viewBox="0 0 24 24" width="15">
      <path
        d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function RotateIconSmall() {
  return (
    <svg fill="none" height="15" viewBox="0 0 24 24" width="15">
      <path
        d="M3 12a9 9 0 101.64-5.2M3 4v5h5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function DownloadIconSmall() {
  return (
    <svg fill="none" height="15" viewBox="0 0 24 24" width="15">
      <path
        d="M12 3v12m0 0l4-4m-4 4l-4-4M5 21h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function readString(row: DataRow | undefined, keys: readonly string[]) {
  if (!row) {
    return "--";
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

  return "--";
}

function readVariant(page: DataPageConfig): TokenRecordVariant {
  switch (page.path) {
    case "/token-record/credit-token-record":
      return {
        badge: "Credit Token Record",
        subtitle: "Review successful credit vend records exactly from the AMR token record flow.",
        generatePath: "/token-generate/credit-token",
        generateLabel: "Open Credit Token",
        secondaryPath: "/token-record/credit-token-cancel-record",
        secondaryLabel: "Open Cancel Record",
        selectedTitle: "Receipt details",
        printLabel: "Print Receipt",
      };
    case "/token-record/credit-token-cancel-record":
      return {
        badge: "Credit Token Cancel Record",
        subtitle: "Review cancelled credit token records from the AMR reference workflow.",
        generatePath: "/token-record/credit-token-record",
        generateLabel: "Open Credit Token Record",
        secondaryPath: "/token-generate/credit-token",
        secondaryLabel: "Open Credit Token",
        selectedTitle: "Cancelled receipt",
        printLabel: "Print Record",
      };
    case "/token-record/clear-tamper-token-record":
      return {
        badge: "Clear Tamper Token Record",
        subtitle: "Review generated clear tamper token records from the AMR token flow.",
        generatePath: "/token-generate/clear-tamper-token",
        generateLabel: "Open Clear Tamper Token",
        secondaryPath: null,
        secondaryLabel: null,
        selectedTitle: "Clear tamper receipt",
        printLabel: "Print Result",
      };
    case "/token-record/clear-credit-record":
      return {
        badge: "Clear Credit Token Record",
        subtitle: "Review generated clear credit token records from the AMR token flow.",
        generatePath: "/token-generate/clear-credit-token",
        generateLabel: "Open Clear Credit Token",
        secondaryPath: null,
        secondaryLabel: null,
        selectedTitle: "Clear credit receipt",
        printLabel: "Print Result",
      };
    case "/token-record/set-maximum-power-limit-token-record":
      return {
        badge: "Maximum Power Limit Token Record",
        subtitle: "Review generated maximum power limit token records from the AMR token flow.",
        generatePath: "/token-generate/set-max-power-limit-token",
        generateLabel: "Open Max Power Limit Token",
        secondaryPath: null,
        secondaryLabel: null,
        selectedTitle: "Maximum power receipt",
        printLabel: "Print Result",
      };
    case "/token-record/set-maximum-phase-power-unbalance-limit-token-record":
      return {
        badge: "Maximum Phase Power Unbalance Limit Token Record",
        subtitle: "Review generated phase power unbalance limit token records from the AMR token flow.",
        generatePath: "/token-generate/set-maximum-phase-power-unbalance-limit-token",
        generateLabel: "Open Phase Unbalance Token",
        secondaryPath: null,
        secondaryLabel: null,
        selectedTitle: "Phase unbalance receipt",
        printLabel: "Print Result",
      };
    case "/token-record/change-meter-key-token-record":
      return {
        badge: "Change Meter Key Token Record",
        subtitle: "Review generated change meter key token records from the AMR token flow.",
        generatePath: "/token-generate/change-meter-key-token",
        generateLabel: "Open Change Meter Key Token",
        secondaryPath: "/token-generate/update-meter-key",
        secondaryLabel: "Open Update Meter Key",
        selectedTitle: "Change key receipt",
        printLabel: "Print Result",
      };
    case "/token-record/set-maximum-overdraft-limit-token-record":
      return {
        badge: "Maximum Overdraft Limit Token Record",
        subtitle: "Review generated maximum overdraft limit token records from the AMR token flow.",
        generatePath: "/token-generate/set-maximum-overdraft-limit-token",
        generateLabel: "Open Max Overdraft Token",
        secondaryPath: null,
        secondaryLabel: null,
        selectedTitle: "Maximum overdraft receipt",
        printLabel: "Print Result",
      };
    case "/token-record/meter-test-token":
      return {
        badge: "Meter Test Token Record",
        subtitle: "Review generated meter test token records from the AMR token flow.",
        generatePath: null,
        generateLabel: null,
        secondaryPath: null,
        secondaryLabel: null,
        selectedTitle: "Meter test receipt",
        printLabel: "Print Result",
      };
    default:
      return {
        badge: page.menuLabel,
        subtitle: page.description,
        generatePath: null,
        generateLabel: null,
        secondaryPath: null,
        secondaryLabel: null,
        selectedTitle: "Selected record",
        printLabel: "Print Record",
      };
  }
}

function getRecordPrimaryColumns(page: DataPageConfig) {
  switch (page.path) {
    case "/token-record/credit-token-record":
    case "/token-record/credit-token-cancel-record":
      return [
        { label: "Receipt", keys: ["receiptId"] },
        { label: "Customer", keys: ["customerName", "customerId"] },
        { label: "Meter", keys: ["meterId"] },
        { label: "Unit", keys: ["totalUnit", "tokenRecharge"] },
        { label: "Amount", keys: ["totalPaid", "totalPrice"] },
        { label: "Vend", keys: ["createId"] },
        { label: "Time", keys: ["createTime"] },
      ] as const;
    case "/token-record/set-maximum-power-limit-token-record":
      return [
        { label: "Receipt", keys: ["receiptId"] },
        { label: "Customer", keys: ["customerName", "customerId"] },
        { label: "Meter", keys: ["meterId"] },
        { label: "Limit", keys: ["maximumPowerLimit"] },
        { label: "Status", keys: ["status"] },
        { label: "Time", keys: ["createTime"] },
      ] as const;
    case "/token-record/set-maximum-phase-power-unbalance-limit-token-record":
      return [
        { label: "Receipt", keys: ["receiptId"] },
        { label: "Customer", keys: ["customerName", "customerId"] },
        { label: "Meter", keys: ["meterId"] },
        { label: "Limit", keys: ["maximumPhasePowerUnbalanceLimit"] },
        { label: "Status", keys: ["status"] },
        { label: "Time", keys: ["createTime"] },
      ] as const;
    case "/token-record/set-maximum-overdraft-limit-token-record":
      return [
        { label: "Receipt", keys: ["receiptId"] },
        { label: "Customer", keys: ["customerName", "customerId"] },
        { label: "Meter", keys: ["meterId"] },
        { label: "Limit", keys: ["maximumOverdraftLimit"] },
        { label: "Status", keys: ["status"] },
        { label: "Time", keys: ["createTime"] },
      ] as const;
    default:
      return [
        { label: "Receipt", keys: ["receiptId"] },
        { label: "Customer", keys: ["customerName", "customerId"] },
        { label: "Meter", keys: ["meterId"] },
        { label: "Token", keys: ["token", "tokenRecharge"] },
        { label: "Status", keys: ["status"] },
        { label: "Time", keys: ["createTime"] },
      ] as const;
  }
}

function getRecordSummaryFields(page: DataPageConfig, row: DataRow) {
  switch (page.path) {
    case "/token-record/credit-token-record":
    case "/token-record/credit-token-cancel-record":
      return [
        ["Customer Id", readString(row, ["customerId"])],
        ["Tariff", readString(row, ["tariffId"])],
        ["Meter", readString(row, ["meterId"])],
        ["Amount", readString(row, ["totalPaid", "totalPrice"])],
        ["Units", readString(row, ["totalUnit", "tokenRecharge"])],
        ["Vend", readString(row, ["createId"])],
        ["Issued", readString(row, ["createTime"])],
      ] as const;
    case "/token-record/set-maximum-power-limit-token-record":
      return [
        ["Customer", readString(row, ["customerName", "customerId"])],
        ["Meter", readString(row, ["meterId"])],
        ["Maximum Power", readString(row, ["maximumPowerLimit"])],
        ["Status", readString(row, ["status"])],
        ["Remark", readString(row, ["remark"])],
        ["Issued", readString(row, ["createTime"])],
      ] as const;
    case "/token-record/set-maximum-phase-power-unbalance-limit-token-record":
      return [
        ["Customer", readString(row, ["customerName", "customerId"])],
        ["Meter", readString(row, ["meterId"])],
        ["Phase Limit", readString(row, ["maximumPhasePowerUnbalanceLimit"])],
        ["Status", readString(row, ["status"])],
        ["Remark", readString(row, ["remark"])],
        ["Issued", readString(row, ["createTime"])],
      ] as const;
    case "/token-record/set-maximum-overdraft-limit-token-record":
      return [
        ["Customer", readString(row, ["customerName", "customerId"])],
        ["Meter", readString(row, ["meterId"])],
        ["Overdraft Limit", readString(row, ["maximumOverdraftLimit"])],
        ["Status", readString(row, ["status"])],
        ["Remark", readString(row, ["remark"])],
        ["Issued", readString(row, ["createTime"])],
      ] as const;
    default:
      return [
        ["Customer", readString(row, ["customerName", "customerId"])],
        ["Meter", readString(row, ["meterId"])],
        ["Token", readString(row, ["token", "tokenRecharge"])],
        ["Status", readString(row, ["status"])],
        ["Remark", readString(row, ["remark"])],
        ["Issued", readString(row, ["createTime"])],
      ] as const;
  }
}

function getRecordVisualValue(page: DataPageConfig, row: DataRow) {
  switch (page.path) {
    case "/token-record/set-maximum-power-limit-token-record":
      return readString(row, ["maximumPowerLimit"]);
    case "/token-record/set-maximum-phase-power-unbalance-limit-token-record":
      return readString(row, ["maximumPhasePowerUnbalanceLimit"]);
    case "/token-record/set-maximum-overdraft-limit-token-record":
      return readString(row, ["maximumOverdraftLimit"]);
    default:
      return readString(row, ["token", "tokenFirst", "tokenRecharge"]);
  }
}

function getRecordDrawerHeroFields(page: DataPageConfig, row: DataRow) {
  switch (page.path) {
    case "/token-record/credit-token-record":
    case "/token-record/credit-token-cancel-record":
      return [
        ["Receipt", readString(row, ["receiptId"])],
        ["Customer", readString(row, ["customerName", "customerId"])],
        ["Meter", readString(row, ["meterId"])],
        ["Amount", readString(row, ["totalPaid", "totalPrice"])],
        ["Units", readString(row, ["totalUnit", "tokenRecharge"])],
      ] as const;
    default:
      return [
        ["Customer", readString(row, ["customerName", "customerId"])],
        ["Meter", readString(row, ["meterId"])],
        ["Status", readString(row, ["status"])],
        ["Issued", readString(row, ["createTime"])],
      ] as const;
  }
}

function getRecordDrawerFields(page: DataPageConfig, row: DataRow) {
  const coreFields = [
    ["Receipt Id", readString(row, ["receiptId"])],
    ["Customer Id", readString(row, ["customerId"])],
    ["Customer Name", readString(row, ["customerName"])],
    ["Meter Id", readString(row, ["meterId"])],
    ["Token", readString(row, ["token", "tokenFirst", "tokenRecharge"])],
    ["Created By", readString(row, ["createId", "createdBy"])],
    ["Created At", readString(row, ["createDate", "createTime"])],
  ] as const;

  switch (page.path) {
    case "/token-record/credit-token-record":
    case "/token-record/credit-token-cancel-record":
      return [
        ...coreFields,
        ["Tariff", readString(row, ["tariffId"])],
        ["Tax", readString(row, ["tax"])],
        ["Monthly Charge", readString(row, ["monthlyCharge"])],
        ["Total Debt", readString(row, ["totalDebt"])],
        ["Remaining Debt", readString(row, ["remainingDebt"])],
        ["Pay Debt", readString(row, ["payDebt"])],
        ["VAT Charge", readString(row, ["vatCharge"])],
        ["Amount", readString(row, ["totalPaid", "totalPrice"])],
        ["Units", readString(row, ["totalUnit"])],
        ["Status", readString(row, ["status"])],
        ["Station", readString(row, ["stationId"])],
        ["Remark", readString(row, ["remark"])],
      ] as const;
    case "/token-record/set-maximum-power-limit-token-record":
      return [
        ...coreFields,
        ["Maximum Power", readString(row, ["maximumPowerLimit"])],
        ["Status", readString(row, ["status"])],
        ["Remark", readString(row, ["remark"])],
      ] as const;
    case "/token-record/set-maximum-phase-power-unbalance-limit-token-record":
      return [
        ...coreFields,
        ["Maximum Phase Power Unbalance Limit", readString(row, ["maximumPhasePowerUnbalanceLimit"])],
        ["Status", readString(row, ["status"])],
        ["Remark", readString(row, ["remark"])],
      ] as const;
    case "/token-record/set-maximum-overdraft-limit-token-record":
      return [
        ...coreFields,
        ["Maximum Overdraft Limit", readString(row, ["maximumOverdraftLimit"])],
        ["Status", readString(row, ["status"])],
        ["Remark", readString(row, ["remark"])],
      ] as const;
    default:
      return [
        ...coreFields,
        ["Status", readString(row, ["status"])],
        ["Remark", readString(row, ["remark"])],
      ] as const;
  }
}

async function printTokenRecordDetails(title: string, columns: DataPageConfig["columns"], row: DataRow) {
  const printableWindow = window.open("", "_blank");
  if (!printableWindow) {
    throw new Error("Unable to open the print dialog");
  }

  const rows = columns
    .map((column) => {
      const value = row[column.key];
      return `<tr><th>${column.label}</th><td>${value === null || value === undefined || value === "" ? "--" : String(value)}</td></tr>`;
    })
    .join("");

  printableWindow.document.open();
  printableWindow.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { margin: 0; padding: 24px; font-family: Arial, sans-serif; background: #f3f4f6; color: #111827; }
      .sheet { max-width: 720px; margin: 0 auto; background: #fff; border: 1px solid #d1d5db; border-radius: 14px; overflow: hidden; }
      .head { padding: 20px 24px; border-bottom: 1px solid #e5e7eb; }
      .eyebrow { margin: 0 0 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #6b7280; }
      h1 { margin: 0; font-size: 24px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 12px 24px; border-bottom: 1px solid #e5e7eb; text-align: left; vertical-align: top; }
      th { width: 34%; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; }
      td { font-size: 14px; font-weight: 600; }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="head">
        <p class="eyebrow">Token Record</p>
        <h1>${title}</h1>
      </div>
      <table>${rows}</table>
    </div>
  </body>
</html>`);
  printableWindow.document.close();
  printableWindow.focus();
  window.setTimeout(() => printableWindow.print(), 50);
}

function buildCreditRecordSnapshot(row: DataRow) {
  return [
    ["Receipt Id", readString(row, ["receiptId"])],
    ["Customer", readString(row, ["customerName", "customerId"])],
    ["Meter", readString(row, ["meterId"])],
    ["Tariff", readString(row, ["tariffId"])],
    ["Unit", readString(row, ["totalUnit", "tokenRecharge"])],
    ["Amount", readString(row, ["totalPaid", "totalPrice"])],
    ["Vend", readString(row, ["createId"])],
    ["Status", readString(row, ["status"])],
    ["Station", readString(row, ["stationId"])],
    ["Issued", readString(row, ["createTime"])],
  ] as const;
}

export function TokenRecordPage({ page }: { page: DataPageConfig }) {
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
    sortName,
    sortDirection,
    setSortName,
    setSortDirection,
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
  const [drawerRecord, setDrawerRecord] = useState<DataRow | null>(null);
  const [openColumnFilter, setOpenColumnFilter] = useState<string | null>(null);
  const [openSortPopover, setOpenSortPopover] = useState(false);
  const variant = readVariant(page);
  const [activeRecordKey, setActiveRecordKey] = useState<string | null>(null);
  const useRecordAnchorLayout = page.sectionKey === "token-record";
  const creditRecordPage = isCreditRecordPage(page);

  const rowActions = useMemo(() => page.rowActions ?? [], [page.rowActions]);
  const activeRecord =
    rows.find((row) => getRowKeyValue(row) === activeRecordKey) ??
    rows[0] ??
    null;
  const printAction =
    rowActions.find((action) => action.operationKind === "client-print") ?? null;
  const cancelAction =
    rowActions.find((action) => action.operationKind === "record-cancel") ?? null;

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

      setDrawerRecord(options.row);
      setFeedback(`${page.menuLabel} receipt preview ready.`);
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

    const result = await runPageAction(action.endpoint, mapping.payload);
    if (action.operationKind === "record-cancel") {
      const canceledRowKey = options.row ? getRowKeyValue(options.row) : null;
      setDrawerRecord(null);
      if (canceledRowKey && activeRecordKey === canceledRowKey) {
        setActiveRecordKey(null);
      }
      await refresh();
      setFeedback(result.message ?? "Record cancelled. Review it in Credit Token Cancel Record.");
      return;
    }

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

  const confirmMessage =
    pendingAction?.action.operationKind === "record-cancel"
      ? [
          "Cancel this token record?",
          `Receipt Id: ${readString(pendingAction.row, ["receiptId"])}`,
          `Customer: ${readString(pendingAction.row, ["customerName", "customerId"])}`,
          `Meter Id: ${readString(pendingAction.row, ["meterId"])}`,
          `Amount: ${readString(pendingAction.row, ["totalPaid", "totalPrice"])}`,
          `Token: ${readString(pendingAction.row, ["token", "tokenFirst"])}`,
        ].join("\n")
      : pendingAction?.action.confirmMessage ?? "";

  return (
    <section className="page-stack token-module-page">
      {creditRecordPage ? null : (
        <TokenReferenceToolbar
          actions={[
            ...(variant.generatePath && variant.generateLabel
              ? [
                  {
                    label: variant.generateLabel,
                    onClick: () => navigate(variant.generatePath as string),
                  },
                ]
              : []),
            ...(variant.secondaryPath && variant.secondaryLabel
              ? [
                  {
                    label: variant.secondaryLabel,
                    onClick: () => navigate(variant.secondaryPath as string),
                  },
                ]
              : []),
            {
              label: "Export",
              onClick: () =>
                void handleAction({
                  key: "export",
                  label: "Export",
                  endpoint: page.readEndpoint,
                  operationKind: "client-export",
                }),
            },
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
          badge={variant.badge}
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
          subtitle={variant.subtitle}
          title={page.title}
          total={total}
          values={draftFilters}
          sortDirection={sortDirection}
          sortName={sortName}
          sortOptions={page.columns.map((column) => ({ key: column.key, label: String(column.label) }))}
        />
      )}

        {creditRecordPage ? (
          <div className="token-record-origin">
            <div className="token-record-origin__toolbar">
              <div className="token-record-origin__sort">
                <button
                  aria-label="Open sort options"
                  className="token-record-origin__sort-trigger"
                  onClick={() => setOpenSortPopover((current) => !current)}
                  type="button"
                >
                  <svg fill="none" height="15" viewBox="0 0 24 24" width="15">
                    <path
                      d="M4 7h10M4 12h7M4 17h4M16 7l2-2 2 2M18 5v14"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                </button>

                {openSortPopover ? (
                  <div className="token-record-origin__sort-panel">
                    <select
                      className="token-record-origin__sort-select"
                      onChange={(event) => setSortName(event.target.value)}
                      value={sortName}
                    >
                      <option value="">Select column</option>
                      {page.columns.map((column) => (
                        <option key={column.key} value={column.key}>
                          {String(column.label)}
                        </option>
                      ))}
                    </select>

                    <div className="token-record-origin__sort-radios">
                      <label>
                        <input
                          checked={sortDirection === "asc"}
                          name="credit-record-sort-direction"
                          onChange={() => setSortDirection("asc")}
                          type="radio"
                        />
                        <span>Ascending</span>
                      </label>
                      <label>
                        <input
                          checked={sortDirection === "desc"}
                          name="credit-record-sort-direction"
                          onChange={() => setSortDirection("desc")}
                          type="radio"
                        />
                        <span>Descending</span>
                      </label>
                    </div>

                    <button
                      className="token-record-origin__sort-apply"
                      onClick={() => {
                        setOpenSortPopover(false);
                        setFeedback(null);
                        search();
                      }}
                      type="button"
                    >
                      Sort
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="token-record-origin__search">
                <span className="token-record-origin__toolbar-icon">
                  <SearchIconSmall />
              </span>
              <input
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    searchTerm: event.target.value,
                  }))
                }
                placeholder="Search Term"
                value={draftFilters.searchTerm ?? ""}
              />
            </div>

              <button
                className="token-record-origin__toolbar-btn"
                onClick={() => {
                  setOpenSortPopover(false);
                  setFeedback(null);
                  search();
                }}
              type="button"
            >
              <SearchIconSmall />
              <span>Search</span>
            </button>

              <button
                className="token-record-origin__toolbar-btn"
                onClick={() => {
                  setFeedback(null);
                  reset();
                  setOpenSortPopover(false);
                  setOpenColumnFilter(null);
                }}
              type="button"
            >
              <RotateIconSmall />
              <span>Reset</span>
            </button>

            <button
              className="token-record-origin__toolbar-btn"
              onClick={() =>
                void handleAction({
                  key: "export",
                  label: "Export",
                  endpoint: page.readEndpoint,
                  operationKind: "client-export",
                })
              }
              type="button"
            >
              <DownloadIconSmall />
              <span>Export</span>
            </button>
          </div>

          <div className="token-record-origin__table-shell">
            <table className="token-record-origin__table">
              <thead>
                <tr>
                  {page.columns.map((column) => (
                    <th key={column.key}>
                      <div className="token-record-origin__head">
                        <span>{String(column.label)}</span>
                        {column.searchable ? (
                          <button
                            className="token-record-origin__head-search"
                              onClick={() =>
                                setOpenColumnFilter((current) => (current === column.key ? null : column.key))
                              }
                              type="button"
                            >
                            <SearchIconSmall />
                          </button>
                        ) : null}
                      </div>
                      {openColumnFilter === column.key ? (
                        <input
                          className="token-record-origin__column-input"
                          onChange={(event) =>
                            setDraftFilters((current) => ({
                              ...current,
                              [column.key]: event.target.value,
                            }))
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              setFeedback(null);
                              search();
                            }
                          }}
                          placeholder={`Search ${String(column.label)}`}
                          value={draftFilters[column.key] ?? ""}
                        />
                      ) : null}
                    </th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={page.columns.length + 1}>Loading records...</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={page.columns.length + 1}>No token records found.</td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={getRowKeyValue(row)}>
                      {page.columns.map((column) => (
                        <td key={column.key}>{readString(row, [column.key])}</td>
                      ))}
                      <td className="token-record-origin__actions">
                        {printAction ? (
                          <button
                            className="token-record-origin__row-btn token-record-origin__row-btn--print"
                            onClick={() => void handleAction(printAction, row)}
                            type="button"
                          >
                            Print
                          </button>
                        ) : null}
                        {cancelAction ? (
                          <button
                            className="token-record-origin__row-btn token-record-origin__row-btn--cancel"
                            onClick={() => void handleAction(cancelAction, row)}
                            type="button"
                          >
                            Cancel
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="token-record-origin__pagination">
            <button
              className="token-record-origin__page-nav"
              disabled={pageNumber <= 1}
              onClick={() => setPageNumber(pageNumber - 1)}
              type="button"
            >
              Prev
            </button>
            {Array.from({ length: Math.max(1, Math.ceil(total / pageSize)) }, (_, index) => index + 1)
              .slice(Math.max(0, pageNumber - 3), Math.max(0, pageNumber - 3) + 5)
              .map((pageIndex) => (
                <button
                  className={`token-record-origin__page-btn${pageIndex === pageNumber ? " is-active" : ""}`}
                  key={pageIndex}
                  onClick={() => setPageNumber(pageIndex)}
                  type="button"
                >
                  {pageIndex}
                </button>
              ))}
            <button
              className="token-record-origin__page-nav"
              disabled={pageNumber * pageSize >= total}
              onClick={() => setPageNumber(pageNumber + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      ) : useRecordAnchorLayout ? (
        <div className="token-anchor-grid">
          <Surface className="token-anchor-panel" tone="default">
            <div className="token-anchor-panel__header">
              <div>
                <p className="token-anchor-panel__eyebrow">Record List</p>
                <h2 className="token-anchor-panel__title">{page.title}</h2>
              </div>
              <span className="token-status-pill">{total.toLocaleString()} rows</span>
            </div>

            <div className="token-anchor-table-wrap">
              <table className="token-anchor-table">
                <thead>
                  <tr>
                    {getRecordPrimaryColumns(page).map((column) => (
                      <th key={column.label}>{column.label}</th>
                    ))}
                    <th aria-label="Action" />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={getRecordPrimaryColumns(page).length + 1}>Loading records...</td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={getRecordPrimaryColumns(page).length + 1}>No token records found.</td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const rowKey = getRowKeyValue(row);
                      const active = activeRecord ? getRowKeyValue(activeRecord) === rowKey : false;

                      return (
                        <tr
                          className={active ? "is-active" : undefined}
                          key={rowKey}
                          onClick={() => setActiveRecordKey(rowKey)}
                        >
                          {getRecordPrimaryColumns(page).map((column) => (
                            <td key={column.label}>
                              {column.label === "Customer" ? (
                                <>
                                  <strong>{readString(row, column.keys)}</strong>
                                  <span>{readString(row, ["customerId"])}</span>
                                </>
                              ) : (
                                readString(row, column.keys)
                              )}
                            </td>
                          ))}
                          <td className="token-anchor-table__action">
                            <div className="token-anchor-inline-actions">
                              {printAction ? (
                                <button
                                  className="token-anchor-button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleAction(printAction, row);
                                  }}
                                  type="button"
                                >
                                  Print
                                </button>
                              ) : null}
                              {cancelAction ? (
                                <button
                                  className="token-anchor-button token-anchor-button--danger"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleAction(cancelAction, row);
                                  }}
                                  type="button"
                                >
                                  Cancel
                                </button>
                              ) : null}
                            </div>
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
                <p className="token-anchor-panel__eyebrow">Selected Receipt</p>
                <h2 className="token-anchor-panel__title">{variant.selectedTitle}</h2>
              </div>
              {activeRecord ? (
                <span className="token-status-pill">{readString(activeRecord, ["receiptId"])}</span>
              ) : null}
            </div>

            {activeRecord ? (
              <>
                <div className="token-success-token">{getRecordVisualValue(page, activeRecord)}</div>

                {creditRecordPage ? (
                  <div className="token-flow-confirm-grid">
                    {buildCreditRecordSnapshot(activeRecord).map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="token-anchor-summary__grid">
                  {getRecordSummaryFields(page, activeRecord).map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>

                <div className="token-anchor-inline-actions">
                  {printAction ? (
                    <button
                      className="token-anchor-button"
                      onClick={() => void handleAction(printAction, activeRecord)}
                      type="button"
                    >
                      {variant.printLabel}
                    </button>
                  ) : null}
                  {cancelAction ? (
                    <button
                      className="token-anchor-button token-anchor-button--danger"
                      onClick={() => void handleAction(cancelAction, activeRecord)}
                      type="button"
                    >
                      Cancel Record
                    </button>
                  ) : null}
                  {variant.generatePath && variant.generateLabel ? (
                    <button
                      className="token-anchor-button token-anchor-button--primary"
                      onClick={() => navigate(variant.generatePath as string)}
                      type="button"
                    >
                      {variant.generateLabel}
                    </button>
                  ) : null}
                  {variant.secondaryPath && variant.secondaryLabel ? (
                    <button
                      className="token-anchor-button"
                      onClick={() => navigate(variant.secondaryPath as string)}
                      type="button"
                    >
                      {variant.secondaryLabel}
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="token-anchor-empty">
                <strong>No record selected</strong>
                <span>Select a record row to review the receipt details and actions.</span>
              </div>
            )}
          </Surface>
        </div>
      ) : (
        <>
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
            onRowClick={(row) => setActiveRecordKey(getRowKeyValue(row))}
            onToggleAll={toggleAll}
            onToggleRow={toggleRow}
            pageNumber={pageNumber}
            pageSize={pageSize}
            rowActions={rowActions}
            rowActionDisplay="inline"
            rows={rows}
            selectedKeys={activeRecord ? [getRowKeyValue(activeRecord)] : []}
            selectionMode="none"
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

          {activeRecord ? (
            <Surface className="token-success-modal token-neutral-surface" tone="default">
              <div className="token-success-modal__header">
                <div>
                  <p className="token-success-modal__eyebrow">{variant.badge}</p>
                  <h2>Selected Record</h2>
                </div>
                <span className="token-status-pill">{readString(activeRecord, ["receiptId"])}</span>
              </div>

              {creditRecordPage ? (
                <div className="token-flow-confirm-grid">
                  {buildCreditRecordSnapshot(activeRecord).map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="token-success-grid">
                <div>
                  <span>Customer</span>
                  <strong>{readString(activeRecord, ["customerName", "customerId"])}</strong>
                </div>
                <div>
                  <span>Meter</span>
                  <strong>{readString(activeRecord, ["meterId"])}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{readString(activeRecord, ["status"])}</strong>
                </div>
                <div>
                  <span>Token</span>
                  <strong>{readString(activeRecord, ["token", "tokenFirst"])}</strong>
                </div>
                <div>
                  <span>Amount</span>
                  <strong>{readString(activeRecord, ["totalPaid", "totalPrice"])}</strong>
                </div>
                <div>
                  <span>Issued</span>
                  <strong>{readString(activeRecord, ["createTime"])}</strong>
                </div>
              </div>

              <div className="token-success-modal__actions">
                {printAction ? (
                  <Button onClick={() => void handleAction(printAction, activeRecord)} tone="neutral">
                    Print Record
                  </Button>
                ) : null}
                {cancelAction ? (
                  <Button onClick={() => void handleAction(cancelAction, activeRecord)} tone="danger">
                    Cancel Record
                  </Button>
                ) : null}
                {variant.generatePath && variant.generateLabel ? (
                  <Button onClick={() => navigate(variant.generatePath as string)} tone="ghost">
                    {variant.generateLabel}
                  </Button>
                ) : null}
                {variant.secondaryPath && variant.secondaryLabel ? (
                  <Button onClick={() => navigate(variant.secondaryPath as string)} tone="ghost">
                    {variant.secondaryLabel}
                  </Button>
                ) : null}
              </div>
            </Surface>
          ) : null}
        </>
      )}

      {drawerRecord ? (
        <TokenReceiptDrawer
          detailFields={getRecordDrawerFields(page, drawerRecord).map(([label, value]) => ({
            label,
            value,
          }))}
          eyebrow={variant.badge}
          heroFields={getRecordDrawerHeroFields(page, drawerRecord).map(([label, value]) => ({
            label,
            value,
          }))}
          onClose={() => setDrawerRecord(null)}
          open
          primaryAction={{
            label: variant.printLabel,
            onClick: () => {
              void printTokenRecordDetails(`${page.menuLabel} Print`, page.columns, drawerRecord)
                .then(() => setFeedback(`Opened print dialog for ${page.menuLabel}.`))
                .catch((caughtError) =>
                  setFeedback(caughtError instanceof Error ? caughtError.message : "Print failed"),
                );
            },
            tone: "neutral",
          }}
          secondaryActions={[
            {
              label: "Close",
              onClick: () => setDrawerRecord(null),
              tone: "primary",
            },
          ]}
          subtitle={variant.subtitle}
          title={variant.selectedTitle}
          tokenValue={getRecordVisualValue(page, drawerRecord)}
        />
      ) : null}

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
          message={confirmMessage}
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

export default TokenRecordPage;
