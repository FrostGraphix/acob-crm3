import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { env } from "./env.js";
import { getRedisClient } from "./redis-client.js";

type RuntimeStateStoreMode = "redis" | "file";

export interface AnalysisNotificationRecord {
  id: string;
  type: "warning" | "critical" | "info";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  meterId?: string;
}

export interface AnalysisStateSnapshot {
  notifications: AnalysisNotificationRecord[];
  knownAlerts: string[];
  savedAt: string;
}

function getStoreMode(): RuntimeStateStoreMode {
  return env.runtimeStateStoreMode;
}

function getFileNameForKey(key: string) {
  const suffix = env.nodeEnv === "test" ? ".test.json" : ".json";
  return `${key}-state${suffix}`;
}

function getFilePath(key: string) {
  return path.resolve(process.cwd(), "tmp", getFileNameForKey(key));
}

function ensureStateDirectory(key: string) {
  mkdirSync(path.dirname(getFilePath(key)), { recursive: true });
}

function readStateFile(key: string) {
  const filePath = getFilePath(key);
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  } catch {
    return null;
  }
}

function writeStateFile(key: string, state: unknown) {
  ensureStateDirectory(key);
  const filePath = getFilePath(key);
  const tempPath = `${filePath}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  renameSync(tempPath, filePath);
}

function toRedisKey(key: string) {
  return `${env.runtimeStateKeyPrefix}${key}`;
}

function shouldLogRuntimeStateWarning() {
  return env.nodeEnv !== "test";
}

function logRuntimeStateWarning(action: "load" | "persist" | "delete", key: string, error: unknown) {
  if (!shouldLogRuntimeStateWarning()) {
    return;
  }

  const message = error instanceof Error ? error.message : "runtime state unavailable";
  // eslint-disable-next-line no-console
  console.warn(`[RuntimeStateStore] Failed to ${action} ${key}`, message);
}

export async function loadRuntimeState<T>(
  key: string,
) {
  if (getStoreMode() === "file") {
    return readStateFile(key) as T | null;
  }

  try {
    const client = await getRedisClient();
    if (!client) {
      return null;
    }

    const raw = await client.get(toRedisKey(key));
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as T;
  } catch (error) {
    logRuntimeStateWarning("load", key, error);
    return null;
  }
}

export async function saveRuntimeState(
  key: string,
  state: unknown,
) {
  if (getStoreMode() === "file") {
    try {
      writeStateFile(key, state);
    } catch (error) {
      logRuntimeStateWarning("persist", key, error);
    }
    return;
  }

  try {
    const client = await getRedisClient();
    if (!client) {
      return;
    }

    await client.set(toRedisKey(key), JSON.stringify(state));
  } catch (error) {
    logRuntimeStateWarning("persist", key, error);
  }
}

export async function deleteRuntimeState(key: string) {
  if (getStoreMode() === "file") {
    const filePath = getFilePath(key);
    if (existsSync(filePath)) {
      rmSync(filePath, { force: true });
    }
    return;
  }

  try {
    const client = await getRedisClient();
    if (!client) {
      return;
    }

    await client.del(toRedisKey(key));
  } catch (error) {
    logRuntimeStateWarning("delete", key, error);
  }
}

export async function checkRuntimeStateStoreHealth() {
  if (getStoreMode() === "file") {
    return {
      ok: true,
      mode: "file" as const,
      detail: "local file persistence",
    };
  }

  try {
    const client = await getRedisClient();
    if (!client) {
      return {
        ok: false,
        mode: "redis" as const,
        detail: "client unavailable",
      };
    }

    const pong = await client.ping();
    return {
      ok: pong === "PONG",
      mode: "redis" as const,
      detail: `ping=${pong}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "runtime state unavailable";
    return {
      ok: false,
      mode: "redis" as const,
      detail: message,
    };
  }
}
