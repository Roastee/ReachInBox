import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env";

let defaultTransporterPromise: Promise<Transporter> | undefined;
const senderTransporters = new Map<string, Promise<Transporter>>();

interface EtherealSenderConfig {
  from: string;
  user: string;
  pass: string;
}

function emailPart(value: string): string {
  return (value.match(/<([^<>\s]+@[^<>\s]+)>/)?.[1] || value).trim().toLowerCase();
}

function configuredSenders(): EtherealSenderConfig[] {
  if (!env.ETHEREAL_SENDERS_JSON) return [];
  try {
    const parsed = JSON.parse(env.ETHEREAL_SENDERS_JSON) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is EtherealSenderConfig =>
        Boolean(item && typeof item === "object" && "from" in item && "user" in item && "pass" in item) &&
        typeof (item as EtherealSenderConfig).from === "string" &&
        typeof (item as EtherealSenderConfig).user === "string" &&
        typeof (item as EtherealSenderConfig).pass === "string",
    );
  } catch {
    console.warn("ETHEREAL_SENDERS_JSON is not valid JSON; using the default Ethereal transport");
    return [];
  }
}

async function createEtherealTransport(): Promise<Transporter> {
  if (env.ETHEREAL_USER && env.ETHEREAL_PASS) {
    return nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.ETHEREAL_USER, pass: env.ETHEREAL_PASS },
    });
  }

  const account = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: { user: account.user, pass: account.pass },
  });
}

function getTransporter(from: string): Promise<Transporter> {
  const configured = configuredSenders().find((sender) => emailPart(sender.from) === emailPart(from));
  if (!configured) {
    defaultTransporterPromise ??= createEtherealTransport();
    return defaultTransporterPromise;
  }

  const key = emailPart(configured.from);
  const existing = senderTransporters.get(key);
  if (existing) return existing;
  const transporter = Promise.resolve(
    nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: configured.user, pass: configured.pass },
    }),
  );
  senderTransporters.set(key, transporter);
  return transporter;
}

export interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    content: Buffer;
  }>;
  messageId?: string;
}

export interface SentEmailResult {
  messageId: string;
  previewUrl?: string;
}

export async function sendEmail(message: EmailMessage): Promise<SentEmailResult> {
  const transporter = await getTransporter(message.from);
  const info = await transporter.sendMail(message);
  const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
  if (previewUrl) console.info(`Ethereal preview available for ${info.messageId}: ${previewUrl}`);
  return { messageId: info.messageId, previewUrl };
}

export function resetTransportForTests(): void {
  defaultTransporterPromise = undefined;
  senderTransporters.clear();
}
