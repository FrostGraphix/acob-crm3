import { pathToFileURL } from "node:url";
import { isMainThread } from "node:worker_threads";
import { createApp } from "./app.js";
import { analysisEngine } from "./services/analysis-engine.js";
import { customerFactEngine } from "./services/customer-fact-engine.js";
import { env } from "./services/env.js";
import { operationalPriorityEngine, revenueLeakageEngine } from "./services/priority-engines.js";
import { readRuntimeDiagnostics } from "./services/runtime-diagnostics.js";
import { walletReconciliationEngine } from "./services/wallet-reconciliation-engine.js";
import { siteConsumptionEngine } from "./services/site-consumption-engine.js";
import { checkSessionStoreHealth } from "./services/session-store.js";
import { isSupabaseDbEnabled } from "./services/supabase-db.js";
import { checkUpstreamHealth } from "./services/upstream.js";

function isMainModule() {
  const entryPoint = process.argv[1];
  if (!entryPoint || !isMainThread) {
    return false;
  }

  return pathToFileURL(entryPoint).href === import.meta.url;
}

export function startBackgroundEngines() {
  if (env.enableAnalysisEngine) {
    analysisEngine.start();
  } else {
    // eslint-disable-next-line no-console
    console.info("Analysis engine is disabled. Set ENABLE_ANALYSIS_ENGINE=true to enable it.");
  }

  if (env.enableSiteConsumptionEngine) {
    siteConsumptionEngine.start();
  } else {
    // eslint-disable-next-line no-console
    console.info(
      "Site consumption engine is disabled. Set ENABLE_SITE_CONSUMPTION_ENGINE=true to enable it.",
    );
  }

  walletReconciliationEngine.start();

  if (isSupabaseDbEnabled()) {
    customerFactEngine.start();
    revenueLeakageEngine.start();
    operationalPriorityEngine.start();
  } else {
    // eslint-disable-next-line no-console
    console.info("Supabase DB is not configured. Customer fact and risk engines will remain idle.");
  }
}

export async function startServer() {
  const app = createApp();
  const runtime = readRuntimeDiagnostics();

  if (env.nodeEnv === "production" && env.sessionStoreMode === "memory") {
    // eslint-disable-next-line no-console
    console.warn("SESSION_STORE_MODE=memory is not recommended for production.");
  }

  if (env.strictDependencyStartup) {
    const [upstream, sessionStore] = await Promise.all([
      checkUpstreamHealth(),
      checkSessionStoreHealth(),
    ]);

    if (!upstream.ok || !sessionStore.ok) {
      // eslint-disable-next-line no-console
      console.error("Startup dependency check failed", {
        upstream,
        sessionStore,
      });
      process.exit(1);
      return;
    }
  }

  startBackgroundEngines();

  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Beverly backend listening on http://localhost:${env.port}`);
    // eslint-disable-next-line no-console
    console.log("Runtime diagnostics", runtime);
  });
}

if (isMainModule()) {
  void startServer();
}
