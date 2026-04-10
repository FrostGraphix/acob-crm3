import type { DataRow } from "../types";

type RowAliasMap = Record<string, string[]>;

const createTimeAliases = [
  "createTime",
  "createDate",
  "createdAt",
  "createdTime",
  "create_datetime",
];

const updateTimeAliases = [
  "updateTime",
  "updateDate",
  "updatedAt",
  "modifyTime",
  "modifiedAt",
  "lastUpdateTime",
];

const stationIdAliases = [
  "stationId",
  "stationID",
  "station",
  "stationNo",
  "stationCode",
  "siteId",
  "siteID",
  "site",
];

const sectionIdAliases = [
  "sectionId",
  "sectionID",
  "section",
  ...stationIdAliases,
];

const customerIdAliases = ["customerId", "customerID", "consumerId", "customerNo", "customerCode"];

const customerNameAliases = [
  "customerName",
  "consumerName",
  "name",
  "fullName",
  "fullname",
  "customerFullName",
];

const meterIdAliases = ["meterId", "meterNo", "meterCode", "meterNumber", "serialNo"];

const meterTypeAliases = ["meterType", "type", "meterCategory", "meterModel"];

const gatewayIdAliases = [
  "gatewayId",
  "collectorId",
  "concentratorId",
  "gatewayNo",
  "gatewayCode",
  "dcuId",
];

const tariffIdAliases = ["tariffId", "tariffID", "tariff", "tariffName", "tariffType"];

const remarkAliases = ["remark", "remarks", "notes", "description", "memo"];

const receiptIdAliases = ["receiptId", "receiptNo", "serialNumber", "orderNo", "voucherNo"];

const tokenAliases = ["token", "tokenCode", "clearToken", "stsToken"];

function normalizeLookupKey(key: string) {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function hasUsableValue(value: unknown): value is DataRow[string] {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return typeof value === "number" || typeof value === "boolean";
}

function readAliasValue(row: DataRow, aliases: string[]) {
  for (const alias of aliases) {
    const directValue = row[alias];
    if (hasUsableValue(directValue)) {
      return directValue;
    }
  }

  const normalizedEntries = new Map<string, DataRow[string]>();

  for (const [key, value] of Object.entries(row)) {
    if (hasUsableValue(value)) {
      normalizedEntries.set(normalizeLookupKey(key), value);
    }
  }

  for (const alias of aliases) {
    const normalizedValue = normalizedEntries.get(normalizeLookupKey(alias));
    if (hasUsableValue(normalizedValue)) {
      return normalizedValue;
    }
  }

  return undefined;
}

function applyAliasMap(row: DataRow, aliasMap: RowAliasMap): DataRow {
  const nextRow: DataRow = { ...row };

  for (const [targetKey, aliases] of Object.entries(aliasMap)) {
    if (hasUsableValue(nextRow[targetKey])) {
      continue;
    }

    const aliasValue = readAliasValue(row, aliases);
    if (hasUsableValue(aliasValue)) {
      nextRow[targetKey] = aliasValue;
    }
  }

  return nextRow;
}

function getAliasMapForEndpoint(endpoint: string): RowAliasMap | null {
  switch (endpoint) {
    case "/api/customer/read":
      return {
        id: ["id", ...customerIdAliases, "code"],
        name: ["name", ...customerNameAliases],
        phone: ["phone", "phoneNo", "mobile", "mobileNo", "telephone", "telephoneNo", "tel"],
        address: ["address", "addr", "location", "customerAddress"],
        certifiName: ["certifiName", "certificateName", "certName"],
        certifiNo: ["certifiNo", "certificateNo", "certNo"],
        remark: remarkAliases,
        createTime: createTimeAliases,
        updateTime: updateTimeAliases,
        stationId: stationIdAliases,
      };

    case "/api/account/read":
      return {
        customerId: customerIdAliases,
        customerName: customerNameAliases,
        meterId: meterIdAliases,
        meterType: meterTypeAliases,
        communicationWay: [
          "communicationWay",
          "commWay",
          "communicationMode",
          "communicationType",
          "commMode",
        ],
        tariffId: tariffIdAliases,
        protocolVersion: ["protocolVersion", "protocol", "protocolType", "version"],
        remark: remarkAliases,
        createTime: createTimeAliases,
        stationId: stationIdAliases,
      };

    case "/api/tariff/read":
      return {
        id: ["id", ...tariffIdAliases, "code", "tariffNo"],
        name: ["name", "tariffName", "title", "tariffTitle", "tariffDesc"],
        price: ["price", "unitPrice", "tariffPrice", "priceValue"],
        remark: remarkAliases,
        createTime: createTimeAliases,
        updateTime: updateTimeAliases,
      };

    case "/api/gateway/read":
      return {
        status: ["status", "gatewayStatus", "onlineStatus", "state"],
        successRate: [
          "successRate",
          "succRate",
          "successRatio",
          "successPercent",
          "communicationSuccessRate",
        ],
        id: ["id", "gatewayId", "gatewayNo", "collectorId", "concentratorId", "code"],
        name: ["name", "gatewayName", "collectorName", "concentratorName", "title"],
      };

    case "/api/meter/read":
      return {
        status: ["status", "meterStatus", "relayStatus", "state"],
        customerId: customerIdAliases,
        customerName: customerNameAliases,
        meterId: meterIdAliases,
        meterType: meterTypeAliases,
        communicationWay: [
          "communicationWay",
          "commWay",
          "communicationMode",
          "communicationType",
          "commMode",
        ],
        protocolVersion: ["protocolVersion", "protocol", "protocolType", "version"],
        gatewayId: gatewayIdAliases,
        remark: remarkAliases,
        createTime: createTimeAliases,
        stationId: stationIdAliases,
      };

    case "/api/debt/read":
      return {
        id: ["id", "debtId", "debtNo", "orderNo", "voucherNo", "serialNumber"],
        customerId: customerIdAliases,
        customerName: customerNameAliases,
        meterId: meterIdAliases,
        amount: ["amount", "debtAmount", "arrears", "outstandingAmount", "balance"],
        status: ["status", "debtStatus", "state"],
        remark: remarkAliases,
        createTime: createTimeAliases,
        updateTime: updateTimeAliases,
      };

    case "/api/dlms/Read":
      return {
        id: ["id", "itemId", "obisId", "code"],
        name: ["name", "itemName", "title", "objectName"],
        obisCode: ["obisCode", "obis", "obisId", "objectCode"],
        classId: ["classId", "classNo", "interfaceClass", "classType"],
        attributeIndex: ["attributeIndex", "attributeNo", "attributeId", "attrIndex"],
        dataType: ["dataType", "type", "valueType"],
        remark: remarkAliases,
      };

    case "/api/dlt645/read":
      return {
        id: ["id", "itemId", "code"],
        name: ["name", "itemName", "title"],
        dataIdentifier: ["dataIdentifier", "identifier", "di", "dataFlag", "itemCode"],
        dataLength: ["dataLength", "length", "dataLen"],
        dataType: ["dataType", "type", "valueType"],
        remark: remarkAliases,
      };

    case "/api/item/read":
    case "/api/item/readItemList":
      return {
        id: ["id", "itemId", "code"],
        name: ["name", "itemName", "title"],
        unit: ["unit", "unitName", "measureUnit", "uom"],
        dataType: ["dataType", "type", "valueType"],
        remark: remarkAliases,
        createTime: createTimeAliases,
      };

    case "/api/DLT645Task/read":
      return {
        status: ["status", "taskStatus", "state"],
        meterId: meterIdAliases,
        dataIdentifier: [
          "dataIdentifier",
          "identifier",
          "di",
          "dataItem",
          "itemName",
          "itemCode",
        ],
        dataValue: ["dataValue", "value", "resultValue", "readValue"],
        createTime: createTimeAliases,
        updateTime: updateTimeAliases,
      };

    case "/API/EventNotification/Read":
      return {
        id: ["id", "eventId", "alarmId", "notificationId", "serialNumber"],
        eventType: ["eventType", "alarmType", "eventName", "type"],
        meterId: meterIdAliases,
        description: ["description", "detail", "message", "content", "remark"],
        severity: ["severity", "level", "priority"],
        createTime: createTimeAliases,
        status: ["status", "eventStatus", "alarmStatus", "state"],
      };

    case "/api/Log/read":
      return {
        id: ["id", "logId", "serialNumber"],
        action: ["action", "operation", "actionName", "operationName"],
        username: ["username", "userName", "loginName", "operator", "createdBy"],
        ipAddress: ["ipAddress", "ip", "clientIp", "remoteAddr"],
        module: ["module", "moduleName", "menuName", "source"],
        detail: ["detail", "description", "content", "remark", "message"],
        createTime: createTimeAliases,
      };

    case "/api/token/creditTokenRecord/read":
      return {
        receiptId: receiptIdAliases,
        customerId: customerIdAliases,
        customerName: customerNameAliases,
        meterId: meterIdAliases,
        meterType: meterTypeAliases,
        tariffId: tariffIdAliases,
        vatCharge: ["vatCharge", "tax", "vat", "taxAmount"],
        totalUnit: ["totalUnit", "unit", "totalKwh", "totalQuantity"],
        totalPrice: ["totalPrice", "totalPaid", "paidAmount", "amount"],
        tokenRecharge: ["tokenRecharge", "recharge", "rechargeUnit", "vendValue", "unit"],
        createId: ["createId", "vend", "vendId", "operatorId", "createdBy", "seller"],
        token: tokenAliases,
        createTime: createTimeAliases,
        remark: remarkAliases,
        stationId: stationIdAliases,
      };

    case "/api/token/clearTamperTokenRecord/read":
    case "/api/token/clearCreditTokenRecord/read":
      return {
        receiptId: receiptIdAliases,
        customerId: customerIdAliases,
        customerName: customerNameAliases,
        meterId: meterIdAliases,
        tokenRecharge: ["tokenRecharge", ...tokenAliases, "clearValue"],
        createTime: createTimeAliases,
        stationId: stationIdAliases,
      };

    case "/api/token/setMaximumPowerLimitTokenRecord/read":
      return {
        receiptId: receiptIdAliases,
        customerId: customerIdAliases,
        customerName: customerNameAliases,
        meterId: meterIdAliases,
        maximumPowerLimit: [
          "maximumPowerLimit",
          "maxPowerLimit",
          "powerLimit",
          "limitPower",
        ],
      };

    case "/api/DailyDataMeter/read":
      return {
        meterId: meterIdAliases,
        gatewayId: gatewayIdAliases,
        stationId: stationIdAliases,
        collectionDate: [
          "collectionDate",
          "collectDate",
          "dataDate",
          "readDate",
          "collectionTime",
          "currentDate",
        ],
        consumption: [
          "consumption",
          "totalEnergy",
          "total1",
          "energy",
          "kwh",
          "usage1",
          "usage",
        ],
        customerId: customerIdAliases,
        customerName: customerNameAliases,
        totalEnergy: ["totalEnergy", "total1", "consumption", "energy", "kwh", "usage"],
        lastHourUsage: ["lastHourUsage", "usage1", "hourlyUsage", "hourUsage", "lastUsage"],
        creditBalance: [
          "creditBalance",
          "remain1",
          "balance",
          "remainingBalance",
          "remainBalance",
          "surplusAmount",
          "credit",
        ],
        maximumDemand: [
          "maximumDemand",
          "intervalDemand",
          "maxDemand",
          "maximumPower",
          "demandMax",
        ],
        power: ["power", "activePower", "instantaneousPower", "powerValue"],
        relayStatus: ["relayStatus", "relayOpen", "relay", "switchStatus", "relayState"],
        energyStatus: ["energyStatus", "status", "source2Activated", "energyState", "energyFlag"],
        magneticStatus: [
          "magneticStatus",
          "magneticInterference",
          "magnetic",
          "magneticState",
        ],
        terminalCover: [
          "terminalCover",
          "terminalCoverOpen",
          "terminalCoverStatus",
          "terminalStatus",
        ],
        upperOpen: ["upperOpen", "coverOpen", "upperOpenStatus", "upperCoverOpen"],
        currentReverse: ["currentReverse", "reverseCurrent", "currentReverseStatus"],
        currentUnbalance: ["currentUnbalance", "unbalanceCurrent", "currentUnbalanceStatus"],
        updateTime: updateTimeAliases,
        sectionId: sectionIdAliases,
      };

    case "/API/RemoteMeterTask/GetReadingTask":
      return {
        customerId: [...customerIdAliases, "id"],
        customerName: customerNameAliases,
        meterId: meterIdAliases,
        dataItem: ["dataItem", "item", "readItem", "itemName"],
        stationId: ["stationId", "site", "siteId", "station", "sectionId"],
        dataValue: ["dataValue", "value", "readValue", "resultValue"],
        status: ["status", "taskStatus", "state"],
        createTime: createTimeAliases,
        updateTime: updateTimeAliases,
      };

    case "/API/PrepayReport/LongNonpurchaseSituation":
    case "/api/reports/non-purchase":
      return {
        customerId: [...customerIdAliases, "id"],
        customerName: customerNameAliases,
        meterId: meterIdAliases,
        tariff: ["tariff", "tariffId", "tariffName", "tariffType"],
        daysWithoutPurchase: [
          "daysWithoutPurchase",
          "nonpurchaseDays",
          "noPurchaseDays",
          "inactiveDays",
          "days",
        ],
      };

    case "/API/PrepayReport/LowPurchaseSituation":
    case "/api/reports/low-purchase":
      return {
        customerId: [...customerIdAliases, "id"],
        customerName: customerNameAliases,
        meterId: meterIdAliases,
        tariffId: ["tariffId", "tariff", "tariffName", "tariffType"],
        tariff: ["tariff", "tariffId", "tariffName", "tariffType"],
        totalUnit: [
          "totalUnit",
          "purchaseTotalUnit",
          "unit",
          "totalKwh",
          "totalQuantity",
          "purchaseUnit",
        ],
        totalPaid: [
          "totalPaid",
          "purchaseTotalPaid",
          "paidAmount",
          "amount",
          "totalPrice",
          "purchaseMoney",
        ],
        customerAddress: ["customerAddress", "address", "addr", "location"],
        remainingBalance: [
          "remainingBalance",
          "balance",
          "remainBalance",
          "surplusAmount",
          "surplus",
          "remainAmount",
        ],
      };

    case "/API/PrepayReport/ConsumptionStatistics":
    case "/api/reports/consumption":
      return {
        collectionDate: [
          "collectionDate",
          "collectDate",
          "dataDate",
          "readDate",
          "periodStart",
          "date",
        ],
        periodStart: [
          "periodStart",
          "collectionDate",
          "collectDate",
          "dataDate",
          "readDate",
          "date",
        ],
        periodEnd: [
          "periodEnd",
          "periodStart",
          "collectionDate",
          "collectDate",
          "dataDate",
          "readDate",
          "date",
        ],
        consumption: [
          "consumption",
          "totalEnergy",
          "energy",
          "usedEnergy",
          "electricityConsumption",
          "consumptionValue",
        ],
        totalEnergy: [
          "totalEnergy",
          "consumption",
          "energy",
          "usedEnergy",
          "electricityConsumption",
          "consumptionValue",
        ],
      };

    case "/API/LoadProfile/ElectricEnergyCurve":
    case "/API/LoadProfile/InstantaneousValueCurve":
    case "/API/LoadProfile/DailyData":
    case "/API/LoadProfile/MonthlyData":
    case "/api/reports/energy-curve/single":
    case "/api/reports/energy-curve/three-phase":
    case "/api/reports/energy-curve/ct":
    case "/api/reports/daily-amr":
    case "/api/reports/monthly-amr":
    case "/api/reports/daily-yield":
    case "/api/reports/monthly-yield":
    case "/api/reports/instantaneous":
      return {
        meterId: meterIdAliases,
        customerName: customerNameAliases,
        collectionDate: [
          "collectionDate",
          "collectDate",
          "dataDate",
          "readDate",
          "currentDate",
          "date",
          "time",
          "timestamp",
        ],
        value: [
          "value",
          "consumption",
          "totalEnergy",
          "energy",
          "usage",
          "usage1",
          "power",
          "activePower",
          "readingValue",
          "readValue",
        ],
        unit: ["unit", "unitLabel", "measureUnit", "uom"],
        status: ["status", "state", "onlineStatus", "eventStatus"],
      };

    default:
      return null;
  }
}

export function mapEndpointRows(endpoint: string | undefined, rows: DataRow[]): DataRow[] {
  const aliasMap = endpoint ? getAliasMapForEndpoint(endpoint) : null;

  if (!aliasMap) {
    return rows;
  }

  return rows.map((row) => applyAliasMap(row, aliasMap));
}
