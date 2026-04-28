export interface UpstreamRequestPlan {
  body: Record<string, unknown>;
  candidateBodies: Record<string, unknown>[];
  timeoutMs?: number;
}

function toRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseDateString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return { year, month, day };
  }

  const dayFirstMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dayFirstMatch) {
    const [, day, month, year] = dayFirstMatch;
    return { year, month, day };
  }

  return null;
}

function toIsoDate(value: unknown) {
  const parsed = parseDateString(value);
  return parsed ? `${parsed.year}-${parsed.month}-${parsed.day}` : value;
}

function toDayFirstDate(value: unknown) {
  const parsed = parseDateString(value);
  return parsed ? `${parsed.day}/${parsed.month}/${parsed.year}` : value;
}

function dedupeBodies(bodies: Record<string, unknown>[]) {
  const seen = new Set<string>();
  const unique: Record<string, unknown>[] = [];

  for (const body of bodies) {
    const key = JSON.stringify(body);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(body);
  }

  return unique;
}

function applyUpstreamDefaults(pathname: string, body: Record<string, unknown>) {
  const nextBody = { ...body };
  const requiresLang =
    pathname.startsWith("/API/PrepayReport/") ||
    pathname.startsWith("/api/DailyData/") ||
    pathname.startsWith("/api/DailyDataMeter/") ||
    pathname.startsWith("/API/LoadProfile/");
  const requiresTaskLang = pathname.startsWith("/API/RemoteMeterTask/Get");
  const requiresGprsTaskLang =
    pathname.startsWith("/API/GPRSMeterTask/GPRSGet") ||
    pathname.startsWith("/api/GPRSMeterTask/GPRSGet");

  if (requiresLang || requiresTaskLang) {
    const currentLang = typeof nextBody.Lang === "string" ? nextBody.Lang.trim() : "";
    if (currentLang.length === 0) {
      nextBody.Lang = "en";
    }
  }

  if (requiresGprsTaskLang) {
    const currentLang = typeof nextBody.lang === "string" ? nextBody.lang.trim() : "";
    if (currentLang.length === 0) {
      nextBody.lang = "en";
    }
  }

  return nextBody;
}

function buildLoadProfileBodies(pathname: string, body: Record<string, unknown>) {
  const meterId =
    typeof body.meterId === "string" && body.meterId.trim().length > 0
      ? body.meterId.trim()
      : typeof body.searchTerm === "string" && body.searchTerm.trim().length > 0
        ? body.searchTerm.trim()
        : undefined;

  const withPaging = {
    pageNumber: typeof body.pageNumber === "number" ? body.pageNumber : 1,
    pageSize: typeof body.pageSize === "number" ? body.pageSize : 10,
    page: typeof body.page === "number" ? body.page : 1,
    limit: typeof body.limit === "number" ? body.limit : (typeof body.pageSize === "number" ? body.pageSize : 10),
    ...body,
  };

  const isoDates = {
    ...withPaging,
    fromDate: toIsoDate(body.fromDate),
    toDate: toIsoDate(body.toDate),
  };

  const dayFirstDates = {
    ...withPaging,
    fromDate: toDayFirstDate(body.fromDate),
    toDate: toDayFirstDate(body.toDate),
  };

  const endpointLabel = pathname.endsWith("/MonthlyData") ? "monthly" : "daily";

  const isoWithAliases = {
    ...isoDates,
    meterNo: meterId,
    meterCode: meterId,
    searchWord: meterId,
    keyword: meterId,
    startDate: isoDates.fromDate,
    endDate: isoDates.toDate,
    beginDate: isoDates.fromDate,
    finishDate: isoDates.toDate,
    startTime: isoDates.fromDate,
    endTime: isoDates.toDate,
    periodType: endpointLabel,
  };

  const dayFirstWithAliases = {
    ...dayFirstDates,
    meterNo: meterId,
    meterCode: meterId,
    searchWord: meterId,
    keyword: meterId,
    startDate: dayFirstDates.fromDate,
    endDate: dayFirstDates.toDate,
    beginDate: dayFirstDates.fromDate,
    finishDate: dayFirstDates.toDate,
    startTime: dayFirstDates.fromDate,
    endTime: dayFirstDates.toDate,
    periodType: endpointLabel,
  };

  return dedupeBodies([
    body,
    withPaging,
    isoDates,
    dayFirstDates,
    isoWithAliases,
    dayFirstWithAliases,
  ]);
}

function buildRemoteTaskCreateBodies(pathname: string, body: Record<string, unknown>) {
  const target = toRecord(body.target);
  const base = {
    taskName: body.taskName,
    name: body.name ?? body.taskName,
    scheduleDate: body.scheduleDate,
    taskType: body.taskType,
    meterId: target.meterId,
    customerId: target.customerId,
    customerName: target.customerName,
    meterType: target.meterType,
    stationId: target.stationId,
    gatewayId: target.gatewayId,
    protocolVersion: target.protocolVersion,
    dataPrefix: body.dataPrefix,
    remark: body.remark,
  };

  if (pathname === "/API/RemoteMeterTask/CreateReadingTask") {
    return dedupeBodies([
      {
        ...base,
        dataItem: body.dataItem,
        data: body.data,
        readMode: body.readMode,
      },
      {
        ...base,
        meterNo: target.meterId,
        customerNo: target.customerId,
        site: target.stationId,
        itemCode: body.dataItem,
        itemId: body.dataItem,
        flag: body.flag ?? body.dataPrefix ?? body.dataItem,
        dataPrefix: body.dataPrefix,
        remark: body.remark,
        name: body.name ?? body.taskName,
        data: body.data,
        readType: body.readMode,
      },
    ]);
  }

  if (pathname === "/API/RemoteMeterTask/CreateSettingTask") {
    return dedupeBodies([
      {
        ...base,
        settingKey: body.settingKey,
        settingValue: body.settingValue,
        data: body.data,
        valueType: body.valueType,
      },
      {
        ...base,
        meterNo: target.meterId,
        customerNo: target.customerId,
        site: target.stationId,
        name: body.name ?? body.taskName,
        dataPrefix: body.dataPrefix,
        remark: body.remark,
        paramKey: body.settingKey,
        paramValue: body.settingValue,
        data: body.data ?? body.settingValue,
        settingType: body.valueType,
      },
    ]);
  }

  if (pathname === "/API/RemoteMeterTask/CreateControlTask") {
    return dedupeBodies([
      {
        ...base,
        controlCommand: body.controlCommand,
        reason: body.reason,
        data: body.data,
      },
      {
        ...base,
        meterNo: target.meterId,
        customerNo: target.customerId,
        site: target.stationId,
        name: body.name ?? body.taskName,
        dataPrefix: body.dataPrefix,
        commandType: body.controlCommand,
        command: body.controlCommand,
        remark: body.remark ?? body.reason,
        data: body.data ?? body.controlCommand,
      },
    ]);
  }

  if (pathname === "/API/RemoteMeterTask/CreateTokenTask") {
    return dedupeBodies([
      {
        ...base,
        tokenType: body.tokenType,
        tokenValue: body.tokenValue,
        data: body.data,
      },
      {
        ...base,
        meterNo: target.meterId,
        customerNo: target.customerId,
        site: target.stationId,
        name: body.name ?? body.taskName,
        dataPrefix: body.dataPrefix,
        commandType: body.tokenType,
        token: body.tokenValue,
        data: body.data ?? body.tokenValue,
      },
    ]);
  }

  if (pathname === "/API/RemoteMeterTask/CreateTransparentForwardingTask") {
    return dedupeBodies([
      {
        ...base,
        protocolMode: body.protocolMode,
        commandPayload: body.commandPayload,
        timeoutSeconds: body.timeoutSeconds,
      },
      {
        ...base,
        meterNo: target.meterId,
        customerNo: target.customerId,
        site: target.stationId,
        name: body.name ?? body.taskName,
        dataPrefix: body.dataPrefix,
        remark: body.remark,
        mode: body.protocolMode,
        payload: body.commandPayload,
        timeout: body.timeoutSeconds,
      },
    ]);
  }

  return [body];
}

function resolveGprsProtocolId(body: Record<string, unknown>, target: Record<string, unknown>) {
  const directProtocolId =
    typeof body.protocolId === "number" && Number.isFinite(body.protocolId)
      ? body.protocolId
      : typeof body.protocolId === "string" && body.protocolId.trim().length > 0
        ? Number(body.protocolId)
        : null;

  if (directProtocolId !== null && Number.isFinite(directProtocolId)) {
    return directProtocolId;
  }

  const protocolVersion =
    typeof target.protocolVersion === "string" ? target.protocolVersion.trim() : "";

  if (protocolVersion === "2.2") {
    return 22;
  }

  if (protocolVersion === "2.0") {
    return 20;
  }

  return 0;
}

function buildGprsTaskCreateBodies(pathname: string, body: Record<string, unknown>) {
  const target = toRecord(body.target);
  const protocolId = resolveGprsProtocolId(body, target);
  const customerId =
    typeof target.customerId === "string" && target.customerId.trim().length > 0
      ? target.customerId.trim()
      : typeof body.customerId === "string" && body.customerId.trim().length > 0
        ? body.customerId.trim()
        : undefined;
  const meterId =
    typeof target.meterId === "string" && target.meterId.trim().length > 0
      ? target.meterId.trim()
      : typeof body.meterId === "string" && body.meterId.trim().length > 0
        ? body.meterId.trim()
        : undefined;
  const stationId =
    typeof target.stationId === "string" && target.stationId.trim().length > 0
      ? target.stationId.trim()
      : typeof body.stationId === "string" && body.stationId.trim().length > 0
        ? body.stationId.trim()
        : undefined;

  if (pathname.endsWith("GPRSCreateTokenTask")) {
    const data =
      typeof body.tokenValue === "string" && body.tokenValue.trim().length > 0
        ? body.tokenValue.trim()
        : typeof body.data === "string" && body.data.trim().length > 0
          ? body.data.trim()
          : "";

    return dedupeBodies([
      {
        customerId,
        meterId,
        protocolId,
        data,
        stationId,
      },
    ]);
  }

  return [body];
}

function buildGprsTaskReadBodies(body: Record<string, unknown>) {
  const pageNumber = typeof body.pageNumber === "number" ? body.pageNumber : 1;
  const pageSize = typeof body.pageSize === "number" ? body.pageSize : 20;

  return dedupeBodies([
    body,
    {
      ...body,
      pageNumber,
      pageSize,
      lang: typeof body.lang === "string" && body.lang.trim().length > 0 ? body.lang : "en",
    },
  ]);
}

function buildGprsTaskUpdateBodies(body: Record<string, unknown>) {
  const row = toRecord(body.row);
  const parsedRowId =
    typeof row.id === "number" && Number.isFinite(row.id)
      ? row.id
      : typeof row.id === "string" && row.id.trim().length > 0
        ? Number(row.id)
        : null;
  const parsedBodyId =
    typeof body.id === "number" && Number.isFinite(body.id)
      ? body.id
      : typeof body.id === "string" && body.id.trim().length > 0
        ? Number(body.id)
        : null;
  const id = parsedRowId ?? parsedBodyId ?? undefined;
  const stationId =
    typeof row.stationId === "string" && row.stationId.trim().length > 0
      ? row.stationId.trim()
      : typeof body.stationId === "string" && body.stationId.trim().length > 0
        ? body.stationId.trim()
        : undefined;

  return dedupeBodies([
    body,
    {
      id,
      stationId,
    },
  ]);
}

function buildConsumptionStatisticsBodies(body: Record<string, unknown>) {
  const customerId =
    typeof body.customerId === "string" && body.customerId.trim().length > 0
      ? body.customerId.trim()
      : undefined;
  const meterId =
    typeof body.meterId === "string" && body.meterId.trim().length > 0
      ? body.meterId.trim()
      : undefined;

  const withPaging = {
    pageNumber: 1,
    pageSize: 10,
    page: 1,
    limit: 10,
    ...body,
  };

  const isoDates = {
    ...withPaging,
    fromDate: toIsoDate(body.fromDate),
    toDate: toIsoDate(body.toDate),
  };

  const dayFirstDates = {
    ...withPaging,
    fromDate: toDayFirstDate(body.fromDate),
    toDate: toDayFirstDate(body.toDate),
  };

  const isoWithAliases = {
    ...isoDates,
    consumerId: customerId,
    customerNo: customerId,
    meterNo: meterId,
    meterCode: meterId,
    startDate: isoDates.fromDate,
    endDate: isoDates.toDate,
    beginDate: isoDates.fromDate,
    finishDate: isoDates.toDate,
    startTime: isoDates.fromDate,
    endTime: isoDates.toDate,
  };

  const dayFirstWithAliases = {
    ...dayFirstDates,
    consumerId: customerId,
    customerNo: customerId,
    meterNo: meterId,
    meterCode: meterId,
    startDate: dayFirstDates.fromDate,
    endDate: dayFirstDates.toDate,
    beginDate: dayFirstDates.fromDate,
    finishDate: dayFirstDates.toDate,
    startTime: dayFirstDates.fromDate,
    endTime: dayFirstDates.toDate,
  };

  return dedupeBodies([
    body,
    withPaging,
    isoDates,
    dayFirstDates,
    isoWithAliases,
    dayFirstWithAliases,
  ]);
}

function buildLongNonpurchaseBodies(body: Record<string, unknown>) {
  const customerId =
    typeof body.customerId === "string" && body.customerId.trim().length > 0
      ? body.customerId.trim()
      : undefined;
  const meterId =
    typeof body.meterId === "string" && body.meterId.trim().length > 0
      ? body.meterId.trim()
      : undefined;
  const nonpurchaseDaysStart =
    typeof body.nonpurchaseDaysStart === "number"
      ? body.nonpurchaseDaysStart
      : typeof body.nonpurchaseDaysStart === "string" && body.nonpurchaseDaysStart.trim().length > 0
        ? Number(body.nonpurchaseDaysStart)
        : undefined;
  const nonpurchaseDaysEnd =
    typeof body.nonpurchaseDaysEnd === "number"
      ? body.nonpurchaseDaysEnd
      : typeof body.nonpurchaseDaysEnd === "string" && body.nonpurchaseDaysEnd.trim().length > 0
        ? Number(body.nonpurchaseDaysEnd)
        : undefined;

  const withPaging = {
    pageNumber: typeof body.pageNumber === "number" ? body.pageNumber : 1,
    pageSize: typeof body.pageSize === "number" ? body.pageSize : 10,
    page: typeof body.page === "number" ? body.page : 1,
    limit: typeof body.limit === "number" ? body.limit : (typeof body.pageSize === "number" ? body.pageSize : 10),
    ...body,
  };

  const aliased = {
    ...withPaging,
    consumerId: customerId,
    customerNo: customerId,
    meterNo: meterId,
    meterCode: meterId,
    daysStart: Number.isFinite(nonpurchaseDaysStart) ? nonpurchaseDaysStart : undefined,
    daysEnd: Number.isFinite(nonpurchaseDaysEnd) ? nonpurchaseDaysEnd : undefined,
    startDays: Number.isFinite(nonpurchaseDaysStart) ? nonpurchaseDaysStart : undefined,
    endDays: Number.isFinite(nonpurchaseDaysEnd) ? nonpurchaseDaysEnd : undefined,
    nonPurchaseDaysStart: Number.isFinite(nonpurchaseDaysStart) ? nonpurchaseDaysStart : undefined,
    nonPurchaseDaysEnd: Number.isFinite(nonpurchaseDaysEnd) ? nonpurchaseDaysEnd : undefined,
    noPurchaseDaysStart: Number.isFinite(nonpurchaseDaysStart) ? nonpurchaseDaysStart : undefined,
    noPurchaseDaysEnd: Number.isFinite(nonpurchaseDaysEnd) ? nonpurchaseDaysEnd : undefined,
    minDays: Number.isFinite(nonpurchaseDaysStart) ? nonpurchaseDaysStart : undefined,
    maxDays: Number.isFinite(nonpurchaseDaysEnd) ? nonpurchaseDaysEnd : undefined,
  };

  return dedupeBodies([body, withPaging, aliased]);
}

function buildLowPurchaseBodies(body: Record<string, unknown>) {
  const customerId =
    typeof body.customerId === "string" && body.customerId.trim().length > 0
      ? body.customerId.trim()
      : undefined;
  const meterId =
    typeof body.meterId === "string" && body.meterId.trim().length > 0
      ? body.meterId.trim()
      : undefined;
  const lowLimit =
    typeof body.lowLimit === "number"
      ? body.lowLimit
      : typeof body.lowLimit === "string" && body.lowLimit.trim().length > 0
        ? Number(body.lowLimit)
        : undefined;

  const withPaging = {
    pageNumber: typeof body.pageNumber === "number" ? body.pageNumber : 1,
    pageSize: typeof body.pageSize === "number" ? body.pageSize : 10,
    page: typeof body.page === "number" ? body.page : 1,
    limit:
      typeof body.limit === "number"
        ? body.limit
        : (typeof body.pageSize === "number" ? body.pageSize : 10),
    ...body,
  };

  const isoDates = {
    ...withPaging,
    fromDate: toIsoDate(body.fromDate),
    toDate: toIsoDate(body.toDate),
  };

  const dayFirstDates = {
    ...withPaging,
    fromDate: toDayFirstDate(body.fromDate),
    toDate: toDayFirstDate(body.toDate),
  };

  const isoWithAliases = {
    ...isoDates,
    consumerId: customerId,
    customerNo: customerId,
    meterNo: meterId,
    meterCode: meterId,
    startDate: isoDates.fromDate,
    endDate: isoDates.toDate,
    beginDate: isoDates.fromDate,
    finishDate: isoDates.toDate,
    startTime: isoDates.fromDate,
    endTime: isoDates.toDate,
    lowBalance: Number.isFinite(lowLimit) ? lowLimit : undefined,
    lowAmount: Number.isFinite(lowLimit) ? lowLimit : undefined,
    balanceLimit: Number.isFinite(lowLimit) ? lowLimit : undefined,
    threshold: Number.isFinite(lowLimit) ? lowLimit : undefined,
    minBalance: Number.isFinite(lowLimit) ? lowLimit : undefined,
  };

  const dayFirstWithAliases = {
    ...dayFirstDates,
    consumerId: customerId,
    customerNo: customerId,
    meterNo: meterId,
    meterCode: meterId,
    startDate: dayFirstDates.fromDate,
    endDate: dayFirstDates.toDate,
    beginDate: dayFirstDates.fromDate,
    finishDate: dayFirstDates.toDate,
    startTime: dayFirstDates.fromDate,
    endTime: dayFirstDates.toDate,
    lowBalance: Number.isFinite(lowLimit) ? lowLimit : undefined,
    lowAmount: Number.isFinite(lowLimit) ? lowLimit : undefined,
    balanceLimit: Number.isFinite(lowLimit) ? lowLimit : undefined,
    threshold: Number.isFinite(lowLimit) ? lowLimit : undefined,
    minBalance: Number.isFinite(lowLimit) ? lowLimit : undefined,
  };

  return dedupeBodies([
    body,
    withPaging,
    isoDates,
    dayFirstDates,
    isoWithAliases,
    dayFirstWithAliases,
  ]);
}

function buildDailyDataMeterBodies(body: Record<string, unknown>) {
  const customerId =
    typeof body.customerId === "string" && body.customerId.trim().length > 0
      ? body.customerId.trim()
      : undefined;
  const meterId =
    typeof body.meterId === "string" && body.meterId.trim().length > 0
      ? body.meterId.trim()
      : undefined;
  const stationId =
    typeof body.stationId === "string" && body.stationId.trim().length > 0
      ? body.stationId.trim()
      : typeof body.site === "string" && body.site.trim().length > 0
        ? body.site.trim()
        : typeof body.siteId === "string" && body.siteId.trim().length > 0
          ? body.siteId.trim()
          : typeof body.station === "string" && body.station.trim().length > 0
            ? body.station.trim()
            : undefined;

  const withPaging = {
    pageNumber: typeof body.pageNumber === "number" ? body.pageNumber : 1,
    pageSize: typeof body.pageSize === "number" ? body.pageSize : 500,
    page: typeof body.page === "number" ? body.page : 1,
    limit: typeof body.limit === "number" ? body.limit : (typeof body.pageSize === "number" ? body.pageSize : 500),
    ...body,
  };

  const isoDates = {
    ...withPaging,
    fromDate: toIsoDate(body.fromDate),
    toDate: toIsoDate(body.toDate),
  };

  const dayFirstDates = {
    ...withPaging,
    fromDate: toDayFirstDate(body.fromDate),
    toDate: toDayFirstDate(body.toDate),
  };

  const isoWithAliases = {
    ...isoDates,
    consumerId: customerId,
    customerNo: customerId,
    meterNo: meterId,
    meterCode: meterId,
    station: stationId,
    stationId,
    site: stationId,
    siteId: stationId,
    sectionId: stationId,
    startDate: isoDates.fromDate,
    endDate: isoDates.toDate,
    beginDate: isoDates.fromDate,
    finishDate: isoDates.toDate,
    startTime: isoDates.fromDate,
    endTime: isoDates.toDate,
  };

  const dayFirstWithAliases = {
    ...dayFirstDates,
    consumerId: customerId,
    customerNo: customerId,
    meterNo: meterId,
    meterCode: meterId,
    station: stationId,
    stationId,
    site: stationId,
    siteId: stationId,
    sectionId: stationId,
    startDate: dayFirstDates.fromDate,
    endDate: dayFirstDates.toDate,
    beginDate: dayFirstDates.fromDate,
    finishDate: dayFirstDates.toDate,
    startTime: dayFirstDates.fromDate,
    endTime: dayFirstDates.toDate,
  };

  return dedupeBodies([
    body,
    withPaging,
    isoDates,
    dayFirstDates,
    isoWithAliases,
    dayFirstWithAliases,
  ]);
}

function omitActionScaffolding(body: Record<string, unknown>) {
  const { row: _row, selectedKeys: _selectedKeys, ...rest } = body;
  return rest;
}

function coerceNumberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function coerceBooleanLike(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value.trim().toLowerCase() === "true") {
      return true;
    }
    if (value.trim().toLowerCase() === "false") {
      return false;
    }
  }

  return undefined;
}

function pickDefined(record: Record<string, unknown>) {
  return Object.entries(record).reduce<Record<string, unknown>>((accumulator, [key, value]) => {
    if (value !== undefined && value !== "") {
      accumulator[key] = value;
    }
    return accumulator;
  }, {});
}

function buildManagementCanonicalRecord(pathname: string, source: Record<string, unknown>) {
  if (pathname.startsWith("/api/customer/")) {
    return pickDefined({
      customerId: source.customerId,
      customerName: source.customerName,
      type: source.type,
      phone: source.phone,
      address: source.address,
      certifiName: source.certifiName,
      certifiNo: source.certifiNo,
      remark: source.remark,
      stationId: source.stationId,
    });
  }

  if (pathname.startsWith("/api/tariff/")) {
    return pickDefined({
      tariffId: source.tariffId,
      tariffName: source.tariffName,
      price: coerceNumberValue(source.price),
      tax: coerceNumberValue(source.tax),
      stationId: source.stationId,
      remark: source.remark,
    });
  }

  if (pathname.startsWith("/api/gateway/")) {
    return pickDefined({
      gatewayId: source.gatewayId,
      gatewayName: source.gatewayName,
      stationId: source.stationId,
      remark: source.remark,
    });
  }

  if (pathname.startsWith("/api/meter/")) {
    return pickDefined({
      meterId: source.meterId,
      type: source.type,
      isThreePhase: coerceBooleanLike(source.isThreePhase),
      communicationWay: source.communicationWay,
      protocolVersion: source.protocolVersion,
      lat: coerceNumberValue(source.lat),
      lng: coerceNumberValue(source.lng),
      stationId: source.stationId,
      remark: source.remark,
    });
  }

  if (pathname.startsWith("/api/account/")) {
    return pickDefined({
      customerId: source.customerId,
      meterId: source.meterId,
      oldMeterId: source.oldMeterId,
      tariffId: source.tariffId,
      ctRatio: coerceNumberValue(source.ctRatio) ?? source.ctRatio,
      stationId: source.stationId,
      remark: source.remark,
    });
  }

  return source;
}

function buildCrudMutationBodies(pathname: string, body: Record<string, unknown>) {
  const lowerPathname = pathname.toLowerCase();
  const row = toRecord(body.row);
  const base = buildManagementCanonicalRecord(pathname, omitActionScaffolding(body));
  const canonicalRow = buildManagementCanonicalRecord(pathname, row);

  if (lowerPathname.endsWith("/create") || lowerPathname.includes("/create")) {
    return dedupeBodies([
      [base] as unknown as Record<string, unknown>,
      body,
    ]);
  }

  if (
    lowerPathname.endsWith("/update") ||
    lowerPathname.includes("/update") ||
    lowerPathname.endsWith("/reset")
  ) {
    const merged = {
      ...canonicalRow,
      ...base,
    };

    return dedupeBodies([
      [merged] as unknown as Record<string, unknown>,
      merged,
      body,
    ]);
  }

  if (lowerPathname.endsWith("/delete") || lowerPathname.includes("/delete")) {
    const selectedKeys = Array.isArray(body.selectedKeys) ? body.selectedKeys : [];
    const deleteRows =
      selectedKeys.length > 0
        ? selectedKeys.map((key) => ({ id: key, key, value: key }))
        : [Object.keys(row).length > 0 ? row : base];

    return dedupeBodies([
      deleteRows as unknown as Record<string, unknown>,
      body,
    ]);
  }

  return [body];
}

function buildItemListBodies(body: Record<string, unknown>) {
  const searchTerm =
    typeof body.searchTerm === "string"
      ? body.searchTerm.trim()
      : typeof body.keyword === "string"
        ? body.keyword.trim()
        : typeof body.searchWord === "string"
          ? body.searchWord.trim()
          : "";

  const pageNumber =
    typeof body.pageNumber === "number" ? body.pageNumber : 1;
  const pageSize =
    typeof body.pageSize === "number" ? body.pageSize : 10;

  const withPaging = {
    pageNumber,
    pageSize,
    page: typeof body.page === "number" ? body.page : pageNumber,
    limit: typeof body.limit === "number" ? body.limit : pageSize,
    ...body,
  };

  const nullSafeSearch = {
    ...withPaging,
    searchTerm,
  };

  const aliasedSearch = {
    ...nullSafeSearch,
    keyword: searchTerm,
    searchWord: searchTerm,
    keyWord: searchTerm,
    name: searchTerm,
    itemName: searchTerm,
  };

  return dedupeBodies([
    body,
    withPaging,
    nullSafeSearch,
    aliasedSearch,
  ]);
}

function readTokenRowString(
  row: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function buildTokenGenerateBodies(pathname: string, body: Record<string, unknown>) {
  const row = toRecord(body.row);
  const meterId =
    readTokenRowString(row, ["meterId", "MeterId", "meterNo", "MeterNo"]) ??
    (typeof body.meterId === "string" && body.meterId.trim().length > 0
      ? body.meterId.trim()
      : undefined);
  const customerId = readTokenRowString(row, ["customerId", "CustomerId"]);
  const customerName = readTokenRowString(row, ["customerName", "CustomerName"]);
  const meterType = readTokenRowString(row, ["meterType", "MeterType"]);
  const tariffId = readTokenRowString(row, ["tariffId", "TariffId"]);
  const stationId = readTokenRowString(row, ["stationId", "StationId", "siteId", "SiteId"]);
  const protocolVersion = readTokenRowString(row, ["protocolVersion", "ProtocolVersion"]);
  const authorizationPassword =
    typeof body.authorizationPassword === "string" && body.authorizationPassword.trim().length > 0
      ? body.authorizationPassword.trim()
      : typeof body.AuthorizationPassword === "string" &&
          body.AuthorizationPassword.trim().length > 0
        ? body.AuthorizationPassword.trim()
        : typeof body.authPassword === "string" && body.authPassword.trim().length > 0
          ? body.authPassword.trim()
          : typeof body.password2 === "string" && body.password2.trim().length > 0
            ? body.password2.trim()
            : undefined;

  const aliasedBody: Record<string, unknown> = {
    ...body,
    MeterId: meterId,
    meterId: meterId ?? body.meterId,
    meterNo: meterId,
    CustomerId: customerId,
    customerId: customerId ?? body.customerId,
    CustomerName: customerName,
    customerName: customerName ?? body.customerName,
    MeterType: meterType,
    meterType: meterType ?? body.meterType,
    TariffId: tariffId,
    tariffId: tariffId ?? body.tariffId,
    StationId: stationId,
    stationId: stationId ?? body.stationId,
    ProtocolVersion: protocolVersion,
    protocolVersion: protocolVersion ?? body.protocolVersion,
    AuthorizationPassword: authorizationPassword,
    authorizationPassword: authorizationPassword ?? body.authorizationPassword,
    authPassword: authorizationPassword,
    password2: authorizationPassword,
    isPreview: body.isPreview,
    IsPreview: body.isPreview,
    isVendByTotalPaid: body.isVendByTotalPaid,
    IsVendByTotalPaid: body.isVendByTotalPaid,
    payDebtPercent: body.payDebtPercent,
    PayDebtPercent: body.payDebtPercent,
    isS2: body.isS2,
    IsS2: body.isS2,
  };

  if (pathname === "/api/token/creditToken/generate") {
    aliasedBody.Amount = body.amount;
    aliasedBody.Unit = body.unit;
  }

  if (pathname === "/api/token/meterKey/update") {
    aliasedBody.OldMeterKey = body.oldMeterKey ?? body.oldKey;
    aliasedBody.NewMeterKey = body.newMeterKey ?? body.newKey;
    aliasedBody.oldMeterKey = body.oldMeterKey ?? body.oldKey;
    aliasedBody.newMeterKey = body.newMeterKey ?? body.newKey;
    aliasedBody.oldKey = body.oldMeterKey ?? body.oldKey;
    aliasedBody.newKey = body.newMeterKey ?? body.newKey;
  }

  if (
    pathname === "/api/token/setMaximumPowerLimitToken/generate" ||
    pathname === "/api/token/setMaximumPhasePowerUnbalanceLimitToken/generate" ||
    pathname === "/api/token/setMaximumOverdraftLimitToken/generate"
  ) {
    aliasedBody.LimitValue = body.limitValue;
  }

  return dedupeBodies([aliasedBody, body]);
}

export function buildUpstreamRequestPlan(
  pathname: string,
  body: Record<string, unknown>,
): UpstreamRequestPlan {
  const normalizedBody = applyUpstreamDefaults(pathname, body);

  if (pathname.startsWith("/API/RemoteMeterTask/Create")) {
    const candidateBodies = buildRemoteTaskCreateBodies(pathname, normalizedBody).map((candidate) =>
      applyUpstreamDefaults(pathname, candidate),
    );

    return {
      body: candidateBodies[0] ?? normalizedBody,
      candidateBodies,
    };
  }

  if (pathname.startsWith("/API/GPRSMeterTask/GPRSCreate") || pathname.startsWith("/api/GPRSMeterTask/GPRSCreate")) {
    const candidateBodies = buildGprsTaskCreateBodies(pathname, normalizedBody).map((candidate) =>
      applyUpstreamDefaults(pathname, candidate),
    );

    return {
      body: candidateBodies[0] ?? normalizedBody,
      candidateBodies,
    };
  }

  if (pathname.startsWith("/API/GPRSMeterTask/GPRSGet") || pathname.startsWith("/api/GPRSMeterTask/GPRSGet")) {
    const candidateBodies = buildGprsTaskReadBodies(normalizedBody).map((candidate) =>
      applyUpstreamDefaults(pathname, candidate),
    );

    return {
      body: candidateBodies[0] ?? normalizedBody,
      candidateBodies,
    };
  }

  if (pathname.startsWith("/API/GPRSMeterTask/GPRSUpdate") || pathname.startsWith("/api/GPRSMeterTask/GPRSUpdate")) {
    const candidateBodies = buildGprsTaskUpdateBodies(normalizedBody).map((candidate) =>
      applyUpstreamDefaults(pathname, candidate),
    );

    return {
      body: candidateBodies[0] ?? normalizedBody,
      candidateBodies,
    };
  }

  if (pathname === "/API/PrepayReport/ConsumptionStatistics") {
    return {
      body: normalizedBody,
      candidateBodies: buildConsumptionStatisticsBodies(normalizedBody),
    };
  }

  if (pathname === "/API/PrepayReport/LongNonpurchaseSituation") {
    return {
      body: normalizedBody,
      candidateBodies: buildLongNonpurchaseBodies(normalizedBody),
    };
  }

  if (pathname === "/API/PrepayReport/LowPurchaseSituation") {
    return {
      body: normalizedBody,
      candidateBodies: buildLowPurchaseBodies(normalizedBody),
    };
  }

  if (pathname === "/api/DailyData/read" || pathname === "/api/DailyDataMeter/read") {
    return {
      body: normalizedBody,
      candidateBodies: buildDailyDataMeterBodies(normalizedBody),
      timeoutMs: 45_000,
    };
  }

  if (pathname === "/api/item/readItemList") {
    return {
      body: normalizedBody,
      candidateBodies: buildItemListBodies(normalizedBody),
    };
  }

  if (pathname.startsWith("/api/token/") && pathname.endsWith("/generate")) {
    const candidateBodies = buildTokenGenerateBodies(pathname, normalizedBody);
    return {
      body: candidateBodies[0] ?? normalizedBody,
      candidateBodies,
    };
  }

  if (
    pathname.toLowerCase().endsWith("/create") ||
    pathname.toLowerCase().includes("/create") ||
    pathname.toLowerCase().endsWith("/update") ||
    pathname.toLowerCase().includes("/update") ||
    pathname.toLowerCase().endsWith("/delete") ||
    pathname.toLowerCase().includes("/delete") ||
    pathname.toLowerCase().endsWith("/reset")
  ) {
    const candidateBodies = buildCrudMutationBodies(pathname, normalizedBody);
    return {
      body: candidateBodies[0] ?? normalizedBody,
      candidateBodies,
    };
  }

  if (
    pathname === "/API/LoadProfile/DailyData" ||
    pathname === "/API/LoadProfile/MonthlyData" ||
    pathname === "/API/LoadProfile/ElectricEnergyCurve" ||
    pathname === "/API/LoadProfile/InstantaneousValueCurve"
  ) {
    return {
      body: normalizedBody,
      candidateBodies: buildLoadProfileBodies(pathname, normalizedBody),
      timeoutMs: 45_000,
    };
  }

  return {
    body: normalizedBody,
    candidateBodies: [normalizedBody],
  };
}




