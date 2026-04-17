import { useState, type FormEvent } from "react";
import { request } from "../../services/api";
import {
  VwBtn,
  VwInfoBox,
  VwStepBar,
  VwConfirmTable,
} from "./VendorPortalPrimitives.tsx";

const SITE_OPTIONS = [
  { value: "MUSHA", label: "Musha" },
  { value: "KYAKALE", label: "Kyakale" },
  { value: "UMAISHA", label: "Umaisha" },
  { value: "TUNGA", label: "Tunga" },
  { value: "OGUFA", label: "Ogufa" },
];

const ROLE_OPTIONS = [
  { value: "vendor_user", label: "Vendor Agent", description: "Can vend, view own transactions, and request top-ups." },
  { value: "vendor_manager", label: "Vendor Manager", description: "All agent permissions plus team visibility and escalation rights." },
];

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
}

type ModalStep = "identity" | "limits" | "credentials" | "confirm";

interface CreateResult {
  vendorId: string;
  vendorCode: string;
  username: string;
  password: string;
  loginIdentifier: string;
  siteCode: string;
  businessName: string;
  loginUrl: string;
}

interface InviteResponse {
  invitation: {
    loginIdentifier: string;
  };
  issuedTemporaryPassword: string;
}

interface Props {
  onClose: () => void;
  onVendorCreated: (vendorId: string) => void;
}

export function CreateVendorAccountModal({ onClose, onVendorCreated }: Props) {
  const [step, setStep] = useState<ModalStep>("identity");

  const [businessName, setBusinessName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const [siteCode, setSiteCode] = useState(SITE_OPTIONS[0]?.value ?? "");
  const [dailyLimit, setDailyLimit] = useState("500000");
  const [perTransactionLimit, setPerTransactionLimit] = useState("100000");
  const [commissionRule, setCommissionRule] = useState("standard");

  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"vendor_user" | "vendor_manager">("vendor_user");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [deliveryMode, setDeliveryMode] = useState("screen");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [copied, setCopied] = useState<Record<string, boolean>>({});

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

  const handleClose = () => {
    setResult(null);
    setCopied({});
    onClose();
  };

  const suggestUsername = () => {
    if (businessName.trim()) {
      setUsername(`${slugify(businessName.trim())}_${Math.floor(Math.random() * 900 + 100)}`);
    }
  };

  const handleIdentitySubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!businessName.trim() || !contactName.trim() || !contactEmail.trim()) {
      return;
    }
    setError(null);
    setStep("limits");
  };

  const handleLimitsSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!siteCode || !dailyLimit.trim() || !perTransactionLimit.trim()) {
      return;
    }
    setError(null);
    if (!username.trim()) {
      suggestUsername();
    }
    setStep("credentials");
  };

  const handleCredentialsSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const vendorId = `ADM_${slugify(businessName).toUpperCase().slice(0, 14)}_${Date.now().toString(36).toUpperCase().slice(-6)}`;
      const vendorCode = `VND-${vendorId.slice(-8)}`;

      const invitation = await request<InviteResponse>("/api/vendor/invite", {
        body: {
          vendorId,
          username: username.trim(),
          loginIdentifier: contactEmail.trim(),
          temporaryPassword: temporaryPassword.trim() || undefined,
          siteCode: siteCode.toUpperCase(),
          role,
        },
      });

      await request<unknown>("/api/vendor/profile", {
        body: {
          vendorId,
          vendorCode,
          businessName: businessName.trim(),
          displayName: displayName.trim() || businessName.trim(),
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim() || undefined,
          siteCode: siteCode.toUpperCase(),
          kycCompleted: false,
        },
      });

      const loginUrl = `${window.location.origin}/vendor/login`;

      setResult({
        vendorId,
        vendorCode,
        username: username.trim(),
        password: invitation.issuedTemporaryPassword || temporaryPassword.trim(),
        loginIdentifier: invitation.invitation.loginIdentifier,
        siteCode: siteCode.toUpperCase(),
        businessName: businessName.trim(),
        loginUrl,
      });
      setStep("confirm");
      onVendorCreated(vendorId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to create vendor account");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (key: string, value: string) => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => setCopied((prev) => ({ ...prev, [key]: false })), 2000);
    });
  };

  const copyAll = () => {
    if (!result) return;
    const text = [
      "ACOB Vendor Portal Access",
      "",
      `Business: ${result.businessName}`,
      `Portal URL: ${result.loginUrl}`,
      `Username: ${result.username}`,
      `Login ID: ${result.loginIdentifier}`,
      `Temporary Password: ${result.password}`,
      `Site: ${result.siteCode}`,
      "",
      "IMPORTANT: This password expires in 72 hours.",
      "The vendor must change it on first login.",
    ].join("\n");
    copyToClipboard("all", text);
  };

  const downloadTxt = () => {
    if (!result) return;
    const text = [
      "ACOB Vendor Portal Access",
      `Generated: ${new Date().toLocaleString()}`,
      "",
      `Business: ${result.businessName}`,
      `Vendor Code: ${result.vendorCode}`,
      `Portal URL: ${result.loginUrl}`,
      `Username: ${result.username}`,
      `Login ID: ${result.loginIdentifier}`,
      `Temporary Password: ${result.password}`,
      `Site: ${result.siteCode}`,
      "",
      "IMPORTANT: This password expires in 72 hours.",
      "The vendor must change their password on first login.",
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${result.username}-vendor-access.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const stepIndex = step === "identity" ? 0 : step === "limits" ? 1 : step === "credentials" ? 2 : 2;

  return (
    <div className="vw-modal-overlay" role="dialog" aria-modal="true">
      <div className="vw-modal vw-modal--lg">
        <div className="vw-modal__header">
          <div>
            <div className="vw-modal__title">
              {step === "identity" && "Create Vendor Account"}
              {step === "limits" && "Configure Site & Limits"}
              {step === "credentials" && "Create Credentials"}
              {step === "confirm" && "Vendor Account Ready"}
            </div>
            {step !== "confirm" ? <div className="vw-modal__subtitle">Step {stepIndex + 1} of 3</div> : null}
          </div>
          <button className="vw-modal__close" onClick={handleClose} type="button">×</button>
        </div>

        {step !== "confirm" ? (
          <div style={{ padding: "14px 22px 0" }}>
            <VwStepBar steps={["Vendor Details", "Site & Limits", "Credentials"]} current={stepIndex} />
          </div>
        ) : null}

        {step === "identity" ? (
          <form onSubmit={handleIdentitySubmit}>
            <div className="vw-modal__body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="vw-field" style={{ gridColumn: "1 / -1" }}>
                  <label className="vw-field__label">Vendor / business name *</label>
                  <input style={fieldInput} type="text" required value={businessName} onChange={(event) => setBusinessName(event.target.value)} />
                </div>
                <div className="vw-field" style={{ gridColumn: "1 / -1" }}>
                  <label className="vw-field__label">Display name</label>
                  <input style={fieldInput} type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                </div>
                <div className="vw-field">
                  <label className="vw-field__label">Contact person *</label>
                  <input style={fieldInput} type="text" required value={contactName} onChange={(event) => setContactName(event.target.value)} />
                </div>
                <div className="vw-field">
                  <label className="vw-field__label">Primary phone</label>
                  <input style={fieldInput} type="tel" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} />
                </div>
                <div className="vw-field" style={{ gridColumn: "1 / -1" }}>
                  <label className="vw-field__label">Email address *</label>
                  <input style={fieldInput} type="email" required value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
                </div>
              </div>
            </div>
            <div className="vw-modal__footer">
              <VwBtn variant="ghost" onClick={handleClose}>Cancel</VwBtn>
              <VwBtn variant="primary" type="submit">Next →</VwBtn>
            </div>
          </form>
        ) : null}

        {step === "limits" ? (
          <form onSubmit={handleLimitsSubmit}>
            <div className="vw-modal__body">
              <div className="vw-field">
                <label className="vw-field__label">Assigned site *</label>
                <select style={fieldInput} required value={siteCode} onChange={(event) => setSiteCode(event.target.value)}>
                  {SITE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="vw-field">
                  <label className="vw-field__label">Daily limit (NGN)</label>
                  <input style={fieldInput} type="number" min="100" step="100" value={dailyLimit} onChange={(event) => setDailyLimit(event.target.value)} />
                </div>
                <div className="vw-field">
                  <label className="vw-field__label">Per-transaction limit (NGN)</label>
                  <input style={fieldInput} type="number" min="100" step="100" value={perTransactionLimit} onChange={(event) => setPerTransactionLimit(event.target.value)} />
                </div>
              </div>

              <div className="vw-field">
                <label className="vw-field__label">Commission rule</label>
                <select style={fieldInput} value={commissionRule} onChange={(event) => setCommissionRule(event.target.value)}>
                  <option value="standard">Standard (0.00% - activation pending)</option>
                  <option value="custom">Custom rate</option>
                </select>
              </div>

              <VwInfoBox type="info">
                Commission is wired from day one at 0.00%. Finance activates the rate when business policy is set.
              </VwInfoBox>
            </div>
            <div className="vw-modal__footer">
              <VwBtn variant="outline" onClick={() => setStep("identity")}>← Back</VwBtn>
              <VwBtn variant="primary" type="submit">Next →</VwBtn>
            </div>
          </form>
        ) : null}

        {step === "credentials" ? (
          <form onSubmit={handleCredentialsSubmit}>
            <div className="vw-modal__body">
              <div style={{ background: "var(--vw-success-bg)", border: "1px solid #b7dfc8", borderRadius: 12, padding: 18, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--vw-success-text)", marginBottom: 10 }}>Credentials generated automatically</div>
                <VwConfirmTable
                  rows={[
                    { key: "Assigned site", value: SITE_OPTIONS.find((option) => option.value === siteCode)?.label ?? siteCode },
                    { key: "Daily limit", value: dailyLimit },
                    { key: "Per transaction", value: perTransactionLimit },
                    { key: "Expiry", value: "72 hours - must change on first login" },
                  ]}
                />
              </div>

              <div className="vw-field">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label className="vw-field__label">Username *</label>
                  <button type="button" onClick={suggestUsername} style={{ fontSize: 11, color: "var(--vw-primary)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                    Suggest from name
                  </button>
                </div>
                <input style={fieldInput} type="text" required value={username} onChange={(event) => setUsername(event.target.value)} />
              </div>

              <div className="vw-field">
                <label className="vw-field__label">Temporary password</label>
                <input style={fieldInput} type="text" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} placeholder="Leave blank to auto-generate" />
              </div>

              <div className="vw-field">
                <label className="vw-field__label">Portal access role</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {ROLE_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      style={{
                        padding: "14px 16px",
                        borderRadius: 12,
                        border: `${role === option.value ? "2px" : "1px"} solid ${role === option.value ? "var(--vw-primary)" : "var(--vw-border)"}`,
                        background: role === option.value ? "var(--vw-primary-light)" : "var(--vw-surface)",
                        cursor: "pointer",
                      }}
                    >
                      <input type="radio" name="role" checked={role === option.value} onChange={() => setRole(option.value as "vendor_user" | "vendor_manager")} style={{ display: "none" }} />
                      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--vw-text)", marginBottom: 3 }}>{option.label}</div>
                      <div style={{ fontSize: 11, color: "var(--vw-muted)", lineHeight: 1.5 }}>{option.description}</div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="vw-field">
                <label className="vw-field__label">Deliver credentials via</label>
                <select style={fieldInput} value={deliveryMode} onChange={(event) => setDeliveryMode(event.target.value)}>
                  <option value="sms">SMS to registered phone</option>
                  <option value="email">Email</option>
                  <option value="screen">Display on screen</option>
                </select>
              </div>

              <VwInfoBox type="warning">
                Vendor must change password on first login before any wallet operation is permitted.
              </VwInfoBox>

              {error ? <VwInfoBox type="danger">{error}</VwInfoBox> : null}
            </div>
            <div className="vw-modal__footer">
              <VwBtn variant="outline" onClick={() => setStep("limits")}>← Back</VwBtn>
              <VwBtn variant="primary" type="submit" disabled={loading || !username.trim()}>
                {loading ? "Creating..." : "Create Account & Send Credentials"}
              </VwBtn>
            </div>
          </form>
        ) : null}

        {step === "confirm" && result ? (
          <>
            <div className="vw-modal__body">
              <div style={{ background: "linear-gradient(135deg, var(--vw-sidebar-bg), #013b18)", borderRadius: 14, padding: "22px 20px", textAlign: "center", marginBottom: 18 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <svg width="22" height="22" fill="none" stroke="#4ade80" strokeWidth="3" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>Account Created for {result.businessName}</div>
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 4 }}>
                  Share these credentials securely. This is the only time the password is shown.
                </div>
              </div>

              <VwConfirmTable
                rows={[
                  { key: "Portal URL", value: result.loginUrl, mono: true },
                  { key: "Username", value: result.username, mono: true },
                  { key: "Login ID", value: result.loginIdentifier, mono: true },
                  { key: "Temp Password", value: result.password, mono: true, primary: true },
                  { key: "Site", value: result.siteCode },
                  { key: "Expires in", value: "72 hours" },
                ]}
              />

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                {[
                  { label: "URL", field: "url", value: result.loginUrl },
                  { label: "Username", field: "username", value: result.username },
                  { label: "Login ID", field: "loginId", value: result.loginIdentifier },
                  { label: "Password", field: "password", value: result.password },
                ].map((item) => (
                  <button
                    key={item.field}
                    type="button"
                    onClick={() => copyToClipboard(item.field, item.value)}
                    style={{
                      background: copied[item.field] ? "var(--vw-primary-light)" : "var(--vw-bg)",
                      border: `1px solid ${copied[item.field] ? "var(--vw-primary)" : "var(--vw-border)"}`,
                      borderRadius: 7,
                      padding: "5px 12px",
                      fontSize: 11,
                      cursor: "pointer",
                      fontFamily: "var(--vw-font)",
                      fontWeight: 600,
                      color: copied[item.field] ? "var(--vw-primary)" : "var(--vw-muted)",
                    }}
                  >
                    {copied[item.field] ? `✓ ${item.label}` : `Copy ${item.label}`}
                  </button>
                ))}
              </div>

              <VwInfoBox type="warning">
                This is the only time the password will be shown. Copy or download it now.
              </VwInfoBox>
            </div>
            <div className="vw-modal__footer">
              <VwBtn variant="ghost" onClick={copyAll}>{copied.all ? "✓ Copied!" : "Copy All as Text"}</VwBtn>
              <VwBtn variant="outline" onClick={downloadTxt}>Download .txt</VwBtn>
              <VwBtn variant="primary" onClick={handleClose}>Done</VwBtn>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
