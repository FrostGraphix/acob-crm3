import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { sanitizeRequestBody } from "../services/request-validation.js";
import { sendEnvelope } from "../services/response.js";
import {
  forwardWithUpstreamSessionRecovery,
  UpstreamSessionError,
} from "../services/upstream-session.js";
import { forwardToUpstream } from "../services/upstream.js";

interface BulkImportResult {
  success: boolean;
  message: string;
  importedCount: number;
  failedCount: number;
  failures: Array<{
    index: number;
    reason: string;
  }>;
}

function readRecords(body: Record<string, unknown>) {
  return Array.isArray(body.records)
    ? body.records.filter(
        (record): record is Record<string, unknown> =>
          typeof record === "object" && record !== null && !Array.isArray(record),
      )
    : [];
}

export function createBulkImportHandler(createPath: string, entityLabel: string) {
  return async (request: AuthenticatedRequest, response: Response) => {
    const body = sanitizeRequestBody(request.body);
    const records = readRecords(body);

    if (records.length === 0) {
      sendEnvelope(response, 400, null, "Import requires a non-empty records array", 1);
      return;
    }

    if (records.length > 200) {
      sendEnvelope(response, 400, null, "Import is limited to 200 records per request", 1);
      return;
    }

    const failures: BulkImportResult["failures"] = [];
    let importedCount = 0;

    for (const [index, record] of records.entries()) {
      try {
        const upstreamResult = await forwardWithUpstreamSessionRecovery(
          request,
          response,
          (upstreamCookie) => forwardToUpstream(createPath, record, upstreamCookie),
        );
        if (upstreamResult.statusCode >= 400 || upstreamResult.payload.code !== 0) {
          failures.push({
            index,
            reason: upstreamResult.payload.reason || `Failed to import ${entityLabel}`,
          });
          continue;
        }

        importedCount += 1;
      } catch (error) {
        if (error instanceof UpstreamSessionError) {
          sendEnvelope(response, 401, null, error.message, 1);
          return;
        }

        failures.push({
          index,
          reason: error instanceof Error ? error.message : `Failed to import ${entityLabel}`,
        });
      }
    }

    const failedCount = failures.length;
    const result: BulkImportResult = {
      success: failedCount === 0,
      message:
        failedCount === 0
          ? `Imported ${importedCount} ${entityLabel} record(s).`
          : `Imported ${importedCount} of ${records.length} ${entityLabel} record(s).`,
      importedCount,
      failedCount,
      failures,
    };

    sendEnvelope(
      response,
      failedCount === 0 ? 200 : 400,
      result,
      result.message,
      failedCount === 0 ? 0 : 1,
    );
  };
}
