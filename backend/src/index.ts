import { createApp } from "./app.js";
import { env } from "./services/env.js";
import { checkSessionStoreHealth } from "./services/session-store.js";
import { checkUpstreamHealth } from "./services/upstream.js";
import { analysisEngine } from "./services/analysis-engine.js";

const app = createApp();

async function startServer() {
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

  analysisEngine.start();

  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`ACOB CRM3 backend listening on http://localhost:${env.port}`);
  });
}

void startServer();
