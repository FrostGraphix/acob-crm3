import { useState, type CSSProperties, type FormEvent } from "react";
import { request } from "../../services/api";
import {
  VwBtn,
  VwConfirmTable,
  VwInfoBox,
  VwStepBar,
} from "./VendorPortalPrimitives.tsx";

const SITE_OPTIONS = [
  { value: "MUSHA", label: "MUSHA" },
  { value: "KYAKALE", label: "KYAKALE" },
  { value: "UMAISHA", label: "UMAISHA" },
  { value: "TUNGA", label: "TUNGA" },
  { value: "OGUFA", label: "OGUFA" },
];

const ROLE_OPTIONS = [
  { value: "vendor_user", label: "Vendor Agent", description: "Can vend, view own transactions, and request top-ups." },
  { value: "vendor_manager", label: "Vendor Manager", description: "All agent permissions plus team visibility and escalation rights." },
];

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

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
}

function SiteRegistryModal({
  assignedSites,
  fieldInput,
  onAddAssignedSite,
  onClose,
  onRemoveAssignedSite,
  onSiteDraftChange,
  siteDraft,
}: {
  assignedSites: string[];
  fieldInput: CSSProperties;
  onAddAssignedSite: (value: string) => void;
  onClose: () => void;
  onRemoveAssignedSite: (value: string) => void;
  onSiteDraftChange: (value: string) => void;
  siteDraft: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(1, 21, 8, 0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        borderRadius: 24,
        zIndex: 2,
      }}
    >
      <div
        style={{
          width: "min(560px, 100%)",
          background: "var(--vw-surface)",
          border: "1px solid var(--vw-border)",
          borderRadius: 18,
          boxShadow: "0 24px 60px rgba(2, 31, 13, 0.16)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--vw-border)",
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--vw-text)" }}>
              Register Assigned Site / Site ID
            </div>
            <div style={{ fontSize: 12, color: "var(--vw-muted)", marginTop: 4 }}>
              Use the 5 CRM site IDs below or add more custom site IDs for this vendor.
            </div>
          </div>
          <button className="vw-modal__close" onClick={onClose} type="button">x</button>
        </div>

        <div style={{ padding: 22, display: "grid", gap: 16 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {SITE_OPTIONS.map((option) => {
              const active = assignedSites.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onAddAssignedSite(option.value)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: `1px solid ${active ? "var(--vw-primary)" : "var(--vw-border)"}`,
                    background: active ? "var(--vw-primary-light)" : "var(--vw-surface)",
                    color: active ? "var(--vw-primary)" : "var(--vw-text-mid)",
                    fontFamily: "var(--vw-font)",
                    fontSize: 12,
                    fontWeight: active ? 700 : 500,
                    cursor: "pointer",
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
            <input
              style={fieldInput}
              type="text"
              value={siteDraft}
              onChange={(event) => onSiteDraftChange(event.target.value)}
              placeholder="Add custom site ID"
            />
            <VwBtn variant="outline" onClick={() => onAddAssignedSite(siteDraft)}>Add Site</VwBtn>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {assignedSites.map((site) => (
              <span
                key={site}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 10px",
                  borderRadius: 999,
                  background: "var(--vw-surface2)",
                  border: "1px solid var(--vw-border)",
                  fontSize: 11,
                  fontFamily: "var(--vw-mono)",
                  color: "var(--vw-text)",
                }}
              >
                {site}
                {assignedSites.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => onRemoveAssignedSite(site)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--vw-muted)",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    x
                  </button>
                ) : null}
              </span>
            ))}
          </div>

          <VwInfoBox type="lemon">
            One assigned site becomes the primary site for login defaults, but the vendor can still operate across all registered site IDs.
          </VwInfoBox>
        </div>

        <div className="vw-modal__footer" style={{ borderTop: "1px solid var(--vw-border)" }}>
          <VwBtn variant="ghost" onClick={onClose}>Close</VwBtn>
          <VwBtn variant="primary" onClick={onClose}>Use Selected Sites</VwBtn>
        </div>
      </div>
    </div>
  );
}

export function CreateVendorAccountModal({ onClose, onVendorCreated }: Props) {
  const [step, setStep] = useState<ModalStep>("identity");
  const [businessName, setBusinessName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [cacNumber, setCacNumber] = useState("");
  const [tin, setTin] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [siteCode, setSiteCode] = useState(SITE_OPTIONS[0]?.value ?? "");
  const [assignedSites, setAssignedSites] = useState<string[]>([SITE_OPTIONS[0]?.value ?? ""]);
  const [siteDraft, setSiteDraft] = useState("");
  const [dailyLimit, setDailyLimit] = useState("500000");
  const [perTransactionLimit, setPerTransactionLimit] = useState("100000");
  const [commissionRule, setCommissionRule] = useState("standard");
  const [riskClassification, setRiskClassification] = useState("low");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"vendor_user" | "vendor_manager">("vendor_user");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [deliveryMode, setDeliveryMode] = useState("screen");
  const [showSiteRegistry, setShowSiteRegistry] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [copied, setCopied] = useState<Record<string, boolean>>({});

  const fieldInput: CSSProperties = {
    width: "100%",
    padding: "9px 13px",
    borderRadius: 8,
    border: "1px solid var(--vw-border2)",
    fontFamily: "var(--vw-font)",
    fontSize: 13,
    background: "var(--vw-surface)",
    color: "var(--vw-text)",
  };

  const stepIndex = step === "identity" ? 0 : step === "limits" ? 1 : 2;

  const handleClose = () => {
    setResult(null);
    setCopied({});
    setShowSiteRegistry(false);
    onClose();
  };

  const suggestUsername = () => {
    if (businessName.trim()) {
      setUsername(`${slugify(businessName.trim())}_${Math.floor(Math.random() * 900 + 100)}`);
    }
  };

  const addAssignedSite = (value: string) => {
    const normalized = value.trim().toUpperCase();
    if (!normalized) return;
    setAssignedSites((current) => (current.includes(normalized) ? current : [...current, normalized]));
    if (!siteCode) {
      setSiteCode(normalized);
    }
    setSiteDraft("");
  };

  const removeAssignedSite = (value: string) => {
    setAssignedSites((current) => {
      const next = current.filter((entry) => entry !== value);
      if (siteCode === value) {
        setSiteCode(next[0] ?? "");
      }
      return next.length > 0 ? next : current;
    });
  };

  const copyToClipboard = (key: string, value: string) => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => setCopied((prev) => ({ ...prev, [key]: false })), 2000);
    });
  };

  const copyAll = () => {
    if (!result) return;
    copyToClipboard(
      "all",
      [
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
      ].join("\n"),
    );
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

  const handleIdentitySubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!businessName.trim() || !contactName.trim() || !contactPhone.trim()) {
      return;
    }
    setError(null);
    setStep("limits");
  };

  const handleLimitsSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!siteCode || assignedSites.length === 0 || !dailyLimit.trim() || !perTransactionLimit.trim()) {
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
          loginIdentifier: contactEmail.trim() || contactPhone.trim(),
          temporaryPassword: temporaryPassword.trim() || undefined,
          siteCode: siteCode.toUpperCase(),
          assignedSites,
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
          contactEmail: contactEmail.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          cacNumber: cacNumber.trim() || undefined,
          tin: tin.trim() || undefined,
          businessAddress: businessAddress.trim() || undefined,
          siteCode: siteCode.toUpperCase(),
          assignedSites,
          dailyPurchaseLimit: Number(dailyLimit) || undefined,
          perTransactionLimit: Number(perTransactionLimit) || undefined,
          commissionRule,
          riskClassification,
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

  return (
    <div className="vw-modal-overlay" role="dialog" aria-modal="true">
      <div className="vw-modal vw-modal--lg" style={{ position: "relative" }}>
        <div className="vw-modal__header">
          <div>
            <div className="vw-modal__title">
              {step === "identity" && "Create Vendor Account"}
              {step === "limits" && "Site & Limits"}
              {step === "credentials" && "Credentials"}
              {step === "confirm" && "Vendor Account Ready"}
            </div>
            {step !== "confirm" ? (
              <div className="vw-modal__subtitle">
                Step {stepIndex + 1} of 3 — {step === "identity" ? "Vendor Details" : step === "limits" ? "Site & Limits" : "Credentials"}
              </div>
            ) : null}
          </div>
          <button className="vw-modal__close" onClick={handleClose} type="button">x</button>
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
                  <input style={fieldInput} type="text" required placeholder="e.g. Bright Future Electrical" value={businessName} onChange={(event) => setBusinessName(event.target.value)} />
                </div>
                <div className="vw-field">
                  <label className="vw-field__label">Primary phone *</label>
                  <input style={fieldInput} type="tel" required placeholder="08012345678" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} />
                </div>
                <div className="vw-field">
                  <label className="vw-field__label">Email address</label>
                  <input style={fieldInput} type="email" placeholder="accounts@vendor.ng" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
                </div>
                <div className="vw-field">
                  <label className="vw-field__label">Contact person name *</label>
                  <input style={fieldInput} type="text" required placeholder="Full legal name" value={contactName} onChange={(event) => setContactName(event.target.value)} />
                </div>
                <div className="vw-field">
                  <label className="vw-field__label">Display name</label>
                  <input style={fieldInput} type="text" placeholder="Optional short display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                </div>
                <div className="vw-field">
                  <label className="vw-field__label">CAC registration number *</label>
                  <input style={fieldInput} type="text" required placeholder="RC-0000000" value={cacNumber} onChange={(event) => setCacNumber(event.target.value)} />
                </div>
                <div className="vw-field">
                  <label className="vw-field__label">Tax ID (TIN)</label>
                  <input style={fieldInput} type="text" placeholder="12345678-0001" value={tin} onChange={(event) => setTin(event.target.value)} />
                </div>
                <div className="vw-field" style={{ gridColumn: "1 / -1" }}>
                  <label className="vw-field__label">Business address</label>
                  <input style={fieldInput} type="text" placeholder="Street, City, State" value={businessAddress} onChange={(event) => setBusinessAddress(event.target.value)} />
                </div>
              </div>
            </div>
            <div className="vw-modal__footer">
              <VwBtn variant="ghost" onClick={handleClose}>Cancel</VwBtn>
              <VwBtn variant="primary" type="submit">Next</VwBtn>
            </div>
          </form>
        ) : null}

        {step === "limits" ? (
          <form onSubmit={handleLimitsSubmit}>
            <div className="vw-modal__body">
              <div className="vw-field">
                <label className="vw-field__label">Primary assigned site *</label>
                <select style={fieldInput} required value={siteCode} onChange={(event) => setSiteCode(event.target.value)}>
                  {assignedSites.map((site) => (
                    <option key={site} value={site}>
                      {SITE_OPTIONS.find((option) => option.value === site)?.label ?? site}
                    </option>
                  ))}
                </select>
              </div>

              <div className="vw-field">
                <label className="vw-field__label">Assigned sites / site IDs</label>
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 11, color: "var(--vw-muted)", lineHeight: 1.6 }}>
                      Register site IDs from CRM or attach more custom site IDs for this vendor.
                    </div>
                    <VwBtn variant="outline" size="sm" onClick={() => setShowSiteRegistry(true)}>
                      Register Site IDs
                    </VwBtn>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {assignedSites.map((site) => (
                      <span
                        key={site}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "4px 10px",
                          borderRadius: 20,
                          background: "var(--vw-surface2)",
                          border: "1px solid var(--vw-border)",
                          fontSize: 11,
                          fontFamily: "var(--vw-mono)",
                          color: "var(--vw-text)",
                        }}
                      >
                        {site}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="vw-field">
                  <label className="vw-field__label">Daily purchase limit (NGN)</label>
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

              <div className="vw-field">
                <label className="vw-field__label">Risk classification</label>
                <select style={fieldInput} value={riskClassification} onChange={(event) => setRiskClassification(event.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <VwInfoBox type="lemon">
                Commission is wired from day one at 0.00%. Finance activates the live rate later without changing the vendor creation flow.
              </VwInfoBox>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {[
                  ["Assigned Sites", String(assignedSites.length)],
                  ["Daily Limit", Number(dailyLimit) > 0 ? `₦${Number(dailyLimit).toLocaleString("en-NG")}` : "--"],
                  ["Per Transaction", Number(perTransactionLimit) > 0 ? `₦${Number(perTransactionLimit).toLocaleString("en-NG")}` : "--"],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: "var(--vw-bg)", border: "1px solid var(--vw-border)", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, color: "var(--vw-muted)", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--vw-text)" }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="vw-modal__footer">
              <VwBtn variant="outline" onClick={() => setStep("identity")}>Back</VwBtn>
              <VwBtn variant="primary" type="submit">Next</VwBtn>
            </div>
          </form>
        ) : null}

        {step === "credentials" ? (
          <form onSubmit={handleCredentialsSubmit}>
            <div className="vw-modal__body">
              <div style={{ background: "var(--vw-success-bg)", border: "1px solid #b7dfc8", borderRadius: 12, padding: 18, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--vw-success-text)", marginBottom: 10 }}>
                  Credentials will be generated automatically on creation
                </div>
                <VwConfirmTable
                  rows={[
                    { key: "Primary site", value: SITE_OPTIONS.find((option) => option.value === siteCode)?.label ?? siteCode },
                    { key: "Assigned sites", value: assignedSites.join(", "), mono: true },
                    { key: "Daily limit", value: dailyLimit, mono: true },
                    { key: "Per transaction", value: perTransactionLimit, mono: true },
                    { key: "Password expiry", value: "72 hours - must change on first login" },
                  ]}
                />
              </div>

              <div className="vw-field">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label className="vw-field__label">Username *</label>
                  <button
                    type="button"
                    onClick={suggestUsername}
                    style={{
                      fontSize: 11,
                      color: "var(--vw-primary)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
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
                  <option value="email">Email to registered address</option>
                  <option value="screen">Display on screen</option>
                </select>
              </div>

              <VwInfoBox type="warning">
                Vendor must change the temporary password on first login before any wallet operation is permitted.
              </VwInfoBox>

              <div style={{ background: "var(--vw-bg)", border: "1px solid var(--vw-border)", borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 11, color: "var(--vw-muted)", marginBottom: 8 }}>Credential Preview</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {[
                    ["Username", username || "Auto-generated"],
                    ["Login ID", contactEmail.trim() || contactPhone.trim() || "--"],
                    ["Role", ROLE_OPTIONS.find((item) => item.value === role)?.label ?? role],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ fontSize: 12, color: "var(--vw-muted)" }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--vw-text)" }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {error ? <VwInfoBox type="danger">{error}</VwInfoBox> : null}
            </div>
            <div className="vw-modal__footer">
              <VwBtn variant="outline" onClick={() => setStep("limits")}>Back</VwBtn>
              <VwBtn variant="primary" type="submit" disabled={loading || !username.trim()}>
                {loading ? "Creating..." : "Create Account & Send Credentials"}
              </VwBtn>
            </div>
          </form>
        ) : null}

        {step === "confirm" && result ? (
          <>
            <div className="vw-modal__body">
              <div
                style={{
                  background: "linear-gradient(135deg, var(--vw-sidebar-bg), #013b18)",
                  borderRadius: 14,
                  padding: "22px 20px",
                  textAlign: "center",
                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "rgba(74,222,128,0.15)",
                    border: "1px solid rgba(74,222,128,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 12px",
                  }}
                >
                  <svg width="22" height="22" fill="none" stroke="#4ade80" strokeWidth="3" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>
                  Account Created for {result.businessName}
                </div>
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
                    {copied[item.field] ? `Copied ${item.label}` : `Copy ${item.label}`}
                  </button>
                ))}
              </div>

              <VwInfoBox type="warning">
                This is the only time the password will be shown. Copy or download it now.
              </VwInfoBox>
            </div>
            <div className="vw-modal__footer">
              <VwBtn variant="ghost" onClick={copyAll}>{copied.all ? "Copied" : "Copy All as Text"}</VwBtn>
              <VwBtn variant="outline" onClick={downloadTxt}>Download .txt</VwBtn>
              <VwBtn variant="primary" onClick={handleClose}>Done</VwBtn>
            </div>
          </>
        ) : null}

        {showSiteRegistry ? (
          <SiteRegistryModal
            assignedSites={assignedSites}
            fieldInput={fieldInput}
            onAddAssignedSite={addAssignedSite}
            onClose={() => setShowSiteRegistry(false)}
            onRemoveAssignedSite={removeAssignedSite}
            onSiteDraftChange={setSiteDraft}
            siteDraft={siteDraft}
          />
        ) : null}
      </div>
    </div>
  );
}
