interface MetricsState {
  startedAtIso: string;
  totalRequests: number;
  totalDurationMs: number;
  statusCounts: Record<string, number>;
  endpointCounts: Record<string, number>;
}

function createInitialState(): MetricsState {
  return {
    startedAtIso: new Date().toISOString(),
    totalRequests: 0,
    totalDurationMs: 0,
    statusCounts: {},
    endpointCounts: {},
  };
}

const metricsState = createInitialState();

function incrementCounter(target: Record<string, number>, key: string) {
  target[key] = (target[key] ?? 0) + 1;
}

function normalizePath(pathname: string) {
  const trimmed = pathname.trim();

  if (!trimmed) {
    return "/";
  }

  return trimmed.length > 160 ? trimmed.slice(0, 160) : trimmed;
}

export function recordRequestMetric(
  pathname: string,
  statusCode: number,
  durationMs: number,
) {
  metricsState.totalRequests += 1;
  metricsState.totalDurationMs += Math.max(0, durationMs);
  incrementCounter(metricsState.statusCounts, String(statusCode));
  incrementCounter(metricsState.endpointCounts, normalizePath(pathname));
}

export function readMetricsSnapshot() {
  const memory = process.memoryUsage();
  const averageDurationMs =
    metricsState.totalRequests > 0
      ? Number((metricsState.totalDurationMs / metricsState.totalRequests).toFixed(2))
      : 0;

  const topEndpoints = Object.entries(metricsState.endpointCounts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 20)
    .map(([pathname, count]) => ({
      pathname,
      count,
    }));

  return {
    service: "acob-crm3-backend",
    startedAt: metricsState.startedAtIso,
    uptimeSeconds: Math.round(process.uptime()),
    requests: {
      total: metricsState.totalRequests,
      averageDurationMs,
      statusCounts: { ...metricsState.statusCounts },
      topEndpoints,
    },
    process: {
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
      externalBytes: memory.external,
    },
  };
}

