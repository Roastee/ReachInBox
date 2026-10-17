import Redis from "ioredis";
import { env } from "./config/env";

// BullMQ requires maxRetriesPerRequest to be null so a blocked Redis command
// can remain pending until the connection is available again.
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

export function createRedisConnection(): Redis {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}
