import type { DashboardData } from "../types";
import { mapDashboardData } from "./dashboard-mapper.ts";

export const DASHBOARD_BOOTSTRAP_TIMEOUT_MS = 90_000;
export const DASHBOARD_REQUEST_TIMEOUT_MS = 15_000;

export type DashboardLoadState = "initial-loading" | "ready" | "stale" | "empty";

export interface DashboardFailureResolution {
  loadState: DashboardLoadState;
  statusMessage: string | null;
  stale: boolean;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error ?? "Request failed");
}

export function isLikelyTimeoutError(error: unknown) {
  const message = toErrorMessage(error).toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("aborted") ||
    message.includes("abort")
  );
}

export function resolveDashboardDataFromSettledResults(
  summaryResult: PromiseSettledResult<Record<string, unknown>>,
  chartResults: Array<PromiseSettledResult<Record<string, unknown>>>,
  mergedChartResult: Record<string, unknown>,
): DashboardData {
  const hasAnyChart = chartResults.some((result) => result.status === "fulfilled");

  if (summaryResult.status === "rejected" && !hasAnyChart) {
    throw new Error("Failed to load dashboard data from upstream endpoints.");
  }

  return mapDashboardData(
    summaryResult.status === "fulfilled" ? summaryResult.value : {},
    mergedChartResult,
  );
}

export function shouldForceDashboardBootstrapFallback(
  hasSuccessfulDashboard: boolean,
  bootstrapStartedAt: number,
  now = Date.now(),
) {
  return !hasSuccessfulDashboard && now - bootstrapStartedAt >= DASHBOARD_BOOTSTRAP_TIMEOUT_MS;
}

export function resolveDashboardFailureState({
  isBackground,
  hasDashboard,
  bootstrapStartedAt,
  now = Date.now(),
}: {
  isBackground: boolean;
  hasDashboard: boolean;
  bootstrapStartedAt: number;
  now?: number;
}): DashboardFailureResolution {
  if (hasDashboard) {
    return {
      loadState: "stale",
      statusMessage: "Showing the last successful dashboard sync while upstream refresh retries.",
      stale: true,
    };
  }

  const bootstrapTimedOut = shouldForceDashboardBootstrapFallback(false, bootstrapStartedAt, now);
  if (!bootstrapTimedOut) {
    return {
      loadState: "initial-loading",
      statusMessage: isBackground
        ? null
        : "Still attempting live dashboard synchronization with upstream services.",
      stale: false,
    };
  }

  return {
    loadState: "empty",
    statusMessage: "Unable to load live dashboard data from the upstream service. Retrying in the background.",
    stale: false,
  };
}
