import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { changeLoginPassword } from "../services/api";

interface PasswordRule {
  key: string;
  label: string;
  test: (pw: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
  { key: "len", label: "At least 12 characters", test: (pw) => pw.length >= 12 },
  { key: "upper", label: "One uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { key: "number", label: "One number", test: (pw) => /[0-9]/.test(pw) },
  { key: "symbol", label: "One symbol", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

function allRulesPass(pw: string) {
  return PASSWORD_RULES.every((r) => r.test(pw));
}

export function VendorChangePasswordPage() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    allRulesPass(newPassword) &&
    passwordsMatch &&
    !loading;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    try {
      await changeLoginPassword({
        oldPassword: currentPassword,
        newPassword,
        confirmPassword,
      });

      // Refresh the user — server should clear forcePasswordChange
      const user = await refreshUser();

      if (!user) {
        navigate("/vendor/login", { replace: true });
        return;
      }

      navigate("/vendor/dashboard", { replace: true });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to update password. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { num: 1, text: "Verify vendor identity credentials", active: false },
    { num: 2, text: "Set permanent password lock", active: true },
    { num: 3, text: "Access workspace", active: false },
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
              <span className="login-brand-name">ACOB <strong>Vendor Network</strong></span>
            </div>

            <h2 className="login-welcome">Secure Access</h2>
            <p className="login-branding-subtitle">
              Your account was created by an ACOB administrator. Please finalize your security setup to continue.
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
          <div className="login-card login-card--wide">
            <h1 className="login-card-title">Set Password</h1>
            <p className="login-card-subtitle">
              You must set a new secure password before you can continue.
            </p>

            <form className="login-form" onSubmit={handleSubmit} noValidate>
              {/* Current password */}
              <div className="login-field-group">
                <label className="login-label" htmlFor="login-current-password">
                  CURRENT (TEMPORARY) PASSWORD
                </label>
                <div className="login-input-wrap">
                  <input
                    id="login-current-password"
                    type={showCurrent ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Your temporary password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <button
                    className="login-eye-toggle"
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowCurrent((v) => !v)}
                    aria-label={showCurrent ? "Hide password" : "Show password"}
                  >
                    <EyeIcon open={showCurrent} />
                  </button>
                </div>
              </div>

              {/* New password */}
              <div className="login-field-group">
                <label className="login-label" htmlFor="login-new-password">
                  NEW PASSWORD
                </label>
                <div className="login-input-wrap">
                  <input
                    id="login-new-password"
                    type={showNew ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Choose a strong password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    className="login-eye-toggle"
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowNew((v) => !v)}
                    aria-label={showNew ? "Hide password" : "Show password"}
                  >
                    <EyeIcon open={showNew} />
                  </button>
                </div>

                {/* Strength checklist using mapped layout */}
                <ul className="vp-password-checklist" aria-live="polite">
                  {PASSWORD_RULES.map((rule) => {
                    const passes = rule.test(newPassword);
                    return (
                      <li
                        key={rule.key}
                        className={`vp-password-rule ${passes ? "vp-password-rule--pass" : ""}`}
                      >
                        <span className="vp-password-rule-icon">
                          {passes ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <circle cx="12" cy="12" r="9" />
                            </svg>
                          )}
                        </span>
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Confirm password */}
              <div className="login-field-group">
                <label className="login-label" htmlFor="login-confirm-password">
                  CONFIRM NEW PASSWORD
                </label>
                <div className="login-input-wrap">
                  <input
                    id="login-confirm-password"
                    style={{ borderColor: confirmPassword.length > 0 && !passwordsMatch ? "var(--error)" : undefined }}
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                {confirmPassword.length > 0 && !passwordsMatch ? (
                  <p className="vp-field-error" style={{ marginLeft: "0.25rem", color: "var(--error)", fontSize: "0.8rem", fontWeight: 500 }}>
                    Passwords do not match
                  </p>
                ) : null}
              </div>

              {error ? (
                <div className="login-error">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{error}</span>
                </div>
              ) : null}

              <button
                className="login-submit"
                type="submit"
                disabled={!canSubmit}
                style={{ marginTop: "1rem" }}
              >
                {loading ? (
                  <>
                    <span className="login-spinner" />
                    Setting password...
                  </>
                ) : (
                  <>
                    Set Password and Continue
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
