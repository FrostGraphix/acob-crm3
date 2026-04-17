import { useState, type FormEvent } from "react";
import { request } from "../../services/api";
import {
  VwBtn,
  VwInfoBox,
} from "./VendorPortalPrimitives.tsx";

interface Props {
  vendorId: string;
  businessName: string;
  onClose: () => void;
  onRejected: () => void;
}

export function RejectVendorModal({ vendorId, businessName, onClose, onRejected }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reason, setReason] = useState("kyc_failed");
  const [vendorMessage, setVendorMessage] = useState("");
  const [internalNote, setInternalNote] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await request(`/api/vendor/${vendorId}/reject`, {
        method: "POST",
        body: {
          reason,
          vendorMessage,
          internalNote: internalNote.trim() || undefined,
        }
      });
      onRejected();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject vendor.");
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
      <div className="vw-modal vw-modal--md">
        <div className="vw-modal__header">
          <div>
            <div className="vw-modal__title">Reject Application</div>
            <div className="vw-modal__subtitle">Provide a reason for rejecting {businessName}&apos;s application</div>
          </div>
          <button className="vw-modal__close" onClick={onClose} type="button">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="vw-modal__body">
            <VwInfoBox type="danger" icon={<span>⚠️</span>}>
              Rejection will notify the vendor and prevent wallet activation. This action can be reversed by re-submitting onboarding.
            </VwInfoBox>

            <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
              <div className="vw-field">
                <label className="vw-field__label">Rejection Reason</label>
                <select style={fieldInput} value={reason} onChange={(e) => setReason(e.target.value)}>
                  <option value="kyc_failed">Failed KYC Verification</option>
                  <option value="duplicate_account">Duplicate Vendor Account</option>
                  <option value="unsupported_region">Unsupported Region</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="vw-field">
                <label className="vw-field__label">Message Shown To Vendor *</label>
                <textarea
                  style={{ ...fieldInput, resize: "vertical" }}
                  rows={4}
                  value={vendorMessage}
                  onChange={(e) => setVendorMessage(e.target.value)}
                  placeholder="Explain what the vendor needs to know about this rejection."
                  minLength={20}
                  required
                />
                <div className="vw-field__hint">Minimum 20 characters. This message is visible to the vendor.</div>
              </div>

              <div className="vw-field">
                <label className="vw-field__label">Internal Note</label>
                <textarea
                  style={{ ...fieldInput, resize: "vertical" }}
                  rows={3}
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  placeholder="Optional note for internal reviewers only."
                />
              </div>
            </div>

            {error && <VwInfoBox type="danger">{error}</VwInfoBox>}
          </div>

          <div className="vw-modal__footer">
            <VwBtn variant="ghost" onClick={onClose} disabled={loading}>Cancel</VwBtn>
            <VwBtn variant="danger" type="submit" disabled={loading}>
              {loading ? "Rejecting…" : "Reject Application"}
            </VwBtn>
          </div>
        </form>
      </div>
    </div>
  );
}
