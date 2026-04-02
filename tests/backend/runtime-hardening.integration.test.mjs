import assert from "node:assert/strict";
import test from "node:test";
import { Worker } from "node:worker_threads";

function runWorkerProbe(script) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(script, { eval: true });

    worker.once("message", (message) => {
      resolve(message);
    });

    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Worker exited with code ${code}`));
      }
    });
  });
}

function createProbeScript(body) {
  return `
    const { parentPort } = require("node:worker_threads");
    console.log = () => {};
    console.info = () => {};
    console.warn = () => {};
    console.error = () => {};

    (async () => {
      try {
        ${body}
        parentPort.postMessage({ ok: true });
      } catch (error) {
        parentPort.postMessage({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  `;
}

test("env import fails fast when JWT secret is missing outside test", async () => {
  const message = await runWorkerProbe(
    createProbeScript(`
      process.env.NODE_ENV = "production";
      process.env.JWT_SECRET = "";

      let failedAsExpected = false;
      try {
        await import("./dist/backend/src/services/env.js?probe=missing-secret");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("JWT_SECRET")) {
          failedAsExpected = true;
        } else {
          throw error;
        }
      }

      if (!failedAsExpected) {
        throw new Error("Expected JWT_SECRET validation to fail");
      }
    `),
  );

  assert.equal(message.ok, true, message.error);
});

test("env import fails fast when runtime state store resolves to file in production", async () => {
  const message = await runWorkerProbe(
    createProbeScript(`
      process.env.NODE_ENV = "production";
      process.env.JWT_SECRET = "runtime-hardening-test-secret";
      process.env.RUNTIME_STATE_STORE_MODE = "file";

      let failedAsExpected = false;
      try {
        await import("./dist/backend/src/services/env.js?probe=file-runtime-state");
      } catch (error) {
        const failure = error instanceof Error ? error.message : String(error);
        if (failure.includes("RUNTIME_STATE_STORE_MODE")) {
          failedAsExpected = true;
        } else {
          throw error;
        }
      }

      if (!failedAsExpected) {
        throw new Error("Expected runtime state store validation to fail");
      }
    `),
  );

  assert.equal(message.ok, true, message.error);
});

test("background engines stay disabled unless explicitly enabled", async () => {
  const message = await runWorkerProbe(
    createProbeScript(`
      process.env.NODE_ENV = "production";
      process.env.JWT_SECRET = "runtime-hardening-test-secret";
      process.env.RUNTIME_STATE_STORE_MODE = "redis";
      process.env.SCHEDULER_COORDINATION_MODE = "redis";
      process.env.REDIS_URL = "redis://127.0.0.1:1";
      process.env.REDIS_CONNECT_TIMEOUT_MS = "50";
      process.env.ENABLE_ANALYSIS_ENGINE = "false";
      process.env.ENABLE_SITE_CONSUMPTION_ENGINE = "false";

      const analysisModule = await import("./dist/backend/src/services/analysis-engine.js");
      const siteModule = await import("./dist/backend/src/services/site-consumption-engine.js");

      let analysisStarts = 0;
      let siteStarts = 0;

      analysisModule.analysisEngine.start = () => {
        analysisStarts += 1;
      };

      siteModule.siteConsumptionEngine.start = () => {
        siteStarts += 1;
      };

      const { startBackgroundEngines } = await import("./dist/backend/src/index.js?probe=index-disabled");
      startBackgroundEngines();

      if (analysisStarts !== 0 || siteStarts !== 0) {
        throw new Error(\`Unexpected background start counts: analysis=\${analysisStarts}, site=\${siteStarts}\`);
      }
    `),
  );

  assert.equal(message.ok, true, message.error);
});

test("background engines start only when their flags are enabled", async () => {
  const message = await runWorkerProbe(
    createProbeScript(`
      process.env.NODE_ENV = "production";
      process.env.JWT_SECRET = "runtime-hardening-test-secret";
      process.env.RUNTIME_STATE_STORE_MODE = "redis";
      process.env.SCHEDULER_COORDINATION_MODE = "redis";
      process.env.REDIS_URL = "redis://127.0.0.1:1";
      process.env.REDIS_CONNECT_TIMEOUT_MS = "50";
      process.env.ENABLE_ANALYSIS_ENGINE = "true";
      process.env.ENABLE_SITE_CONSUMPTION_ENGINE = "true";

      const analysisModule = await import("./dist/backend/src/services/analysis-engine.js");
      const siteModule = await import("./dist/backend/src/services/site-consumption-engine.js");

      let analysisStarts = 0;
      let siteStarts = 0;

      analysisModule.analysisEngine.start = () => {
        analysisStarts += 1;
      };

      siteModule.siteConsumptionEngine.start = () => {
        siteStarts += 1;
      };

      const { startBackgroundEngines } = await import("./dist/backend/src/index.js?probe=index-enabled");
      startBackgroundEngines();

      if (analysisStarts !== 1 || siteStarts !== 1) {
        throw new Error(\`Expected both engines to start once, got analysis=\${analysisStarts}, site=\${siteStarts}\`);
      }
    `),
  );

  assert.equal(message.ok, true, message.error);
});

test("rate limit ignores forwarded headers unless explicitly trusted", async () => {
  const message = await runWorkerProbe(
    createProbeScript(`
      process.env.NODE_ENV = "production";
      process.env.JWT_SECRET = "runtime-hardening-test-secret";
      process.env.RUNTIME_STATE_STORE_MODE = "redis";
      process.env.SCHEDULER_COORDINATION_MODE = "redis";
      process.env.REDIS_URL = "redis://127.0.0.1:1";
      process.env.REDIS_CONNECT_TIMEOUT_MS = "50";
      process.env.RATE_LIMIT_WINDOW_MS = "60000";
      process.env.RATE_LIMIT_MAX_REQUESTS_PER_WINDOW = "1";
      process.env.RATE_LIMIT_TRUST_FORWARDED_FOR = "false";

      const { rateLimitMiddleware } = await import("./dist/backend/src/middleware/rate-limit.js?probe=rate-limit");

      function createResponse() {
        let statusCode = 0;
        let payload = null;

        return {
          status(code) {
            statusCode = code;
            return this;
          },
          json(body) {
            payload = body;
            return this;
          },
          getStatus() {
            return statusCode;
          },
          getPayload() {
            return payload;
          },
        };
      }

      const firstRequest = {
        headers: { "x-forwarded-for": "203.0.113.1" },
        ip: "127.0.0.1",
      };
      const secondRequest = {
        headers: { "x-forwarded-for": "198.51.100.2" },
        ip: "127.0.0.1",
      };

      let firstCalled = false;
      const firstResponse = createResponse();
      rateLimitMiddleware(firstRequest, firstResponse, () => {
        firstCalled = true;
      });

      let secondCalled = false;
      const secondResponse = createResponse();
      rateLimitMiddleware(secondRequest, secondResponse, () => {
        secondCalled = true;
      });

      if (
        !firstCalled ||
        secondCalled ||
        secondResponse.getStatus() !== 429 ||
        secondResponse.getPayload()?.reason !== "Too many requests"
      ) {
        throw new Error("Rate limit safety behavior did not match expectations");
      }
    `),
  );

  assert.equal(message.ok, true, message.error);
});
