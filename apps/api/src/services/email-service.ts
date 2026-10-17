import type { Prisma, PrismaClient } from "@prisma/client";
import { indexEmail, type SearchEmailDocument } from "./search-service";

const attachmentSelect = {
  id: true,
  filename: true,
  contentType: true,
  sizeBytes: true,
} as const;

type EmailWithAttachments = Prisma.ScheduledEmailGetPayload<{
  include: { attachments: { select: typeof attachmentSelect } };
}>;

export interface EmailAttachmentResponse {
  id: string;
  filename: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  size: number;
  url: string;
}

export interface EmailDetailResponse {
  id: string;
  tenantId: string;
  scheduleId: string;
  toAddress: string;
  fromAddress: string;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  scheduledAt: string;
  status: string;
  attempts: number;
  nextAttemptAt: string | null;
  lastError: string | null;
  messageId: string | null;
  previewUrl: string | null;
  sentAt: string | null;
  isStarred: boolean;
  archivedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: EmailAttachmentResponse[];
}

function iso(value: Date | null): string | null {
  return value?.toISOString() || null;
}

function attachmentUrl(emailId: string, attachmentId: string): string {
  return `/api/emails/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(attachmentId)}`;
}

export function serializeEmail(email: EmailWithAttachments): EmailDetailResponse {
  return {
    id: email.id,
    tenantId: email.tenantId,
    scheduleId: email.scheduleId,
    toAddress: email.toAddress,
    fromAddress: email.fromAddress,
    subject: email.subject,
    bodyText: email.bodyText,
    bodyHtml: email.bodyHtml,
    scheduledAt: email.scheduledAt.toISOString(),
    status: email.status,
    attempts: email.attempts,
    nextAttemptAt: iso(email.nextAttemptAt),
    lastError: email.lastError,
    messageId: email.messageId,
    previewUrl: email.previewUrl,
    sentAt: iso(email.sentAt),
    isStarred: email.isStarred,
    archivedAt: iso(email.archivedAt),
    deletedAt: iso(email.deletedAt),
    createdAt: email.createdAt.toISOString(),
    updatedAt: email.updatedAt.toISOString(),
    attachments: email.attachments.map((attachment) => ({
      id: attachment.id,
      filename: attachment.filename,
      name: attachment.filename,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      size: attachment.sizeBytes,
      url: attachmentUrl(email.id, attachment.id),
    })),
  };
}

function toSearchDocument(email: EmailWithAttachments): SearchEmailDocument {
  return {
    id: email.id,
    tenantId: email.tenantId,
    scheduleId: email.scheduleId,
    toAddress: email.toAddress,
    fromAddress: email.fromAddress,
    subject: email.subject,
    bodyText: email.bodyText,
    bodyHtml: email.bodyHtml,
    scheduledAt: email.scheduledAt.toISOString(),
    nextAttemptAt: iso(email.nextAttemptAt),
    sentAt: iso(email.sentAt),
    previewUrl: email.previewUrl,
    isStarred: email.isStarred,
    archivedAt: iso(email.archivedAt),
    deletedAt: iso(email.deletedAt),
    status: email.status,
  };
}

function refreshSearchIndex(email: EmailWithAttachments): void {
  void indexEmail(toSearchDocument(email)).catch((error) => {
    console.warn("email state persisted but Elasticsearch indexing failed", error);
  });
}

async function queueSearchReindex(database: PrismaClient, email: EmailWithAttachments): Promise<void> {
  const payload = { emailId: email.id, tenantId: email.tenantId };
  const reset = await database.outboxEvent.updateMany({
    where: { kind: "EMAIL_INDEX", aggregateId: email.id },
    data: { tenantId: email.tenantId, payload, publishedAt: null, lastError: null },
  });
  if (reset.count > 0) return;

  try {
    await database.outboxEvent.create({
      data: {
        tenantId: email.tenantId,
        kind: "EMAIL_INDEX",
        aggregateId: email.id,
        payload,
      },
    });
  } catch (error) {
    // Another worker may have created the unique event concurrently. Reset it
    // so the durable publisher still observes this latest email state.
    const code = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : undefined;
    if (code !== "P2002") throw error;
    await database.outboxEvent.updateMany({
      where: { kind: "EMAIL_INDEX", aggregateId: email.id },
      data: { tenantId: email.tenantId, payload, publishedAt: null, lastError: null },
    });
  }
}

async function findEmail(
  database: PrismaClient,
  tenantId: string,
  emailId: string,
  includeDeleted = false,
): Promise<EmailWithAttachments | null> {
  return database.scheduledEmail.findFirst({
    where: {
      id: emailId,
      tenantId,
      ...(includeDeleted ? {} : { deletedAt: null }),
    },
    include: { attachments: { select: attachmentSelect } },
  });
}

export async function getEmail(
  database: PrismaClient,
  tenantId: string,
  emailId: string,
): Promise<EmailDetailResponse | null> {
  const email = await findEmail(database, tenantId, emailId);
  return email ? serializeEmail(email) : null;
}

export async function starEmail(
  database: PrismaClient,
  tenantId: string,
  emailId: string,
  starred?: boolean,
): Promise<EmailDetailResponse | null> {
  const current = await findEmail(database, tenantId, emailId);
  if (!current) return null;

  const updated = await database.scheduledEmail.updateMany({
    where: { id: current.id, tenantId, deletedAt: null },
    data: { isStarred: starred ?? !current.isStarred },
  });
  if (updated.count === 0) return null;

  const email = await findEmail(database, tenantId, emailId);
  if (!email) return null;
  await queueSearchReindex(database, email);
  refreshSearchIndex(email);
  return serializeEmail(email);
}

export async function archiveEmail(
  database: PrismaClient,
  tenantId: string,
  emailId: string,
  archived = true,
): Promise<EmailDetailResponse | null> {
  const updated = await database.scheduledEmail.updateMany({
    where: { id: emailId, tenantId, deletedAt: null },
    data: { archivedAt: archived ? new Date() : null },
  });
  if (updated.count === 0) return null;

  const email = await findEmail(database, tenantId, emailId);
  if (!email) return null;
  await queueSearchReindex(database, email);
  refreshSearchIndex(email);
  return serializeEmail(email);
}

export async function deleteEmail(database: PrismaClient, tenantId: string, emailId: string): Promise<boolean> {
  const now = new Date();
  const deleted = await database.$transaction(async (transaction) => {
    const result = await transaction.scheduledEmail.updateMany({
      where: { id: emailId, tenantId, deletedAt: null },
      data: { deletedAt: now },
    });
    if (result.count === 0) return false;

    // Queued messages can be safely removed from the send path. A message that
    // is already SENDING is made reviewable before the worker can replay it;
    // the SMTP boundary remains at-most-once if a delete races a send.
    await transaction.scheduledEmail.updateMany({
      where: {
        id: emailId,
        tenantId,
        status: { in: ["PENDING", "FAILED"] },
      },
      data: { status: "CANCELLED", nextAttemptAt: null },
    });
    await transaction.scheduledEmail.updateMany({
      where: { id: emailId, tenantId, status: "SENDING" },
      data: {
        status: "NEEDS_REVIEW",
        nextAttemptAt: null,
        lastError: "Message was deleted while delivery was in progress; inspect the SMTP result before retrying.",
      },
    });
    return true;
  });

  if (!deleted) return false;
  const email = await findEmail(database, tenantId, emailId, true);
  if (email) {
    await queueSearchReindex(database, email);
    refreshSearchIndex(email);
  }
  return true;
}

export async function getEmailAttachment(
  database: PrismaClient,
  tenantId: string,
  emailId: string,
  attachmentId: string,
): Promise<{ filename: string; contentType: string; sizeBytes: number; content: Buffer } | null> {
  const email = await database.scheduledEmail.findFirst({
    where: { id: emailId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!email) return null;

  return database.emailAttachment.findFirst({
    where: { id: attachmentId, scheduledEmailId: email.id },
    select: { filename: true, contentType: true, sizeBytes: true, content: true },
  });
}
