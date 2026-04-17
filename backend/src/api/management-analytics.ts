import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import {
  buildCustomerForecastsMix,
  buildCustomerSegmentsMix,
  buildOperationalPriorityMix,
  buildRevenueLeakageMix,
  buildSiteBenchmarkMatrix,
  buildTopConsumerWatchlist,
} from "../services/analytics-mix.js";
import {
  getManagementConsumptionAnalytics,
  getManagementMeterConsumptionAnalytics,
  getManagementTokenAnalyticsSnapshot,
} from "../services/management-token-analytics.js";
import { sendEnvelope } from "../services/response.js";
import { SITE_CONSUMPTION_SITES } from "../services/site-consumption-store.js";
import {
  isSupabaseDbEnabled,
  listMeterConsumptionRanking,
  listRevenueUsageSeries,
  listSiteConsumptionSeries,
} from "../services/supabase-db.js";
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

function readLimit(rawLimit: unknown, fallback = 10, max = 50) {
  const parsed = toFiniteNumber(rawLimit);
  if (parsed === null) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

managementAnalyticsRouter.get("/site-benchmark", async (request, response) => {
  try {
    const result = await buildSiteBenchmarkMatrix(request as AuthenticatedRequest, response);
    sendEnvelope(response, 200, result, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load site benchmark";
    sendEnvelope(response, 502, null, message, 1);
  }
});

managementAnalyticsRouter.get("/top-consumer-watchlist", async (request, response) => {
  try {
    const result = await buildTopConsumerWatchlist(request as AuthenticatedRequest, response);
    sendEnvelope(response, 200, result, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load top consumer watchlist";
    sendEnvelope(response, 502, null, message, 1);
  }
});

managementAnalyticsRouter.get("/customer-segments", async (request, response) => {
  try {
    const result = await buildCustomerSegmentsMix(request as AuthenticatedRequest, response);
    sendEnvelope(response, 200, result, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load customer segments";
    sendEnvelope(response, 502, null, message, 1);
  }
});

managementAnalyticsRouter.get("/customer-forecasts", async (request, response) => {
  try {
    const result = await buildCustomerForecastsMix(request as AuthenticatedRequest, response);
    sendEnvelope(response, 200, result, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load customer forecasts";
    sendEnvelope(response, 502, null, message, 1);
  }
});

managementAnalyticsRouter.get("/revenue-leakage", async (request, response) => {
  try {
    const result = await buildRevenueLeakageMix(request as AuthenticatedRequest, response);
    sendEnvelope(response, 200, result, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load revenue leakage mix";
    sendEnvelope(response, 502, null, message, 1);
  }
});

managementAnalyticsRouter.get("/operational-priority", async (request, response) => {
  try {
    const result = await buildOperationalPriorityMix(request as AuthenticatedRequest, response);
    sendEnvelope(response, 200, result, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load operational priority mix";
    sendEnvelope(response, 502, null, message, 1);
  }
});

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
    if (isSupabaseDbEnabled()) {
      const [revenueRows, consumptionRows] = await Promise.all([
        listRevenueUsageSeries({
          siteId: selectedSite,
          limit: 400,
        }),
        listSiteConsumptionSeries({
          siteId: selectedSite,
          granularity: "daily",
          limit: 400,
        }),
      ]);

      if (revenueRows.length > 0 || consumptionRows.length > 0) {
        const labels = Array.from(
          new Set([
            ...revenueRows.map((row) => row.date),
            ...consumptionRows.map((row) => row.date),
          ]),
        ).sort((left, right) => left.localeCompare(right));
        const revenueByDate = new Map(revenueRows.map((row) => [row.date, row]));
        const usageByDate = new Map(consumptionRows.map((row) => [row.date, row.totalKwh]));
        const rows = labels.map((date) => {
          const revenue = revenueByDate.get(date);
          const totalKwh = usageByDate.get(date) ?? revenue?.totalKwh ?? 0;
          const dayKwh = revenue?.dayKwh ?? totalKwh;
          const nightKwh = revenue?.nightKwh ?? Math.max(0, totalKwh - dayKwh);
          const totalRevenue = revenue?.totalRevenue ?? 0;
          return {
            date,
            dayKwh,
            nightKwh,
            totalKwh,
            totalRevenue,
          };
        });
        const totalConsumptionKwh = rows.reduce((sum, entry) => sum + entry.totalKwh, 0);
        const totalDayKwh = rows.reduce((sum, entry) => sum + entry.dayKwh, 0);
        const totalNightKwh = rows.reduce((sum, entry) => sum + entry.nightKwh, 0);
        const totalRevenue = rows.reduce((sum, entry) => sum + entry.totalRevenue, 0);
        const peakDay =
          rows.reduce<typeof rows[number] | null>((best, entry) => {
            if (!best || entry.totalKwh > best.totalKwh) {
              return entry;
            }
            return best;
          }, null);
        const topSiteEntry =
          Array.from(
            revenueRows.reduce((accumulator, row) => {
              const key = row.siteCode ?? "unknown";
              accumulator.set(key, (accumulator.get(key) ?? 0) + row.totalKwh);
              return accumulator;
            }, new Map<string, number>()).entries(),
          ).sort((left, right) => right[1] - left[1])[0] ?? null;

        sendEnvelope(
          response,
          200,
          {
            availableSites: SITE_CONSUMPTION_SITES,
            selectedSite,
            sourceWindow: {
              fromDate: labels[0] ?? "",
              toDate: labels[labels.length - 1] ?? "",
            },
            lastUpdatedAt: rows[rows.length - 1]?.date ?? null,
            summary: {
              totalConsumptionKwh: roundKwh(totalConsumptionKwh),
              totalDayKwh: roundKwh(totalDayKwh),
              totalNightKwh: roundKwh(totalNightKwh),
              percentDay: totalConsumptionKwh > 0 ? (totalDayKwh / totalConsumptionKwh) * 100 : 0,
              percentNight: totalConsumptionKwh > 0 ? (totalNightKwh / totalConsumptionKwh) * 100 : 0,
              totalRevenue: roundKwh(totalRevenue),
              peakDay:
                peakDay == null
                  ? null
                  : {
                      label: peakDay.date,
                      dayKwh: roundKwh(peakDay.dayKwh),
                      nightKwh: roundKwh(peakDay.nightKwh),
                      totalKwh: roundKwh(peakDay.totalKwh),
                    },
              totalAccounts: null,
              trackedSites: selectedSite ? 1 : SITE_CONSUMPTION_SITES.length,
              topSite:
                topSiteEntry == null
                  ? null
                  : {
                      site: topSiteEntry[0],
                      totalConsumptionKwh: roundKwh(topSiteEntry[1]),
                    },
            },
            trend: {
              labels: rows.map((entry) => entry.date),
              dayValues: rows.map((entry) => roundKwh(entry.dayKwh)),
              nightValues: rows.map((entry) => roundKwh(entry.nightKwh)),
              totalValues: rows.map((entry) => roundKwh(entry.totalKwh)),
            },
            issues: [],
          },
          "success",
        );
        return;
      }
    }

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
  const limit = readLimit(request.query.limit, 200, 500);

  try {
    if (isSupabaseDbEnabled()) {
      const rankedRows = await listMeterConsumptionRanking({
        siteId: selectedSite,
        limit,
      });

      if (rankedRows.length > 0) {
        sendEnvelope(
          response,
          200,
          {
            availableSites: SITE_CONSUMPTION_SITES,
            selectedSite,
            snapshotDate: extractIsoDate(rankedRows[0]?.lastTransactionAt ?? null),
            lastUpdatedAt: rankedRows[0]?.lastTransactionAt ?? null,
            total: rankedRows.length,
            rows: rankedRows.map((entry) => ({
              meterId: entry.meterId,
              customerName: entry.customerName,
              site: entry.siteCode?.toUpperCase() ?? "",
              totalKwh: roundKwh(entry.totalKwh),
              dayKwh: roundKwh(entry.dayKwh),
              nightKwh: roundKwh(entry.nightKwh),
              percentDay: entry.totalKwh > 0 ? Math.round((entry.dayKwh / entry.totalKwh) * 100) : 0,
              updatedAt: entry.lastTransactionAt,
              snapshotDate: extractIsoDate(entry.lastTransactionAt),
            })),
          },
          "success",
        );
        return;
      }
    }

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
