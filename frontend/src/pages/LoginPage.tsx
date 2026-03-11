import { useState, type FormEvent } from "react";
import { useAuth } from "../hooks/useAuth";

interface LoginPageProps {
  onSuccess: () => void;
}

export function LoginPage({ onSuccess }: LoginPageProps) {
  const { login } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("ACOB_admin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="login-portal">
      <div
        className="login-branding"
        style={{
          backgroundImage: `url('file:///C:/Users/ACOB/.gemini/antigravity/brain/fc3bd549-5767-44e0-bd45-e49cda0806a8/acob_login_branding_image_1773232435036.png')`,
        }}
      >
        <div className="login-branding-content">
          <div
            className="sidebar-brand-mark"
            style={{ width: "3.5rem", height: "3.5rem", fontSize: "1.5rem", marginBottom: "2rem" }}
          >
            A
          </div>
          <h2>
            Empowering <span>Sustainable</span> Energy Monitoring.
          </h2>
          <p style={{ fontSize: "1.2rem", opacity: 0.9, lineHeight: 1.6 }}>
            The ACOB Odyssey Platform provides real-time visibility and advanced control over your
            energy infrastructure, anywhere in the world.
          </p>

          <div className="login-branding-features">
            <div className="login-branding-feature">
              <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Remote Meter Analysis & Control</span>
            </div>
            <div className="login-branding-feature">
              <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Real-time Fault Detection</span>
            </div>
            <div className="login-branding-feature">
              <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Automated Revenue Reporting</span>
            </div>
          </div>
        </div>
      </div>

      <div className="login-shell">
        <section className="login-panel">
          <div style={{ marginBottom: "2rem" }}>
            <p className="eyebrow" style={{ color: "var(--acob-green)" }}>
              Welcome Back
            </p>
            <h1>Portal Sign-in</h1>
          </div>

          <p className="login-copy">
            Authenticate to access the ACOB Lighting CRM and energy management suite.
          </p>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Username</span>
              <input onChange={(event) => setUsername(event.target.value)} value={username} />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </label>
            {error ? <p className="status-banner status-banner-error">{error}</p> : null}
            <button
              className="button button-primary"
              disabled={loading}
              style={{ padding: "1rem", marginTop: "1rem" }}
              type="submit"
            >
              {loading ? "Establishing Secure Session..." : "Sign in to Dashboard"}
            </button>
          </form>

          <p
            style={{
              marginTop: "3rem",
              fontSize: "0.85rem",
              color: "var(--text-muted)",
              textAlign: "center",
            }}
          >
            &copy; 2026 ACOB Lighting Technology Ltd. All rights reserved.
          </p>
        </section>
      </div>
    </div>
  );
}
