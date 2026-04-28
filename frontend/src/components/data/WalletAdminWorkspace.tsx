import { useEffect, useState, type ReactNode } from "react";
import {
  AlertOctagon,
  ArrowUpCircle,
  Archive,
  ArrowUpDown,
  BarChart2,
  CheckCircle2,
  Clock,
  Download,
  Flag,
  Info,
  Lock,
  PenLine,
  RefreshCw,
  Search,
  Star,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react";
import { NGN, VwBadge, VwBtn, VwInfoBox, VwKPI } from "../vendor/VendorPortalPrimitives.tsx";
import { request } from "../../services/api";
import { normalizeTableData } from "../../services/table-data";
import type { ActionConfig, DataPageConfig, DataRow } from "../../types";

interface WalletAdminWorkspaceProps {
  page: DataPageConfig;
  rows: DataRow[];
  loading: boolean;
  feedback: string | null;
  error: string | null;
  onRefresh: () => void;
  onToolbarAction: (action: ActionConfig) => void;
  onRowAction: (action: ActionConfig, row: DataRow) => void;
}

interface PurchaseRow {
  amount: number;
  customer: string;
  date: string;
  id: string;
  method: "remote_send" | "token";
  receipt: string | null;
  site: string;
  status: "failed" | "reversed" | "successful";
  vendor: string;
}

interface AuditRow {
  actor: string;
  detail: string;
  event: string;
  ip: string;
  role: "admin" | "system" | "vendor_user";
  target: string;
  time: string;
}

function readText(row: DataRow | undefined, keys: string[], fallback = "--") {
  if (!row) return fallback;
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text.length > 0) return text;
  }
  return fallback;
}

function readNumber(row: DataRow | undefined, keys: string[]) {
  const value = keys
    .map((key) => row?.[key])
    .find((entry) => entry !== null && entry !== undefined && String(entry).trim().length > 0);
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div>
        <div className="vw-page-title">{title}</div>
        <div className="vw-page-sub">{description}</div>
      </div>
      {action}
    </div>
  );
}

function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return <div className="vw-surface" style={style}>{children}</div>;
}

function TableShell({
  footer,
  headers,
  children,
}: {
  footer?: ReactNode;
  headers: string[];
  children: ReactNode;
}) {
  return (
    <Card>
      <div style={{ overflowX: "auto" }}>
        <table className="vw-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {footer}
    </Card>
  );
}

function Chip({
  active,
  children,
  onClick,
  tone = "primary",
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
  tone?: "dark" | "info" | "primary";
}) {
  const colors =
    tone === "dark"
      ? { activeBg: "var(--vw-sidebar)", activeColor: "#fff", activeBorder: "var(--vw-sidebar)" }
      : tone === "info"
        ? { activeBg: "var(--vw-info-bg)", activeColor: "var(--vw-info-text)", activeBorder: "var(--vw-info)" }
        : { activeBg: "var(--vw-primary-light)", activeColor: "var(--vw-primary)", activeBorder: "var(--vw-primary)" };

  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 12px",
        borderRadius: 20,
        fontSize: 11,
        cursor: "pointer",
        border: `1px solid ${active ? colors.activeBorder : "var(--vw-border)"}`,
        background: active ? colors.activeBg : "var(--vw-surface)",
        color: active ? colors.activeColor : "var(--vw-muted)",
        fontWeight: active ? 700 : 400,
        fontFamily: "var(--vw-font)",
      }}
      type="button"
    >
      {children}
    </button>
  );
}

const fallbackManualCredits = [
  { amount: 50000, checker: null, code: "VND-001", id: "MCR-001", maker: "ops-admin", reason: "Balance correction after upstream mismatch on PO-00285.", requestedAt: "16 Apr, 08:30", status: "pending_checker", type: "Balance correction", vendor: "Bright Future Electrical" },
  { amount: 2500, checker: "admin-checker", code: "VND-003", id: "MCR-002", maker: "finance-admin", reason: "Reversal credit for failed remote-send REV-00001.", requestedAt: "15 Apr, 17:15", status: "approved", type: "Reversal credit", vendor: "Sunco Vending Services" },
  { amount: 10000, checker: "finance-admin", code: "VND-005", id: "MCR-003", maker: "coo-delegate", reason: "Goodwill credit approved by COO memo dated 14 Apr 2025.", requestedAt: "14 Apr, 14:00", status: "rejected", type: "Goodwill adjustment", vendor: "Apex Energy Partners" },
];

const fallbackPurchases: PurchaseRow[] = [
  { amount: 5000, customer: "Adebayo Okafor", date: "16 Apr, 09:42", id: "PO-00291", method: "token", receipt: "RCP-20250416-000042", site: "Lagos North", status: "successful", vendor: "Bright Future" },
  { amount: 3000, customer: "Grace Eze", date: "16 Apr, 08:15", id: "PO-00290", method: "remote_send", receipt: "RCP-20250416-000041", site: "Lagos North", status: "successful", vendor: "Bright Future" },
  { amount: 8000, customer: "Fatima Bello", date: "15 Apr, 14:30", id: "PO-00289", method: "token", receipt: "RCP-20250415-000040", site: "Lagos North", status: "successful", vendor: "Bright Future" },
  { amount: 2500, customer: "Chukwu Eze", date: "15 Apr, 11:20", id: "PO-00288", method: "remote_send", receipt: null, site: "Lagos North", status: "failed", vendor: "Sunco Vending" },
  { amount: 6000, customer: "Kemi Adeyemi", date: "13 Apr, 10:15", id: "PO-00285", method: "token", receipt: "RCP-20250413-000038", site: "Lagos North", status: "reversed", vendor: "Bright Future" },
];

const fallbackAudit: AuditRow[] = [
  { actor: "admin", detail: "Checker approved NGN 50,000 credit to VND-001", event: "manual_credit_approved", ip: "197.211.58.14", role: "admin", target: "MCR-001", time: "10:14:22" },
  { actor: "recon-engine", detail: "Purchase reserved state timeout threshold exceeded", event: "exception_created", ip: "internal", role: "system", target: "EXC-001", time: "09:58:01" },
  { actor: "brightfuture01", detail: "Token generated for PO-00291", event: "purchase_successful", ip: "41.203.68.22", role: "vendor_user", target: "PO-00291", time: "09:42:15" },
  { actor: "brightfuture01", detail: "NGN 200,000 funding request submitted", event: "funding_initiated", ip: "41.203.68.22", role: "vendor_user", target: "FND-20250416-000012", time: "09:15:44" },
  { actor: "ops-admin", detail: "Maker submitted NGN 50,000 credit request for VND-001", event: "manual_credit_requested", ip: "197.211.58.14", role: "admin", target: "MCR-001", time: "08:30:00" },
];

const walletRequestCreditAction: ActionConfig = {
  key: "request-credit",
  label: "Request Credit",
  endpoint: "/api/wallet/manual-credit/request",
  tone: "primary",
  operationKind: "generic",
  fields: [
    { key: "walletId", label: "Wallet ID", placeholder: "Wallet ID", required: true, sourceKey: "walletId" },
    { key: "amount", label: "Amount", type: "number", placeholder: "Enter amount", required: true },
    {
      key: "reason",
      label: "Reason",
      type: "textarea",
      placeholder: "State why this manual credit is required",
      required: true,
    },
  ],
  confirmMessage: "Route this manual credit into the maker-checker queue now?",
};

const walletFreezeAction: ActionConfig = {
  key: "freeze-wallet",
  label: "Freeze",
  endpoint: "/api/wallet/freeze/request",
  tone: "danger",
  operationKind: "generic",
  fields: [
    { key: "walletId", label: "Wallet ID", placeholder: "Wallet ID", required: true, sourceKey: "walletId" },
    {
      key: "reason",
      label: "Reason",
      type: "textarea",
      placeholder: "Explain why this wallet should be frozen",
      required: true,
    },
  ],
  confirmMessage: "Send this wallet freeze request into the approval workflow?",
};

const walletUnfreezeAction: ActionConfig = {
  key: "unfreeze-wallet",
  label: "Unfreeze",
  endpoint: "/api/wallet/unfreeze/request",
  tone: "primary",
  operationKind: "generic",
  fields: [
    { key: "walletId", label: "Wallet ID", placeholder: "Wallet ID", required: true, sourceKey: "walletId" },
    {
      key: "reason",
      label: "Reason",
      type: "textarea",
      placeholder: "Explain why this wallet can be unfrozen",
      required: true,
    },
  ],
  confirmMessage: "Send this wallet unfreeze request into the approval workflow?",
};

const manualCreditApproveAction: ActionConfig = {
  key: "approve-credit",
  label: "Approve",
  endpoint: "/api/wallet/approvals/:requestId/approve",
  tone: "primary",
  operationKind: "generic",
  confirmMessage: "Approve this manual credit request now?",
};

export function WalletAdminWorkspace({
  page,
  rows,
  loading,
  feedback,
  error,
  onRefresh,
  onToolbarAction,
  onRowAction,
}: WalletAdminWorkspaceProps) {
  const exportAction = page.toolbarActions?.find((action) => action.operationKind === "client-export");
  const primaryAction = page.toolbarActions?.find((action) => action.operationKind !== "client-export");
  const [fundingTab, setFundingTab] = useState<"funding" | "manual">("funding");
  const [purchaseFilter, setPurchaseFilter] = useState<"all" | "failed" | "reversed" | "successful">("all");
  const [purchaseMethod, setPurchaseMethod] = useState<"all" | "remote_send" | "token">("all");
  const [exceptionSeverity, setExceptionSeverity] = useState<"all" | "critical" | "high" | "low" | "medium">("all");
  const [settlementPeriod, setSettlementPeriod] = useState("14");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditRole, setAuditRole] = useState<"admin" | "all" | "system" | "vendor_user">("all");
  const [manualCreditRows, setManualCreditRows] = useState<DataRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    if (page.path !== "/wallet-admin/funding-pending") {
      setManualCreditRows([]);
      return () => {
        cancelled = true;
      };
    }

    async function loadManualCredits() {
      try {
        const result = await request<unknown>("/api/wallet/approvals", {
          method: "GET",
          query: {
            requestType: "wallet_manual_credit",
          },
        });
        if (!cancelled) {
          setManualCreditRows(normalizeTableData(result, "/api/wallet/approvals").rows);
        }
      } catch {
        if (!cancelled) {
          setManualCreditRows([]);
        }
      }
    }

    void loadManualCredits();

    return () => {
      cancelled = true;
    };
  }, [page.path, feedback]);

  const shell = (content: ReactNode, action?: ReactNode) => (
    <section className="page-stack ds-page wallet-admin-data-page vendor-wallet-stack">
      <div className="vw-surface vw-surface--padded vw-fadeUp">
        <SectionHeader
          title={page.title}
          description={page.description}
          action={action ?? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {exportAction ? <VwBtn variant="ghost" size="sm" onClick={() => onToolbarAction(exportAction)}>Export</VwBtn> : null}
              {primaryAction ? <VwBtn variant="primary" size="sm" onClick={() => onToolbarAction(primaryAction)}>{primaryAction.label}</VwBtn> : null}
              <VwBtn variant="outline" size="sm" onClick={onRefresh}>Refresh</VwBtn>
            </div>
          )}
        />
      </div>

      {feedback ? <VwInfoBox type="success">{feedback}</VwInfoBox> : null}
      {error ? <VwInfoBox type="danger">{error}</VwInfoBox> : null}
      {loading ? <VwInfoBox type="info">Loading workspace data.</VwInfoBox> : content}
    </section>
  );

  if (page.path === "/wallet-admin/wallet-kpis") {
    const totalFloat = rows.reduce((sum, row) => sum + readNumber(row, ["totalFloat", "vendorFloat", "balance", "totalVendorFloat"]), 0);
    const totalReserved = rows.reduce((sum, row) => sum + readNumber(row, ["reservedFloat", "reserved", "totalReserved"]), 0);
    const activeWallets = rows.filter((walletRow) => readText(walletRow, ["status", "accountStatus"], "ACTIVE").toLowerCase().includes("active")).length;
    const manualCreditsPending = fallbackManualCredits.filter((item) => item.status === "pending_checker").length;

    return shell(
      <>
        <div className="vw-grid-4">
          <VwKPI label="Total Float" value={NGN(totalFloat || 2017650)} icon={Wallet} iconBg="var(--vw-success-bg)" />
          <VwKPI label="Total Reserved" value={NGN(totalReserved || 165000)} icon={Clock} valueColor="var(--vw-warning)" iconBg="var(--vw-warning-bg)" />
          <VwKPI label="Active Wallets" value={`${activeWallets || 4} / ${rows.length || 5}`} icon={CheckCircle2} valueColor="var(--vw-success)" iconBg="var(--vw-success-bg)" />
          <VwKPI label="Manual Cr. Pending" value={String(manualCreditsPending)} icon={PenLine} valueColor="var(--vw-lemon-dark)" iconBg="var(--vw-lemon-light)" />
        </div>

        <VwInfoBox type="lemon">
          <strong>Admin Credit Policy:</strong> No admin can directly edit wallet balances. Credits are posted either via approved vendor funding requests or via the maker-checker manual credit flow.
        </VwInfoBox>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {rows.filter((walletRow) => !readText(walletRow, ["approvalStatus", "status"], "active").toLowerCase().includes("pending")).map((walletRow, index) => {
            const float = readNumber(walletRow, ["totalFloat", "vendorFloat", "balance", "totalVendorFloat"]);
            const reserved = readNumber(walletRow, ["reservedFloat", "reserved", "totalReserved"]);
            const dailyLimit = readNumber(walletRow, ["dailyPurchaseLimit", "dailyLimit"]) || 500000;
            const perTxnLimit = readNumber(walletRow, ["perTransactionLimit", "perTxnLimit"]) || 100000;
            const status = readText(walletRow, ["status", "accountStatus"], index === 4 ? "suspended" : "active").toLowerCase();
            const risk =
              reserved > float * 0.5 ? "high" :
              reserved > float * 0.2 ? "medium" :
              "low";

            return (
              <Card key={`${readText(walletRow, ["vendorCode"], String(index))}`} style={{ padding: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "var(--vw-text)" }}>
                      {readText(walletRow, ["vendorName", "businessName"], "Vendor Wallet")}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--vw-muted)", marginTop: 2, fontFamily: "var(--vw-mono)" }}>
                      {readText(walletRow, ["vendorCode"], "VND-001")} · {readText(walletRow, ["siteCode"], "Lagos North")}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <VwBadge variant={status === "active" ? "success" : "danger"} dot>{status}</VwBadge>
                    <VwBadge variant={risk === "low" ? "success" : risk === "medium" ? "warning" : "danger"}>{risk.toUpperCase()} RISK</VwBadge>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
                  {[
                    { color: "var(--vw-text)", label: "Available", value: NGN(Math.max(float - reserved, 0)) },
                    { color: "var(--vw-text)", label: "Posted Float", value: NGN(float) },
                    { color: reserved > 0 ? "var(--vw-warning)" : "var(--vw-muted)", label: "Reserved", value: NGN(reserved) },
                    { color: "var(--vw-muted)", label: "Daily Limit", value: NGN(dailyLimit) },
                    { color: "var(--vw-muted)", label: "Per-Txn Limit", value: NGN(perTxnLimit) },
                  ].map((item) => (
                    <div key={item.label} style={{ background: "var(--vw-bg)", borderRadius: 10, padding: "10px 12px", border: "1px solid var(--vw-border)" }}>
                      <div style={{ fontSize: 9, color: "var(--vw-faint)", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700, marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: item.color }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                  {[
                    { label: "Ledger State", value: reserved > 0 ? "Reserved orders open" : "Balanced", tone: reserved > 0 ? "var(--vw-warning)" : "var(--vw-success)" },
                    { label: "Last Purchase", value: index % 2 === 0 ? "16 Apr, 09:42" : "15 Apr, 14:30", tone: "var(--vw-text)" },
                    { label: "Control Mode", value: status === "active" ? "Live vending" : "Frozen", tone: status === "active" ? "var(--vw-success)" : "var(--vw-danger)" },
                  ].map((item) => (
                    <div key={item.label} style={{ background: "var(--vw-surface2)", borderRadius: 10, padding: "11px 12px", border: "1px solid var(--vw-border)" }}>
                      <div style={{ fontSize: 9, color: "var(--vw-faint)", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700, marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: item.tone }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                {reserved > 0 ? (
                  <div style={{ marginBottom: 12 }}>
                    <VwInfoBox type="warning">
                      {NGN(reserved)} is currently reserved for in-flight purchases. This will be released when purchases complete or time out.
                    </VwInfoBox>
                  </div>
                ) : null}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <VwBtn variant="ghost" size="sm">Ledger</VwBtn>
                  <VwBtn variant="ghost" size="sm">Transactions</VwBtn>
                  <VwBtn variant="ghost" size="sm">Statement</VwBtn>
                  {status === "active" ? (
                    <>
                      <VwBtn variant="lemon" size="sm" onClick={() => onRowAction(walletRequestCreditAction, walletRow)}>Request Credit</VwBtn>
                      <VwBtn variant="danger" size="sm" onClick={() => onRowAction(walletFreezeAction, walletRow)}>Freeze</VwBtn>
                    </>
                  ) : (
                    <VwBtn variant="subtle" size="sm" onClick={() => onRowAction(walletUnfreezeAction, walletRow)}>Unfreeze</VwBtn>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </>,
    );
  }

  if (page.path === "/wallet-admin/funding-pending") {
    const pendingFunding = rows.filter((row) => !readText(row, ["status"], "").toLowerCase().includes("posted"));
    const postedFunding = rows.filter((row) => readText(row, ["status"], "").toLowerCase().includes("posted"));
    const fundingPreviewItems = (rows.length > 0 ? rows : [{}, {}, {}]).map((row, index) => ({
      amount: readNumber(row, ["amount"]) || [200000, 500000, 50000, 150000][index] || 0,
      bankRef: readText(row, ["externalBankRef", "bankRef"], index === 2 ? "—" : `REF-${index + 1}`),
      channel: readText(row, ["channel"], index === 2 ? "Cash branch" : "Bank transfer"),
      proofReady: !readText(row, ["status"], index < 2 ? "under_review" : index === 2 ? "awaiting_proof" : "posted").includes("proof"),
      reference: readText(row, ["reference"], `FND-20250416-0000${index + 1}`),
      status: readText(row, ["status"], index < 2 ? "under_review" : index === 2 ? "awaiting_proof" : "posted"),
      submittedAt: readText(row, ["createdAt", "submittedAt"], "16 Apr, 09:15"),
      vendor: readText(row, ["vendorName", "vendorCode"], fallbackManualCredits[index % fallbackManualCredits.length].vendor),
    }));
    const manualCreditItems = manualCreditRows.length > 0
      ? manualCreditRows.map((row) => ({
          amount: readNumber(row, ["amount"]),
          checker: readText(row, ["checkerId"], ""),
          code: readText(row, ["vendorId"], "UNKNOWN"),
          id: readText(row, ["id"], "APPROVAL"),
          maker: readText(row, ["submittedBy"], "maker"),
          reason: readText(row, ["notes", "summary"], ""),
          requestedAt: readText(row, ["submittedAt"], "--"),
          status: readText(row, ["status"], "pending"),
          type: readText(row, ["requestType"], "wallet_manual_credit"),
          vendor: readText(row, ["vendorId"], "Vendor"),
        }))
      : fallbackManualCredits;
    const manualPending = manualCreditItems.filter((item) => ["pending", "pending_checker"].includes(item.status)).length;

    return shell(
      <>
        <div className="vw-grid-4">
          <VwKPI label="Pending Funding" value={pendingFunding.length || 3} icon={ArrowUpCircle} valueColor="var(--vw-warning)" iconBg="var(--vw-warning-bg)" />
          <VwKPI label="Posted Today" value={postedFunding.length || 2} icon={CheckCircle2} valueColor="var(--vw-success)" iconBg="var(--vw-success-bg)" />
          <VwKPI label="Manual Cr. Pending" value={manualPending} icon={PenLine} valueColor="var(--vw-lemon-dark)" iconBg="var(--vw-lemon-light)" />
          <VwKPI label="Total Approved (Apr)" value={NGN(650000)} icon={TrendingUp} valueColor="var(--vw-primary)" iconBg="var(--vw-primary-light)" />
        </div>

        <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "1px solid var(--vw-border)" }}>
          <button type="button" onClick={() => setFundingTab("funding")} style={{ padding: "10px 20px", background: "none", border: "none", borderBottom: fundingTab === "funding" ? "2px solid var(--vw-primary)" : "2px solid transparent", color: fundingTab === "funding" ? "var(--vw-primary)" : "var(--vw-muted)", fontSize: 13, fontWeight: fundingTab === "funding" ? 700 : 400, cursor: "pointer", fontFamily: "var(--vw-font)" }}>Vendor Funding Requests</button>
          <button type="button" onClick={() => setFundingTab("manual")} style={{ padding: "10px 20px", background: "none", border: "none", borderBottom: fundingTab === "manual" ? "2px solid var(--vw-primary)" : "2px solid transparent", color: fundingTab === "manual" ? "var(--vw-primary)" : "var(--vw-muted)", fontSize: 13, fontWeight: fundingTab === "manual" ? 700 : 400, cursor: "pointer", fontFamily: "var(--vw-font)" }}>Manual Credit Requests (Maker-Checker)</button>
        </div>

        {fundingTab === "funding" ? (
          <>
            <TableShell headers={["Reference", "Vendor", "Amount", "Channel", "Bank Ref", "Submitted", "Proof", "Status", "Actions"]}>
              {(rows.length > 0 ? rows : []).map((row, index) => {
                const status = readText(row, ["status"], index < 2 ? "under_review" : index === 2 ? "awaiting_proof" : "posted");
                return (
                  <tr key={`${readText(row, ["reference"], String(index))}`}>
                    <td style={{ fontFamily: "var(--vw-mono)", color: "var(--vw-primary)", fontSize: 11 }}>{readText(row, ["reference"], `FND-20250416-0000${index + 1}`)}</td>
                    <td><div style={{ fontWeight: 700, color: "var(--vw-text)", fontSize: 13 }}>{readText(row, ["vendorName", "vendorCode"], fallbackManualCredits[index % fallbackManualCredits.length].vendor)}</div><div style={{ fontSize: 10, color: "var(--vw-muted)", fontFamily: "var(--vw-mono)" }}>{readText(row, ["vendorCode"], `VND-00${index + 1}`)}</div></td>
                    <td style={{ fontWeight: 700 }}>{NGN(readNumber(row, ["amount"]) || [200000, 500000, 50000, 150000][index] || 0)}</td>
                    <td style={{ color: "var(--vw-muted)" }}>{readText(row, ["channel"], index === 2 ? "Cash branch" : "Bank transfer")}</td>
                    <td style={{ fontFamily: "var(--vw-mono)" }}>{readText(row, ["externalBankRef", "bankRef"], index === 2 ? "—" : `REF-${index + 1}`)}</td>
                    <td style={{ color: "var(--vw-muted)" }}>{readText(row, ["createdAt", "submittedAt"], "16 Apr, 09:15")}</td>
                    <td style={{ textAlign: "center" }}>{status.includes("proof") ? <XCircle size={14} color="var(--vw-danger)" /> : <CheckCircle2 size={14} color="var(--vw-success)" />}</td>
                    <td><VwBadge variant={status === "posted" ? "success" : status === "under_review" ? "warning" : "info"}>{status.replace(/_/g, " ")}</VwBadge></td>
                    <td>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        <VwBtn variant="ghost" size="xs">Proof</VwBtn>
                        {(page.rowActions ?? []).map((action) => (
                          <VwBtn key={action.key} variant={action.tone === "primary" ? "lemon" : "ghost"} size="xs" onClick={() => onRowAction(action, row)}>
                            {action.label}
                          </VwBtn>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </TableShell>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
              {fundingPreviewItems.slice(0, 3).map((item) => (
                <Card key={`${item.reference}-detail`} style={{ padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--vw-text)" }}>{item.vendor}</div>
                      <div style={{ fontSize: 10, color: "var(--vw-muted)", fontFamily: "var(--vw-mono)" }}>{item.reference}</div>
                    </div>
                    <VwBadge variant={item.status === "posted" ? "success" : item.status === "under_review" ? "warning" : "info"}>{item.status.replace(/_/g, " ")}</VwBadge>
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {[
                      ["Amount", NGN(item.amount)],
                      ["Channel", item.channel],
                      ["Bank Ref", item.bankRef],
                      ["Proof", item.proofReady ? "Attached" : "Awaiting proof"],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <span style={{ fontSize: 11, color: "var(--vw-muted)" }}>{label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--vw-text)" }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
            <VwInfoBox type="info">Approving a funding request posts a funding credit journal to the vendor wallet ledger and immediately increases their available balance.</VwInfoBox>
          </>
        ) : (
          <>
            <VwInfoBox type="lemon"><strong>Maker-Checker:</strong> A maker submits the request. A different checker must approve it. No admin can approve their own request.</VwInfoBox>
            <TableShell headers={["Request ID", "Vendor", "Amount", "Type", "Reason", "Maker", "Requested", "Status", "Actions"]}>
              {manualCreditItems.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontFamily: "var(--vw-mono)", color: "var(--vw-lemon-dark)", fontWeight: 700, fontSize: 11 }}>{item.id}</td>
                  <td><div style={{ fontWeight: 700, color: "var(--vw-text)" }}>{item.vendor}</div><div style={{ fontSize: 10, color: "var(--vw-muted)", fontFamily: "var(--vw-mono)" }}>{item.code}</div></td>
                  <td style={{ fontWeight: 700 }}>{NGN(item.amount)}</td>
                  <td style={{ color: "var(--vw-muted)" }}>{item.type}</td>
                  <td><span style={{ fontSize: 11, color: "var(--vw-muted)" }}>{item.reason}</span></td>
                  <td style={{ fontFamily: "var(--vw-mono)" }}>{item.maker}</td>
                  <td style={{ color: "var(--vw-muted)" }}>{item.requestedAt}</td>
                  <td><VwBadge variant={item.status === "approved" ? "success" : item.status === "rejected" ? "danger" : "lemon"}>{item.status === "pending_checker" ? "Awaiting Checker" : item.status}</VwBadge></td>
                  <td>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      <VwBtn variant="ghost" size="xs">Review</VwBtn>
                      {item.status === "pending" || item.status === "pending_checker" ? <VwBtn variant="primary" size="xs" onClick={() => onRowAction(manualCreditApproveAction, item as unknown as DataRow)}>Approve</VwBtn> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </TableShell>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
              {manualCreditItems.slice(0, 3).map((item) => (
                <Card key={`${item.id}-summary`} style={{ padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--vw-text)" }}>{item.vendor}</div>
                      <div style={{ fontSize: 10, color: "var(--vw-muted)", fontFamily: "var(--vw-mono)" }}>{item.id}</div>
                    </div>
                    <VwBadge variant={item.status === "approved" ? "success" : item.status === "rejected" ? "danger" : "lemon"}>{item.status === "pending_checker" ? "Awaiting Checker" : item.status}</VwBadge>
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {[
                      ["Amount", NGN(item.amount)],
                      ["Type", item.type],
                      ["Maker", item.maker],
                      ["Requested", item.requestedAt],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <span style={{ fontSize: 11, color: "var(--vw-muted)" }}>{label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--vw-text)" }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </>,
      <VwBadge variant="lemon" lg dot>3 pending action</VwBadge>,
    );
  }

  if (page.path === "/wallet-admin/purchase-monitor") {
    const purchases: PurchaseRow[] = rows.length > 0
      ? rows.map((row, index) => ({
          amount: readNumber(row, ["amount"]) || fallbackPurchases[index % fallbackPurchases.length].amount,
          customer: readText(row, ["customerName"], fallbackPurchases[index % fallbackPurchases.length].customer),
          date: readText(row, ["createdAt"], fallbackPurchases[index % fallbackPurchases.length].date),
          id: readText(row, ["reference", "id"], fallbackPurchases[index % fallbackPurchases.length].id),
          method: readText(row, ["deliveryMethod", "method"], fallbackPurchases[index % fallbackPurchases.length].method) === "remote_send" ? "remote_send" : "token",
          receipt: readText(row, ["receiptNumber"], "") || fallbackPurchases[index % fallbackPurchases.length].receipt,
          site: readText(row, ["siteCode"], fallbackPurchases[index % fallbackPurchases.length].site),
          status: (readText(row, ["status"], fallbackPurchases[index % fallbackPurchases.length].status) as PurchaseRow["status"]),
          vendor: readText(row, ["vendorName"], fallbackPurchases[index % fallbackPurchases.length].vendor),
        }))
      : fallbackPurchases;

    const filtered = purchases.filter((item) => (purchaseFilter === "all" || item.status === purchaseFilter) && (purchaseMethod === "all" || item.method === purchaseMethod));

    return shell(
      <>
        <div className="vw-grid-4" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
          <VwKPI label="Today's Total" value={NGN(312500)} icon={TrendingUp} valueColor="var(--vw-primary)" iconBg="var(--vw-primary-light)" />
          <VwKPI label="Successful" value={String(purchases.filter((item) => item.status === "successful").length)} icon={CheckCircle2} valueColor="var(--vw-success)" iconBg="var(--vw-success-bg)" />
          <VwKPI label="Failed" value={String(purchases.filter((item) => item.status === "failed").length)} icon={XCircle} valueColor="var(--vw-danger)" iconBg="var(--vw-danger-bg)" />
          <VwKPI label="Reversed" value={String(purchases.filter((item) => item.status === "reversed").length)} icon={RefreshCw} valueColor="var(--vw-warning)" iconBg="var(--vw-warning-bg)" />
          <VwKPI label="Reversal Rate" value="1.2%" icon={ArrowUpDown} />
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {[
            ["all", "All Status"],
            ["successful", "Successful"],
            ["failed", "Failed"],
            ["reversed", "Reversed"],
          ].map(([value, label]) => (
            <Chip key={value} active={purchaseFilter === value} onClick={() => setPurchaseFilter(value as typeof purchaseFilter)}>{label}</Chip>
          ))}
          <div style={{ width: 1, background: "var(--vw-border)" }} />
          {[
            ["all", "All Methods"],
            ["token", "Token"],
            ["remote_send", "Remote Send"],
          ].map(([value, label]) => (
            <Chip key={value} active={purchaseMethod === value} onClick={() => setPurchaseMethod(value as typeof purchaseMethod)} tone="info">{label}</Chip>
          ))}
        </div>

        <TableShell
          headers={["Order ID", "Date", "Vendor", "Site", "Customer", "Delivery", "Amount", "Status", "Receipt"]}
          footer={
            <div style={{ padding: "10px 16px", borderTop: "1px solid var(--vw-border)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--vw-muted)" }}>
              <span>Showing {filtered.length} of {purchases.length}</span>
              <div style={{ display: "flex", gap: 6 }}>
                <VwBtn variant="ghost" size="xs">Prev</VwBtn>
                <VwBtn variant="ghost" size="xs">Next</VwBtn>
              </div>
            </div>
          }
        >
          {filtered.map((item) => (
            <tr key={item.id}>
              <td style={{ fontFamily: "var(--vw-mono)", color: "var(--vw-primary)" }}>{item.id}</td>
              <td style={{ color: "var(--vw-muted)" }}>{item.date}</td>
              <td>{item.vendor}</td>
              <td style={{ color: "var(--vw-muted)" }}>{item.site}</td>
              <td>{item.customer}</td>
              <td>{item.method === "remote_send" ? <VwBadge variant="info">Remote Send</VwBadge> : <VwBadge variant="success">Token (20-digit)</VwBadge>}</td>
              <td style={{ fontWeight: 700 }}>{NGN(item.amount)}</td>
              <td><VwBadge variant={item.status === "successful" ? "success" : item.status === "reversed" ? "info" : "danger"} dot>{item.status}</VwBadge></td>
              <td>{item.receipt ? <VwBtn variant="ghost" size="xs">View</VwBtn> : "—"}</td>
            </tr>
          ))}
        </TableShell>
      </>,
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <VwBtn variant="outline" size="sm">Export</VwBtn>
        <VwBtn variant="outline" size="sm" onClick={onRefresh}>Refresh</VwBtn>
      </div>,
    );
  }

  if (page.path === "/wallet-admin/exceptions") {
    const filtered = rows.filter((row) => exceptionSeverity === "all" || readText(row, ["severity"]).toLowerCase().includes(exceptionSeverity));
    const reconLevels = [
      ["L1", "Ledger vs Balance Snapshot", "critical"],
      ["L2", "Purchase Orders vs Upstream Records", "high"],
      ["L3", "Funding Requests vs Journal Records", "high"],
      ["L4", "Commission Accrual vs Settlement", "medium"],
      ["L5", "Site/Day Summary vs Settlement Batch", "medium"],
    ] as const;

    return shell(
      <>
        <div className="vw-grid-4">
          <VwKPI label="Critical" value={String(rows.filter((row) => readText(row, ["severity"]).toLowerCase().includes("critical") && !readText(row, ["status"]).toLowerCase().includes("resolved")).length)} sub="SLA: 15 min" icon={AlertOctagon} valueColor="var(--vw-danger)" iconBg="var(--vw-danger-bg)" />
          <VwKPI label="High" value={String(rows.filter((row) => readText(row, ["severity"]).toLowerCase().includes("high") && !readText(row, ["status"]).toLowerCase().includes("resolved")).length)} sub="SLA: 1 hour" icon={Flag} valueColor="var(--vw-warning)" iconBg="var(--vw-warning-bg)" />
          <VwKPI label="Medium / Low" value={String(rows.filter((row) => ["medium", "low"].some((level) => readText(row, ["severity"]).toLowerCase().includes(level)) && !readText(row, ["status"]).toLowerCase().includes("resolved")).length)} sub="SLA: EOD" icon={Info} valueColor="var(--vw-info)" iconBg="var(--vw-info-bg)" />
          <VwKPI label="Total Open" value={String(rows.filter((row) => !readText(row, ["status"]).toLowerCase().includes("resolved")).length)} sub={`${rows.filter((row) => readText(row, ["status"]).toLowerCase().includes("resolved")).length} resolved today`} />
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {[
            ["all", "All"],
            ["critical", "Critical"],
            ["high", "High"],
            ["medium", "Medium"],
            ["low", "Low"],
          ].map(([value, label]) => (
            <Chip key={value} active={exceptionSeverity === value} onClick={() => setExceptionSeverity(value as typeof exceptionSeverity)} tone="dark">{label}</Chip>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          {filtered.map((row, index) => {
            const severity = readText(row, ["severity"], "medium").toLowerCase();
            const status = readText(row, ["status"], "open");
            return (
              <Card key={`${readText(row, ["id", "summary"], String(index))}`} style={{ borderLeft: `4px solid ${severity === "critical" ? "var(--vw-danger)" : severity === "high" ? "var(--vw-warning)" : "var(--vw-info)"}`, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                      <VwBadge variant={severity === "critical" ? "danger" : severity === "high" ? "warning" : "info"}>{severity.toUpperCase()}</VwBadge>
                      <span style={{ fontSize: 11, fontFamily: "var(--vw-mono)", color: "var(--vw-primary)", fontWeight: 700 }}>{readText(row, ["id"], `EXC-00${index + 1}`)}</span>
                      <span style={{ fontSize: 11, fontFamily: "var(--vw-mono)", color: "var(--vw-muted)" }}>{readText(row, ["type"], "exception_type")}</span>
                      <VwBadge variant={status === "open" ? "danger" : status === "assigned" ? "lemon" : status === "resolved" ? "success" : "warning"}>{status}</VwBadge>
                      {readText(row, ["assignee"], "").trim().length > 0 ? <span style={{ fontSize: 11, color: "var(--vw-muted)" }}>→ {readText(row, ["assignee"])}</span> : null}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--vw-text)", marginBottom: 5 }}>{readText(row, ["vendorName", "vendor", "summary"], "Exception")} · {readText(row, ["siteCode"], "Lagos North")}</div>
                    <div style={{ fontSize: 13, color: "var(--vw-muted)", marginBottom: 8, lineHeight: 1.65 }}>{readText(row, ["summary"], "Operational exception requiring review")}</div>
                    <div style={{ fontSize: 11, color: "var(--vw-faint)", display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <span>Created: {readText(row, ["detectedAt"], "16 Apr, 09:37")}</span>
                      <span>SLA: <strong style={{ color: status !== "resolved" && severity === "critical" ? "var(--vw-danger)" : "var(--vw-muted)" }}>{readText(row, ["dueAt"], "09:52")}</strong></span>
                      <span>Ref: <span style={{ fontFamily: "var(--vw-mono)" }}>{readText(row, ["reference"], "PO-00291")}</span></span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 18 }}>
                    {(page.rowActions ?? []).slice(0, 2).map((action) => (
                      <VwBtn key={action.key} variant={action.tone === "danger" ? "danger" : "ghost"} size="sm" onClick={() => onRowAction(action, row)}>{action.label}</VwBtn>
                    ))}
                    {(page.rowActions ?? []).find((action) => action.key.includes("resolve")) ? (
                      <VwBtn variant="primary" size="sm" onClick={() => onRowAction((page.rowActions ?? []).find((action) => action.key.includes("resolve")) as ActionConfig, row)}>Resolve</VwBtn>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
          {filtered.slice(0, 3).map((row, index) => {
            const severity = readText(row, ["severity"], "medium").toLowerCase();
            const status = readText(row, ["status"], "open");
            return (
              <Card key={`${readText(row, ["id"], String(index))}-summary`} style={{ padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--vw-text)" }}>{readText(row, ["vendorName", "vendor", "summary"], "Exception")}</div>
                  <VwBadge variant={severity === "critical" ? "danger" : severity === "high" ? "warning" : "info"}>{severity.toUpperCase()}</VwBadge>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {[
                    ["Ref", readText(row, ["reference"], "PO-00291")],
                    ["Status", status],
                    ["Site", readText(row, ["siteCode"], "Lagos North")],
                    ["SLA", readText(row, ["dueAt"], "09:52")],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ fontSize: 11, color: "var(--vw-muted)" }}>{label}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--vw-text)" }}>{value}</span>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>

        <Card style={{ padding: 20, background: "var(--vw-surface2)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--vw-muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 14 }}>Reconciliation Levels</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {reconLevels.map(([code, desc, severity]) => (
              <div key={code} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12 }}>
                <span style={{ background: "var(--vw-sidebar)", color: "#fff", fontFamily: "var(--vw-mono)", fontSize: 11, fontWeight: 800, padding: "2px 9px", borderRadius: 5, flexShrink: 0 }}>{code}</span>
                <span style={{ color: "var(--vw-muted)", lineHeight: 1.5 }}>{desc} - <strong style={{ color: severity === "critical" ? "var(--vw-danger)" : severity === "high" ? "var(--vw-warning)" : "var(--vw-info)" }}>{severity}</strong></span>
              </div>
            ))}
          </div>
        </Card>
      </>,
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <VwBtn variant="outline" size="sm">Run Recon</VwBtn>
        <VwBtn variant="ghost" size="sm">Export</VwBtn>
      </div>,
    );
  }

  if (page.path === "/wallet-admin/settlement-batches") {
    return shell(
      <>
        <div className="vw-grid-4">
          <VwKPI label="Total Settled" value={NGN(rows.reduce((sum, row) => sum + readNumber(row, ["totalPurchases", "totalCommissionCredits"]), 0) || 4940000)} icon={BarChart2} valueColor="var(--vw-primary)" iconBg="var(--vw-primary-light)" />
          <VwKPI label="Commission Earned" value={NGN(0)} sub="Rate: 0.00% (pending)" icon={Star} />
          <VwKPI label="Batches Locked" value={String(rows.length || 6)} icon={Lock} valueColor="var(--vw-success)" iconBg="var(--vw-success-bg)" />
          <VwKPI label="Open Exceptions" value="3" icon={Flag} valueColor="var(--vw-danger)" iconBg="var(--vw-danger-bg)" />
        </div>

        <VwInfoBox type="info">Commission rate is <strong>0.00%</strong>. The commission engine is wired and will activate automatically when finance configures a non-zero rate via the commission rules page.</VwInfoBox>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <select value={settlementPeriod} onChange={(event) => setSettlementPeriod(event.target.value)} style={{ minWidth: 140, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--vw-border)", background: "#fff", fontFamily: "var(--vw-font)", fontSize: 12 }}>
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {(rows.length > 0 ? rows : Array.from({ length: 6 }, (_, index) => ({ businessDate: `15 Apr 2025`, siteCode: ["Lagos North", "Abuja Central", "Kano Central", "Port Harcourt", "Lagos North", "Port Harcourt"][index], totalPurchases: [1240000, 890000, 420000, 310000, 1100000, 310000][index], totalCommissionCredits: 0, itemCount: [42, 31, 17, 12, 45, 12][index], exceptionCount: [0, 0, 0, 0, 1, 0][index], status: "locked" } as unknown as DataRow))).map((row, index) => {
            const purchases = readNumber(row, ["totalPurchases", "totalCommissionCredits"]) || [1240000, 890000, 420000, 310000, 1100000, 310000][index] || 0;
            const transactions = readNumber(row, ["itemCount"]) || [42, 31, 17, 12, 45, 12][index] || 0;
            const exceptions = readNumber(row, ["exceptionCount"]) || [0, 0, 0, 0, 1, 0][index] || 0;
            return (
              <Card key={`${readText(row, ["businessDate"], String(index))}-${readText(row, ["siteCode"], String(index))}`} style={{ padding: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "var(--vw-text)" }}>{readText(row, ["businessDate"], "15 Apr 2025")} - {readText(row, ["siteCode"], "Lagos North")}</div>
                    <div style={{ fontSize: 12, color: "var(--vw-muted)", marginTop: 3 }}>Commission: 0.00% · {transactions} transactions · {exceptions} exceptions</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <VwBadge variant="success">locked</VwBadge>
                    <VwBtn variant="ghost" size="sm">Details</VwBtn>
                    <VwBtn variant="ghost" size="sm">Export</VwBtn>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
                  {[
                    { color: "var(--vw-text)", label: "Purchases", value: NGN(purchases) },
                    { color: "var(--vw-muted)", label: "Commission", value: NGN(0) },
                    { color: "var(--vw-text)", label: "Transactions", value: String(transactions) },
                    { color: exceptions > 0 ? "var(--vw-danger)" : "var(--vw-success)", label: "Exceptions", value: String(exceptions) },
                    { color: "var(--vw-success)", label: "Status", value: "Locked" },
                  ].map((item) => (
                    <div key={item.label} style={{ background: "var(--vw-bg)", borderRadius: 10, padding: "10px 12px", border: "1px solid var(--vw-border)" }}>
                      <div style={{ fontSize: 9, color: "var(--vw-faint)", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700, marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: item.color }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </>,
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <VwBtn variant="ghost" size="sm" onClick={onRefresh}>Refresh</VwBtn>
      </div>,
    );
  }

  if (page.path === "/wallet-admin/reconciliation") {
    const auditRows: AuditRow[] = rows.some((row) => row.event !== undefined)
      ? rows.map((row) => ({
          actor: readText(row, ["actor"], "admin"),
          detail: readText(row, ["detail", "stageSummary"], "System event"),
          event: readText(row, ["event"], "system_event"),
          ip: readText(row, ["ip"], "internal"),
          role: (readText(row, ["role"], "admin") as AuditRow["role"]),
          target: readText(row, ["target", "businessDate"], "target"),
          time: readText(row, ["time", "lastRunCompletedAt"], "10:14:22"),
        }))
      : fallbackAudit;

    const filtered = auditRows.filter((row) => (auditRole === "all" || row.role === auditRole) && (!auditSearch || row.event.includes(auditSearch) || row.actor.includes(auditSearch) || row.target.includes(auditSearch)));

    return shell(
      <>
        <VwInfoBox type="info">Audit logs are append-only. No policy permits UPDATE or DELETE on this table for any role. Manual credit events appear as <code>manual_credit_requested</code> and <code>manual_credit_approved</code>.</VwInfoBox>

        <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
            <Search size={13} color="var(--vw-faint)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input value={auditSearch} onChange={(event) => setAuditSearch(event.target.value)} placeholder="Search event, actor, or target..." style={{ width: "100%", padding: "7px 12px 7px 30px", borderRadius: 8, border: "1px solid var(--vw-border2)", background: "var(--vw-surface)", fontSize: 12, fontFamily: "var(--vw-font)", color: "var(--vw-text)" }} />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              ["all", "All Roles"],
              ["admin", "Admin"],
              ["vendor_user", "Vendor"],
              ["system", "System"],
            ].map(([value, label]) => (
              <Chip key={value} active={auditRole === value} onClick={() => setAuditRole(value as typeof auditRole)}>{label}</Chip>
            ))}
          </div>
        </div>

        <TableShell
          headers={["Time (WAT)", "Actor", "Role", "Event", "Target", "Detail", "IP Address"]}
          footer={
            <div style={{ padding: "10px 16px", borderTop: "1px solid var(--vw-border)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--vw-muted)" }}>
              <span>Showing {filtered.length} of {auditRows.length} events</span>
              <span style={{ fontFamily: "var(--vw-mono)", fontSize: 11 }}>Log ID: AUDIT-20250416-LGS001</span>
            </div>
          }
        >
          {filtered.map((item, index) => (
            <tr key={`${item.event}-${index}`}>
              <td style={{ fontFamily: "var(--vw-mono)" }}><span style={{ fontSize: 12 }}>16 Apr {item.time}</span></td>
              <td style={{ fontWeight: 700 }}>{item.actor}</td>
              <td><VwBadge variant={item.role === "admin" ? "info" : item.role === "system" ? "purple" : "success"}>{item.role}</VwBadge></td>
              <td style={{ fontFamily: "var(--vw-mono)" }}><span style={{ fontSize: 12, color: item.event.includes("manual_credit") ? "var(--vw-lemon-dark)" : item.event.includes("exception") ? "var(--vw-danger)" : "var(--vw-primary)" }}>{item.event}</span></td>
              <td style={{ fontFamily: "var(--vw-mono)" }}><span style={{ fontSize: 11, color: "var(--vw-muted)" }}>{item.target}</span></td>
              <td><span style={{ fontSize: 11, color: "var(--vw-muted)" }}>{item.detail}</span></td>
              <td style={{ color: "var(--vw-muted)" }}>{item.ip}</td>
            </tr>
          ))}
        </TableShell>
      </>,
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <VwBtn variant="outline" size="sm"><Download size={12} /> Export</VwBtn>
        <VwBtn variant="outline" size="sm"><Archive size={12} /> Archive</VwBtn>
      </div>,
    );
  }

  return shell(
    <TableShell headers={page.columns.map((column) => String(column.label))}>
      {rows.map((row, index) => (
        <tr key={String(index)}>
          {page.columns.map((column) => (
            <td key={column.key}>{readText(row, [column.key])}</td>
          ))}
        </tr>
      ))}
    </TableShell>,
  );
}
