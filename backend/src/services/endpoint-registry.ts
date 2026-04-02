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
  | "file-upload"
  | "generic";

export interface EndpointPolicy {
  pathname: string;
  operation: OperationKind;
}

const explicitPolicies = new Map<string, OperationKind>([
  // Dashboard
  ["/api/dashboard/readPanelGroup", "read"],
  ["/api/dashboard/readLineChart", "read"],

  // Account CRUD
  ["/api/account/read", "read"],
  ["/api/account/create", "crud-create"],
  ["/api/account/update", "crud-update"],
  ["/api/account/delete", "crud-delete"],
  ["/api/account/import", "import"],

  // Customer CRUD
  ["/api/customer/read", "read"],
  ["/api/customer/create", "crud-create"],
  ["/api/customer/update", "crud-update"],
  ["/api/customer/delete", "crud-delete"],
  ["/api/customer/import", "import"],

  // User maintenance
  ["/api/user/updateInfo", "crud-update"],
  ["/api/user/modifyLoginPassword", "crud-update"],
  ["/api/user/modifyAuthorizationPassword", "crud-update"],

  // Tariff CRUD
  ["/api/tariff/read", "read"],
  ["/api/tariff/create", "crud-create"],
  ["/api/tariff/update", "crud-update"],
  ["/api/tariff/delete", "crud-delete"],
  ["/api/tariff/import", "import"],

  // Gateway CRUD
  ["/api/gateway/read", "read"],
  ["/api/gateway/create", "crud-create"],
  ["/api/gateway/update", "crud-update"],
  ["/api/gateway/delete", "crud-delete"],
  ["/api/gateway/import", "import"],

  // Meter CRUD
  ["/api/meter/read", "read"],
  ["/api/meter/addread", "read"],
  ["/api/meter/create", "crud-create"],
  ["/api/meter/update", "crud-update"],
  ["/api/meter/delete", "crud-delete"],
  ["/api/meter/import", "import"],

  // Debt CRUD
  ["/api/debt/read", "read"],
  ["/api/debt/create", "crud-create"],
  ["/api/debt/update", "crud-update"],
  ["/api/debt/delete", "crud-delete"],
  ["/api/debt/import", "import"],

  // Token — Credit
  ["/api/token/creditToken/generate", "token-generate"],
  ["/api/token/creditTokenRecord/read", "read"],
  ["/api/token/creditTokenRecord/readMore", "read"],
  ["/api/token/creditTokenRecord/cancel", "token-cancel"],
  ["/api/token/creditTokenCancelRecord/read", "read"],

  // Token — Clear Tamper
  ["/api/token/clearTamperToken/generate", "token-generate"],
  ["/api/token/clearTamperTokenRecord/read", "read"],

  // Token — Clear Credit
  ["/api/token/clearCreditToken/generate", "token-generate"],
  ["/api/token/clearCreditTokenRecord/read", "read"],

  // Token — Max Power Limit
  ["/api/token/setMaximumPowerLimitToken/generate", "token-generate"],
  ["/api/token/setMaximumPowerLimitTokenRecord/read", "read"],

  // Token — Phase Power Unbalance Limit
  ["/api/token/setMaximumPhasePowerUnbalanceLimitToken/generate", "token-generate"],
  ["/api/token/setMaximumPhasePowerUnbalanceLimitTokenRecord/read", "read"],

  // Token — Meter Test
  ["/api/token/meterTestToken/read", "read"],

  // Token — Meter Key
  ["/api/token/meterKey/update", "crud-update"],

  // Token — Change Meter Key
  ["/api/token/changeMeterKeyToken/generate", "token-generate"],
  ["/api/token/changeMeterKeyTokenRecord/read", "read"],

  // Token — Max Overdraft Limit
  ["/api/token/setMaximumOverdraftLimitToken/generate", "token-generate"],
  ["/api/token/setMaximumOverdraftLimitTokenRecord/read", "read"],

  // DailyDataMeter
  ["/api/DailyDataMeter/read", "read"],
  ["/api/DailyDataMeter/readMore", "read"],
  ["/api/DailyDataMeter/readHourly", "drilldown"],
  ["/api/DailyDataMeter/readMonthly", "drilldown"],

  // Reports
  ["/API/PrepayReport/LongNonpurchaseSituation", "read"],
  ["/API/PrepayReport/LowPurchaseSituation", "read"],
  ["/API/PrepayReport/ConsumptionStatistics", "read"],

  // Remote Meter Tasks
  ["/API/RemoteMeterTask/CreateReadingTask", "task-create"],
  ["/API/RemoteMeterTask/CreateSettingTask", "task-create"],
  ["/API/RemoteMeterTask/CreateControlTask", "task-create"],
  ["/API/RemoteMeterTask/CreateTokenTask", "task-create"],
  ["/API/RemoteMeterTask/CreateTransparentForwardingTask", "task-create"],
  ["/API/RemoteMeterTask/GetReadingTask", "task-read"],
  ["/API/RemoteMeterTask/GetSettingTask", "task-read"],
  ["/API/RemoteMeterTask/GetControlTask", "task-read"],
  ["/API/RemoteMeterTask/GetTokenTask", "task-read"],
  ["/API/RemoteMeterTask/GetTransparentForwardingTask", "task-read"],
  ["/API/RemoteMeterTask/UpdateReadingTask", "task-update"],
  ["/API/RemoteMeterTask/UpdateSettingTask", "task-update"],
  ["/API/RemoteMeterTask/UpdateControlTask", "task-update"],
  ["/API/RemoteMeterTask/UpdateTokenTask", "task-update"],

  // DLMS Protocol
  ["/api/dlms/Read", "read"],
  ["/api/dlms/ReadDLMSTree", "read"],
  ["/api/dlms/Create", "crud-create"],
  ["/api/dlms/Update", "crud-update"],
  ["/api/dlms/Delete", "crud-delete"],
  ["/api/dlms/Import", "import"],

  // DLT645 Protocol
  ["/api/dlt645/read", "read"],
  ["/api/dlt645/readDLT645Tree", "read"],
  ["/api/dlt645/create", "crud-create"],
  ["/api/dlt645/update", "crud-update"],
  ["/api/dlt645/delete", "crud-delete"],
  ["/api/dlt645/import", "import"],

  // DLT645 Task
  ["/api/DLT645Task/read", "read"],

  // Load Profile
  ["/API/LoadProfile/ElectricEnergyCurve", "read"],
  ["/API/LoadProfile/InstantaneousValueCurve", "read"],
  ["/API/LoadProfile/DailyData", "read"],
  ["/API/LoadProfile/MonthlyData", "read"],

  // Item Management
  ["/api/item/read", "read"],
  ["/api/item/readItemList", "read"],
  ["/api/item/create", "crud-create"],
  ["/api/item/update", "crud-update"],
  ["/api/item/delete", "crud-delete"],
  ["/api/item/import", "import"],

  // Event Notification
  ["/API/EventNotification/Read", "read"],

  // File Upload
  ["/API/File/Upload", "file-upload"],
  ["/API/File/UploadBin", "file-upload"],
  ["/API/File/ConcentratorUploadBin", "file-upload"],

  // System Log
  ["/api/Log/read", "read"],
]);

let allKnownEndpoints: Set<string> | null = null;

function inferOperation(pathname: string): OperationKind {
  const lowerCasePath = pathname.toLowerCase();

  if (
    lowerCasePath.endsWith("/readhourly") ||
    lowerCasePath.endsWith("/readmonthly")
  ) {
    return "drilldown";
  }

  if (
    lowerCasePath.includes("task") &&
    (lowerCasePath.includes("/get") || lowerCasePath.includes("get"))
  ) {
    return "task-read";
  }

  if (lowerCasePath.includes("task") && lowerCasePath.includes("create")) {
    return "task-create";
  }

  if (lowerCasePath.includes("task") && lowerCasePath.includes("update")) {
    return "task-update";
  }

  if (
    lowerCasePath.endsWith("/read") ||
    lowerCasePath.endsWith("/readmore") ||
    lowerCasePath.endsWith("/view") ||
    lowerCasePath.endsWith("/info") ||
    lowerCasePath.includes("readdatarole") ||
    lowerCasePath.includes("readdlmstree") ||
    lowerCasePath.includes("readdlt645tree") ||
    lowerCasePath.includes("readitemlist") ||
    lowerCasePath.includes("electricenergycurve") ||
    lowerCasePath.includes("instantaneousvaluecurve") ||
    lowerCasePath.endsWith("/dailydata") ||
    lowerCasePath.endsWith("/monthlydata") ||
    lowerCasePath.endsWith("/addread")
  ) {
    return "read";
  }

  if (lowerCasePath.includes("/generate")) {
    return "token-generate";
  }

  if (
    lowerCasePath.endsWith("/create") ||
    lowerCasePath.includes("/create")
  ) {
    return "crud-create";
  }

  if (
    lowerCasePath.endsWith("/update") ||
    lowerCasePath.includes("/update") ||
    lowerCasePath.endsWith("/reset") ||
    lowerCasePath.endsWith("/updateinfo") ||
    lowerCasePath.endsWith("/modifyloginpassword") ||
    lowerCasePath.endsWith("/modifyauthorizationpassword")
  ) {
    return "crud-update";
  }

  if (lowerCasePath.endsWith("/delete") || lowerCasePath.includes("/delete")) {
    return "crud-delete";
  }

  if (
    lowerCasePath.endsWith("/import") ||
    lowerCasePath.includes("/upload")
  ) {
    return "import";
  }

  if (lowerCasePath.endsWith("/export") || pathname.endsWith("Export")) {
    return "export";
  }

  if (lowerCasePath.includes("/cancel")) {
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
