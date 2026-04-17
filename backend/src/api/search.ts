import { Router } from "express";
import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { sendEnvelope } from "../services/response.js";
import { searchWarehouseEntities } from "../services/supabase-db.js";
import { syncWarehouseSearchSeed } from "../services/warehouse-search-sync.js";

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}

function readLimit(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.min(25, Math.floor(value)));
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(1, Math.min(25, Math.floor(parsed)));
    }
  }

  return 12;
}

export const searchRouter = Router();

searchRouter.get("/global", async (request: Request, response: Response) => {
  try {
    const query = readString(request.query.q ?? request.query.query ?? request.query.search);
    if (!query) {
      sendEnvelope(response, 200, {
        query: "",
        total: 0,
        counts: {},
        results: [],
      }, "success");
      return;
    }

    const siteId = readString(request.query.siteId ?? request.query.site) || null;
    const limit = readLimit(request.query.limit);
    let results = await searchWarehouseEntities({
      query,
      siteId,
      limit,
    });

    if (results.length < limit) {
      try {
        const syncResult = await syncWarehouseSearchSeed(
          request as AuthenticatedRequest,
          response,
          {
            query,
            siteId,
            limit,
          },
        );

        if (syncResult.customersSynced > 0 || syncResult.metersSynced > 0) {
          results = await searchWarehouseEntities({
            query,
            siteId,
            limit,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown sync error";
        console.warn("[search] warehouse seed sync failed:", message);
      }
    }

    const counts = results.reduce<Record<string, number>>((accumulator, result) => {
      accumulator[result.entityType] = (accumulator[result.entityType] ?? 0) + 1;
      return accumulator;
    }, {});

    sendEnvelope(response, 200, {
      query,
      total: results.length,
      counts,
      results,
    }, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to search warehouse";
    sendEnvelope(response, 502, null, message, 1);
  }
});
