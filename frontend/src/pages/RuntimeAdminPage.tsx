import { useEffect, useState } from "react";
import {
  loadCustomerForecasts,
  loadCustomerSegments,
  loadOperationalPriority,
  loadRevenueLeakage,
  loadRuntimeEngineCatalog,
  loadRuntimeEngines,
  runRuntimeEngine,
  startRuntimeEngine,
  stopRuntimeEngine,
} from "../services/api";
import type {
  CustomerForecastsResponse,
  CustomerSegmentsResponse,
  DataEngineCatalogEntry,
  OperationalPriorityResponse,
  RevenueLeakageResponse,
  RuntimeEngineCollection,
  RuntimeEngineStatus,
} from "../types";

type EngineKey =
  | "analysis"
  | "site-consumption"
  | "customer-facts"
  | "revenue-leakage"
  | "operational-priority";

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
      {status.theftMetrics ? (
        <div className="runtime-engine-grid">
          <div>
            <span className="runtime-engine-label">Active Signals</span>
            <strong>{status.theftMetrics.activeSignals}</strong>
          </div>
          <div>
            <span className="runtime-engine-label">Open Cases</span>
            <strong>{status.theftMetrics.openCases}</strong>
          </div>
          <div>
            <span className="runtime-engine-label">Critical Signals</span>
            <strong>{status.theftMetrics.criticalSignals}</strong>
          </div>
        </div>
      ) : null}
      {status.rowMetrics ? (
        <div className="runtime-engine-grid">
          <div>
            <span className="runtime-engine-label">Recharge Facts</span>
            <strong>{status.rowMetrics.rechargeFacts}</strong>
          </div>
          <div>
            <span className="runtime-engine-label">Consumption Facts</span>
            <strong>{status.rowMetrics.consumptionFacts}</strong>
          </div>
          <div>
            <span className="runtime-engine-label">Segments</span>
            <strong>{status.rowMetrics.segments}</strong>
          </div>
          <div>
            <span className="runtime-engine-label">Forecasts</span>
            <strong>{status.rowMetrics.forecasts}</strong>
          </div>
        </div>
      ) : null}
      {typeof status.rowCount === "number" ? (
        <p className="runtime-engine-note">Latest output rows: {status.rowCount}</p>
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

function RuntimePreviewTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<Record<string, string | number | null>>;
}) {
  const columns = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <article className="runtime-preview-card premium-card">
      <div className="runtime-engine-card__header">
        <div>
          <p className="runtime-engine-card__eyebrow">Preview</p>
          <h3 className="runtime-engine-card__title">{title}</h3>
        </div>
        <span className="runtime-engine-note">{rows.length} rows</span>
      </div>

      {rows.length === 0 ? (
        <p className="runtime-engine-note">No rows available yet.</p>
      ) : (
        <div className="runtime-preview-table-wrapper">
          <table className="runtime-preview-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${title}-${index}`}>
                  {columns.map((column) => (
                    <td key={column}>{String(row[column] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

export function RuntimeAdminPage() {
  const [engines, setEngines] = useState<RuntimeEngineCollection | null>(null);
  const [engineCatalog, setEngineCatalog] = useState<DataEngineCatalogEntry[]>([]);
  const [segments, setSegments] = useState<CustomerSegmentsResponse["rows"]>([]);
  const [forecasts, setForecasts] = useState<CustomerForecastsResponse["rows"]>([]);
  const [revenueLeakage, setRevenueLeakage] = useState<RevenueLeakageResponse["rows"]>([]);
  const [operationalPriority, setOperationalPriority] = useState<OperationalPriorityResponse["rows"]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const hydrate = async () => {
    try {
      const [runtimeResult, catalogResult] = await Promise.all([
        loadRuntimeEngines(),
        loadRuntimeEngineCatalog(),
      ]);
      const [segmentResult, forecastResult, leakageResult, priorityResult] = await Promise.all([
        loadCustomerSegments({ limit: 5 }),
        loadCustomerForecasts({ limit: 5 }),
        loadRevenueLeakage(),
        loadOperationalPriority(),
      ]);
      setEngines(runtimeResult.engines);
      setEngineCatalog(catalogResult.entries);
      setSegments(segmentResult.rows);
      setForecasts(forecastResult.rows);
      setRevenueLeakage(leakageResult.rows.slice(0, 5));
      setOperationalPriority(priorityResult.rows.slice(0, 5));
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
        <>
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
            <RuntimeEngineCard
              busyAction={busyAction}
              engineKey="customer-facts"
              onAction={handleAction}
              status={engines.customerFacts}
            />
            <RuntimeEngineCard
              busyAction={busyAction}
              engineKey="revenue-leakage"
              onAction={handleAction}
              status={engines.revenueLeakage}
            />
            <RuntimeEngineCard
              busyAction={busyAction}
              engineKey="operational-priority"
              onAction={handleAction}
              status={engines.operationalPriority}
            />
          </div>

          <div className="runtime-admin-grid">
            <RuntimePreviewTable
              title="Customer Segments"
              rows={segments.map((row) => ({
                meterId: row.meterId,
                segment: row.segment,
                recharge30d: row.totalRechargeAmount30d,
                avgUse7d: row.avgDailyConsumption7d,
              }))}
            />
            <RuntimePreviewTable
              title="Customer Forecasts"
              rows={forecasts.map((row) => ({
                meterId: row.meterId,
                avgUse7d: row.avgDailyConsumption7d,
                daysCovered: row.estimatedDaysCovered,
                nextRecharge: row.predictedNextRechargeDate,
              }))}
            />
            <RuntimePreviewTable
              title="Revenue Leakage"
              rows={revenueLeakage.map((row) => ({
                meterId: row.meterId,
                score: row.leakageScore,
                lossKwh: row.estimatedLossKwh,
                reason: row.reasons[0] ?? "",
              }))}
            />
            <RuntimePreviewTable
              title="Operational Priority"
              rows={operationalPriority.map((row) => ({
                meterId: row.meterId,
                score: row.priorityScore,
                action: row.recommendedAction,
                reason: row.reasons[0] ?? "",
              }))}
            />
          </div>

          <section className="toolbar-panel">
            <div className="runtime-engine-catalog__header">
              <div>
                <p className="eyebrow">Delivery Table</p>
                <h2 className="runtime-admin-title">Data Engine Roadmap</h2>
              </div>
              <span className="runtime-engine-note">{engineCatalog.length} engines</span>
            </div>

            <div className="runtime-engine-catalog">
              {engineCatalog.map((entry) => (
                <article key={entry.key} className="runtime-engine-catalog__card premium-card">
                  <div className="runtime-engine-card__header">
                    <div>
                      <p className="runtime-engine-card__eyebrow">{entry.category}</p>
                      <h3 className="runtime-engine-card__title">{entry.name}</h3>
                    </div>
                    <span className={`runtime-engine-badge ${entry.status === "implemented" ? "is-leader" : ""}`}>
                      {entry.status}
                    </span>
                  </div>

                  <div className="runtime-engine-catalog__meta">
                    <div>
                      <span className="runtime-engine-label">Endpoints</span>
                      <strong>{entry.endpointNames.join(", ")}</strong>
                    </div>
                    <div>
                      <span className="runtime-engine-label">Schedule</span>
                      <strong>{entry.workerSchedule}</strong>
                    </div>
                    <div>
                      <span className="runtime-engine-label">Refresh</span>
                      <strong>{entry.refreshInterval}</strong>
                    </div>
                    <div>
                      <span className="runtime-engine-label">Tables</span>
                      <strong>{entry.supabaseTables.join(", ")}</strong>
                    </div>
                  </div>

                  <div className="runtime-engine-catalog__stack">
                    <p className="runtime-engine-note">Formulas: {entry.formulas.join(" | ")}</p>
                    <p className="runtime-engine-note">Backend: {entry.backendServices.join(", ")}</p>
                    <p className="runtime-engine-note">Frontend: {entry.frontendPages.join(", ")}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}
