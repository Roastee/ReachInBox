import type { PrismaClient } from "@prisma/client";
import type { EmailJobPayload } from "@reachinbox/shared";
import { env } from "../config/env";
import { prisma as defaultPrisma } from "../db";
import { indexEmail } from "../services/search-service";
import { emailQueue } from "./queues";

function asEmailPayload(payload: unknown): EmailJobPayload {
  if (!payload || typeof payload !== "object") throw new Error("Outbox payload is not an object");
  const candidate = payload as Record<string, unknown>;
  if (typeof candidate.emailId !== "string" || typeof candidate.tenantId !== "string") {
    throw new Error("Outbox email payload is missing emailId or tenantId");
  }
  return { emailId: candidate.emailId, tenantId: candidate.tenantId };
}

export async function publishOutboxBatch(
  database: PrismaClient = defaultPrisma,
  batchSize = 100,
): Promise<number> {
  const events = await database.outboxEvent.findMany({
    where: { publishedAt: null },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  let published = 0;
  for (const event of events) {
    try {
      if (event.kind !== "EMAIL_SCHEDULED") {
        if (event.kind !== "EMAIL_INDEX") {
          throw new Error(`Unsupported outbox event kind: ${event.kind}`);
        }

        const payload = asEmailPayload(event.payload);
        const email = await database.scheduledEmail.findUnique({
          where: { id: payload.emailId },
          select: {
            id: true,
            tenantId: true,
            scheduleId: true,
            toAddress: true,
            fromAddress: true,
            subject: true,
            bodyText: true,
            bodyHtml: true,
            scheduledAt: true,
            nextAttemptAt: true,
            sentAt: true,
            previewUrl: true,
            isStarred: true,
            archivedAt: true,
            deletedAt: true,
            status: true,
          },
        });
        if (!email || email.tenantId !== payload.tenantId) {
          throw new Error("Scheduled email referenced by outbox index event does not exist");
        }

        await indexEmail({
          id: email.id,
          tenantId: email.tenantId,
          scheduleId: email.scheduleId,
          toAddress: email.toAddress,
          fromAddress: email.fromAddress,
          subject: email.subject,
          bodyText: email.bodyText,
          bodyHtml: email.bodyHtml,
          scheduledAt: email.scheduledAt.toISOString(),
          nextAttemptAt: email.nextAttemptAt?.toISOString() || null,
          sentAt: email.sentAt?.toISOString() || null,
          previewUrl: email.previewUrl,
          isStarred: email.isStarred,
          archivedAt: email.archivedAt?.toISOString() || null,
          deletedAt: email.deletedAt?.toISOString() || null,
          status: email.status,
        });
      } else {
        const payload = asEmailPayload(event.payload);
        const email = await database.scheduledEmail.findUnique({
          where: { id: payload.emailId },
          select: { jobId: true, scheduledAt: true, tenantId: true },
        });
        if (!email || email.tenantId !== payload.tenantId) {
          throw new Error("Scheduled email referenced by outbox event does not exist");
        }

        // A stable jobId makes queue.add idempotent when a process crashes after
        // enqueueing but before marking the outbox row as published.
        await emailQueue.add("send-email", payload, {
          jobId: email.jobId,
          delay: Math.max(0, email.scheduledAt.getTime() - Date.now()),
          attempts: env.MAX_EMAIL_ATTEMPTS,
        });
      }

      await database.outboxEvent.update({
        where: { id: event.id },
        data: { publishedAt: new Date(), lastError: null, attempts: { increment: 1 } },
      });
      published += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await database.outboxEvent.update({
        where: { id: event.id },
        data: { lastError: message, attempts: { increment: 1 } },
      });
    }
  }

  return published;
}

async function recoverMissingPublishedJobs(database: PrismaClient, batchSize = 100): Promise<number> {
  const emails = await database.scheduledEmail.findMany({
    where: {
      status: "PENDING",
    },
    orderBy: { scheduledAt: "asc" },
    take: batchSize,
    select: { id: true, jobId: true, scheduledAt: true, tenantId: true },
  });

  let recovered = 0;
  for (const email of emails) {
    const publishedEvent = await database.outboxEvent.findFirst({
      where: { kind: "EMAIL_SCHEDULED", aggregateId: email.id, publishedAt: { not: null } },
      select: { id: true },
    });
    if (!publishedEvent) continue;

    const job = await emailQueue.getJob(email.jobId);
    if (job) continue;
    await emailQueue.add(
      "send-email",
      { emailId: email.id, tenantId: email.tenantId },
      {
        jobId: email.jobId,
        delay: Math.max(0, email.scheduledAt.getTime() - Date.now()),
        attempts: env.MAX_EMAIL_ATTEMPTS,
      },
    );
    recovered += 1;
  }
  return recovered;
}

/** Recovery retries unpublished rows and repairs published rows lost with Redis data. */
export async function recoverOutbox(database: PrismaClient = defaultPrisma): Promise<number> {
  const published = await publishOutboxBatch(database);
  return published + (await recoverMissingPublishedJobs(database));
}

export function startOutboxPublisher(database: PrismaClient = defaultPrisma): () => void {
  let stopped = false;
  let running = false;

  const tick = async (): Promise<void> => {
    if (stopped || running) return;
    running = true;
    try {
      await recoverOutbox(database);
    } catch (error) {
      console.error("outbox publisher failed", error);
    } finally {
      running = false;
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), env.OUTBOX_POLL_MS);
  timer.unref();

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
