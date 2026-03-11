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
        customerName: customerNameAliases,
        meterId: meterIdAliases,
        meterType: meterTypeAliases,
        remark: remarkAliases,
        stationId: stationIdAliases,
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
        collectionDate: [
          "collectionDate",
          "collectDate",
          "dataDate",
          "readDate",
          "collectionTime",
          "currentDate",
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
