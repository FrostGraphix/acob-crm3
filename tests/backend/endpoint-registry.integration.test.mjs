import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { resolveEndpointPolicy } from "../../backend/dist/backend/src/services/endpoint-registry.js";

function loadSwaggerPaths() {
  const filePath = path.resolve(process.cwd(), "..", "swagger_paths.txt");
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("/"));
}

test("endpoint registry resolves every documented upstream path", () => {
  const swaggerPaths = loadSwaggerPaths();

  for (const pathname of swaggerPaths) {
    assert.notEqual(resolveEndpointPolicy(pathname), null, pathname);
  }
});

test("endpoint registry classifies representative upstream paths", () => {
  const expectations = new Map([
    ["/api/account/create", "crud-create"],
    ["/api/DailyDataMeter/readMonthly", "drilldown"],
    ["/API/RemoteMeterTask/CreateSettingTask", "task-create"],
    ["/API/RemoteMeterTask/CreateTransparentForwardingTask", "task-create"],
    ["/API/RemoteMeterTask/GetSettingTask", "task-read"],
    ["/API/File/Upload", "import"],
    ["/api/token/setMaximumPowerLimitToken/generate", "token-generate"],
    ["/api/user/info", "read"],
    ["/api/user/updateInfo", "crud-update"],
    ["/api/user/modifyAuthorizationPassword", "crud-update"],
  ]);

  for (const [pathname, operation] of expectations) {
    assert.equal(resolveEndpointPolicy(pathname)?.operation, operation, pathname);
  }
});

test("removed modules no longer resolve through the endpoint registry", () => {
  const removedPaths = [
    "/api/DailyData/read",
    "/API/GPRSMeterTask/GPRSCreateReadingTask",
    "/API/GPRSOnlineStatus/Read",
    "/API/UpdateFirmwareTask/GetUpdateFirmwareTask",
    "/api/station/read",
    "/api/role/read",
    "/api/user/read",
    "/api/user/reset",
  ];

  for (const pathname of removedPaths) {
    assert.equal(resolveEndpointPolicy(pathname), null, pathname);
  }
});
