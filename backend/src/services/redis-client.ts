import { createClient, type RedisClientType } from "redis";
import { env } from "./env.js";

let redisClient: RedisClientType | null = null;
let redisConnectPromise: Promise<unknown> | null = null;

export async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: env.redisUrl,
      socket: {
        connectTimeout: env.redisConnectTimeoutMs,
        reconnectStrategy: false,
      },
    });
  }

  if (!redisClient.isOpen) {
    if (!redisConnectPromise) {
      redisConnectPromise = redisClient.connect().finally(() => {
        redisConnectPromise = null;
      });
    }

    await redisConnectPromise;
  }

  return redisClient;
}
