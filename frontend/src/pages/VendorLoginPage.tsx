import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Modal } from "../components/ui/Modal";

interface VendorAccessState {
  title: string;
  detail: string;
  tone: "danger" | "warning";
}

function classifyVendorAccessState(message: string): VendorAccessState | null {
  const normalized = message.toLowerCase();
  if (normalized.includes("suspended")) {
    return {
      title: "Account Suspended",
      detail: message,
      tone: "danger",
    };
  }

  if (normalized.includes("rejected")) {
    return {
      title: "Application Rejected",
      detail: message,
      tone: "warning",
    };
  }

  return null;
}

export function VendorLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessState, setAccessState] = useState<VendorAccessState | null>(null);
  const [activeModal, setActiveModal] = useState<"first-access" | "help" | null>(null);

  const normalizedUsername = useMemo(() => username.trim(), [username]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!normalizedUsername || !password) return;

    setLoading(true);
    setError(null);
    setAccessState(null);

    try {
      const user = await login({ username: normalizedUsername, password, portal: "vendor" });

      // Forced password change gate
      if (user.forcePasswordChange) {
        navigate("/vendor/change-password", { replace: true });
        return;
      }

      // Status gates are enforced server-side; surface any status message
      navigate("/vendor/dashboard", { replace: true });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Login failed";
      const vendorAccessState = classifyVendorAccessState(message);
      if (vendorAccessState) {
        setAccessState(vendorAccessState);
        setError(null);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { num: 1, text: "Verify vendor identity credentials", active: true },
    { num: 2, text: "Manage business identity & KYC", active: false },
    { num: 3, text: "Monitor payments & funding requests", active: false },
  ];

  return (
    <div className="login-portal login-portal--vendor">
      {/* Ambient glow orbs */}
      <div className="login-orb login-orb--green" />
      <div className="login-orb login-orb--amber" />

      <div className="login-container">
        {/* Left branding panel */}
        <div className="login-branding">
          <div className="login-branding-content">
            <div className="login-brand-row">
              <div className="login-brand-badge">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="login-brand-name">Beverly <strong>Vendor Network</strong></span>
            </div>

            <h2 className="login-welcome">Vendor Portal</h2>
            <p className="login-branding-subtitle">
              Sign in to manage your organization's energy service operations and billing.
            </p>

            <div className="login-steps">
              {steps.map((step) => (
                <div className={`login-step ${step.active ? "login-step--active" : ""}`} key={step.num}>
                  <span className={`login-step-num ${step.active ? "login-step-num--active" : ""}`}>
                    {step.num}
                  </span>
                  <span className="login-step-text">{step.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right form card */}
        <div className="login-shell">
          <div className="login-card">
            <h1 className="login-card-title">Vendor Sign In</h1>
            <p className="login-card-subtitle">
              Enter your vendor credentials below to continue.
            </p>

            {accessState ? (
              <div className={`login-status-card login-status-card--${accessState.tone}`}>
                <h2 className="login-status-card__title">{accessState.title}</h2>
                <p className="login-status-card__detail">{accessState.detail}</p>
                <p className="login-status-card__help">
                  Contact your Beverly administrator for access review or credential assistance.
                </p>
              </div>
            ) : null}

            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <div className="login-field-group">
                <label className="login-label" htmlFor="login-username">USERNAME OR LOGIN ID</label>
                <div className="login-input-wrap">
                  <input
                    autoComplete="username"
                    id="login-username"
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (accessState) {
                        setAccessState(null);
                      }
                    }}
                    placeholder="Enter your username or assigned login ID"
                    value={username}
                    autoFocus
                  />
                </div>
              </div>

              <div className="login-field-group">
                <div className="login-label-row">
                  <label className="login-label" htmlFor="login-password">PASSWORD</label>
                </div>
                <div className="login-input-wrap">
                  <input
                    autoComplete="current-password"
                    id="login-password"
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (accessState) {
                        setAccessState(null);
                      }
                    }}
                    placeholder="Enter your password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                  />
                  <button
                    className="login-eye-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    type="button"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="login-inline-actions">
                <button
                  className="login-link-button"
                  onClick={() => setActiveModal("first-access")}
                  type="button"
                >
                  First-time access
                </button>
                <button
                  className="login-link-button"
                  onClick={() => setActiveModal("help")}
                  type="button"
                >
                  Need help?
                </button>
              </div>

              {error ? (
                <div className="login-error">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span>{error}</span>
                </div>
              ) : null}

              <button
                className="login-submit"
                disabled={loading || !normalizedUsername || !password}
                type="submit"
              >
                {loading ? (
                  <>
                    <span className="login-spinner" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In to Portal
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </>
                )}
              </button>
            </form>

            <div className="login-application-note" style={{ marginTop: "1rem" }}>
              Use the username or login ID shared during onboarding. If this is your first sign-in,
              use the temporary password provided by Beverly and you will be taken to create a permanent
              password before wallet access is enabled.
            </div>

            <p className="login-security-note" style={{ marginTop: "2rem" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Protected by 256-bit SSL encryption
            </p>

            <div className="login-vendor-footer">
              <Link to="/login" className="login-vendor-link">
                Not a vendor?
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Staff login
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={activeModal === "first-access"}
        onClose={() => setActiveModal(null)}
        size="sm"
        title="First-Time Vendor Access"
        subtitle="Use your temporary credentials, then complete the password setup."
      >
        <div className="auth-help-modal">
          <ol className="auth-help-modal__steps">
            <li>Sign in with the username or login ID and temporary password shared by Beverly.</li>
            <li>After successful sign-in, you will be redirected to set a permanent password.</li>
            <li>Your temporary password expires after 72 hours, and wallet actions remain blocked until the change is complete.</li>
          </ol>
          <div className="auth-help-modal__notice">
            If your onboarding is still under review, suspended, or rejected, portal access will remain restricted.
          </div>
        </div>
      </Modal>

      <Modal
        open={activeModal === "help"}
        onClose={() => setActiveModal(null)}
        size="sm"
        title="Vendor Sign-In Help"
        subtitle="What to check before contacting support."
      >
        <div className="auth-help-modal">
          <ul className="auth-help-modal__steps auth-help-modal__steps--unordered">
            <li>Try both your assigned username and your login email if you were given both.</li>
            <li>Make sure you are using the vendor portal and not the staff login page.</li>
            <li>If your account was suspended or your application was rejected, only an Beverly administrator can restore access.</li>
          </ul>
          <div className="auth-help-modal__notice">
            For password resets or onboarding review, contact your Beverly administrator with your business name and assigned site.
          </div>
        </div>
      </Modal>
    </div>
  );
}
