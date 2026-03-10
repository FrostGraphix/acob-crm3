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
    <div className="login-shell">
      <section className="login-panel">
        <p className="eyebrow">ACOB Platform</p>
        <h1>CRM3 replication workspace</h1>
        <p className="login-copy">
          Sign in to access dashboards, token operations, reports, and management
          modules from one unified interface.
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
          <button className="button button-primary" disabled={loading} type="submit">
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </div>
  );
}
