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
        id: ["id", "customerId", ...customerIdAliases, "code"],
        name: ["name", "customerName", ...customerNameAliases],
        customerId: ["customerId", "id", ...customerIdAliases, "code"],
        customerName: ["customerName", "name", ...customerNameAliases],
        phone: ["phone", "phoneNo", "mobile", "mobileNo", "telephone", "telephoneNo", "tel"],
        address: ["address", "addr", "location", "customerAddress"],
        type: ["type", "customerType", "category"],
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
        oldMeterId: ["oldMeterId", "previousMeterId", "oldSerialNo"],
        meterType: meterTypeAliases,
        ctRatio: ["ctRatio", "ctratio", "ctratio"],
        communicationWay: [
          "communicationWay",
          "commWay",
          "communicationMode",
          "communicationType",
          "commMode",
        ],
        tariffId: tariffIdAliases,
        protocolVersion: ["protocolVersion", "protocol", "protocolType", "version"],
        status: ["status", "accountStatus", "state"],
        remark: remarkAliases,
        createTime: createTimeAliases,
        updateTime: updateTimeAliases,
        stationId: stationIdAliases,
      };

    case "/api/tariff/read":
      return {
        id: ["id", "tariffId", ...tariffIdAliases, "code", "tariffNo"],
        name: ["name", "tariffName", "title", "tariffTitle", "tariffDesc"],
        tariffId: ["tariffId", "id", ...tariffIdAliases, "code", "tariffNo"],
        tariffName: ["tariffName", "name", "title", "tariffTitle", "tariffDesc"],
        price: ["price", "unitPrice", "tariffPrice", "priceValue"],
        tax: ["tax", "vat", "vatCharge", "taxAmount"],
        stationId: stationIdAliases,
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
        stationId: stationIdAliases,
        remark: remarkAliases,
        createTime: createTimeAliases,
        updateTime: updateTimeAliases,
      };

    case "/api/meter/read":
      return {
        status: ["status", "meterStatus", "relayStatus", "state"],
        customerId: customerIdAliases,
        customerName: customerNameAliases,
        gatewayId: gatewayIdAliases,
        meterId: meterIdAliases,
        meterType: meterTypeAliases,
        isThreePhase: ["isThreePhase", "threePhase", "is3Phase"],
        communicationWay: [
          "communicationWay",
          "commWay",
          "communicationMode",
          "communicationType",
          "commMode",
        ],
        protocolVersion: ["protocolVersion", "protocol", "protocolType", "version"],
        lat: ["lat", "latitude"],
        lng: ["lng", "longitude", "lon"],
        baseYear: ["baseYear"],
        sgc: ["sgc"],
        krn: ["krn"],
        ken: ["ken"],
        ti: ["ti"],
        kt: ["kt"],
        remark: remarkAliases,
        createTime: createTimeAliases,
        updateTime: updateTimeAliases,
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
    case "/api/eventNotification/read":
      return {
        id: ["id", "eventId", "alarmId", "notificationId", "serialNumber"],
        eventCode: ["eventCode", "alarmCode", "code", "eventNo", "typeCode"],
        eventType: ["eventType", "alarmType", "eventName", "type"],
        meterId: meterIdAliases,
        description: ["description", "detail", "message", "content", "remark"],
        remark: remarkAliases,
        severity: ["severity", "level", "priority"],
        stationId: stationIdAliases,
        createTime: createTimeAliases,
        updateTime: updateTimeAliases,
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
    case "/api/token/creditTokenCancelRecord/read":
      return {
        receiptId: receiptIdAliases,
        communicationWay: [
          "communicationWay",
          "commWay",
          "communicationMode",
          "communicationType",
          "commMode",
        ],
        customerId: customerIdAliases,
        customerName: customerNameAliases,
        meterId: meterIdAliases,
        meterType: meterTypeAliases,
        tariffId: tariffIdAliases,
        tax: ["tax", "vatCharge", "vat", "taxAmount"],
        vatCharge: ["vatCharge", "tax", "vat", "taxAmount"],
        totalUnit: ["totalUnit", "unit", "totalKwh", "totalQuantity"],
        totalPaid: ["totalPaid", "totalPrice", "paidAmount", "amount"],
        totalPrice: ["totalPrice", "totalPaid", "paidAmount", "amount"],
        tokenRecharge: ["tokenRecharge", "recharge", "rechargeUnit", "vendValue", "unit"],
        monthlyCharge: ["monthlyCharge", "monthCharge", "fixedCharge"],
        totalDebt: ["totalDebt", "debt", "arrears", "debtAmount"],
        remainingDebt: ["remainingDebt", "balanceDebt", "arrearsBalance"],
        payDebt: ["payDebt", "debtPaid", "paidDebt"],
        tokenFirst: ["tokenFirst", "firstToken"],
        tokenSecond: ["tokenSecond", "secondToken"],
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
    case "/api/token/setMaximumPhasePowerUnbalanceLimitTokenRecord/read":
      return {
        receiptId: receiptIdAliases,
        customerId: customerIdAliases,
        customerName: customerNameAliases,
        meterId: meterIdAliases,
        meterType: meterTypeAliases,
        maximumPowerLimit: [
          "maximumPowerLimit",
          "maxPowerLimit",
          "powerLimit",
          "limitPower",
        ],
        status: ["status", "state"],
        createTime: createTimeAliases,
        remark: remarkAliases,
        stationId: stationIdAliases,
      };

    case "/api/token/meterTestToken/read":
      return {
        receiptId: receiptIdAliases,
        customerId: customerIdAliases,
        customerName: customerNameAliases,
        meterId: meterIdAliases,
        meterType: meterTypeAliases,
        testToken: ["testToken", "token", "tokenCode"],
        status: ["status", "state"],
        createTime: createTimeAliases,
        remark: remarkAliases,
        stationId: stationIdAliases,
      };

    case "/api/token/changeMeterKeyTokenRecord/read":
      return {
        receiptId: receiptIdAliases,
        customerId: customerIdAliases,
        customerName: customerNameAliases,
        meterId: meterIdAliases,
        meterType: meterTypeAliases,
        tariffId: tariffIdAliases,
        token: tokenAliases,
        tokenFirst: ["tokenFirst", "firstToken"],
        tokenSecond: ["tokenSecond", "secondToken"],
        status: ["status", "state"],
        createTime: createTimeAliases,
        remark: remarkAliases,
        stationId: stationIdAliases,
      };

    case "/api/token/setMaximumOverdraftLimitTokenRecord/read":
      return {
        receiptId: receiptIdAliases,
        customerId: customerIdAliases,
        customerName: customerNameAliases,
        meterId: meterIdAliases,
        meterType: meterTypeAliases,
        maximumOverdraftLimit: [
          "maximumOverdraftLimit",
          "maxOverdraftLimit",
          "overdraftLimit",
        ],
        status: ["status", "state"],
        createTime: createTimeAliases,
        remark: remarkAliases,
        stationId: stationIdAliases,
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
    case "/api/remoteMeterTask/getReadingTask":
      return {
        id: ["id", "taskId", "serialNumber"],
        name: ["name", "taskName", "title"],
        customerId: [...customerIdAliases, "id"],
        customerName: customerNameAliases,
        meterId: meterIdAliases,
        dataItem: ["dataItem", "item", "readItem", "itemName"],
        dataPrefix: ["dataPrefix", "prefix", "flag"],
        stationId: ["stationId", "site", "siteId", "station", "sectionId"],
        dataValue: ["dataValue", "value", "readValue", "resultValue"],
        data: ["data", "rawData", "result", "frameData"],
        concentratorId: gatewayIdAliases,
        gatewayId: gatewayIdAliases,
        lang: ["lang", "Lang", "language"],
        status: ["status", "taskStatus", "state"],
        remark: remarkAliases,
        createTime: createTimeAliases,
        updateTime: updateTimeAliases,
      };

    case "/API/RemoteMeterTask/GetSettingTask":
    case "/api/remoteMeterTask/getSettingTask":
    case "/API/RemoteMeterTask/GetControlTask":
    case "/api/remoteMeterTask/getControlTask":
    case "/API/RemoteMeterTask/GetTransparentForwardingTask":
    case "/api/remoteMeterTask/GetTransparentForwardingTask":
    case "/API/RemoteMeterTask/GetTokenTask":
    case "/api/remoteMeterTask/getTokenTask":
      return {
        id: ["id", "taskId", "serialNumber"],
        name: ["name", "taskName", "title"],
        customerId: [...customerIdAliases, "id"],
        customerName: customerNameAliases,
        meterId: meterIdAliases,
        dataItem: ["dataItem", "item", "tokenType", "taskType", "type"],
        dataPrefix: ["dataPrefix", "prefix", "flag"],
        token: tokenAliases,
        data: ["data", "rawData", "result", "frameData"],
        concentratorId: gatewayIdAliases,
        gatewayId: gatewayIdAliases,
        lang: ["lang", "Lang", "language"],
        status: ["status", "taskStatus", "state"],
        createTime: createTimeAliases,
        updateTime: updateTimeAliases,
        remark: remarkAliases,
        stationId: ["stationId", "site", "siteId", "station", "sectionId"],
      };

    case "/API/GPRSMeterTask/GPRSGetTokenTask":
      return {
        customerId: [...customerIdAliases, "id"],
        customerName: customerNameAliases,
        meterId: meterIdAliases,
        gatewayId: gatewayIdAliases,
        dataItem: ["dataItem", "item", "tokenType", "taskType", "type", "name"],
        token: ["token", "tokenCode", "clearToken", "stsToken", "data"],
        status: ["status", "taskStatus", "state"],
        createTime: createTimeAliases,
        updateTime: updateTimeAliases,
        stationId: ["stationId", "site", "siteId", "station", "sectionId"],
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
    case "/api/loadProfile/electricEnergyCurve":
    case "/API/LoadProfile/InstantaneousValueCurve":
    case "/api/loadProfile/instantaneousValueCurve":
    case "/API/LoadProfile/DailyData":
    case "/api/loadProfile/dailyData":
    case "/API/LoadProfile/MonthlyData":
    case "/api/loadProfile/monthlyData":
    case "/api/reports/energy-curve/single":
    case "/api/reports/energy-curve/three-phase":
    case "/api/reports/energy-curve/ct":
    case "/api/reports/daily-amr":
    case "/api/reports/monthly-amr":
    case "/api/reports/daily-yield":
    case "/api/reports/monthly-yield":
    case "/api/reports/instantaneous":
      return {
        customerId: customerIdAliases,
        currentDate: ["currentDate"],
        meterId: meterIdAliases,
        customerName: customerNameAliases,
        ctRatio: ["ctRatio", "ctratio", "ct"],
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
        headline: ["headline", "title", "caption", "label"],
        data: ["data", "rawData", "detail", "content"],
        unit: ["unit", "unitLabel", "measureUnit", "uom"],
        status: ["status", "state", "onlineStatus", "eventStatus"],
        stationId: stationIdAliases,
        createTime: createTimeAliases,
        updateTime: updateTimeAliases,
      };

    case "/API/UpdateFirmwareTask/GetUpdateFirmwareTask":
    case "/api/updateFirmwareTask/getUpdateFirmwareTask":
      return {
        id: ["id", "taskId", "serialNumber"],
        name: ["name", "taskName", "title"],
        meterId: meterIdAliases,
        gatewayId: gatewayIdAliases,
        concentratorId: gatewayIdAliases,
        fileName: ["fileName", "binName", "firmwareName"],
        fileUrl: ["fileUrl", "url", "downloadUrl", "path"],
        firmwareVersion: ["firmwareVersion", "version", "targetVersion"],
        status: ["status", "taskStatus", "state"],
        progress: ["progress", "percent", "percentage"],
        createTime: createTimeAliases,
        updateTime: updateTimeAliases,
        stationId: stationIdAliases,
        remark: remarkAliases,
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

