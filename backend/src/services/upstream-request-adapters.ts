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
    pathname.startsWith("/api/DailyDataMeter/") ||
    pathname.startsWith("/API/LoadProfile/");
  const requiresTaskLang = pathname.startsWith("/API/RemoteMeterTask/Get");

  if (requiresLang || requiresTaskLang) {
    const currentLang = typeof nextBody.Lang === "string" ? nextBody.Lang.trim() : "";
    if (currentLang.length === 0) {
      nextBody.Lang = "en";
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
    scheduleDate: body.scheduleDate,
    taskType: body.taskType,
    meterId: target.meterId,
    customerId: target.customerId,
    customerName: target.customerName,
    meterType: target.meterType,
    stationId: target.stationId,
    gatewayId: target.gatewayId,
    protocolVersion: target.protocolVersion,
  };

  if (pathname === "/API/RemoteMeterTask/CreateReadingTask") {
    return dedupeBodies([
      {
        ...base,
        dataItem: body.dataItem,
        readMode: body.readMode,
      },
      {
        ...base,
        meterNo: target.meterId,
        customerNo: target.customerId,
        site: target.stationId,
        itemCode: body.dataItem,
        itemId: body.dataItem,
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
        valueType: body.valueType,
      },
      {
        ...base,
        meterNo: target.meterId,
        customerNo: target.customerId,
        site: target.stationId,
        paramKey: body.settingKey,
        paramValue: body.settingValue,
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
      },
      {
        ...base,
        meterNo: target.meterId,
        customerNo: target.customerId,
        site: target.stationId,
        commandType: body.controlCommand,
        command: body.controlCommand,
        remark: body.reason,
      },
    ]);
  }

  if (pathname === "/API/RemoteMeterTask/CreateTokenTask") {
    return dedupeBodies([
      {
        ...base,
        tokenType: body.tokenType,
        tokenValue: body.tokenValue,
      },
      {
        ...base,
        meterNo: target.meterId,
        customerNo: target.customerId,
        site: target.stationId,
        commandType: body.tokenType,
        token: body.tokenValue,
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
        mode: body.protocolMode,
        payload: body.commandPayload,
        timeout: body.timeoutSeconds,
      },
    ]);
  }

  return [body];
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

  if (pathname === "/api/DailyDataMeter/read") {
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

  if (pathname === "/API/LoadProfile/DailyData" || pathname === "/API/LoadProfile/MonthlyData") {
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
