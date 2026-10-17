import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./db";
import { redis } from "./redis";
import { closeQueues } from "./queues/queues";
import { startOutboxPublisher } from "./queues/outbox";
import { createWorkers } from "./queues/worker";

const app = createApp();
const workers = createWorkers();
const stopOutboxPublisher = startOutboxPublisher();

const server = app.listen(env.PORT, () => {
  console.info(`ReachInbox API listening on http://localhost:${env.PORT}`);
});

async function shutdown(signal: string): Promise<void> {
  console.info(`received ${signal}; shutting down`);
  stopOutboxPublisher();
  server.close(async () => {
    await workers.close();
    await closeQueues();
    await Promise.all([prisma.$disconnect(), redis.quit()]);
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
