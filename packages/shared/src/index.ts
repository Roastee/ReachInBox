export const EMAIL_STATUSES = [
  "PENDING",
  "SENDING",
  "SENT",
  "FAILED",
  "CANCELLED",
  "NEEDS_REVIEW",
] as const;

export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export const SCHEDULE_STATUSES = [
  "QUEUED",
  "COMPLETED",
  "PARTIAL_FAILURE",
  "CANCELLED",
] as const;

export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export interface ScheduleUploadRow {
  to: string;
  from?: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  scheduledAt?: string;
}

export interface EmailAttachmentMetadata {
  id: string;
  filename: string;
  name?: string;
  contentType: string;
  sizeBytes: number;
  size?: number;
  url?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  tenantId: string;
}

export interface EmailSearchItem {
  id: string;
  tenantId: string;
  scheduleId: string;
  toAddress: string;
  fromAddress: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  scheduledAt: string;
  nextAttemptAt?: string | null;
  sentAt?: string | null;
  previewUrl?: string | null;
  isStarred?: boolean;
  archivedAt?: string | null;
  deletedAt?: string | null;
  status: EmailStatus;
  score?: number | null;
}

export interface ScheduleCreateResponse {
  id: string;
  emailCount: number;
  status: ScheduleStatus;
}

export interface EmailJobPayload {
  emailId: string;
  tenantId: string;
}

export interface RateLimitNotificationPayload {
  tenantId: string;
  sender: string;
  delayMs: number;
  hourWindow: string;
}
