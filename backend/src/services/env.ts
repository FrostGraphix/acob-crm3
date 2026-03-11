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

export interface AppEnv {
  nodeEnv: "development" | "test" | "production";
  port: number;
  corsOrigins: string[];
  upstreamApiUrl: string;
  upstreamUsername: string;
  upstreamPassword: string;
  jwtSecret: string;
  sessionStoreMode: "redis" | "memory";
  redisUrl: string;
  redisKeyPrefix: string;
  strictDependencyStartup: boolean;
  enableMetrics: boolean;
  supabaseAuthEnabled: boolean;
  supabaseStorageEnabled: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  supabaseStorageBucket: string;
}

export const env: AppEnv = {
  nodeEnv:
    process.env.NODE_ENV === "production" ||
    process.env.NODE_ENV === "test" ||
    process.env.NODE_ENV === "development"
      ? process.env.NODE_ENV
      : "development",
  port: parsePort(process.env.PORT, 3000),
  corsOrigins: parseCsv(process.env.CORS_ORIGINS, ["http://localhost:5173"]),
  upstreamApiUrl: process.env.UPSTREAM_API_URL ?? "http://8.208.16.168:9311",
  upstreamUsername: process.env.UPSTREAM_USERNAME ?? "admin",
  upstreamPassword: process.env.UPSTREAM_PASSWORD ?? "",
  jwtSecret: process.env.JWT_SECRET ?? randomUUID(),
  sessionStoreMode: parseSessionStoreMode(process.env.SESSION_STORE_MODE),
  redisUrl: parseString(process.env.REDIS_URL, "redis://127.0.0.1:6379"),
  redisKeyPrefix: parseString(process.env.REDIS_KEY_PREFIX, "acob:session:"),
  strictDependencyStartup: parseBool(
    process.env.STRICT_DEPENDENCY_STARTUP,
    process.env.NODE_ENV === "production",
  ),
  enableMetrics: parseBool(process.env.ENABLE_METRICS, true),
  supabaseAuthEnabled: parseBool(process.env.SUPABASE_AUTH_ENABLED, false),
  supabaseStorageEnabled: parseBool(process.env.SUPABASE_STORAGE_ENABLED, false),
  supabaseUrl: parseString(process.env.SUPABASE_URL),
  supabaseAnonKey: parseString(process.env.SUPABASE_ANON_KEY),
  supabaseServiceRoleKey: parseString(process.env.SUPABASE_SERVICE_ROLE_KEY),
  supabaseStorageBucket: parseString(process.env.SUPABASE_STORAGE_BUCKET),
};
