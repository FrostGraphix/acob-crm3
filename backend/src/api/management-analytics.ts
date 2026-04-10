import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import {
  getManagementConsumptionAnalytics,
  getManagementMeterConsumptionAnalytics,
  getManagementTokenAnalyticsSnapshot,
} from "../services/management-token-analytics.js";
import { sendEnvelope } from "../services/response.js";
import { SITE_CONSUMPTION_SITES } from "../services/site-consumption-store.js";
import { forwardWithUpstreamSessionRecovery } from "../services/upstream-session.js";
import { forwardToUpstream } from "../services/upstream.js";

export const managementAnalyticsRouter = Router();

function toFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function toObjectRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function extractIsoDate(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function roundKwh(value: number) {
  return Math.round(value * 100) / 100;
}

function readSelectedSite(rawSite: unknown) {
  if (typeof rawSite !== "string" || rawSite.trim().length === 0) {
    return null;
  }

  const normalized = rawSite.trim().toLowerCase();
  return (
    SITE_CONSUMPTION_SITES.find((site) => site.toLowerCase() === normalized) ?? null
  );
}

function readLimit(rawLimit: unknown, fallback = 10) {
  const parsed = toFiniteNumber(rawLimit);
  if (parsed === null) {
    return fallback;
  }

  return Math.max(1, Math.min(50, Math.floor(parsed)));
}

async function loadDashboardRevenue(
  request: AuthenticatedRequest,
  response: Parameters<typeof sendEnvelope>[0],
) {
  try {
    const result = await forwardWithUpstreamSessionRecovery(
      request,
      response,
      async (upstreamCookie) =>
        forwardToUpstream(
          "/api/dashboard/readPanelGroup",
          {},
          upstreamCookie,
        ),
    );

    if (result.statusCode >= 400 || result.payload.code !== 0) {
      return null;
    }

    const payload = toObjectRecord(result.payload.result);
    return {
      totalRevenue: toFiniteNumber(payload?.totalPurchaseMoney) ?? null,
      totalAccounts: toFiniteNumber(payload?.totalAccountCount) ?? null,
    };
  } catch {
    return null;
  }
}

managementAnalyticsRouter.get("/consumption", async (request, response) => {
  const authRequest = request as AuthenticatedRequest;
  const selectedSite = readSelectedSite(request.query.siteId ?? request.query.site);

  try {
    const [snapshot, analytics, revenueSummary] = await Promise.all([
      getManagementTokenAnalyticsSnapshot(authRequest, response),
      getManagementConsumptionAnalytics(authRequest, response, {
        siteId: selectedSite ?? undefined,
      }),
      loadDashboardRevenue(authRequest, response),
    ]);

    const totalConsumptionKwh = analytics.reduce((sum, entry) => sum + entry.totalKwh, 0);
    const totalDayKwh = analytics.reduce((sum, entry) => sum + entry.dayKwh, 0);
    const totalNightKwh = analytics.reduce((sum, entry) => sum + entry.nightKwh, 0);
    const totalRevenue = analytics.reduce((sum, entry) => sum + entry.totalRevenue, 0);
    const peakDay =
      analytics.reduce<typeof analytics[number] | null>((best, entry) => {
        if (!best || entry.totalKwh > best.totalKwh) {
          return entry;
        }

        return best;
      }, null);
    const topSiteMap = new Map<string, number>();

    for (const transaction of snapshot.transactions) {
      if (selectedSite && transaction.siteId.toLowerCase() !== selectedSite.toLowerCase()) {
        continue;
      }

      topSiteMap.set(
        transaction.siteId,
        (topSiteMap.get(transaction.siteId) ?? 0) + transaction.kwh,
      );
    }

    const topSiteEntry =
      Array.from(topSiteMap.entries()).sort((left, right) => right[1] - left[1])[0] ?? null;

    sendEnvelope(
      response,
      200,
      {
        availableSites:
          snapshot.availableSites.length > 0 ? snapshot.availableSites : SITE_CONSUMPTION_SITES,
        selectedSite,
        sourceWindow: snapshot.sourceWindow,
        lastUpdatedAt: snapshot.lastTransactionAt ?? snapshot.fetchedAt,
        summary: {
          totalConsumptionKwh: roundKwh(totalConsumptionKwh),
          totalDayKwh: roundKwh(totalDayKwh),
          totalNightKwh: roundKwh(totalNightKwh),
          percentDay: totalConsumptionKwh > 0 ? (totalDayKwh / totalConsumptionKwh) * 100 : 0,
          percentNight: totalConsumptionKwh > 0 ? (totalNightKwh / totalConsumptionKwh) * 100 : 0,
          totalRevenue: revenueSummary?.totalRevenue ?? roundKwh(totalRevenue),
          peakDay:
            peakDay == null
              ? null
              : {
                  label: peakDay.date,
                  dayKwh: roundKwh(peakDay.dayKwh),
                  nightKwh: roundKwh(peakDay.nightKwh),
                  totalKwh: roundKwh(peakDay.totalKwh),
                },
          totalAccounts: revenueSummary?.totalAccounts ?? null,
          trackedSites: selectedSite ? 1 : snapshot.availableSites.length,
          topSite:
            topSiteEntry == null
              ? null
              : {
                  site: topSiteEntry[0],
                  totalConsumptionKwh: roundKwh(topSiteEntry[1]),
                },
        },
        trend: {
          labels: analytics.map((entry) => entry.date),
          dayValues: analytics.map((entry) => roundKwh(entry.dayKwh)),
          nightValues: analytics.map((entry) => roundKwh(entry.nightKwh)),
          totalValues: analytics.map((entry) => roundKwh(entry.totalKwh)),
        },
        issues: [],
      },
      "success",
    );
  } catch {
    sendEnvelope(
      response,
      200,
      {
        availableSites: SITE_CONSUMPTION_SITES,
        selectedSite,
        sourceWindow: {
          fromDate: "",
          toDate: "",
        },
        lastUpdatedAt: null,
        summary: {
          totalConsumptionKwh: 0,
          totalDayKwh: 0,
          totalNightKwh: 0,
          percentDay: 0,
          percentNight: 0,
          totalRevenue: null,
          peakDay: null,
          totalAccounts: null,
          trackedSites: selectedSite ? 1 : SITE_CONSUMPTION_SITES.length,
          topSite: null,
        },
        trend: {
          labels: [],
          dayValues: [],
          nightValues: [],
          totalValues: [],
        },
        issues: [],
      },
      "success",
    );
  }
});

managementAnalyticsRouter.get("/meter-consumption", async (request, response) => {
  const authRequest = request as AuthenticatedRequest;
  const selectedSite = readSelectedSite(request.query.siteId ?? request.query.site);
  const limit = readLimit(request.query.limit);

  try {
    const [snapshot, analytics] = await Promise.all([
      getManagementTokenAnalyticsSnapshot(authRequest, response),
      getManagementMeterConsumptionAnalytics(authRequest, response, {
        siteId: selectedSite ?? undefined,
      }),
    ]);

    sendEnvelope(
      response,
      200,
      {
        availableSites:
          snapshot.availableSites.length > 0 ? snapshot.availableSites : SITE_CONSUMPTION_SITES,
        selectedSite,
        snapshotDate: extractIsoDate(snapshot.lastTransactionAt ?? snapshot.fetchedAt),
        lastUpdatedAt: snapshot.lastTransactionAt ?? snapshot.fetchedAt,
        total: analytics.length,
        rows: analytics.slice(0, limit).map((entry) => ({
          meterId: entry.meterSN,
          customerName: entry.customerName,
          site: entry.siteId,
          totalKwh: roundKwh(entry.totalKwh),
          dayKwh: roundKwh(entry.dayKwh),
          nightKwh: roundKwh(entry.nightKwh),
          percentDay: entry.totalKwh > 0 ? Math.round((entry.dayKwh / entry.totalKwh) * 100) : 0,
          updatedAt: snapshot.lastTransactionAt ?? snapshot.fetchedAt,
          snapshotDate: extractIsoDate(snapshot.lastTransactionAt ?? snapshot.fetchedAt),
        })),
      },
      "success",
    );
  } catch {
    sendEnvelope(
      response,
      200,
      {
        availableSites: SITE_CONSUMPTION_SITES,
        selectedSite,
        snapshotDate: null,
        lastUpdatedAt: null,
        total: 0,
        rows: [],
      },
      "success",
    );
  }
});
