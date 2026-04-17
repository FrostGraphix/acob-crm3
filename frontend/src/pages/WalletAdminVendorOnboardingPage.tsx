import { useEffect, useMemo, useState } from "react";
import { ApproveVendorModal } from "../components/vendor/ApproveVendorModal";
import { CreateVendorAccountModal } from "../components/vendor/CreateVendorAccountModal";
import {
  VwBadge,
  VwBtn,
  VwDivider,
  VwInfoBox,
  VwKPI,
} from "../components/vendor/VendorPortalPrimitives";
import { RejectVendorModal } from "../components/vendor/RejectVendorModal";
import { request } from "../services/api";
import { normalizeTableData } from "../services/table-data";
import type { DataPageConfig, DataRow } from "../types";

interface VendorOnboardingRecord {
  id: string;
  vendorCode: string;
  vendorName: string;
  businessName: string;
  siteCode: string;
  submittedAt: string;
  kycStatus: string;
  submittedDocumentsCount: string;
  bankStatus: string;
  approvalStatus: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

function readString(row: DataRow, keys: string[], fallback = "--") {
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined) {
      continue;
    }

    const text = String(value).trim();
    if (text.length > 0) {
      return text;
    }
  }

  return fallback;
}

function toVendorOnboardingRecord(row: DataRow): VendorOnboardingRecord {
  return {
    id: readString(row, ["id", "vendorId"], ""),
    vendorCode: readString(row, ["vendorCode", "code"]),
    vendorName: readString(row, ["vendorName", "businessName", "displayName", "legalName"]),
    businessName: readString(row, ["businessName", "vendorName", "displayName", "legalName"]),
    siteCode: readString(row, ["siteCode", "siteName"]),
    submittedAt: readString(row, ["submittedAt", "createdAt", "createTime"]),
    kycStatus: readString(row, ["kycStatus"]),
    submittedDocumentsCount: readString(row, ["submittedDocumentsCount", "kycDocumentCount"], "0"),
    bankStatus: readString(row, ["bankStatus", "bankVerificationStatus"]),
    approvalStatus: readString(row, ["approvalStatus", "status"]),
    contactName: readString(row, ["contactName", "ownerName", "reviewContact"], "--"),
    contactEmail: readString(row, ["contactEmail", "email"], "--"),
    contactPhone: readString(row, ["contactPhone", "phone"], "--"),
  };
}

function formatDateTime(value: string) {
  if (value === "--") {
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  });
}

function statusTone(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("approved") || normalized.includes("active") || normalized.includes("complete")) {
    return "success";
  }
  if (normalized.includes("pending") || normalized.includes("review")) {
    return "warning";
  }
  if (normalized.includes("reject") || normalized.includes("fail") || normalized.includes("suspend")) {
    return "danger";
  }
  return "gray";
}

function readinessSummary(record: VendorOnboardingRecord | null) {
  if (!record) {
    return {
      score: 0,
      blockers: [] as string[],
    };
  }

  let score = 0;
  const blockers: string[] = [];

  if (record.kycStatus.toLowerCase().includes("complete") || record.kycStatus.toLowerCase().includes("approved")) {
    score += 1;
  } else {
    blockers.push("KYC completion still pending.");
  }

  if (Number(record.submittedDocumentsCount) > 0) {
    score += 1;
  } else {
    blockers.push("Supporting documents not yet sufficient.");
  }

  if (
    record.bankStatus.toLowerCase().includes("verified") ||
    record.bankStatus.toLowerCase().includes("complete") ||
    record.bankStatus.toLowerCase().includes("approved")
  ) {
    score += 1;
  } else {
    blockers.push("Bank verification still outstanding.");
  }

  return { score, blockers };
}

export function WalletAdminVendorOnboardingPage({ page }: { page: DataPageConfig }) {
  const [records, setRecords] = useState<VendorOnboardingRecord[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "active" | "pending_review" | "suspended">("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [decisionModal, setDecisionModal] = useState<"approve" | "reject" | null>(null);

  const loadQueue = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await request<unknown>(page.readEndpoint, { method: page.readMethod ?? "GET" });
      const nextRecords = normalizeTableData(result, page.readEndpoint).rows.map(toVendorOnboardingRecord);
      setRecords(nextRecords);
      setSelectedVendorId((current) => {
        if (nextRecords.some((record) => record.id === current)) {
          return current;
        }
        return nextRecords[0]?.id ?? "";
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load vendor onboarding queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return records.filter((record) => {
      const normalizedStatus = record.approvalStatus.trim().toLowerCase().replace(/\s+/g, "_");
      const matchesTab = activeTab === "all" || normalizedStatus.includes(activeTab);
      if (!matchesTab) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        record.vendorCode,
        record.vendorName,
        record.businessName,
        record.siteCode,
        record.contactName,
        record.contactEmail,
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [activeTab, records, searchTerm]);

  const selectedRecord =
    filteredRecords.find((record) => record.id === selectedVendorId) ??
    records.find((record) => record.id === selectedVendorId) ??
    filteredRecords[0] ??
    null;

  const pendingCount = records.filter((record) => record.approvalStatus.toLowerCase().includes("pending")).length;
  const activeCount = records.filter((record) => record.approvalStatus.toLowerCase().includes("active")).length;
  const kycReadyCount = records.filter((record) => {
    const status = record.kycStatus.toLowerCase();
    return status.includes("complete") || status.includes("approved");
  }).length;
  const suspendedCount = records.filter((record) => record.approvalStatus.toLowerCase().includes("suspend")).length;
  const selectedReadiness = readinessSummary(selectedRecord);

  const handleActionComplete = async (message: string) => {
    setDecisionModal(null);
    setFeedback(message);
    await loadQueue();
  };

  return (
    <section className="vendor-portal-page" style={{ background: "var(--vw-bg)", minHeight: "100vh" }}>
      <div className="vendor-wallet-stack" style={{ padding: "24px", fontFamily: "var(--vw-font)" }}>
        <div className="vw-hero">
          <div className="vw-hero__top">
            <div>
              <div className="vw-hero__eyebrow">Wallet Admin Workspace</div>
              <div className="vw-hero__balance" style={{ fontSize: 28 }}>{page.title}</div>
              <div className="vw-hero__sub">Review KYC, banking readiness, and provision vendor accounts without leaving finance operations.</div>
            </div>
            <div className="vw-hero__right">
              <VwBtn
                variant="ghost"
                size="sm"
                onClick={() => void loadQueue()}
                disabled={loading}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.78)",
                }}
              >
                {loading ? "Refreshing..." : "Refresh Queue"}
              </VwBtn>
              <VwBtn variant="lemon" size="sm" onClick={() => setShowCreateModal(true)}>
                Create Vendor Account
              </VwBtn>
            </div>
          </div>
        </div>

        {error ? <VwInfoBox type="danger">{error}</VwInfoBox> : null}
        {feedback ? <VwInfoBox type="success">{feedback}</VwInfoBox> : null}

        <div className="vw-grid-4">
          <VwKPI label="Queue Size" value={records.length} sub="Total vendor applications in scope" iconBg="#EFF6FF" />
          <VwKPI label="Pending Review" value={pendingCount} sub="Waiting for a finance decision" iconBg="#FFFBEB" />
          <VwKPI label="KYC Ready" value={kycReadyCount} sub="Already marked complete or approved" iconBg="#e6f4e6" />
          <VwKPI label="Suspended" value={suspendedCount} sub="Accounts currently restricted" iconBg="#FEF2F2" />
        </div>

        <div className="vw-filter-pills">
          {[
            { key: "all", label: "All", count: records.length },
            { key: "active", label: "Active", count: activeCount },
            { key: "pending_review", label: "Pending Review", count: pendingCount },
            { key: "suspended", label: "Suspended", count: suspendedCount },
          ].map((tab) => (
            <button
              key={tab.key}
              className={`vw-filter-pill${activeTab === tab.key ? " vw-filter-pill--active" : ""}`}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              type="button"
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <div className="vw-grid-2-1">
          <div className="vw-surface">
            <div className="vw-surface__header">
              <div>
                <span className="vw-surface__title">Vendor Table</span>
                <div style={{ fontSize: 12, color: "var(--vw-muted)", marginTop: 2 }}>
                  Search and select any vendor record to inspect its current onboarding package.
                </div>
              </div>
            </div>

            <div style={{ padding: "18px 20px" }}>
              <div className="vw-field" style={{ marginBottom: 16 }}>
                <label className="vw-field__label">Search queue</label>
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by vendor code, name, site, or contact"
                  type="text"
                  style={{
                    width: "100%",
                    padding: "9px 13px",
                    borderRadius: 8,
                    border: "1px solid var(--vw-border2)",
                    fontFamily: "var(--vw-font)",
                    fontSize: 13,
                  }}
                />
              </div>

              <div className="vw-table-wrap">
                <table className="vw-table">
                  <thead>
                    <tr>
                      <th>Vendor</th>
                      <th>Site</th>
                      <th>KYC</th>
                      <th>Bank</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && records.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", color: "var(--vw-muted)", padding: "2rem" }}>
                          Loading onboarding queue...
                        </td>
                      </tr>
                    ) : null}
                    {!loading && filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", color: "var(--vw-muted)", padding: "2rem" }}>
                          No vendors match this filter.
                        </td>
                      </tr>
                    ) : null}
                    {filteredRecords.map((record) => (
                      <tr
                        key={record.id}
                        className="vw-row--clickable"
                        onClick={() => setSelectedVendorId(record.id)}
                        style={selectedRecord?.id === record.id ? { background: "var(--vw-primary-light)" } : undefined}
                      >
                        <td>
                          <div style={{ display: "grid", gap: 3 }}>
                            <span style={{ fontWeight: 700, color: "var(--vw-text)" }}>{record.vendorName}</span>
                            <span style={{ color: "var(--vw-faint)", fontSize: 11 }}>{record.vendorCode}</span>
                          </div>
                        </td>
                        <td>{record.siteCode}</td>
                        <td><VwBadge variant={statusTone(record.kycStatus)}>{record.kycStatus}</VwBadge></td>
                        <td><VwBadge variant={statusTone(record.bankStatus)}>{record.bankStatus}</VwBadge></td>
                        <td><VwBadge variant={statusTone(record.approvalStatus)} dot>{record.approvalStatus}</VwBadge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="vendor-wallet-stack">
            <div className="vw-surface vw-surface--padded">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
                <div>
                  <div className="vw-page-title" style={{ fontSize: 18 }}>Decision Workspace</div>
                  <div className="vw-page-sub">Open approval when the pack is ready, or reject when the record needs correction.</div>
                </div>
                {selectedRecord ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <VwBtn variant="outline" size="sm" onClick={() => setDecisionModal("reject")}>Reject</VwBtn>
                    <VwBtn variant="primary" size="sm" onClick={() => setDecisionModal("approve")}>Approve</VwBtn>
                  </div>
                ) : null}
              </div>

              {selectedRecord ? (
                <div className="vendor-wallet-stack">
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <VwBadge variant="gray">{selectedRecord.vendorCode}</VwBadge>
                    <VwBadge variant="info">{selectedRecord.siteCode}</VwBadge>
                    <VwBadge variant={statusTone(selectedRecord.approvalStatus)} dot>{selectedRecord.approvalStatus}</VwBadge>
                    <VwBadge variant={selectedReadiness.score >= 3 ? "success" : selectedReadiness.score === 2 ? "warning" : "danger"}>
                      Readiness {selectedReadiness.score}/3
                    </VwBadge>
                  </div>

                  <div className="vw-grid-2">
                    {[
                      ["Business Name", selectedRecord.businessName],
                      ["Submitted At", formatDateTime(selectedRecord.submittedAt)],
                      ["Contact Name", selectedRecord.contactName],
                      ["Contact Email", selectedRecord.contactEmail],
                      ["Contact Phone", selectedRecord.contactPhone],
                      ["Documents", selectedRecord.submittedDocumentsCount],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        style={{
                          background: "var(--vw-bg)",
                          border: "1px solid var(--vw-border)",
                          borderRadius: 10,
                          padding: "12px 14px",
                        }}
                      >
                        <div style={{ fontSize: 10, color: "var(--vw-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, fontWeight: 600 }}>
                          {label}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--vw-text)" }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="vw-grid-2">
                    {[
                      ["KYC Status", selectedRecord.kycStatus],
                      ["Bank Status", selectedRecord.bankStatus],
                      ["Approval Status", selectedRecord.approvalStatus],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        style={{
                          background: "var(--vw-surface2)",
                          border: "1px solid var(--vw-border)",
                          borderRadius: 14,
                          padding: "16px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--vw-text)" }}>{label}</span>
                          <VwBadge variant={statusTone(value)}>{value}</VwBadge>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--vw-muted)", lineHeight: 1.6 }}>
                          {label === "KYC Status" ? "Finance should confirm the uploaded KYC pack is acceptable before provisioning." : null}
                          {label === "Bank Status" ? "Bank readiness supports settlement and payout operations once live." : null}
                          {label === "Approval Status" ? "This is the current routing state for the vendor onboarding flow." : null}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="vw-surface vw-surface--padded" style={{ background: "var(--vw-surface2)" }}>
                    <div className="vw-surface__title" style={{ marginBottom: 12 }}>Reviewer Guidance</div>
                    {selectedReadiness.blockers.length === 0 ? (
                      <VwInfoBox type="success">This onboarding pack appears ready for approval and wallet provisioning.</VwInfoBox>
                    ) : (
                      <VwInfoBox type="warning">{selectedReadiness.blockers.join(" ")}</VwInfoBox>
                    )}
                    <VwDivider label="FINANCE FLOW" />
                    <div style={{ display: "grid", gap: 10 }}>
                      {[
                        "Approve when KYC, bank verification, and core contact details are sufficient for live operations.",
                        "Reject when the vendor must correct onboarding data before activation can proceed.",
                        "Use reviewer notes in the modal so the audit trail remains useful to downstream wallet admins.",
                      ].map((item) => (
                        <div key={item} style={{ fontSize: 12, color: "var(--vw-muted)", lineHeight: 1.7 }}>
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <VwInfoBox type="info">Select a vendor from the table to begin review.</VwInfoBox>
              )}
            </div>
          </div>
        </div>

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
            businessName={selectedRecord.businessName}
            vendorId={selectedRecord.id}
            onClose={() => setDecisionModal(null)}
            onApproved={() => void handleActionComplete("Vendor approved and wallet provisioning started.")}
          />
        ) : null}

        {decisionModal === "reject" && selectedRecord ? (
          <RejectVendorModal
            businessName={selectedRecord.businessName}
            vendorId={selectedRecord.id}
            onClose={() => setDecisionModal(null)}
            onRejected={() => void handleActionComplete("Vendor application rejected and queue refreshed.")}
          />
        ) : null}
      </div>
    </section>
  );
}

export default WalletAdminVendorOnboardingPage;
