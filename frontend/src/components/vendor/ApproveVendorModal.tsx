import { useState, type FormEvent } from "react";
import { request } from "../../services/api";
import {
  NGN,
  VwBadge,
  VwBtn,
  VwInfoBox,
  VwStepBar,
} from "./VendorPortalPrimitives.tsx";

interface Props {
  vendorId: string;
  businessName: string;
  onClose: () => void;
  onApproved: () => void;
}

export function ApproveVendorModal({ vendorId, businessName, onClose, onApproved }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [riskRating, setRiskRating] = useState("low");
  const [dailyPurchaseLimit, setDailyPurchaseLimit] = useState("500000");
  const [perTransactionLimit, setPerTransactionLimit] = useState("100000");
  const [reviewerNote, setReviewerNote] = useState("");

  const dailyLimitValue = Number(dailyPurchaseLimit || "0");
  const perTransactionValue = Number(perTransactionLimit || "0");
  const reviewReady =
    Number.isFinite(dailyLimitValue) &&
    Number.isFinite(perTransactionValue) &&
    dailyLimitValue > 0 &&
    perTransactionValue > 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await request(`/api/vendor/${vendorId}/approve`, {
        method: "POST",
        body: {
          riskRating,
          dailyPurchaseLimit: Number(dailyPurchaseLimit),
          perTransactionLimit: Number(perTransactionLimit),
          reviewerNote: reviewerNote.trim() || undefined,
        },
      });
      onApproved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve vendor.");
    } finally {
      setLoading(false);
    }
  };

  const fieldInput: React.CSSProperties = {
    width: "100%",
    padding: "9px 13px",
    borderRadius: 8,
    border: "1px solid var(--vw-border2)",
    fontFamily: "var(--vw-font)",
    fontSize: 13,
    background: "var(--vw-surface)",
    color: "var(--vw-text)",
  };

  return (
    <div className="vw-modal-overlay" role="dialog" aria-modal="true">
      <div className="vw-modal vw-modal--lg">
        <div className="vw-modal__header">
          <div>
            <div className="vw-modal__title">Review Vendor Application</div>
            <div className="vw-modal__subtitle">{businessName} · Approve and activate vendor wallet access</div>
          </div>
          <button className="vw-modal__close" onClick={onClose} type="button">×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="vw-modal__body">
            <VwStepBar steps={["KYC Pack", "Controls", "Activate"]} current={2} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[
                ["Vendor Name", businessName],
                ["Contact", "Submitted by onboarding profile"],
                ["Site", "Assigned during vendor creation"],
                ["Risk Rating", riskRating.toUpperCase()],
                ["Daily Limit", NGN(dailyLimitValue || 0)],
                ["Per Transaction", NGN(perTransactionValue || 0)],
              ].map(([key, value]) => (
                <div key={key} style={{ background: "var(--vw-bg)", borderRadius: 10, padding: "12px 14px", border: "1px solid var(--vw-border)" }}>
                  <div style={{ fontSize: 11, color: "var(--vw-muted)", marginBottom: 3 }}>{key}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--vw-text)" }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 16 }}>
              {[
                ["CAC Certificate", "Corporate identity document", "approved"],
                ["Director's ID", "KYC identity review", "approved"],
                ["Utility Bill", "Address verification pack", "pending"],
              ].map(([name, sub, status]) => (
                <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "var(--vw-bg)", borderRadius: 12, marginBottom: 8, border: "1px solid var(--vw-border)" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--vw-text)" }}>{name}</div>
                    <div style={{ fontSize: 11, color: "var(--vw-muted)" }}>{sub}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <VwBadge variant={status === "approved" ? "success" : "warning"}>{status}</VwBadge>
                    <VwBtn variant="ghost" size="xs">View</VwBtn>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              <div className="vw-field">
                <label className="vw-field__label">Risk Rating</label>
                <select style={fieldInput} value={riskRating} onChange={(event) => setRiskRating(event.target.value)}>
                  <option value="low">Low Risk - Standard limits</option>
                  <option value="medium">Medium Risk - Requires periodic review</option>
                  <option value="high">High Risk - Strict monitoring</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="vw-field">
                  <label className="vw-field__label">Daily Purchase Limit (NGN)</label>
                  <input style={fieldInput} type="number" min="100" step="100" value={dailyPurchaseLimit} onChange={(event) => setDailyPurchaseLimit(event.target.value)} required />
                </div>
                <div className="vw-field">
                  <label className="vw-field__label">Per-Transaction Limit (NGN)</label>
                  <input style={fieldInput} type="number" min="100" step="100" value={perTransactionLimit} onChange={(event) => setPerTransactionLimit(event.target.value)} required />
                </div>
              </div>

              <div className="vw-field">
                <label className="vw-field__label">Review Note (optional)</label>
                <textarea style={{ ...fieldInput, resize: "vertical", minHeight: 80 }} value={reviewerNote} onChange={(event) => setReviewerNote(event.target.value)} placeholder="Add any notes..." />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {[
                ["Risk", riskRating.toUpperCase()],
                ["Daily", NGN(dailyLimitValue || 0)],
                ["Per-Txn", NGN(perTransactionValue || 0)],
              ].map(([label, value]) => (
                <div key={label} style={{ background: "var(--vw-surface2)", border: "1px solid var(--vw-border)", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, color: "var(--vw-muted)", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--vw-text)" }}>{value}</div>
                </div>
              ))}
            </div>

            <VwInfoBox type="lemon">
              Approval provisions the vendor wallet immediately and sets the initial controls used by finance and operations.
            </VwInfoBox>

            {error ? <VwInfoBox type="danger">{error}</VwInfoBox> : null}
          </div>

          <div className="vw-modal__footer">
            <VwBtn variant="danger" onClick={onClose}>Reject</VwBtn>
            <div style={{ flex: 1 }} />
            <VwBtn variant="outline" onClick={onClose}>Cancel</VwBtn>
            <VwBtn variant="primary" type="submit" disabled={loading || !reviewReady}>
              {loading ? "Approving..." : "Approve & Activate"}
            </VwBtn>
          </div>
        </form>
      </div>
    </div>
  );
}
