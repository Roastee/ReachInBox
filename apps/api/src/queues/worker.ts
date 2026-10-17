import { Job, Worker, type WorkerOptions } from "bullmq";
import type { EmailJobPayload, RateLimitNotificationPayload } from "@reachinbox/shared";
import { EmailStatus, PrismaClient } from "@prisma/client";
import { env } from "../config/env";
import { prisma as defaultPrisma } from "../db";
import { redis, createRedisConnection } from "../redis";
import { sendEmail } from "../services/email-sender";
import { indexEmail } from "../services/search-service";
import { sendRateLimitNotification } from "../services/slack-service";
import { emailJobId, rateLimitNotificationJobId } from "../utils/id";
import { acquireSenderSlot, nextDelayForTimestamp } from "./rate-limiter";
import { EMAIL_QUEUE_NAME, emailQueue, NOTIFICATION_QUEUE_NAME, notificationQueue } from "./queues";

const STALE_SENDING_MS = 10 * 60 * 1000;

async function refreshScheduleStatus(database: PrismaClient, scheduleId: string): Promise<void> {
  const emails = await database.scheduledEmail.findMany({ where: { scheduleId }, select: { status: true } });
  if (emails.length === 0) return;
  const sent = emails.filter((email) => email.status === EmailStatus.SENT).length;
  const failed = emails.filter((email) => email.status === EmailStatus.FAILED || email.status === EmailStatus.NEEDS_REVIEW).length;
  const pending = emails.some((email) => email.status === EmailStatus.PENDING || email.status === EmailStatus.SENDING);
  const cancelled = emails.every((email) => email.status === EmailStatus.CANCELLED);
  const status = cancelled
    ? "CANCELLED"
    : pending
      ? "QUEUED"
      : failed > 0
        ? "PARTIAL_FAILURE"
        : sent === emails.length
          ? "COMPLETED"
          : "QUEUED";
  await database.schedule.updateMany({
    where: { id: scheduleId, status: { not: "CANCELLED" } },
    data: { status },
  });
}

async function rescheduleEmailJob(
  job: Job<EmailJobPayload>,
  payload: EmailJobPayload,
  delayMs: number,
): Promise<void> {
  const delay = Math.max(1000, Math.ceil(delayMs));
  const runAt = Date.now() + delay;
  const token = (job as Job<EmailJobPayload> & { token?: string }).token;

  try {
    // Moving the active job preserves its deterministic id and avoids creating
    // duplicate jobs while the sender is throttled.
    await (job as unknown as { moveToDelayed: (timestamp: number, token?: string) => Promise<void> }).moveToDelayed(
      runAt,
      token,
    );
  } catch (error) {
    // Some BullMQ versions do not expose the worker lock token on Job. The
    // fallback still preserves idempotency at the database boundary and uses a
    // stable second-level retry id.
    const retryJobId = `${emailJobId(payload.emailId)}-retry-${Math.floor(runAt / 1000)}`;
    await emailQueue.add("send-email", payload, {
      jobId: retryJobId,
      delay,
      attempts: env.MAX_EMAIL_ATTEMPTS,
    });
    console.warn("email job moved to a fallback delayed job", { jobId: job.id, error });
  }
}

async function enqueueRateLimitNotification(
  payload: EmailJobPayload,
  sender: string,
  delayMs: number,
): Promise<void> {
  const hourWindow = new Date().toISOString().slice(0, 13);
  try {
    await notificationQueue.add(
      "rate-limit",
      { tenantId: payload.tenantId, sender, delayMs, hourWindow },
      { jobId: rateLimitNotificationJobId(payload.tenantId, sender, Math.floor(Date.now() / 3_600_000)) },
    );
  } catch (error) {
    // Notifications are advisory and must not block the email retry path.
    console.warn("could not enqueue Slack rate-limit notification", error);
  }
}

export async function processEmailJob(
  job: Job<EmailJobPayload>,
  database: PrismaClient = defaultPrisma,
): Promise<{ status: "sent" | "skipped" | "rescheduled" }> {
  const payload = job.data;
  const email = await database.scheduledEmail.findFirst({
    where: { id: payload.emailId, tenantId: payload.tenantId, deletedAt: null },
    include: { schedule: true, attachments: true },
  });

  if (!email || email.status === EmailStatus.SENT || email.status === EmailStatus.CANCELLED || email.status === EmailStatus.NEEDS_REVIEW) {
    return { status: "skipped" };
  }

  if (email.status === EmailStatus.SENDING) {
    const leaseAge = Date.now() - email.updatedAt.getTime();
    if (leaseAge < STALE_SENDING_MS) {
      // A stalled delivery can be replayed before the lease expires. Delay it
      // instead of marking the job complete and leaving the row stuck at
      // SENDING forever.
      await rescheduleEmailJob(job, payload, STALE_SENDING_MS - leaseAge + 1000);
      return { status: "rescheduled" };
    }
    await database.scheduledEmail.updateMany({
      where: { id: email.id, tenantId: email.tenantId, status: EmailStatus.SENDING },
      data: {
        status: EmailStatus.NEEDS_REVIEW,
        lastError: "Delivery was in progress when the worker lease expired; it was not retried to avoid a duplicate SMTP send.",
      },
    });
    await refreshScheduleStatus(database, email.scheduleId);
    return { status: "skipped" };
  }

  const scheduleDelay = nextDelayForTimestamp(email.scheduledAt);
  if (scheduleDelay > 0) {
    await rescheduleEmailJob(job, payload, scheduleDelay);
    return { status: "rescheduled" };
  }

  let slot: { delayMs: number; rateLimited: boolean };
  try {
    slot = await acquireSenderSlot(
      redis,
      email.tenantId,
      email.fromAddress,
      email.schedule.hourlyLimit,
      email.id,
      Math.max(env.SENDER_MIN_DELAY_MS, email.schedule.delayMs),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("rate limiter unavailable; keeping email queued", message);
    await database.scheduledEmail.updateMany({
      where: { id: email.id, tenantId: email.tenantId, status: { in: [EmailStatus.PENDING, EmailStatus.FAILED] } },
      data: { status: EmailStatus.PENDING, nextAttemptAt: new Date(Date.now() + 5000), lastError: `Rate limiter unavailable: ${message}` },
    });
    await rescheduleEmailJob(job, payload, 5000);
    return { status: "rescheduled" };
  }

  if (slot.delayMs > 0) {
    await database.scheduledEmail.updateMany({
      where: { id: email.id, tenantId: email.tenantId, status: { in: [EmailStatus.PENDING, EmailStatus.FAILED] } },
      data: { status: EmailStatus.PENDING, nextAttemptAt: new Date(Date.now() + slot.delayMs), lastError: null },
    });
    if (slot.rateLimited) await enqueueRateLimitNotification(payload, email.fromAddress, slot.delayMs);
    await rescheduleEmailJob(job, payload, slot.delayMs);
    return { status: "rescheduled" };
  }

  // Claim after the distributed gate. A duplicate worker can observe the same
  // deterministic Redis member, but only one can transition the DB row.
  const claimed = await database.scheduledEmail.updateMany({
    where: {
      id: email.id,
      tenantId: email.tenantId,
      status: { in: [EmailStatus.PENDING, EmailStatus.FAILED] },
    },
    data: { status: EmailStatus.SENDING, nextAttemptAt: null, lastError: null },
  });
  if (claimed.count === 0) return { status: "skipped" };

  await database.scheduledEmail.updateMany({
    where: { id: email.id, tenantId: email.tenantId, status: EmailStatus.SENDING },
    data: { attempts: { increment: 1 } },
  });

  try {
    const result = await sendEmail({
      from: email.fromAddress,
      to: email.toAddress,
      subject: email.subject,
      text: email.bodyText,
      html: email.bodyHtml || undefined,
      attachments: (email.attachments || []).map((attachment) => ({
        filename: attachment.filename,
        contentType: attachment.contentType,
        content: attachment.content,
      })),
      messageId: `<${email.id}@reachinbox.local>`,
    });

    const transition = await database.scheduledEmail.updateMany({
      where: { id: email.id, tenantId: email.tenantId, status: EmailStatus.SENDING },
      data: {
        status: EmailStatus.SENT,
        messageId: result.messageId,
        previewUrl: result.previewUrl,
        sentAt: new Date(),
        lastError: null,
      },
    });

    if (transition.count > 0) {
      await refreshScheduleStatus(database, email.scheduleId);
      try {
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
          sentAt: new Date().toISOString(),
          previewUrl: result.previewUrl || null,
          isStarred: email.isStarred,
          archivedAt: email.archivedAt?.toISOString() || null,
          deletedAt: email.deletedAt?.toISOString() || null,
          status: EmailStatus.SENT,
        });
      } catch (indexError) {
        // Search indexing is eventually consistent and cannot turn a delivered
        // SMTP message back into a failed send.
        console.warn("email was sent but Elasticsearch indexing failed", indexError);
      }
    }
    return { status: "sent" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await database.scheduledEmail.updateMany({
      where: { id: email.id, tenantId: email.tenantId, status: EmailStatus.SENDING },
      data: { status: EmailStatus.NEEDS_REVIEW, lastError: message },
    });
    await refreshScheduleStatus(database, email.scheduleId);
    // SMTP errors can happen after the remote server accepts a message. Do not
    // let BullMQ retry the job automatically and risk a duplicate delivery.
    console.warn("email delivery needs review; automatic retry suppressed", { emailId: email.id, error });
    return { status: "skipped" };
  }
}

export function createWorkers(database: PrismaClient = defaultPrisma): {
  emailWorker: Worker<EmailJobPayload>;
  notificationWorker: Worker<RateLimitNotificationPayload>;
  close: () => Promise<void>;
} {
  const workerOptions: Omit<WorkerOptions, "connection"> = {
    concurrency: env.WORKER_CONCURRENCY,
  };
  const emailWorker = new Worker<EmailJobPayload>(
    EMAIL_QUEUE_NAME,
    async (job) => processEmailJob(job, database),
    { ...workerOptions, connection: createRedisConnection() },
  );
  const notificationWorker = new Worker<RateLimitNotificationPayload>(
    NOTIFICATION_QUEUE_NAME,
    async (job) => {
      const { tenantId, sender, delayMs, hourWindow } = job.data;
      await sendRateLimitNotification(
        database,
        tenantId,
        `Sender ${sender} reached its hourly limit for ${hourWindow} UTC. Queued messages will resume in about ${Math.ceil(delayMs / 60000)} minutes.`,
      );
      return { notified: true };
    },
    { ...workerOptions, connection: createRedisConnection() },
  );

  emailWorker.on("failed", (job, error) => {
    console.error("email worker job failed", { jobId: job?.id, error });
  });
  notificationWorker.on("failed", (job, error) => {
    console.error("notification worker job failed", { jobId: job?.id, error });
  });

  return {
    emailWorker,
    notificationWorker,
    close: async () => {
      await Promise.all([emailWorker.close(), notificationWorker.close()]);
    },
  };
}
