import { useState, type FormEvent } from "react";
import { useAuth } from "../hooks/useAuth";

interface LoginPageProps {
  onSuccess: () => void;
}

export function LoginPage({ onSuccess }: LoginPageProps) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login({ username, password });
      onSuccess();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { num: 1, text: "Verify your secure credentials", active: true },
    { num: 2, text: "Access your energy workspace", active: false },
    { num: 3, text: "Monitor & manage meter operations", active: false },
  ];

  return (
    <div className="login-portal">
      {/* Ambient glow orbs */}
      <div className="login-orb login-orb--green" />
      <div className="login-orb login-orb--gold" />

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
              <span className="login-brand-name">ACOB <strong>Workspace</strong></span>
            </div>

            <h2 className="login-welcome">Welcome Back</h2>
            <p className="login-branding-subtitle">
              Sign in to access your secure portal and manage your energy infrastructure.
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
            <h1 className="login-card-title">Sign In</h1>
            <p className="login-card-subtitle">Enter your credentials below to continue.</p>

            <form className="login-form" onSubmit={handleSubmit}>
              <div className="login-field-group">
                <label className="login-label" htmlFor="login-username">USERNAME</label>
                <div className="login-input-wrap">
                  <input
                    autoComplete="username"
                    id="login-username"
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    value={username}
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
                    onChange={(e) => setPassword(e.target.value)}
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
                disabled={loading || !username || !password}
                type="submit"
              >
                {loading ? (
                  <>
                    <span className="login-spinner" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </>
                )}
              </button>
            </form>

            <p className="login-security-note">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Protected by 256-bit SSL encryption
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
