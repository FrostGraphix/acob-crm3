import { useEffect, useState } from "react";
import {
  loadRuntimeEngines,
  runRuntimeEngine,
  startRuntimeEngine,
  stopRuntimeEngine,
} from "../services/api";
import type { RuntimeEngineCollection, RuntimeEngineStatus } from "../types";

type EngineKey = "analysis" | "site-consumption";

const POLL_INTERVAL_MS = 10_000;

function formatTimestamp(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not yet";
}

function RuntimeEngineCard({
  engineKey,
  status,
  busyAction,
  onAction,
}: {
  engineKey: EngineKey;
  status: RuntimeEngineStatus;
  busyAction: string | null;
  onAction: (engine: EngineKey, action: "start" | "stop" | "run") => void;
}) {
  return (
    <article className="runtime-engine-card">
      <div className="runtime-engine-card__header">
        <div>
          <p className="runtime-engine-card__eyebrow">{status.name}</p>
          <h2 className="runtime-engine-card__title">{status.enabledByConfig ? "Enabled" : "Disabled by Env"}</h2>
        </div>
        <span className={`runtime-engine-badge ${status.leader.isLeader ? "is-leader" : ""}`}>
          {status.leader.isLeader ? "Leader" : "Follower"}
        </span>
      </div>

      <div className="runtime-engine-grid">
        <div>
          <span className="runtime-engine-label">Scheduler</span>
          <strong>{status.schedulerRunning ? "Running" : "Stopped"}</strong>
        </div>
        <div>
          <span className="runtime-engine-label">Coordination</span>
          <strong>{status.leader.coordinationMode}</strong>
        </div>
        <div>
          <span className="runtime-engine-label">Last Start</span>
          <strong>{formatTimestamp(status.lastRunStartedAt)}</strong>
        </div>
        <div>
          <span className="runtime-engine-label">Last Complete</span>
          <strong>{formatTimestamp(status.lastRunCompletedAt)}</strong>
        </div>
        <div>
          <span className="runtime-engine-label">Duration</span>
          <strong>{status.lastRunDurationMs ? `${status.lastRunDurationMs} ms` : "N/A"}</strong>
        </div>
        <div>
          <span className="runtime-engine-label">Lease Key</span>
          <strong>{status.leader.leaseKey}</strong>
        </div>
      </div>

      {status.sourceWindow ? (
        <p className="runtime-engine-note">
          Source Window: {status.sourceWindow.fromDate} to {status.sourceWindow.toDate}
        </p>
      ) : null}
      {status.lastError ? <p className="status-banner status-banner-error">{status.lastError}</p> : null}
      {status.leader.lastLeadershipError ? (
        <p className="status-banner status-banner-error">{status.leader.lastLeadershipError}</p>
      ) : null}

      <div className="runtime-engine-actions">
        <button
          className="button button-primary"
          disabled={busyAction !== null || status.schedulerRunning}
          onClick={() => onAction(engineKey, "start")}
          type="button"
        >
          Start Scheduler
        </button>
        <button
          className="button button-ghost"
          disabled={busyAction !== null || !status.schedulerRunning}
          onClick={() => onAction(engineKey, "stop")}
          type="button"
        >
          Stop Scheduler
        </button>
        <button
          className="button button-outline"
          disabled={busyAction !== null}
          onClick={() => onAction(engineKey, "run")}
          type="button"
        >
          Run Now
        </button>
      </div>
    </article>
  );
}

export function RuntimeAdminPage() {
  const [engines, setEngines] = useState<RuntimeEngineCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const hydrate = async () => {
    try {
      const result = await loadRuntimeEngines();
      setEngines(result.engines);
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load runtime engines");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void hydrate();
    const timer = setInterval(() => {
      void hydrate();
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const handleAction = async (engine: EngineKey, action: "start" | "stop" | "run") => {
    setBusyAction(`${engine}:${action}`);
    setFeedback(null);
    setError(null);

    try {
      if (action === "start") {
        await startRuntimeEngine(engine);
        setFeedback(`Started scheduler for ${engine}.`);
      } else if (action === "stop") {
        await stopRuntimeEngine(engine);
        setFeedback(`Stopped scheduler for ${engine}.`);
      } else {
        await runRuntimeEngine(engine);
        setFeedback(`Triggered ${engine} on the active leader.`);
      }

      await hydrate();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Runtime action failed");
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <section className="runtime-admin-page page-stack">
      <header className="runtime-admin-hero">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 className="runtime-admin-title">Background Runtime Control</h1>
          <p className="runtime-admin-copy">
            Monitor scheduler leadership, inspect run history, and control engine execution from the app shell.
          </p>
        </div>
        <button className="button button-ghost" onClick={() => void hydrate()} type="button">
          Refresh Status
        </button>
      </header>

      {feedback ? <p className="status-banner">{feedback}</p> : null}
      {error ? <p className="status-banner status-banner-error">{error}</p> : null}

      {loading && !engines ? (
        <div className="toolbar-panel">Loading runtime engine status...</div>
      ) : null}

      {engines ? (
        <div className="runtime-admin-grid">
          <RuntimeEngineCard
            busyAction={busyAction}
            engineKey="analysis"
            onAction={handleAction}
            status={engines.analysis}
          />
          <RuntimeEngineCard
            busyAction={busyAction}
            engineKey="site-consumption"
            onAction={handleAction}
            status={engines.siteConsumption}
          />
        </div>
      ) : null}
    </section>
  );
}
