import { createHash } from "node:crypto";

export function emailJobId(emailId: string): string {
  // BullMQ job ids are stable for the lifetime of the persisted email. Do not
  // use a timestamp here: outbox recovery must safely re-publish the same job.
  return `email-${emailId}`;
}

export function rateLimitNotificationJobId(
  tenantId: string,
  sender: string,
  bucket = Math.floor(Date.now() / 3_600_000),
): string {
  const canonicalSender = sender.match(/<([^<>\s]+@[^<>\s]+)>/)?.[1] || sender;
  const senderHash = createHash("sha256").update(canonicalSender.trim().toLowerCase()).digest("hex").slice(0, 16);
  return `slack-rate-limit-${tenantId}-${senderHash}-${bucket}`;
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "tenant";
}
