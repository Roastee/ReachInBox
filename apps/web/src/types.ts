export type CampaignStatus = "scheduled" | "sent" | "paused" | "failed" | "sending" | "rate_limited" | "needs_review";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  initials?: string;
}

export interface CampaignRecord {
  id: string;
  recipient?: string;
  recipientsList?: string[];
  subject: string;
  sender: string;
  recipients: number;
  body?: string;
  bodyHtml?: string;
  attachments?: EmailAttachment[];
  starred?: boolean;
  archived?: boolean;
  scheduledAt?: string;
  sentAt?: string;
  delaySeconds?: number;
  hourlyLimit?: number;
  delivered?: number;
  opened?: number;
  bounced?: number;
  status: CampaignStatus;
  fileName?: string;
  previewUrl?: string;
}

export interface CreateCampaignPayload {
  subject: string;
  body: string;
  bodyHtml?: string;
  sender: string;
  recipients: string[];
  scheduledAt: string;
  delaySeconds: number;
  hourlyLimit: number;
  fileName?: string;
  file?: File;
  attachments?: File[];
}

export interface EmailAttachment {
  id?: string;
  name: string;
  size?: number;
  url?: string;
  contentType?: string;
}

export interface CampaignListResponse {
  items: CampaignRecord[];
  total?: number;
}

export interface CsvPreviewRow {
  value: string;
  valid: boolean;
  duplicate: boolean;
}
