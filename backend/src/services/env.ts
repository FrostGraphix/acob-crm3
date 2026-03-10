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
      dotenv.config({ path: candidate, override: false });
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

loadEnvFiles();

export interface AppEnv {
  nodeEnv: "development" | "test" | "production";
  port: number;
  upstreamApiUrl: string;
  upstreamUsername: string;
  upstreamPassword: string;
  jwtSecret: string;
  useMockOnly: boolean;
  mockFallbackOnError: boolean;
}

export const env: AppEnv = {
  nodeEnv:
    process.env.NODE_ENV === "production" ||
    process.env.NODE_ENV === "test" ||
    process.env.NODE_ENV === "development"
      ? process.env.NODE_ENV
      : "development",
  port: parsePort(process.env.PORT, 3000),
  upstreamApiUrl: process.env.UPSTREAM_API_URL ?? "http://8.208.16.168:9311",
  upstreamUsername: process.env.UPSTREAM_USERNAME ?? "admin",
  upstreamPassword: process.env.UPSTREAM_PASSWORD ?? "",
  jwtSecret: process.env.JWT_SECRET ?? randomUUID(),
  useMockOnly: parseBool(process.env.USE_MOCK_ONLY, true),
  mockFallbackOnError: parseBool(process.env.MOCK_FALLBACK_ON_ERROR, true),
};
