import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

let server;
let baseUrl;

test.before(async () => {
  const { createApp } = await import("../../backend/dist/backend/src/app.js");
  const app = createApp();
  server = app.listen(0);
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve test server port");
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (server) {
    server.close();
    await once(server, "close");
  }
});

test("protected API returns 401 without auth cookie", async () => {
  const response = await fetch(`${baseUrl}/api/customer/read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ pageNumber: 1, pageSize: 10 }),
  });

  assert.equal(response.status, 401);
});

test("login issues cookie and allows authenticated proxy calls", async () => {
  const loginResponse = await fetch(`${baseUrl}/api/user/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: "admin",
      password: "ACOB_admin",
    }),
  });

  assert.equal(loginResponse.status, 200);
  const setCookie = loginResponse.headers.get("set-cookie");
  assert.ok(setCookie);

  const readResponse = await fetch(`${baseUrl}/api/customer/read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: setCookie,
    },
    body: JSON.stringify({ pageNumber: 1, pageSize: 10 }),
  });

  assert.equal(readResponse.status, 200);
  const readPayload = await readResponse.json();
  assert.equal(readPayload.code, 0);
  assert.ok(Array.isArray(readPayload.result.rows));
});

test("authenticated create request mutates dataset", async () => {
  const loginResponse = await fetch(`${baseUrl}/api/user/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: "admin",
      password: "ACOB_admin",
    }),
  });
  const cookie = loginResponse.headers.get("set-cookie");
  assert.ok(cookie);

  const beforeResponse = await fetch(`${baseUrl}/api/customer/read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({ pageNumber: 1, pageSize: 20 }),
  });
  const beforePayload = await beforeResponse.json();
  const beforeTotal = beforePayload.result.total;

  const createResponse = await fetch(`${baseUrl}/api/customer/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({ name: "Proxy Integration User", remark: "integration-test" }),
  });
  assert.equal(createResponse.status, 200);

  const afterResponse = await fetch(`${baseUrl}/api/customer/read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({ pageNumber: 1, pageSize: 20 }),
  });
  const afterPayload = await afterResponse.json();
  assert.equal(afterPayload.result.total, beforeTotal + 1);
});
