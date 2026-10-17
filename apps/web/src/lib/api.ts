import type {
  CampaignListResponse,
  CampaignRecord,
  CampaignStatus,
  CreateCampaignPayload,
  EmailAttachment,
  User,
} from "../types";

const configuredBaseUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const useDevProxy = import.meta.env.DEV;

// Vite proxies /api and /auth to VITE_API_URL during local development. This
// avoids browser CORS differences between local hostnames while the
// environment variable remains the single source of truth for the API origin.
export const apiBaseUrl = useDevProxy ? "" : configuredBaseUrl;
export const isApiConfigured = Boolean(configuredBaseUrl || useDevProxy);

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function unwrapData(payload: unknown): unknown {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: unknown }).data;
  }
  return payload;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function numberFrom(value: unknown, fallback = 0): number {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return asNumber(value, fallback);
}

function normalizeAttachments(value: unknown): EmailAttachment[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const attachments: EmailAttachment[] = [];
  value.forEach((entry) => {
    const item = asRecord(entry);
    const name = asString(item.name ?? item.fileName ?? item.filename);
    if (!name) return;
    const rawUrl = asString(item.url ?? item.downloadUrl);
    attachments.push({
      id: asString(item.id ?? item._id) || undefined,
      name,
      size: numberFrom(item.size, 0) || undefined,
      url: rawUrl.startsWith("/") && apiBaseUrl ? `${apiBaseUrl}${rawUrl}` : rawUrl || undefined,
      contentType: asString(item.contentType ?? item.type) || undefined,
    });
  });
  return attachments.length ? attachments : undefined;
}

function normalizeStatus(value: unknown, fallback: CampaignStatus): CampaignStatus {
  const status = asString(value).toLowerCase();
  if (status === "pending") return "scheduled";
  if (status === "sending") return "sending";
  if (status === "rate_limited" || status === "rate-limited") return "rate_limited";
  if (status === "needs_review" || status === "needs-review") return "needs_review";
  if (status === "cancelled" || status === "canceled") return "failed";
  if (status === "scheduled" || status === "sent" || status === "paused" || status === "failed") {
    return status;
  }
  return fallback;
}

export function normalizeCampaign(raw: unknown, fallbackStatus: CampaignStatus, index: number): CampaignRecord {
  const item = asRecord(raw);
  const recipientListValue = item.recipientsList ?? item.recipients ?? item.to;
  const recipientsValue = item.recipients ?? item.recipientCount ?? item.totalRecipients ?? item.toAddress ?? item.to;
  const metrics = asRecord(item.metrics);
  const senderValue = item.sender ?? item.from ?? item.fromAddress ?? item.senderEmail;
  const firstRecipient = Array.isArray(recipientListValue) ? recipientListValue[0] : recipientListValue;

  return {
    id: asString(item.id ?? item._id, `campaign-${index}`),
    recipient: asString(item.recipient ?? item.toAddress ?? item.email ?? firstRecipient),
    recipientsList: Array.isArray(recipientListValue)
      ? recipientListValue.filter((value): value is string => typeof value === "string")
      : undefined,
    subject: asString(item.subject ?? item.title, "Untitled campaign"),
    sender: asString(senderValue, "—"),
    recipients: numberFrom(recipientsValue),
    body: asString(item.body ?? item.bodyText ?? item.text ?? item.message) || undefined,
    bodyHtml: asString(item.bodyHtml ?? item.body_html ?? item.html ?? item.messageHtml) || undefined,
    attachments: normalizeAttachments(item.attachments ?? item.files),
    starred: Boolean(item.starred ?? item.isStarred ?? item.star),
    archived: Boolean(item.archived ?? item.isArchived),
    scheduledAt: asString(item.scheduledAt ?? item.nextAttemptAt ?? item.startTime ?? item.scheduled_at) || undefined,
    sentAt: asString(item.sentAt ?? item.completedAt ?? item.sent_at) || undefined,
    delaySeconds: numberFrom(item.delaySeconds ?? item.delay ?? item.delay_seconds, 0),
    hourlyLimit: numberFrom(item.hourlyLimit ?? item.rateLimit ?? item.hourly_limit, 0),
    delivered: numberFrom(item.delivered ?? metrics.delivered, 0),
    opened: numberFrom(item.opened ?? metrics.opened, 0),
    bounced: numberFrom(item.bounced ?? metrics.bounced, 0),
    status: normalizeStatus(item.status, fallbackStatus),
    fileName: asString(item.fileName ?? item.file_name) || undefined,
    previewUrl: asString(item.previewUrl ?? item.preview_url) || undefined,
  };
}

function normalizeList(payload: unknown, status: CampaignStatus): CampaignListResponse {
  const unwrapped = unwrapData(payload);
  const record = asRecord(unwrapped);
  const rawItems = Array.isArray(unwrapped)
    ? unwrapped
    : Array.isArray(record.items)
      ? record.items
      : Array.isArray(record.results)
        ? record.results
        : Array.isArray(record.campaigns)
          ? record.campaigns
          : [];

  return {
    items: rawItems.map((item, index) => normalizeCampaign(item, status, index)),
    total: typeof record.total === "number" ? record.total : undefined,
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch (error) {
    const detail = error instanceof Error && error.message ? ` (${error.message})` : "";
    throw new ApiError(`We could not reach the ReachInbox API${detail}.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const rawPayload = response.status === 204 ? "" : await response.text();
  let payload: unknown = rawPayload;
  if (contentType.includes("application/json") && rawPayload) {
    try {
      payload = JSON.parse(rawPayload) as unknown;
    } catch {
      payload = rawPayload;
    }
  }

  if (!response.ok) {
    const payloadRecord = asRecord(payload);
    const message = asString(payloadRecord.message ?? payloadRecord.error) || (typeof payload === "string" && payload.trim()
      ? payload
      : `Request failed with status ${response.status}.`);
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

function parseUser(payload: unknown): User {
  const unwrapped = unwrapData(payload);
  const envelope = asRecord(unwrapped);
  const record = envelope.user && typeof envelope.user === "object" ? asRecord(envelope.user) : envelope;
  const name = asString(record.name ?? record.fullName, "ReachInbox user");
  const email = asString(record.email, "");
  return {
    id: asString(record.id ?? record._id, email || "user"),
    name,
    email,
    avatarUrl: asString(record.avatarUrl ?? record.avatar) || undefined,
    initials: name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join(""),
  };
}

export const api = {
  getGoogleAuthUrl(): string {
    return import.meta.env.VITE_GOOGLE_AUTH_URL || `${apiBaseUrl}/auth/google`;
  },

  async getCurrentUser(): Promise<User> {
    return parseUser(await request<unknown>("/api/auth/me"));
  },

  async login(email: string, password: string): Promise<User> {
    return parseUser(await request<unknown>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }));
  },

  async register(name: string, email: string, password: string): Promise<User> {
    return parseUser(await request<unknown>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }));
  },

  async listCampaigns(status: "scheduled" | "sent", search = ""): Promise<CampaignListResponse> {
    const params = new URLSearchParams({ status, pageSize: "100" });
    if (search.trim()) params.set("q", search.trim());
    const result = await request<unknown>(`/api/emails?${params.toString()}`);
    return normalizeList(result, status);
  },

  async createCampaign(payload: CreateCampaignPayload): Promise<CampaignRecord> {
    const form = new FormData();
    form.set("subject", payload.subject);
    form.set("body", payload.body);
    form.set("bodyHtml", payload.bodyHtml ?? payload.body);
    form.set("from", payload.sender);
    form.set("scheduledAt", payload.scheduledAt);
    form.set("delaySeconds", String(payload.delaySeconds));
    form.set("hourlyLimit", String(payload.hourlyLimit));
    if (payload.file) form.set("file", payload.file, payload.file.name);
    else form.set("file", new Blob([payload.recipients.join("\n")], { type: "text/plain" }), "recipients.txt");
    payload.attachments?.forEach((attachment) => form.append("attachments", attachment, attachment.name));
    const result = await request<unknown>("/api/schedules", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: form,
    });
    const resultRecord = asRecord(unwrapData(result));
    return {
      id: asString(asRecord(resultRecord.schedule ?? resultRecord).id, `schedule-${Date.now()}`),
      subject: payload.subject,
      body: payload.body,
      bodyHtml: payload.bodyHtml,
      sender: payload.sender,
      recipients: payload.recipients.length,
      recipientsList: payload.recipients,
      attachments: payload.attachments?.map((attachment) => ({ name: attachment.name, size: attachment.size, contentType: attachment.type })),
      scheduledAt: payload.scheduledAt,
      delaySeconds: payload.delaySeconds,
      hourlyLimit: payload.hourlyLimit,
      status: "scheduled",
      fileName: payload.fileName,
    };
  },

  connectSlack(): void {
    window.location.assign(`${apiBaseUrl}/auth/slack/connect`);
  },

  async getSlackStatus(): Promise<{ connected: boolean }> {
    const result = await request<unknown>("/auth/slack/status");
    const record = asRecord(unwrapData(result));
    return { connected: Boolean(record.connected ?? record.connection) };
  },

  async disconnectSlack(): Promise<void> {
    await request<unknown>("/auth/slack/disconnect", { method: "DELETE" });
  },

  async logout(): Promise<void> {
    await request<unknown>("/api/auth/logout", { method: "POST" });
  },

  async getEmail(id: string, fallbackStatus: "scheduled" | "sent" = "sent"): Promise<CampaignRecord> {
    const payload = unwrapData(await request<unknown>(`/api/emails/${encodeURIComponent(id)}`));
    const record = asRecord(payload);
    const nested = [record.email, record.item, record.result].find((value) => value && typeof value === "object");
    return normalizeCampaign(nested ?? payload, fallbackStatus, 0);
  },

  async starEmail(id: string): Promise<void> {
    await request<unknown>(`/api/emails/${encodeURIComponent(id)}/star`, { method: "POST" });
  },

  async archiveEmail(id: string): Promise<void> {
    await request<unknown>(`/api/emails/${encodeURIComponent(id)}/archive`, { method: "POST" });
  },

  async deleteEmail(id: string): Promise<void> {
    await request<unknown>(`/api/emails/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};
