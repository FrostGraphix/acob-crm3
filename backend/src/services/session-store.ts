import { env } from "./env.js";
import { getRedisClient } from "./redis-client.js";

export interface SessionRecord {
  upstreamCookie?: string;
  csrfToken: string;
}

const SESSION_TTL_SECONDS = 8 * 60 * 60;

interface MemorySessionEntry {
  record: SessionRecord;
  expiresAt: number;
}

const memorySessions = new Map<string, MemorySessionEntry>();

function getExpiryEpochMs() {
  return Date.now() + SESSION_TTL_SECONDS * 1000;
}

function pruneMemorySessions() {
  const now = Date.now();
  for (const [sessionId, entry] of memorySessions.entries()) {
    if (entry.expiresAt <= now) {
      memorySessions.delete(sessionId);
    }
  }
}

function toRedisKey(sessionId: string) {
  return `${env.redisKeyPrefix}${sessionId}`;
}

function parseRedisRecord(value: string): SessionRecord | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const csrfToken =
      typeof parsed.csrfToken === "string" ? parsed.csrfToken : null;
    const upstreamCookie =
      typeof parsed.upstreamCookie === "string" ? parsed.upstreamCookie : undefined;

    if (!csrfToken) {
      return null;
    }

    return { csrfToken, upstreamCookie };
  } catch {
    return null;
  }
}

export async function createSession(sessionId: string, record: SessionRecord) {
  if (env.sessionStoreMode === "memory") {
    pruneMemorySessions();
    memorySessions.set(sessionId, {
      record,
      expiresAt: getExpiryEpochMs(),
    });
    return;
  }

  const client = await getRedisClient();
  if (!client) {
    return;
  }

  await client.set(toRedisKey(sessionId), JSON.stringify(record), {
    EX: SESSION_TTL_SECONDS,
  });
}

export async function getSession(sessionId: string) {
  if (env.sessionStoreMode === "memory") {
    const entry = memorySessions.get(sessionId);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      memorySessions.delete(sessionId);
      return null;
    }

    return entry.record;
  }

  const client = await getRedisClient();
  if (!client) {
    return null;
  }

  const raw = await client.get(toRedisKey(sessionId));
  if (!raw) {
    return null;
  }

  return parseRedisRecord(raw);
}

export async function deleteSession(sessionId: string) {
  if (env.sessionStoreMode === "memory") {
    memorySessions.delete(sessionId);
    return;
  }

  const client = await getRedisClient();
  if (!client) {
    return;
  }

  await client.del(toRedisKey(sessionId));
}

export async function checkSessionStoreHealth() {
  if (env.sessionStoreMode === "memory") {
    return {
      ok: true,
      mode: "memory" as const,
      detail: "in-memory store",
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
    const message = error instanceof Error ? error.message : "redis unavailable";
    return {
      ok: false,
      mode: "redis" as const,
      detail: message,
    };
  }
}
