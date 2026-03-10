import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type OperationKind =
  | "read"
  | "crud-create"
  | "crud-update"
  | "crud-delete"
  | "import"
  | "export"
  | "token-generate"
  | "token-cancel"
  | "task-create"
  | "task-update"
  | "task-read"
  | "drilldown"
  | "generic";

export interface EndpointPolicy {
  pathname: string;
  operation: OperationKind;
}

const explicitPolicies = new Map<string, OperationKind>([
  ["/api/dashboard/readPanelGroup", "read"],
  ["/api/dashboard/readLineChart", "read"],
  ["/api/account/read", "read"],
  ["/api/account/create", "crud-create"],
  ["/api/account/update", "crud-update"],
  ["/api/account/delete", "crud-delete"],
  ["/api/account/import", "import"],
  ["/api/customer/read", "read"],
  ["/api/customer/create", "crud-create"],
  ["/api/customer/update", "crud-update"],
  ["/api/customer/delete", "crud-delete"],
  ["/api/customer/import", "import"],
  ["/api/tariff/read", "read"],
  ["/api/tariff/create", "crud-create"],
  ["/api/tariff/update", "crud-update"],
  ["/api/tariff/delete", "crud-delete"],
  ["/api/tariff/import", "import"],
  ["/api/gateway/read", "read"],
  ["/api/gateway/create", "crud-create"],
  ["/api/gateway/update", "crud-update"],
  ["/api/gateway/delete", "crud-delete"],
  ["/api/gateway/import", "import"],
  ["/api/meter/read", "read"],
  ["/api/token/creditToken/generate", "token-generate"],
  ["/api/token/clearTamperToken/generate", "token-generate"],
  ["/api/token/clearCreditToken/generate", "token-generate"],
  ["/api/token/setMaxPowerLimitToken/generate", "token-generate"],
  ["/api/token/creditTokenRecord/read", "read"],
  ["/api/token/clearTamperTokenRecord/read", "read"],
  ["/api/token/clearCreditTokenRecord/read", "read"],
  ["/api/token/setMaxPowerLimitTokenRecord/read", "read"],
  ["/api/token/creditTokenRecord/cancel", "token-cancel"],
  ["/api/DailyDataMeter/read", "read"],
  ["/api/DailyDataMeter/readHourly", "drilldown"],
  ["/api/DailyDataMeter/readMonthly", "drilldown"],
  ["/API/PrepayReport/LongNonpurchaseSituation", "read"],
  ["/API/PrepayReport/LowPurchaseSituation", "read"],
  ["/API/PrepayReport/ConsumptionStatistics", "read"],
  ["/API/PrepayReport/LongNonpurchaseSituationExport", "export"],
  ["/API/PrepayReport/LowPurchaseSituationExport", "export"],
  ["/API/PrepayReport/ConsumptionStatisticsExport", "export"],
  ["/API/RemoteMeterTask/CreateReadingTask", "task-create"],
  ["/API/RemoteMeterTask/CreateControlTask", "task-create"],
  ["/API/RemoteMeterTask/CreateTokenTask", "task-create"],
  ["/API/RemoteMeterTask/GetReadingTask", "task-read"],
  ["/API/RemoteMeterTask/GetControlTask", "task-read"],
  ["/API/RemoteMeterTask/GetTokenTask", "task-read"],
  ["/API/RemoteMeterTask/UpdateReadingTask", "task-update"],
  ["/API/RemoteMeterTask/UpdateControlTask", "task-update"],
  ["/API/RemoteMeterTask/UpdateTokenTask", "task-update"],
]);

let allKnownEndpoints: Set<string> | null = null;

function inferOperation(pathname: string): OperationKind {
  if (pathname.endsWith("/read") || pathname.includes("/Get")) {
    return pathname.includes("Task") ? "task-read" : "read";
  }

  if (pathname.includes("/readHourly") || pathname.includes("/readMonthly")) {
    return "drilldown";
  }

  if (pathname.includes("/generate")) {
    return "token-generate";
  }

  if (pathname.includes("Create") && pathname.includes("Task")) {
    return "task-create";
  }

  if (pathname.includes("Update") && pathname.includes("Task")) {
    return "task-update";
  }

  if (pathname.endsWith("/create")) {
    return "crud-create";
  }

  if (pathname.endsWith("/update")) {
    return "crud-update";
  }

  if (pathname.endsWith("/delete")) {
    return "crud-delete";
  }

  if (pathname.endsWith("/import")) {
    return "import";
  }

  if (pathname.endsWith("/export") || pathname.endsWith("Export")) {
    return "export";
  }

  if (pathname.includes("/cancel")) {
    return "token-cancel";
  }

  return "generic";
}

function loadSwaggerEndpointSet() {
  if (allKnownEndpoints) {
    return allKnownEndpoints;
  }

  const candidate = path.resolve(process.cwd(), "..", "swagger_paths.txt");
  const set = new Set<string>();

  for (const pathname of explicitPolicies.keys()) {
    set.add(pathname);
  }

  if (existsSync(candidate)) {
    const content = readFileSync(candidate, "utf8");
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const pathValue = line.trim();
      if (pathValue.startsWith("/")) {
        set.add(pathValue);
      }
    }
  }

  allKnownEndpoints = set;
  return set;
}

export function resolveEndpointPolicy(pathname: string): EndpointPolicy | null {
  const knownEndpoints = loadSwaggerEndpointSet();

  if (!knownEndpoints.has(pathname)) {
    return null;
  }

  return {
    pathname,
    operation: explicitPolicies.get(pathname) ?? inferOperation(pathname),
  };
}
