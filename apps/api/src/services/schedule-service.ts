import { randomUUID } from "node:crypto";
import type { PrismaClient, ScheduleStatus } from "@prisma/client";
import { env } from "../config/env";
import { emailJobId } from "../utils/id";
import { CsvInputError, isEmailAddress, parseScheduleCsv } from "../utils/csv";

export interface ScheduleAttachmentInput {
  filename: string;
  contentType: string;
  sizeBytes: number;
  content: Buffer;
}

export interface CreateScheduleInput {
  tenantId: string;
  createdById: string;
  name?: string;
  sourceName?: string;
  defaultFrom?: string;
  defaultScheduledAt?: string;
  defaultSubject?: string;
  defaultBody?: string;
  defaultBodyHtml?: string;
  /** Alias used by callers that create one rich-body schedule directly. */
  bodyHtml?: string;
  delayMs?: number;
  hourlyLimit?: number;
  idempotencyKey?: string;
  attachments?: ScheduleAttachmentInput[];
  csv: string;
}

function validateAttachments(attachments: ScheduleAttachmentInput[]): ScheduleAttachmentInput[] {
  if (attachments.length > env.MAX_ATTACHMENT_COUNT) {
    throw new CsvInputError(`A schedule may contain at most ${env.MAX_ATTACHMENT_COUNT} attachments`);
  }

  let totalBytes = 0;
  return attachments.map((attachment) => {
    const filename = attachment.filename.trim();
    if (!filename) throw new CsvInputError("Attachment filename is required");

    const content = Buffer.isBuffer(attachment.content) ? attachment.content : Buffer.from(attachment.content);
    const sizeBytes = content.byteLength;
    if (sizeBytes > env.MAX_ATTACHMENT_BYTES) {
      throw new CsvInputError(`Attachment ${filename} cannot exceed ${env.MAX_ATTACHMENT_BYTES} bytes`);
    }

    totalBytes += sizeBytes;
    if (totalBytes > env.MAX_TOTAL_ATTACHMENT_BYTES) {
      throw new CsvInputError(`Attachments cannot exceed ${env.MAX_TOTAL_ATTACHMENT_BYTES} bytes in total`);
    }

    return {
      filename,
      contentType: attachment.contentType.trim() || "application/octet-stream",
      sizeBytes,
      content,
    };
  });
}

export async function createSchedule(
  database: PrismaClient,
  input: CreateScheduleInput,
): Promise<{ id: string; emailCount: number; status: ScheduleStatus }> {
  const attachments = validateAttachments(input.attachments || []);
  const defaultBodyHtml = input.defaultBodyHtml ?? input.bodyHtml;
  const delayMs = Number.isFinite(input.delayMs) ? Math.max(0, Math.floor(input.delayMs as number)) : env.SENDER_MIN_DELAY_MS;
  const hourlyLimit = Number.isFinite(input.hourlyLimit)
    ? Math.max(1, Math.floor(input.hourlyLimit as number))
    : env.SENDER_HOURLY_LIMIT;
  if (hourlyLimit > env.SENDER_HOURLY_LIMIT) {
    throw new CsvInputError(`hourlyLimit cannot exceed ${env.SENDER_HOURLY_LIMIT}`);
  }
  const rows = parseScheduleCsv(input.csv, {
    subject: input.defaultSubject,
    body: input.defaultBody,
    bodyHtml: defaultBodyHtml,
    from: input.defaultFrom || env.DEFAULT_FROM,
    scheduledAt: input.defaultScheduledAt,
  });
  if (rows.length > 10_000) throw new CsvInputError("A single schedule may contain at most 10,000 emails");

  const defaultDate = input.defaultScheduledAt ? new Date(input.defaultScheduledAt) : new Date();
  if (Number.isNaN(defaultDate.getTime())) throw new CsvInputError("default scheduledAt must be a valid date");
  const fallbackFrom = input.defaultFrom || env.DEFAULT_FROM;
  if (!fallbackFrom && rows.some((row) => !row.from)) {
    throw new CsvInputError("from is required in every row or as the defaultFrom form field");
  }

  const seenRecipients = new Set<string>();
  const normalized = rows.flatMap((row, index) => {
    const fromAddress = row.from || fallbackFrom;
    if (!isEmailAddress(row.to)) throw new CsvInputError(`Row ${index + 2}: invalid recipient email`);
    if (!fromAddress || !isEmailAddress(fromAddress)) {
      throw new CsvInputError(`Row ${index + 2}: sender must be a valid email address`);
    }
    const normalizedRecipient = row.to.trim().toLowerCase();
    if (seenRecipients.has(normalizedRecipient)) return [];
    seenRecipients.add(normalizedRecipient);
    const date = row.scheduledAt ? new Date(row.scheduledAt) : new Date(defaultDate.getTime() + index * delayMs);
    if (Number.isNaN(date.getTime())) throw new CsvInputError(`Row ${index + 2}: scheduledAt must be a valid date`);
    return [
      {
        ...row,
        to: normalizedRecipient,
        subject: row.subject.trim(),
        body: row.body.trim(),
        ...(row.bodyHtml?.trim() ? { bodyHtml: row.bodyHtml.trim() } : {}),
        fromAddress,
        scheduledAt: date,
      },
    ];
  });

  if (normalized.length === 0) throw new CsvInputError("Upload did not contain any unique valid recipients");

  const existingSchedule = input.idempotencyKey
    ? await database.schedule.findFirst({
        where: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey },
        include: { _count: { select: { emails: true } } },
      })
    : null;
  if (existingSchedule) {
    return { id: existingSchedule.id, emailCount: existingSchedule._count.emails, status: existingSchedule.status };
  }

  const scheduleId = randomUUID();
  await database.$transaction(async (transaction) => {
    await transaction.schedule.create({
      data: {
        id: scheduleId,
        tenantId: input.tenantId,
        createdById: input.createdById,
        name: input.name?.trim() || `Email schedule ${new Date().toISOString()}`,
        sourceName: input.sourceName,
        subject: input.defaultSubject?.trim() || normalized[0].subject,
        bodyText: input.defaultBody?.trim() || normalized[0].body,
        bodyHtml: defaultBodyHtml?.trim() || normalized[0].bodyHtml || null,
        defaultFrom: fallbackFrom || normalized[0].fromAddress,
        delayMs,
        hourlyLimit,
        idempotencyKey: input.idempotencyKey,
        status: "QUEUED",
      },
    });

    for (const row of normalized) {
      const emailId = randomUUID();
      await transaction.scheduledEmail.create({
        data: {
          id: emailId,
          tenantId: input.tenantId,
          scheduleId,
          toAddress: row.to,
          fromAddress: row.fromAddress,
          subject: row.subject,
          bodyText: row.body,
          bodyHtml: row.bodyHtml || null,
          scheduledAt: row.scheduledAt,
          nextAttemptAt: row.scheduledAt,
          jobId: emailJobId(emailId),
          status: "PENDING",
          ...(attachments.length
            ? {
                attachments: {
                  create: attachments.map((attachment) => ({
                    filename: attachment.filename,
                    contentType: attachment.contentType,
                    sizeBytes: attachment.sizeBytes,
                    content: attachment.content,
                  })),
                },
              }
            : {}),
        },
      });
      await transaction.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          kind: "EMAIL_SCHEDULED",
          aggregateId: emailId,
          payload: { emailId, tenantId: input.tenantId },
        },
      });
      await transaction.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          kind: "EMAIL_INDEX",
          aggregateId: emailId,
          payload: { emailId, tenantId: input.tenantId },
        },
      });
    }
  });

  return { id: scheduleId, emailCount: normalized.length, status: "QUEUED" };
}

export async function listSchedules(database: PrismaClient, tenantId: string) {
  return database.schedule.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { emails: true } } },
  });
}

export async function getSchedule(database: PrismaClient, tenantId: string, scheduleId: string) {
  return database.schedule.findFirst({
    where: { id: scheduleId, tenantId },
    include: { emails: { orderBy: { scheduledAt: "asc" } } },
  });
}

export async function cancelSchedule(
  database: PrismaClient,
  tenantId: string,
  scheduleId: string,
): Promise<boolean> {
  const updated = await database.$transaction(async (transaction) => {
    const schedule = await transaction.schedule.findFirst({ where: { id: scheduleId, tenantId } });
    if (!schedule) return false;
    await transaction.scheduledEmail.updateMany({
      where: {
        scheduleId,
        tenantId,
        status: { in: ["PENDING", "FAILED"] },
      },
      data: { status: "CANCELLED" },
    });
    await transaction.schedule.update({ where: { id: scheduleId }, data: { status: "CANCELLED" } });
    return true;
  });
  return updated;
}
