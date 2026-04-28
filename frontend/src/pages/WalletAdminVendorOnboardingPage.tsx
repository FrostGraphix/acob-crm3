import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ApproveVendorModal } from "../components/vendor/ApproveVendorModal";
import { CreateVendorAccountModal } from "../components/vendor/CreateVendorAccountModal";
import {
  VwBadge,
  VwBtn,
  VwInfoBox,
  VwKPI,
  T,
} from "../components/vendor/VendorPortalPrimitives";
import { RejectVendorModal } from "../components/vendor/RejectVendorModal";
import { request } from "../services/api";
import { normalizeTableData } from "../services/table-data";
import type { DataPageConfig, DataRow } from "../types";

interface VendorRecord {
  approvalStatus: string;
  balance: number;
  contactEmail: string;
  contactPhone: string;
  id: string;
  joined: string;
  kycStatus: string;
  risk: string;
  siteCode: string;
  txns: number;
  vendorCode: string;
  vendorName: string;
}

function readString(row: DataRow, keys: string[], fallback = "--") {
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text.length > 0) return text;
  }
  return fallback;
}

function readNumber(row: DataRow, keys: string[]) {
  const value = keys.map((key) => row[key]).find((entry) => entry !== null && entry !== undefined && String(entry).trim().length > 0);
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toVendorRecord(row: DataRow): VendorRecord {
  const status = readString(row, ["approvalStatus", "status"], "pending_review").toLowerCase();
  const normalizedStatus =
    status.includes("active") ? "active" :
    status.includes("suspend") ? "suspended" :
    "pending_review";
  const risk =
    readString(row, ["risk", "riskRating"], "").toLowerCase() ||
    (normalizedStatus === "suspended" ? "high" : normalizedStatus === "pending_review" ? "medium" : "low");

  return {
    approvalStatus: normalizedStatus,
    balance: readNumber(row, ["balance", "availableBalance", "walletBalance"]),
    contactEmail: readString(row, ["contactEmail", "email"], "--"),
    contactPhone: readString(row, ["contactPhone", "phone"], "--"),
    id: readString(row, ["id", "vendorId"], ""),
    joined: readString(row, ["submittedAt", "createdAt", "createTime"], "--"),
    kycStatus: readString(row, ["kycStatus"], "submitted").toLowerCase(),
    risk,
    siteCode: readString(row, ["siteCode", "siteName"], "Unassigned"),
    txns: readNumber(row, ["transactionCount", "txns", "purchaseCount"]),
    vendorCode: readString(row, ["vendorCode", "code"], "VND-000"),
    vendorName: readString(row, ["vendorName", "businessName", "displayName", "legalName"], "Vendor"),
  };
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    currency: "NGN",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatDate(value: string) {
  if (value === "--") return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-NG", {
    dateStyle: "medium",
    timeZone: "Africa/Lagos",
  });
}

export function WalletAdminVendorOnboardingPage({ page }: { page: DataPageConfig }) {
  const [records, setRecords] = useState<VendorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "active" | "pending_review" | "suspended">("all");
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [decisionModal, setDecisionModal] = useState<"approve" | "reject" | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await request<unknown>(page.readEndpoint, { method: page.readMethod ?? "GET" });
      const nextRecords = normalizeTableData(result, page.readEndpoint).rows.map(toVendorRecord);
      setRecords(nextRecords);
      setSelectedVendorId((current) => {
        if (nextRecords.some((record) => record.id === current)) return current;
        return nextRecords[0]?.id ?? "";
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load vendor onboarding queue.");
    } finally {
      setLoading(false);
    }
  }, [page.readEndpoint, page.readMethod]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      const tabMatch = tab === "all" || record.approvalStatus === tab;
      const queryMatch =
        !query ||
        [record.vendorName, record.vendorCode, record.siteCode].some((value) => value.toLowerCase().includes(query));
      return tabMatch && queryMatch;
    });
  }, [records, search, tab]);

  const selectedRecord =
    filtered.find((record) => record.id === selectedVendorId) ??
    records.find((record) => record.id === selectedVendorId) ??
    null;

  const activeCount = records.filter((record) => record.approvalStatus === "active").length;
  const pendingCount = records.filter((record) => record.approvalStatus === "pending_review").length;
  const suspendedCount = records.filter((record) => record.approvalStatus === "suspended").length;
  const highRiskCount = records.filter((record) => record.risk === "high").length;

  return (
    <div className="status-fade-in" style={{ padding: 24 }}>
      <div className="vendor-wallet-stack" style={{ minHeight: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="vw-page-title">Vendors</div>
            <div className="vw-page-sub">Manage vendor accounts, KYC, site assignments, and wallet limits</div>
          </div>
          <VwBtn variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
            Create Vendor Account
          </VwBtn>
        </div>

        {error ? <VwInfoBox type="danger">{error}</VwInfoBox> : null}
        {feedback ? <VwInfoBox type="success">{feedback}</VwInfoBox> : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12, marginBottom: 20 }}>
          <VwKPI label="Total Vendors" value={records.length} />
          <VwKPI label="Active" value={activeCount} valueColor={T.success} iconBg={T.successBg} />
          <VwKPI label="Pending Review" value={pendingCount} valueColor={T.warning} iconBg={T.warningBg} />
          <VwKPI label="Suspended" value={suspendedCount} valueColor={T.danger} iconBg={T.dangerBg} />
          <VwKPI label="High Risk" value={highRiskCount} valueColor={T.danger} iconBg={T.dangerBg} />
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 280 }}>
            <Search size={13} color={T.faint} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search vendor name or code..."
              style={{
                width: "100%",
                padding: "7px 12px 7px 30px",
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                background: "#fff",
                fontSize: 12,
                fontFamily: "var(--vw-font)",
                color: T.text,
              }}
              type="text"
            />
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              ["all", "All"],
              ["active", "Active"],
              ["pending_review", "Pending Review"],
              ["suspended", "Suspended"],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTab(value as typeof tab)}
                style={{
                  padding: "5px 14px",
                  borderRadius: 20,
                  fontSize: 12,
                  cursor: "pointer",
                  background: tab === value ? T.sidebar : "#fff",
                  color: tab === value ? "#fff" : T.muted,
                  border: `1px solid ${tab === value ? T.sidebar : T.border}`,
                  fontWeight: tab === value ? 700 : 400,
                  fontFamily: "var(--vw-font)",
                }}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="vw-surface">
          <div style={{ overflowX: "auto" }}>
            <table className="vw-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Code</th>
                  <th>Site</th>
                  <th>Status</th>
                  <th>KYC</th>
                  <th>Balance</th>
                  <th>Txns</th>
                  <th>Risk</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && records.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: "32px 16px", textAlign: "center", color: T.faint }}>
                      Loading vendors...
                    </td>
                  </tr>
                ) : null}

                {!loading && filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: "32px 16px", textAlign: "center", color: T.faint }}>
                      No vendors found.
                    </td>
                  </tr>
                ) : null}

                {filtered.map((record) => (
                  <tr
                    key={record.id}
                    className="vw-row--clickable"
                    onClick={() => setSelectedVendorId(record.id)}
                    style={selectedVendorId === record.id ? { background: T.primaryLight } : undefined}
                  >
                    <td>
                      <div style={{ fontWeight: 700, color: T.text }}>{record.vendorName}</div>
                      <div style={{ fontSize: 11, color: T.muted }}>{record.contactPhone} · {record.contactEmail}</div>
                    </td>
                    <td style={{ fontFamily: T.mono, color: T.primary, fontSize: 11.5 }}>{record.vendorCode}</td>
                    <td style={{ color: T.muted }}>{record.siteCode}</td>
                    <td>
                      <VwBadge variant={record.approvalStatus === "active" ? "success" : record.approvalStatus === "pending_review" ? "warning" : "danger"} dot>
                        {record.approvalStatus.replace(/_/g, " ")}
                      </VwBadge>
                    </td>
                    <td>
                      <VwBadge variant={record.kycStatus === "approved" ? "success" : record.kycStatus === "submitted" ? "info" : "gray"}>
                        {record.kycStatus}
                      </VwBadge>
                    </td>
                    <td style={{ fontWeight: 700 }}>{record.balance > 0 ? formatMoney(record.balance) : "—"}</td>
                    <td style={{ color: T.muted }}>{record.txns}</td>
                    <td>
                      <span
                        style={{
                          fontWeight: 700,
                          color: record.risk === "low" ? T.success : record.risk === "medium" ? T.warning : T.danger,
                          textTransform: "uppercase",
                          fontSize: 10,
                        }}
                      >
                        {record.risk}
                      </span>
                    </td>
                    <td style={{ color: T.muted }}>{formatDate(record.joined)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 5 }}>
                        {record.approvalStatus === "pending_review" ? (
                          <VwBtn variant="lemon" size="xs" onClick={() => setDecisionModal("approve")}>Review</VwBtn>
                        ) : null}
                        {record.approvalStatus === "active" ? (
                          <>
                            <VwBtn variant="ghost" size="xs">View</VwBtn>
                            <VwBtn variant="ghost" size="xs">Suspend</VwBtn>
                          </>
                        ) : null}
                        {record.approvalStatus === "suspended" ? (
                          <VwBtn variant="subtle" size="xs">Reactivate</VwBtn>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedRecord ? (
          <div className="vw-surface vw-surface--padded" style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{selectedRecord.vendorName}</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                  {selectedRecord.vendorCode} · {selectedRecord.siteCode} · {selectedRecord.contactPhone}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <VwBadge variant={selectedRecord.approvalStatus === "active" ? "success" : selectedRecord.approvalStatus === "pending_review" ? "warning" : "danger"} dot>
                  {selectedRecord.approvalStatus.replace(/_/g, " ")}
                </VwBadge>
                <VwBadge variant={selectedRecord.risk === "low" ? "success" : selectedRecord.risk === "medium" ? "warning" : "danger"}>
                  {selectedRecord.risk.toUpperCase()} RISK
                </VwBadge>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {[
                  ["Wallet Balance", selectedRecord.balance > 0 ? formatMoney(selectedRecord.balance) : "₦0.00"],
                  ["Transactions", String(selectedRecord.txns)],
                  ["KYC", selectedRecord.kycStatus],
                  ["Joined", formatDate(selectedRecord.joined)],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, color: T.faint, textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {[
                  ["CAC Certificate", "Corporate identity document", selectedRecord.kycStatus === "approved" ? "approved" : "submitted"],
                  ["Director ID", "KYC identity review", selectedRecord.kycStatus === "approved" ? "approved" : "submitted"],
                  ["Utility Bill", "Address verification pack", selectedRecord.approvalStatus === "pending_review" ? "pending" : "approved"],
                ].map(([name, sub, status]) => (
                  <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 10, background: T.surface2 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{name}</div>
                      <div style={{ fontSize: 10, color: T.muted }}>{sub}</div>
                    </div>
                    <VwBadge variant={status === "approved" ? "success" : status === "pending" ? "warning" : "info"}>{status}</VwBadge>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {selectedRecord.approvalStatus === "pending_review" ? (
                <>
                  <VwBtn variant="primary" size="sm" onClick={() => setDecisionModal("approve")}>Approve & Activate</VwBtn>
                  <VwBtn variant="danger" size="sm" onClick={() => setDecisionModal("reject")}>Reject</VwBtn>
                </>
              ) : null}
              <VwBtn variant="ghost" size="sm">View Wallet</VwBtn>
              <VwBtn variant="ghost" size="sm">View Ledger</VwBtn>
              <VwBtn variant="outline" size="sm">Open Detail</VwBtn>
            </div>
          </div>
        ) : null}

        {showCreateModal ? (
          <CreateVendorAccountModal
            onClose={() => setShowCreateModal(false)}
            onVendorCreated={async (vendorId) => {
              await loadQueue();
              setSelectedVendorId(vendorId);
              setFeedback("Vendor account created and added to the onboarding queue.");
            }}
          />
        ) : null}

        {decisionModal === "approve" && selectedRecord ? (
          <ApproveVendorModal
            businessName={selectedRecord.vendorName}
            vendorId={selectedRecord.id}
            onClose={() => setDecisionModal(null)}
            onApproved={async () => {
              setDecisionModal(null);
              setFeedback("Vendor approved and wallet provisioning started.");
              await loadQueue();
            }}
          />
        ) : null}

        {decisionModal === "reject" && selectedRecord ? (
          <RejectVendorModal
            businessName={selectedRecord.vendorName}
            vendorId={selectedRecord.id}
            onClose={() => setDecisionModal(null)}
            onRejected={async () => {
              setDecisionModal(null);
              setFeedback("Vendor application rejected and queue refreshed.");
              await loadQueue();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

export default WalletAdminVendorOnboardingPage;
