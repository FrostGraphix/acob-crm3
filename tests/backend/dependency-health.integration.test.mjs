import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";

let upstreamServer;
let server;
let baseUrl;

test.before(async () => {
  upstreamServer = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;

    if (pathname === "/") {
      response.writeHead(200, { "Content-Type": "text/plain" });
      response.end("ok");
      return;
    }

    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("not-found");
  });

  upstreamServer.listen(0);
  await once(upstreamServer, "listening");

  const upstreamAddress = upstreamServer.address();
  if (!upstreamAddress || typeof upstreamAddress === "string") {
    throw new Error("Failed to resolve upstream test server port");
  }

  process.env.NODE_ENV = "test";
  process.env.UPSTREAM_API_URL = `http://127.0.0.1:${upstreamAddress.port}`;
  process.env.SESSION_STORE_MODE = "memory";
  process.env.SUPABASE_AUTH_ENABLED = "false";
  process.env.SUPABASE_STORAGE_ENABLED = "false";

  const { createApp } = await import("../../backend/dist/backend/src/app.js");
  const app = createApp();

  server = app.listen(0);
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve backend test server port");
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (upstreamServer) {
    upstreamServer.close();
    await once(upstreamServer, "close");
  }

  if (server) {
    server.close();
    await once(server, "close");
  }
});

test("dependency health endpoint returns ok when upstream and session store are reachable", async () => {
  const response = await fetch(`${baseUrl}/health/dependencies`);
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.status, "ok");
  assert.equal(payload.dependencies.upstream.ok, true);
  assert.equal(payload.dependencies.sessionStore.ok, true);
});

