import type { ActionResponse, AmrResponse, ApiRowsResponse } from "../../../common/types/index.js";
import { envelope } from "./response.js";

type MockScalar = string | number | boolean | null;
type MockRow = Record<string, MockScalar>;
type DatasetName =
  | "accounts"
  | "customers"
  | "tariffs"
  | "gateways"
  | "meters"
  | "creditTokenRecords"
  | "clearTamperRecords"
  | "clearCreditRecords"
  | "maxPowerRecords"
  | "readingTasks"
  | "controlTasks"
  | "tokenTasks"
  | "intervalData"
  | "longNonpurchaseReport"
  | "lowPurchaseReport"
  | "consumptionReport";

interface DatasetSchema {
  keyField: string;
  prefix: string;
  seed: number;
  fields: string[];
}

interface DatasetState {
  rows: MockRow[];
  counter: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nowStamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function buildValue(field: string, order: number, prefix: string): MockScalar {
  const serial = String(order).padStart(4, "0");
  const upperPrefix = prefix.toUpperCase().replace(/\s+/g, "-");
  const lowerField = field.toLowerCase();

  if (lowerField.includes("time") || lowerField.includes("date")) {
    return `2026-03-${String((order % 28) + 1).padStart(2, "0")} 09:${String(order % 60).padStart(2, "0")}`;
  }

  if (
    lowerField.includes("money") ||
    lowerField.includes("paid") ||
    lowerField.includes("charge")
  ) {
    return (1200 + order * 27).toFixed(2);
  }

  if (
    lowerField.includes("unit") ||
    lowerField.includes("energy") ||
    lowerField.includes("balance") ||
    lowerField.includes("demand")
  ) {
    return (55 + order * 1.9).toFixed(2);
  }

  if (lowerField.includes("status")) {
    return order % 3 === 0 ? "Completed" : "Pending";
  }

  if (lowerField.includes("phone")) {
    return `0803${String(1_000_000 + order).slice(-7)}`;
  }

  if (lowerField.includes("address")) {
    return `${order} Marina Road`;
  }

  if (lowerField.includes("protocol")) {
    return order % 2 === 0 ? "DLMS" : "DLT645";
  }

  if (lowerField.includes("type")) {
    return order % 2 === 0 ? "STS" : "Smart";
  }

  if (lowerField.includes("way")) {
    return order % 2 === 0 ? "GPRS" : "RF";
  }

  if (lowerField.includes("name")) {
    return `${prefix} ${order}`;
  }

  if (lowerField.includes("id")) {
    return `${upperPrefix}-${serial}`;
  }

  if (lowerField.includes("remark")) {
    return `${prefix} record ${order}`;
  }

  return `${prefix} ${field} ${order}`;
}

const schemas: Record<DatasetName, DatasetSchema> = {
  accounts: {
    keyField: "customerId",
    prefix: "Account",
    seed: 120,
    fields: [
      "customerId",
      "customerName",
      "meterId",
      "meterType",
      "communicationWay",
      "tariffId",
      "protocolVersion",
      "remark",
      "createTime",
      "stationId",
    ],
  },
  customers: {
    keyField: "id",
    prefix: "Customer",
    seed: 120,
    fields: [
      "id",
      "name",
      "phone",
      "address",
      "certifiName",
      "certifiNo",
      "remark",
      "createTime",
      "updateTime",
      "stationId",
    ],
  },
  tariffs: {
    keyField: "id",
    prefix: "Tariff",
    seed: 40,
    fields: ["id", "name", "remark", "createTime", "updateTime", "stationId"],
  },
  gateways: {
    keyField: "id",
    prefix: "Gateway",
    seed: 35,
    fields: ["id", "name", "remark", "createTime", "updateTime", "stationId"],
  },
  meters: {
    keyField: "meterId",
    prefix: "Meter",
    seed: 110,
    fields: ["status", "customerName", "meterId", "meterType", "remark", "stationId"],
  },
  creditTokenRecords: {
    keyField: "receiptId",
    prefix: "Receipt",
    seed: 80,
    fields: [
      "receiptId",
      "customerId",
      "customerName",
      "meterId",
      "meterType",
      "tariffId",
      "vatCharge",
      "totalUnit",
      "totalPaid",
      "tokenRecharge",
      "vend",
      "time",
      "remark",
      "stationId",
    ],
  },
  clearTamperRecords: {
    keyField: "receiptId",
    prefix: "Tamper",
    seed: 32,
    fields: ["receiptId", "customerId", "customerName", "meterId", "time", "remark", "stationId"],
  },
  clearCreditRecords: {
    keyField: "receiptId",
    prefix: "Clear Credit",
    seed: 34,
    fields: ["receiptId", "customerId", "customerName", "meterId", "time", "remark", "stationId"],
  },
  maxPowerRecords: {
    keyField: "receiptId",
    prefix: "Power Limit",
    seed: 28,
    fields: ["receiptId", "customerId", "customerName", "meterId", "time", "remark", "stationId"],
  },
  readingTasks: {
    keyField: "meterId",
    prefix: "Reading Task",
    seed: 35,
    fields: ["status", "meterId", "customerName", "createTime", "remark", "stationId"],
  },
  controlTasks: {
    keyField: "meterId",
    prefix: "Control Task",
    seed: 30,
    fields: ["status", "meterId", "customerName", "createTime", "remark", "stationId"],
  },
  tokenTasks: {
    keyField: "meterId",
    prefix: "Token Task",
    seed: 30,
    fields: ["status", "meterId", "customerName", "createTime", "remark", "stationId"],
  },
  intervalData: {
    keyField: "meterId",
    prefix: "Interval",
    seed: 120,
    fields: [
      "meterId",
      "gatewayId",
      "collectionDate",
      "customerId",
      "customerName",
      "stationId",
      "totalEnergy",
      "lastHourUsage",
      "creditBalance",
      "maximumDemand",
      "protocol",
    ],
  },
  longNonpurchaseReport: {
    keyField: "meterId",
    prefix: "Nonpurchase",
    seed: 70,
    fields: ["customerId", "customerName", "meterId", "lastPurchaseDate", "daysWithoutPurchase", "stationId"],
  },
  lowPurchaseReport: {
    keyField: "meterId",
    prefix: "Low Purchase",
    seed: 75,
    fields: ["customerId", "customerName", "meterId", "remainingBalance", "lastPurchaseDate", "stationId"],
  },
  consumptionReport: {
    keyField: "meterId",
    prefix: "Consumption",
    seed: 75,
    fields: ["meterId", "customerName", "periodStart", "periodEnd", "totalEnergy", "stationId"],
  },
};

function buildSeedRows(schema: DatasetSchema) {
  return Array.from({ length: schema.seed }, (_, index) => {
    const order = index + 1;
    return schema.fields.reduce<MockRow>((row, field) => {
      row[field] = buildValue(field, order, schema.prefix);
      return row;
    }, {});
  });
}

function createInitialDbState() {
  return (Object.keys(schemas) as DatasetName[]).reduce<Record<DatasetName, DatasetState>>(
    (state, datasetName) => {
      const schema = schemas[datasetName];
      state[datasetName] = {
        rows: buildSeedRows(schema),
        counter: schema.seed,
      };
      return state;
    },
    {} as Record<DatasetName, DatasetState>,
  );
}

let dbState = createInitialDbState();

export function resetMockState() {
  dbState = createInitialDbState();
}

const readMap: Record<string, DatasetName> = {
  "/api/account/read": "accounts",
  "/api/customer/read": "customers",
  "/api/tariff/read": "tariffs",
  "/api/gateway/read": "gateways",
  "/api/meter/read": "meters",
  "/api/token/creditTokenRecord/read": "creditTokenRecords",
  "/api/token/clearTamperTokenRecord/read": "clearTamperRecords",
  "/api/token/clearCreditTokenRecord/read": "clearCreditRecords",
  "/api/token/setMaxPowerLimitTokenRecord/read": "maxPowerRecords",
  "/API/RemoteMeterTask/GetReadingTask": "readingTasks",
  "/API/RemoteMeterTask/GetControlTask": "controlTasks",
  "/API/RemoteMeterTask/GetTokenTask": "tokenTasks",
  "/api/DailyDataMeter/read": "intervalData",
  "/API/PrepayReport/LongNonpurchaseSituation": "longNonpurchaseReport",
  "/API/PrepayReport/LowPurchaseSituation": "lowPurchaseReport",
  "/API/PrepayReport/ConsumptionStatistics": "consumptionReport",
};

function normalize(value: MockScalar) {
  return String(value ?? "").toLowerCase();
}

function paginate(rows: MockRow[], body: Record<string, unknown>): ApiRowsResponse<MockRow> {
  const pageNumber = Math.max(1, asNumber(body.pageNumber, 1));
  const pageSize = Math.max(1, asNumber(body.pageSize, 20));
  const start = (pageNumber - 1) * pageSize;
  const end = start + pageSize;

  return {
    rows: rows.slice(start, end),
    total: rows.length,
  };
}

function readDataset(datasetName: DatasetName, body: Record<string, unknown>) {
  const searchTerm = asString(body.searchTerm).trim().toLowerCase();
  const rows = dbState[datasetName].rows;
  const filtered = searchTerm
    ? rows.filter((row) =>
        Object.values(row).some((value) => normalize(value).includes(searchTerm)),
      )
    : rows;
  return paginate(filtered, body);
}

function inferRowKey(row: MockRow) {
  return (
    row.id ??
    row.customerId ??
    row.meterId ??
    row.receiptId ??
    row.gatewayId ??
    row.name ??
    null
  );
}

function resolveKey(datasetName: DatasetName, row: MockRow) {
  const schema = schemas[datasetName];
  const key = row[schema.keyField] ?? inferRowKey(row);
  return key === null ? null : String(key);
}

function createRow(datasetName: DatasetName, payload: Record<string, unknown>) {
  const schema = schemas[datasetName];
  const state = dbState[datasetName];
  state.counter += 1;
  const seedOrder = state.counter;

  const newRow = schema.fields.reduce<MockRow>((row, field) => {
    const incoming = payload[field];
    if (incoming !== undefined && incoming !== null && String(incoming).trim() !== "") {
      row[field] = String(incoming);
      return row;
    }

    row[field] = buildValue(field, seedOrder, schema.prefix);
    return row;
  }, {});

  if (schema.fields.includes("updateTime")) {
    newRow.updateTime = nowStamp();
  }

  if (schema.fields.includes("createTime")) {
    newRow.createTime = nowStamp();
  }

  if (schema.fields.includes("time")) {
    newRow.time = nowStamp();
  }

  if (!newRow[schema.keyField]) {
    newRow[schema.keyField] = buildValue(schema.keyField, seedOrder, schema.prefix);
  }

  state.rows.unshift(newRow);
  return newRow;
}

function updateRow(datasetName: DatasetName, payload: Record<string, unknown>) {
  const sourceRow = asRecord(payload.row) as MockRow;
  const schema = schemas[datasetName];
  const state = dbState[datasetName];
  const key = resolveKey(datasetName, sourceRow);

  if (!key) {
    return null;
  }

  const index = state.rows.findIndex((row) => String(row[schema.keyField]) === key);
  if (index < 0) {
    return null;
  }

  const mergedRow: MockRow = {
    ...state.rows[index],
    ...sourceRow,
  };

  if (typeof payload.name === "string") {
    mergedRow.name = payload.name;
    mergedRow.customerName = payload.name;
  }

  if (typeof payload.remark === "string") {
    mergedRow.remark = payload.remark;
  }

  if (schema.fields.includes("updateTime")) {
    mergedRow.updateTime = nowStamp();
  }

  state.rows[index] = mergedRow;
  return mergedRow;
}

function deleteRows(datasetName: DatasetName, payload: Record<string, unknown>) {
  const schema = schemas[datasetName];
  const state = dbState[datasetName];
  const selectedKeys = Array.isArray(payload.selectedKeys)
    ? payload.selectedKeys.map((entry) => String(entry))
    : [];
  const sourceRow = asRecord(payload.row) as MockRow;
  const rowKey = resolveKey(datasetName, sourceRow);
  const keys = new Set<string>(selectedKeys);

  if (rowKey) {
    keys.add(rowKey);
  }

  if (keys.size === 0) {
    return 0;
  }

  const before = state.rows.length;
  state.rows = state.rows.filter((row) => !keys.has(String(row[schema.keyField])));
  return before - state.rows.length;
}

function importRows(datasetName: DatasetName) {
  for (let index = 0; index < 5; index += 1) {
    createRow(datasetName, {});
  }
}

function createTokenRecord(datasetName: DatasetName, payload: Record<string, unknown>, label: string) {
  const source = asRecord(payload.row) as MockRow;
  const amount = asNumber(payload.amount, 1500);
  const unit = asNumber(payload.unit, 80);
  const state = dbState[datasetName];
  state.counter += 1;
  const counter = state.counter;
  const baseRow: MockRow = {
    receiptId: `RCT-${String(counter).padStart(6, "0")}`,
    customerId: source.customerId ?? `CUSTOMER-${String(counter).padStart(4, "0")}`,
    customerName: source.customerName ?? `Customer ${counter}`,
    meterId: source.meterId ?? `METER-${String(counter).padStart(4, "0")}`,
    remark: `${label} generated`,
    stationId: source.stationId ?? `STATION-${String((counter % 12) + 1).padStart(3, "0")}`,
    time: nowStamp(),
  };

  if (datasetName === "creditTokenRecords") {
    state.rows.unshift({
      ...baseRow,
      meterType: source.meterType ?? "STS",
      tariffId: source.tariffId ?? `TARIFF-${String((counter % 9) + 1).padStart(3, "0")}`,
      vatCharge: (amount * 0.075).toFixed(2),
      totalUnit: unit.toFixed(2),
      totalPaid: amount.toFixed(2),
      tokenRecharge: `TK-${String(counter).padStart(8, "0")}`,
      vend: `V-${String(counter).padStart(6, "0")}`,
    });
    return;
  }

  state.rows.unshift(baseRow);
}

function createTask(datasetName: DatasetName, payload: Record<string, unknown>, label: string) {
  const source = asRecord(payload.row) as MockRow;
  const state = dbState[datasetName];
  state.counter += 1;
  const counter = state.counter;

  state.rows.unshift({
    status: "Pending",
    meterId: source.meterId ?? `METER-${String(counter).padStart(5, "0")}`,
    customerName: source.customerName ?? `Customer ${counter}`,
    createTime: nowStamp(),
    remark: asString(payload.taskName, `${label} created`),
    stationId: source.stationId ?? `STATION-${String((counter % 12) + 1).padStart(3, "0")}`,
  });
}

function updateTask(datasetName: DatasetName, payload: Record<string, unknown>) {
  const state = dbState[datasetName];
  const source = asRecord(payload.row) as MockRow;
  const key = resolveKey(datasetName, source);
  const keyField = schemas[datasetName].keyField;

  if (!key) {
    return false;
  }

  const index = state.rows.findIndex((row) => String(row[keyField]) === key);
  if (index < 0) {
    return false;
  }

  const existing = state.rows[index];
  if (!existing) {
    return false;
  }

  state.rows[index] = {
    ...existing,
    status: "Completed",
    remark: asString(payload.remark, String(existing.remark ?? "")),
  };
  return true;
}

function buildDashboard() {
  const creditRows = dbState.creditTokenRecords.rows;
  const taskRows = [
    ...dbState.readingTasks.rows,
    ...dbState.controlTasks.rows,
    ...dbState.tokenTasks.rows,
  ];
  const completedTasks = taskRows.filter((row) => row.status === "Completed").length;
  const totalTaskCount = Math.max(taskRows.length, 1);
  const totalPaid = creditRows.reduce(
    (sum, row) => sum + asNumber(row.totalPaid, 0),
    0,
  );
  const totalUnits = creditRows.reduce(
    (sum, row) => sum + asNumber(row.totalUnit, 0),
    0,
  );
  const successRate = Math.round((completedTasks / totalTaskCount) * 100);
  const intervalRows = dbState.intervalData.rows.slice(0, 6);

  return {
    panels: [
      { label: "Account Count", value: String(dbState.accounts.rows.length), accent: "teal" },
      { label: "Purchase Times", value: String(creditRows.length), accent: "blue" },
      { label: "Purchase Unit", value: totalUnits.toFixed(0), accent: "green" },
      { label: "Purchase Money", value: `NGN ${totalPaid.toFixed(2)}`, accent: "orange" },
    ],
    purchaseMoney: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      values: [14, 18, 22, 17, 25, 21, 24],
    },
    successRate: {
      labels: ["00", "04", "08", "12", "16", "20"],
      values: [
        Math.max(80, successRate - 2),
        Math.max(82, successRate - 1),
        successRate,
        Math.min(99, successRate + 1),
        Math.min(99, successRate + 2),
        Math.min(99, successRate + 1),
      ],
    },
    alarms: [
      { label: "No Data Report", value: Math.max(4, Math.floor(dbState.intervalData.rows.length / 8)) },
      { label: "Current Unbalance", value: Math.max(3, Math.floor(dbState.meters.rows.length / 20)) },
      { label: "Current Reverse", value: Math.max(2, Math.floor(dbState.meters.rows.length / 25)) },
      { label: "Cover Open", value: Math.max(5, Math.floor(taskRows.length / 18)) },
      { label: "Battery Low", value: Math.max(2, Math.floor(taskRows.length / 30)) },
    ],
    consumption: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      daily: intervalRows.map((row) => asNumber(row.lastHourUsage, 0)),
      monthly: intervalRows.map((row) => Math.round(asNumber(row.totalEnergy, 0) * 7)),
    },
  };
}

function actionResponse(success: boolean, message: string): AmrResponse<ActionResponse> {
  return envelope({
    success,
    message,
  });
}

function handleCrudAction(pathname: string, body: Record<string, unknown>) {
  const match = pathname.match(/^\/api\/(account|customer|tariff|gateway)\/(create|update|delete|import|export)$/);
  if (!match) {
    return null;
  }

  const domain = match[1];
  const action = match[2];
  if (!domain || !action) {
    return null;
  }
  const collectionByDomain: Record<string, DatasetName> = {
    account: "accounts",
    customer: "customers",
    tariff: "tariffs",
    gateway: "gateways",
  };
  const datasetName = collectionByDomain[domain];

  if (!datasetName) {
    return null;
  }

  if (action === "create") {
    const row = createRow(datasetName, body);
    return envelope({ success: true, row, message: `Created ${domain} record` });
  }

  if (action === "update") {
    const row = updateRow(datasetName, body);
    return row
      ? envelope({ success: true, row, message: `Updated ${domain} record` })
      : actionResponse(false, "Record not found");
  }

  if (action === "delete") {
    const removed = deleteRows(datasetName, body);
    return actionResponse(removed > 0, removed > 0 ? `Deleted ${removed} record(s)` : "No rows selected");
  }

  if (action === "import") {
    importRows(datasetName);
    return actionResponse(true, `Imported ${domain} records`);
  }

  return actionResponse(true, `Export prepared for ${domain} records`);
}

function handleTokenAction(pathname: string, body: Record<string, unknown>) {
  if (pathname === "/api/token/creditToken/generate") {
    createTokenRecord("creditTokenRecords", body, "Credit token");
    return actionResponse(true, "Credit token generated");
  }

  if (pathname === "/api/token/clearTamperToken/generate") {
    createTokenRecord("clearTamperRecords", body, "Clear tamper token");
    return actionResponse(true, "Clear tamper token generated");
  }

  if (pathname === "/api/token/clearCreditToken/generate") {
    createTokenRecord("clearCreditRecords", body, "Clear credit token");
    return actionResponse(true, "Clear credit token generated");
  }

  if (pathname === "/api/token/setMaxPowerLimitToken/generate") {
    createTokenRecord("maxPowerRecords", body, "Maximum power limit token");
    return actionResponse(true, "Maximum power limit token generated");
  }

  if (pathname === "/api/token/creditTokenRecord/cancel") {
    const removed = deleteRows("creditTokenRecords", body);
    return actionResponse(removed > 0, removed > 0 ? "Credit token record cancelled" : "Record not found");
  }

  return null;
}

function handleTaskAction(pathname: string, body: Record<string, unknown>) {
  if (pathname === "/API/RemoteMeterTask/CreateReadingTask") {
    createTask("readingTasks", body, "Reading task");
    return actionResponse(true, "Reading task created");
  }
  if (pathname === "/API/RemoteMeterTask/CreateControlTask") {
    createTask("controlTasks", body, "Control task");
    return actionResponse(true, "Control task created");
  }
  if (pathname === "/API/RemoteMeterTask/CreateTokenTask") {
    createTask("tokenTasks", body, "Token task");
    return actionResponse(true, "Token task created");
  }
  if (pathname === "/API/RemoteMeterTask/UpdateReadingTask") {
    return actionResponse(updateTask("readingTasks", body), "Reading task updated");
  }
  if (pathname === "/API/RemoteMeterTask/UpdateControlTask") {
    return actionResponse(updateTask("controlTasks", body), "Control task updated");
  }
  if (pathname === "/API/RemoteMeterTask/UpdateTokenTask") {
    return actionResponse(updateTask("tokenTasks", body), "Token task updated");
  }
  return null;
}

function handleDailyDataAction(pathname: string, body: Record<string, unknown>) {
  if (pathname === "/api/DailyDataMeter/readHourly") {
    const source = asRecord(body.row) as MockRow;
    const meterId = String(source.meterId ?? "METER-0001");
    const rows = Array.from({ length: 24 }, (_, index) => ({
      id: `${meterId}-${String(index).padStart(2, "0")}`,
      meterId,
      hour: `${String(index).padStart(2, "0")}:00`,
      energy: (1.2 + (index % 6) * 0.35).toFixed(2),
      voltage: (220 + (index % 4) * 2).toFixed(2),
      current: (4 + (index % 5) * 0.6).toFixed(2),
    }));
    return envelope({
      rows,
      total: rows.length,
    });
  }

  if (pathname === "/api/DailyDataMeter/readMonthly") {
    const rows = dbState.intervalData.rows.slice(0, 12).map((row, index) => ({
      meterId: row.meterId,
      month: `2026-${String((index % 12) + 1).padStart(2, "0")}`,
      totalEnergy: (asNumber(row.totalEnergy, 0) * 10).toFixed(2),
      creditBalance: row.creditBalance,
      stationId: row.stationId,
    }));
    return envelope({
      rows,
      total: rows.length,
    });
  }

  return null;
}

export function mockApiResponse(
  pathname: string,
  body: Record<string, unknown>,
): AmrResponse<unknown> {
  if (pathname === "/api/dashboard/readPanelGroup" || pathname === "/api/dashboard/readLineChart") {
    return envelope(buildDashboard());
  }

  const readDatasetName = readMap[pathname];
  if (readDatasetName) {
    return envelope(readDataset(readDatasetName, body));
  }

  const crud = handleCrudAction(pathname, body);
  if (crud) {
    return crud;
  }

  const token = handleTokenAction(pathname, body);
  if (token) {
    return token;
  }

  const task = handleTaskAction(pathname, body);
  if (task) {
    return task;
  }

  const dailyData = handleDailyDataAction(pathname, body);
  if (dailyData) {
    return dailyData;
  }

  // TECH DEBT: Unmapped endpoints currently use a generic response.
  return actionResponse(true, `Action completed for ${pathname}`);
}
