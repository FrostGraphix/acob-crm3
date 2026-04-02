import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";

function loadEnvFiles() {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "..", ".env"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      dotenv.config({ path: candidate, override: false, quiet: true });
    }
  }
}

function parseBool(value: string | undefined, fallback: boolean) {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.toLowerCase() === "true";
}

function parsePort(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0
    ? parsed
    : fallback;
}

function parseCsv(value: string | undefined, fallback: string[]) {
  if (typeof value !== "string") {
    return fallback;
  }

  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return entries.length > 0 ? entries : fallback;
}

function parseString(value: string | undefined, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function parseSessionStoreMode(value: string | undefined): "redis" | "memory" {
  return value === "memory" ? "memory" : "redis";
}

loadEnvFiles();

const nodeEnv =
  process.env.NODE_ENV === "production" ||
  process.env.NODE_ENV === "test" ||
  process.env.NODE_ENV === "development"
    ? process.env.NODE_ENV
    : "development";

const jwtSecret = parseString(process.env.JWT_SECRET);
if (!jwtSecret && nodeEnv !== "test") {
  throw new Error("JWT_SECRET must be set when NODE_ENV is not test.");
}

export interface AppEnv {
  nodeEnv: "development" | "test" | "production";
  port: number;
  corsOrigins: string[];
  upstreamApiUrl: string;
  upstreamUsername: string;
  upstreamPassword: string;
  jwtSecret: string;
  sessionStoreMode: "redis" | "memory";
  runtimeStateStoreMode: "redis" | "file";
  schedulerCoordinationMode: "redis" | "single-instance";
  redisUrl: string;
  redisConnectTimeoutMs: number;
  redisKeyPrefix: string;
  runtimeStateKeyPrefix: string;
  schedulerLeaderKeyPrefix: string;
  schedulerLeaderLeaseMs: number;
  schedulerLeaderHeartbeatMs: number;
  strictDependencyStartup: boolean;
  enableMetrics: boolean;
  enableAnalysisEngine: boolean;
  enableSiteConsumptionEngine: boolean;
  rateLimitWindowMs: number;
  rateLimitMaxRequestsPerWindow: number;
  rateLimitTrustForwardedFor: boolean;
  supabaseAuthEnabled: boolean;
  supabaseStorageEnabled: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  supabaseStorageBucket: string;
}

export const env: AppEnv = {
  nodeEnv,
  port: parsePort(process.env.PORT, 3000),
  corsOrigins: parseCsv(process.env.CORS_ORIGINS, ["http://localhost:5173"]),
  upstreamApiUrl: process.env.UPSTREAM_API_URL ?? "http://8.208.16.168:9310",
  upstreamUsername: process.env.UPSTREAM_USERNAME ?? "admin",
  upstreamPassword: process.env.UPSTREAM_PASSWORD ?? "",
  jwtSecret: jwtSecret || randomUUID(),
  sessionStoreMode: parseSessionStoreMode(process.env.SESSION_STORE_MODE),
  runtimeStateStoreMode:
    process.env.RUNTIME_STATE_STORE_MODE === "file"
      ? "file"
      : process.env.RUNTIME_STATE_STORE_MODE === "redis"
        ? "redis"
        : parseSessionStoreMode(process.env.SESSION_STORE_MODE) === "redis"
          ? "redis"
          : "file",
  schedulerCoordinationMode:
    process.env.SCHEDULER_COORDINATION_MODE === "single-instance"
      ? "single-instance"
      : process.env.SCHEDULER_COORDINATION_MODE === "redis" || nodeEnv === "production"
        ? "redis"
        : "single-instance",
  redisUrl: parseString(process.env.REDIS_URL, "redis://127.0.0.1:6379"),
  redisConnectTimeoutMs: parsePositiveInteger(process.env.REDIS_CONNECT_TIMEOUT_MS, 750),
  redisKeyPrefix: parseString(process.env.REDIS_KEY_PREFIX, "acob:session:"),
  runtimeStateKeyPrefix: parseString(process.env.RUNTIME_STATE_KEY_PREFIX, "acob:runtime:"),
  schedulerLeaderKeyPrefix: parseString(process.env.SCHEDULER_LEADER_KEY_PREFIX, "acob:leader:"),
  schedulerLeaderLeaseMs: parsePositiveInteger(process.env.SCHEDULER_LEADER_LEASE_MS, 20_000),
  schedulerLeaderHeartbeatMs: parsePositiveInteger(
    process.env.SCHEDULER_LEADER_HEARTBEAT_MS,
    5_000,
  ),
  strictDependencyStartup: parseBool(
    process.env.STRICT_DEPENDENCY_STARTUP,
    nodeEnv === "production",
  ),
  enableMetrics: parseBool(process.env.ENABLE_METRICS, true),
  enableAnalysisEngine: parseBool(
    process.env.ENABLE_ANALYSIS_ENGINE,
    nodeEnv !== "production",
  ),
  enableSiteConsumptionEngine: parseBool(
    process.env.ENABLE_SITE_CONSUMPTION_ENGINE,
    nodeEnv !== "production",
  ),
  rateLimitWindowMs: parsePositiveInteger(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
  rateLimitMaxRequestsPerWindow: parsePositiveInteger(
    process.env.RATE_LIMIT_MAX_REQUESTS_PER_WINDOW,
    240,
  ),
  rateLimitTrustForwardedFor: parseBool(
    process.env.RATE_LIMIT_TRUST_FORWARDED_FOR,
    false,
  ),
  supabaseAuthEnabled: parseBool(process.env.SUPABASE_AUTH_ENABLED, false),
  supabaseStorageEnabled: parseBool(process.env.SUPABASE_STORAGE_ENABLED, false),
  supabaseUrl: parseString(process.env.SUPABASE_URL),
  supabaseAnonKey: parseString(process.env.SUPABASE_ANON_KEY),
  supabaseServiceRoleKey: parseString(process.env.SUPABASE_SERVICE_ROLE_KEY),
  supabaseStorageBucket: parseString(process.env.SUPABASE_STORAGE_BUCKET),
};

if (nodeEnv === "production" && env.runtimeStateStoreMode !== "redis") {
  throw new Error("RUNTIME_STATE_STORE_MODE must resolve to redis in production.");
}

if (nodeEnv === "production" && env.schedulerCoordinationMode !== "redis") {
  throw new Error("SCHEDULER_COORDINATION_MODE must resolve to redis in production.");
}
