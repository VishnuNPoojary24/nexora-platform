import { Redis } from "ioredis";
import { env } from "./env.js";

let client: Redis | null = null;

export function getRedisClient(): Redis {
  if (!client) {
    client = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  return client;
}

export async function checkRedis(): Promise<boolean> {
  try {
    const redis = getRedisClient();
    if (redis.status === "wait") {
      await redis.connect();
    }
    return (await redis.ping()) === "PONG";
  } catch {
    return false;
  }
}
