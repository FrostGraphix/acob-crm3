import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTableData } from "../../frontend/src/services/table-data.ts";

test("normalizeTableData supports direct rows and total payloads", () => {
  const result = normalizeTableData({
    rows: [{ id: "A-1", name: "Alpha" }],
    total: "24",
  });

  assert.deepEqual(result, {
    rows: [{ id: "A-1", name: "Alpha" }],
    total: 24,
  });
});

test("normalizeTableData supports list payloads nested under page", () => {
  const result = normalizeTableData({
    page: {
      list: [{ customerId: "C-1" }, { customerId: "C-2" }],
      count: 78,
    },
  });

  assert.deepEqual(result, {
    rows: [{ customerId: "C-1" }, { customerId: "C-2" }],
    total: 78,
  });
});

test("normalizeTableData falls back to array length when total is omitted", () => {
  const result = normalizeTableData({
    data: [{ meterId: "M-1" }, { meterId: "M-2" }],
  });

  assert.deepEqual(result, {
    rows: [{ meterId: "M-1" }, { meterId: "M-2" }],
    total: 2,
  });
});

test("normalizeTableData returns empty state for null or unsupported payloads", () => {
  assert.deepEqual(normalizeTableData(null), {
    rows: [],
    total: 0,
  });

  assert.deepEqual(normalizeTableData({ status: "ok" }), {
    rows: [],
    total: 0,
  });
});

test("normalizeTableData maps customer aliases into the management table keys", () => {
  const result = normalizeTableData(
    {
      rows: [
        {
          customerId: "C-001",
          customerName: "Ada Lovelace",
          mobileNo: "09000000000",
          addr: "Abuja",
          certificateName: "National ID",
          certificateNo: "NIN-001",
          notes: "Priority customer",
          createDate: "2026-03-01 10:00",
          modifyTime: "2026-03-03 08:15",
          stationCode: "TUNGA",
        },
      ],
      total: 1,
    },
    "/api/customer/read",
  );

  assert.deepEqual(result, {
    rows: [
      {
        customerId: "C-001",
        customerName: "Ada Lovelace",
        mobileNo: "09000000000",
        addr: "Abuja",
        certificateName: "National ID",
        certificateNo: "NIN-001",
        notes: "Priority customer",
        createDate: "2026-03-01 10:00",
        modifyTime: "2026-03-03 08:15",
        stationCode: "TUNGA",
        id: "C-001",
        name: "Ada Lovelace",
        phone: "09000000000",
        address: "Abuja",
        certifiName: "National ID",
        certifiNo: "NIN-001",
        remark: "Priority customer",
        createTime: "2026-03-01 10:00",
        updateTime: "2026-03-03 08:15",
        stationId: "TUNGA",
      },
    ],
    total: 1,
  });
});

test("normalizeTableData maps account aliases into the management table keys", () => {
  const result = normalizeTableData(
    {
      rows: [
        {
          consumerId: "C-700",
          consumerName: "Bala",
          meterNo: "M-700",
          meterCategory: "STS",
          commWay: "GPRS",
          tariffName: "RES",
          protocol: "IEC62055",
          notes: "Field verified",
          createDate: "2026-03-04 11:00",
          stationCode: "ABJ-01",
        },
      ],
      total: 1,
    },
    "/api/account/read",
  );

  assert.deepEqual(result.rows[0], {
    consumerId: "C-700",
    consumerName: "Bala",
    meterNo: "M-700",
    meterCategory: "STS",
    commWay: "GPRS",
    tariffName: "RES",
    protocol: "IEC62055",
    notes: "Field verified",
    createDate: "2026-03-04 11:00",
    stationCode: "ABJ-01",
    customerId: "C-700",
    customerName: "Bala",
    meterId: "M-700",
    meterType: "STS",
    communicationWay: "GPRS",
    tariffId: "RES",
    protocolVersion: "IEC62055",
    remark: "Field verified",
    createTime: "2026-03-04 11:00",
    stationId: "ABJ-01",
  });
});

test("normalizeTableData maps tariff aliases into the table column keys", () => {
  const result = normalizeTableData(
    {
      rows: [
        {
          tariffId: "RES",
          tariffName: "Residential",
          tariffPrice: 350,
          createDate: "2026-03-01 10:00",
          modifyTime: "2026-03-03 08:15",
        },
      ],
      total: 1,
    },
    "/api/tariff/read",
  );

  assert.deepEqual(result, {
    rows: [
      {
        tariffId: "RES",
        tariffName: "Residential",
        tariffPrice: 350,
        createDate: "2026-03-01 10:00",
        modifyTime: "2026-03-03 08:15",
        id: "RES",
        name: "Residential",
        price: 350,
        createTime: "2026-03-01 10:00",
        updateTime: "2026-03-03 08:15",
      },
    ],
    total: 1,
  });
});

test("normalizeTableData maps gateway aliases into the management table keys", () => {
  const result = normalizeTableData(
    {
      rows: [
        {
          gatewayStatus: "Online",
          successRatio: 98.5,
          collectorId: "GW-002",
          collectorName: "Collector 2",
        },
      ],
      total: 1,
    },
    "/api/gateway/read",
  );

  assert.deepEqual(result.rows[0], {
    gatewayStatus: "Online",
    successRatio: 98.5,
    collectorId: "GW-002",
    collectorName: "Collector 2",
    status: "Online",
    successRate: 98.5,
    id: "GW-002",
    name: "Collector 2",
  });
});

test("normalizeTableData maps meter aliases into the management table keys", () => {
  const result = normalizeTableData(
    {
      rows: [
        {
          meterNo: "M-321",
          meterCategory: "STS",
          consumerId: "C-321",
          consumerName: "Amina",
          commWay: "GPRS",
          protocol: "DLMS",
          collectorId: "GW-321",
          stationCode: "ABJ-7",
          meterStatus: "Online",
          createDate: "2026-03-14 10:10",
          notes: "Field-installed",
        },
      ],
      total: 1,
    },
    "/api/meter/read",
  );

  assert.deepEqual(result.rows[0], {
    meterNo: "M-321",
    meterCategory: "STS",
    consumerId: "C-321",
    consumerName: "Amina",
    commWay: "GPRS",
    protocol: "DLMS",
    collectorId: "GW-321",
    stationCode: "ABJ-7",
    meterStatus: "Online",
    createDate: "2026-03-14 10:10",
    notes: "Field-installed",
    status: "Online",
    customerId: "C-321",
    customerName: "Amina",
    meterId: "M-321",
    meterType: "STS",
    communicationWay: "GPRS",
    protocolVersion: "DLMS",
    gatewayId: "GW-321",
    remark: "Field-installed",
    createTime: "2026-03-14 10:10",
    stationId: "ABJ-7",
  });
});

test("normalizeTableData maps debt aliases into the management table keys", () => {
  const result = normalizeTableData(
    {
      rows: [
        {
          debtNo: "D-500",
          consumerId: "C-500",
          consumerName: "Usman",
          meterNo: "M-500",
          debtAmount: 4200,
          debtStatus: "Open",
          description: "Outstanding postpaid bill",
          createDate: "2026-03-01 08:00",
          modifyTime: "2026-03-03 09:15",
        },
      ],
      total: 1,
    },
    "/api/debt/read",
  );

  assert.deepEqual(result.rows[0], {
    debtNo: "D-500",
    consumerId: "C-500",
    consumerName: "Usman",
    meterNo: "M-500",
    debtAmount: 4200,
    debtStatus: "Open",
    description: "Outstanding postpaid bill",
    createDate: "2026-03-01 08:00",
    modifyTime: "2026-03-03 09:15",
    id: "D-500",
    customerId: "C-500",
    customerName: "Usman",
    meterId: "M-500",
    amount: 4200,
    status: "Open",
    remark: "Outstanding postpaid bill",
    createTime: "2026-03-01 08:00",
    updateTime: "2026-03-03 09:15",
  });
});

test("normalizeTableData maps DLMS aliases into the protocol table keys", () => {
  const result = normalizeTableData(
    {
      rows: [
        {
          itemId: "DLMS-01",
          objectName: "Voltage Reading",
          obis: "1.0.32.7.0.255",
          interfaceClass: "3",
          attrIndex: "2",
          valueType: "integer",
          notes: "Instantaneous voltage",
        },
      ],
      total: 1,
    },
    "/api/dlms/Read",
  );

  assert.deepEqual(result.rows[0], {
    itemId: "DLMS-01",
    objectName: "Voltage Reading",
    obis: "1.0.32.7.0.255",
    interfaceClass: "3",
    attrIndex: "2",
    valueType: "integer",
    notes: "Instantaneous voltage",
    id: "DLMS-01",
    name: "Voltage Reading",
    obisCode: "1.0.32.7.0.255",
    classId: "3",
    attributeIndex: "2",
    dataType: "integer",
    remark: "Instantaneous voltage",
  });
});

test("normalizeTableData maps DLT645 aliases into the protocol table keys", () => {
  const result = normalizeTableData(
    {
      rows: [
        {
          itemId: "645-01",
          itemName: "Forward Active Energy",
          di: "00010000",
          dataLen: "4",
          valueType: "BCD",
          notes: "Primary energy register",
        },
      ],
      total: 1,
    },
    "/api/dlt645/read",
  );

  assert.deepEqual(result.rows[0], {
    itemId: "645-01",
    itemName: "Forward Active Energy",
    di: "00010000",
    dataLen: "4",
    valueType: "BCD",
    notes: "Primary energy register",
    id: "645-01",
    name: "Forward Active Energy",
    dataIdentifier: "00010000",
    dataLength: "4",
    dataType: "BCD",
    remark: "Primary energy register",
  });
});

test("normalizeTableData maps DLT645 task aliases into the protocol task table keys", () => {
  const result = normalizeTableData(
    {
      rows: [
        {
          taskStatus: "Success",
          meterNo: "M-645",
          di: "00010000",
          resultValue: "1234.56",
          createDate: "2026-03-09 11:00",
          modifyTime: "2026-03-09 11:02",
        },
      ],
      total: 1,
    },
    "/api/DLT645Task/read",
  );

  assert.deepEqual(result.rows[0], {
    taskStatus: "Success",
    meterNo: "M-645",
    di: "00010000",
    resultValue: "1234.56",
    createDate: "2026-03-09 11:00",
    modifyTime: "2026-03-09 11:02",
    status: "Success",
    meterId: "M-645",
    dataIdentifier: "00010000",
    dataValue: "1234.56",
    createTime: "2026-03-09 11:00",
    updateTime: "2026-03-09 11:02",
  });
});

test("normalizeTableData maps event notification aliases into the event table keys", () => {
  const result = normalizeTableData(
    {
      rows: [
        {
          alarmId: "EV-1",
          alarmType: "Magnetic Interference",
          meterNo: "M-ALARM",
          message: "Magnetic event detected",
          level: "Critical",
          createDate: "2026-03-11 07:45",
          eventStatus: "Unread",
        },
      ],
      total: 1,
    },
    "/API/EventNotification/Read",
  );

  assert.deepEqual(result.rows[0], {
    alarmId: "EV-1",
    alarmType: "Magnetic Interference",
    meterNo: "M-ALARM",
    message: "Magnetic event detected",
    level: "Critical",
    createDate: "2026-03-11 07:45",
    eventStatus: "Unread",
    id: "EV-1",
    eventType: "Magnetic Interference",
    meterId: "M-ALARM",
    description: "Magnetic event detected",
    severity: "Critical",
    createTime: "2026-03-11 07:45",
    status: "Unread",
  });
});

test("normalizeTableData maps system log aliases into the log table keys", () => {
  const result = normalizeTableData(
    {
      rows: [
        {
          logId: "LOG-9",
          operationName: "Delete Customer",
          userName: "admin",
          clientIp: "127.0.0.1",
          moduleName: "Customer",
          message: "Deleted duplicate record",
          createDate: "2026-03-12 15:30",
        },
      ],
      total: 1,
    },
    "/api/Log/read",
  );

  assert.deepEqual(result.rows[0], {
    logId: "LOG-9",
    operationName: "Delete Customer",
    userName: "admin",
    clientIp: "127.0.0.1",
    moduleName: "Customer",
    message: "Deleted duplicate record",
    createDate: "2026-03-12 15:30",
    id: "LOG-9",
    action: "Delete Customer",
    username: "admin",
    ipAddress: "127.0.0.1",
    module: "Customer",
    detail: "Deleted duplicate record",
    createTime: "2026-03-12 15:30",
  });
});

test("normalizeTableData maps token record aliases for vend, timestamps, and station", () => {
  const creditResult = normalizeTableData(
    {
      rows: [
        {
          receiptNo: "R-900",
          consumerId: "C-900",
          consumerName: "Fatima",
          meterNo: "M-900",
          meterCategory: "STS",
          tariffName: "RES",
          vend: "AGENT-1",
          tax: 5,
          totalKwh: 33.4,
          totalPaid: 4200,
          tokenCode: "11112222333344445555",
          description: "Over-the-counter vend",
          stationCode: "ST-9",
          createDate: "2026-03-10 07:20",
        },
      ],
      total: 1,
    },
    "/api/token/creditTokenRecord/read",
  );

  assert.equal(creditResult.rows[0]?.receiptId, "R-900");
  assert.equal(creditResult.rows[0]?.customerId, "C-900");
  assert.equal(creditResult.rows[0]?.customerName, "Fatima");
  assert.equal(creditResult.rows[0]?.meterId, "M-900");
  assert.equal(creditResult.rows[0]?.meterType, "STS");
  assert.equal(creditResult.rows[0]?.tariffId, "RES");
  assert.equal(creditResult.rows[0]?.createId, "AGENT-1");
  assert.equal(creditResult.rows[0]?.vatCharge, 5);
  assert.equal(creditResult.rows[0]?.totalUnit, 33.4);
  assert.equal(creditResult.rows[0]?.totalPrice, 4200);
  assert.equal(creditResult.rows[0]?.token, "11112222333344445555");
  assert.equal(creditResult.rows[0]?.remark, "Over-the-counter vend");
  assert.equal(creditResult.rows[0]?.stationId, "ST-9");
  assert.equal(creditResult.rows[0]?.createTime, "2026-03-10 07:20");

  const result = normalizeTableData(
    {
      rows: [
        {
          receiptNo: "R-001",
          consumerId: "C-001",
          consumerName: "Ada",
          meterNo: "M-001",
          vend: "SYSTEM",
          tokenCode: "12345678901234567890",
          createDate: "2026-03-05 09:30",
          stationID: "STATION-001",
        },
      ],
      total: 1,
    },
    "/api/token/clearCreditTokenRecord/read",
  );

  assert.deepEqual(result.rows[0], {
    receiptNo: "R-001",
    consumerId: "C-001",
    consumerName: "Ada",
    meterNo: "M-001",
    vend: "SYSTEM",
    tokenCode: "12345678901234567890",
    createDate: "2026-03-05 09:30",
    stationID: "STATION-001",
    receiptId: "R-001",
    customerId: "C-001",
    customerName: "Ada",
    meterId: "M-001",
    tokenRecharge: "12345678901234567890",
    createTime: "2026-03-05 09:30",
    stationId: "STATION-001",
  });
});

test("normalizeTableData maps interval data aliases into the configured report columns", () => {
  const result = normalizeTableData(
    {
      data: [
        {
          meterNo: "47005332649",
          collectorId: "GW-100",
          collectDate: "2025-11-05",
          consumerId: "C-009",
          consumerName: "Grace",
          station: "TUNGA",
          energy: 48.2,
          hourUsage: 2.4,
          balance: 3150,
          maxDemand: 11.7,
          activePower: 4.8,
          relay: "Closed",
          energyState: "Normal",
          magnetic: "Clear",
          terminalCoverStatus: "Closed",
          upperOpenStatus: "No",
          reverseCurrent: "No",
          unbalanceCurrent: "Low",
          modifyTime: "2026-03-11 14:00",
        },
      ],
    },
    "/api/DailyDataMeter/read",
  );

  assert.deepEqual(result.rows[0], {
    meterNo: "47005332649",
    collectorId: "GW-100",
    collectDate: "2025-11-05",
    consumerId: "C-009",
    consumerName: "Grace",
    station: "TUNGA",
    energy: 48.2,
    hourUsage: 2.4,
    balance: 3150,
    maxDemand: 11.7,
    activePower: 4.8,
    relay: "Closed",
    energyState: "Normal",
    magnetic: "Clear",
    terminalCoverStatus: "Closed",
    upperOpenStatus: "No",
    reverseCurrent: "No",
    unbalanceCurrent: "Low",
    modifyTime: "2026-03-11 14:00",
    consumption: 48.2,
    meterId: "47005332649",
    gatewayId: "GW-100",
    collectionDate: "2025-11-05",
    customerId: "C-009",
    customerName: "Grace",
    stationId: "TUNGA",
    sectionId: "TUNGA",
    totalEnergy: 48.2,
    lastHourUsage: 2.4,
    creditBalance: 3150,
    maximumDemand: 11.7,
    power: 4.8,
    relayStatus: "Closed",
    energyStatus: "Normal",
    magneticStatus: "Clear",
    terminalCover: "Closed",
    upperOpen: "No",
    currentReverse: "No",
    currentUnbalance: "Low",
    updateTime: "2026-03-11 14:00",
  });
});

test("normalizeTableData maps live interval data field names into the configured report columns", () => {
  const result = normalizeTableData(
    {
      data: [
        {
          currentDate: "2026-03-11 00:00:00",
          customerId: "47005326427",
          customerName: "IBRAHIM IWALA",
          meterId: "47005326427",
          usage1: "0",
          total1: 5,
          remain1: 0,
          intervalDemand: 0,
          power: 0,
          relayOpen: false,
          magneticInterference: true,
          terminalCoverOpen: true,
          coverOpen: true,
          source2Activated: true,
          currentReverse: true,
          currentUnbalance: true,
          stationId: "MUSHA",
          gatewayId: "E4-38-19-FF-FE-1A-BE-63",
          updateDate: "2026-03-11 16:22:00",
        },
      ],
      total: 1,
    },
    "/api/DailyDataMeter/read",
  );

  assert.deepEqual(result.rows[0], {
    currentDate: "2026-03-11 00:00:00",
    customerId: "47005326427",
    customerName: "IBRAHIM IWALA",
    meterId: "47005326427",
    consumption: 5,
    usage1: "0",
    total1: 5,
    remain1: 0,
    intervalDemand: 0,
    power: 0,
    relayOpen: false,
    magneticInterference: true,
    terminalCoverOpen: true,
    coverOpen: true,
    source2Activated: true,
    currentReverse: true,
    currentUnbalance: true,
    stationId: "MUSHA",
    gatewayId: "E4-38-19-FF-FE-1A-BE-63",
    updateDate: "2026-03-11 16:22:00",
    collectionDate: "2026-03-11 00:00:00",
    consumption: 5,
    sectionId: "MUSHA",
    totalEnergy: 5,
    lastHourUsage: "0",
    creditBalance: 0,
    maximumDemand: 0,
    relayStatus: false,
    energyStatus: true,
    magneticStatus: true,
    terminalCover: true,
    upperOpen: true,
    updateTime: "2026-03-11 16:22:00",
  });
});

test("normalizeTableData maps low purchase aliases into the report table keys", () => {
  const result = normalizeTableData(
    {
      rows: [
        {
          consumerId: "C-100",
          consumerName: "Musa",
          meterNo: "M-100",
          tariffName: "RESID",
          totalKwh: 87.5,
          purchaseMoney: 12500,
          addr: "Tunga Maje",
          balance: 125,
        },
      ],
      total: 1,
    },
    "/API/PrepayReport/LowPurchaseSituation",
  );

  assert.deepEqual(result.rows[0], {
    consumerId: "C-100",
    consumerName: "Musa",
    meterNo: "M-100",
    tariffName: "RESID",
    totalKwh: 87.5,
    purchaseMoney: 12500,
    addr: "Tunga Maje",
    balance: 125,
    customerId: "C-100",
    customerName: "Musa",
    meterId: "M-100",
    tariffId: "RESID",
    tariff: "RESID",
    totalUnit: 87.5,
    totalPaid: 12500,
    customerAddress: "Tunga Maje",
    remainingBalance: 125,
  });
});

test("normalizeTableData maps live low purchase field names into the report table keys", () => {
  const result = normalizeTableData(
    {
      rows: [
        {
          customerId: "47005371142",
          customerName: "ABDUSALEM",
          customerAddress: "UMAISHA",
          meterId: "47005371142",
          tariffId: "RESIDENTIAL",
          purchaseTotalUnit: 0.8,
          purchaseTotalPaid: 300,
        },
      ],
      total: 1,
    },
    "/API/PrepayReport/LowPurchaseSituation",
  );

  assert.deepEqual(result.rows[0], {
    customerId: "47005371142",
    customerName: "ABDUSALEM",
    customerAddress: "UMAISHA",
    meterId: "47005371142",
    tariffId: "RESIDENTIAL",
    purchaseTotalUnit: 0.8,
    purchaseTotalPaid: 300,
    tariff: "RESIDENTIAL",
    totalUnit: 0.8,
    totalPaid: 300,
  });
});

test("normalizeTableData maps long nonpurchase aliases into the report table keys", () => {
  const result = normalizeTableData(
    {
      rows: [
        {
          consumerId: "C-200",
          consumerName: "Grace",
          meterNo: "M-200",
          tariffName: "COMM",
          nonpurchaseDays: 34,
        },
      ],
      total: 1,
    },
    "/API/PrepayReport/LongNonpurchaseSituation",
  );

  assert.deepEqual(result.rows[0], {
    consumerId: "C-200",
    consumerName: "Grace",
    meterNo: "M-200",
    tariffName: "COMM",
    nonpurchaseDays: 34,
    customerId: "C-200",
    customerName: "Grace",
    meterId: "M-200",
    tariff: "COMM",
    daysWithoutPurchase: 34,
  });
});

test("normalizeTableData maps consumption statistics aliases into the report table keys", () => {
  const result = normalizeTableData(
    {
      rows: [
        {
          periodStart: "2026-03-01",
          totalEnergy: 18.5,
        },
      ],
      total: 1,
    },
    "/API/PrepayReport/ConsumptionStatistics",
  );

  assert.deepEqual(result.rows[0], {
    periodStart: "2026-03-01",
    totalEnergy: 18.5,
    collectionDate: "2026-03-01",
    periodEnd: "2026-03-01",
    consumption: 18.5,
  });
});

test("normalizeTableData maps meter reading task aliases into the task table keys", () => {
  const result = normalizeTableData(
    {
      rows: [
        {
          consumerId: "C-300",
          consumerName: "Hauwa",
          meterNo: "M-300",
          itemName: "Power",
          site: "TUNGA",
          readValue: "229.4V",
          taskStatus: "Success",
          createDate: "2026-03-11 08:10",
          modifyTime: "2026-03-11 08:12",
        },
      ],
      total: 1,
    },
    "/API/RemoteMeterTask/GetReadingTask",
  );

  assert.deepEqual(result.rows[0], {
    consumerId: "C-300",
    consumerName: "Hauwa",
    meterNo: "M-300",
    itemName: "Power",
    site: "TUNGA",
    readValue: "229.4V",
    taskStatus: "Success",
    createDate: "2026-03-11 08:10",
    modifyTime: "2026-03-11 08:12",
    customerId: "C-300",
    customerName: "Hauwa",
    meterId: "M-300",
    dataItem: "Power",
    stationId: "TUNGA",
    dataValue: "229.4V",
    status: "Success",
    createTime: "2026-03-11 08:10",
    updateTime: "2026-03-11 08:12",
  });
});
