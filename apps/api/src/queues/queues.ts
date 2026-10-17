import { Queue } from "bullmq";
import type { EmailJobPayload, RateLimitNotificationPayload } from "@reachinbox/shared";
import { createRedisConnection } from "../redis";

export const EMAIL_QUEUE_NAME = "reachinbox-email-sends";
export const NOTIFICATION_QUEUE_NAME = "reachinbox-notifications";

export const emailQueue = new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
    removeOnFail: { age: 7 * 24 * 60 * 60, count: 5000 },
  },
});

export const notificationQueue = new Queue<RateLimitNotificationPayload>(NOTIFICATION_QUEUE_NAME, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
    removeOnFail: { age: 7 * 24 * 60 * 60, count: 5000 },
  },
});

export async function closeQueues(): Promise<void> {
  await Promise.all([emailQueue.close(), notificationQueue.close()]);
}
