export interface UpstreamRequestPlan {
  body: Record<string, unknown>;
  candidateBodies: Record<string, unknown>[];
  timeoutMs?: number;
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
    pathname.startsWith("/API/PrepayReport/") || pathname.startsWith("/api/DailyDataMeter/");
  const requiresTaskLang = pathname.startsWith("/API/RemoteMeterTask/Get");

  if (requiresLang || requiresTaskLang) {
    const currentLang = typeof nextBody.Lang === "string" ? nextBody.Lang.trim() : "";
    if (currentLang.length === 0) {
      nextBody.Lang = "en";
    }
  }

  return nextBody;
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

export function buildUpstreamRequestPlan(
  pathname: string,
  body: Record<string, unknown>,
): UpstreamRequestPlan {
  const normalizedBody = applyUpstreamDefaults(pathname, body);

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

  if (pathname === "/api/DailyDataMeter/read") {
    return {
      body: normalizedBody,
      candidateBodies: buildDailyDataMeterBodies(normalizedBody),
      timeoutMs: 45_000,
    };
  }

  return {
    body: normalizedBody,
    candidateBodies: [normalizedBody],
  };
}
