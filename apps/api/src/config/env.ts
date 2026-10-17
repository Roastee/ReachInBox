import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

// npm workspace commands may execute with the repository root as cwd. Load the
// API-local .env explicitly so Prisma and the runtime use the same settings.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

const optionalString = z.string().optional().default("");
const booleanFromEnv = z.preprocess(
  (value) => {
    if (value === undefined || value === "") return false;
    if (typeof value === "boolean") return value;
    return value === "true" || value === "1";
  },
  z.boolean(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  SESSION_SECRET: z.string().min(16).default("local-development-session-secret-change-me"),
  ALLOW_DEV_AUTH: booleanFromEnv.default(false),

  DATABASE_URL: z
    .string()
    .url()
    .default("postgresql://postgres:postgres@localhost:5432/reachinbox?schema=public"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  ELASTICSEARCH_URL: z.string().url().default("http://localhost:9200"),
  ELASTICSEARCH_USERNAME: optionalString,
  ELASTICSEARCH_PASSWORD: optionalString,
  ELASTICSEARCH_INDEX: z.string().min(1).default("reachinbox-emails"),

  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GOOGLE_CALLBACK_URL: z.string().url().default("http://localhost:4000/auth/google/callback"),

  SLACK_CLIENT_ID: optionalString,
  SLACK_CLIENT_SECRET: optionalString,
  SLACK_CALLBACK_URL: z.string().url().default("http://localhost:4000/auth/slack/callback"),
  SLACK_RATE_LIMIT_CHANNEL: optionalString,

  SMTP_HOST: z.string().min(1).default("smtp.ethereal.email"),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanFromEnv.default(false),
  ETHEREAL_USER: optionalString,
  ETHEREAL_PASS: optionalString,
  ETHEREAL_SENDERS_JSON: optionalString,
  DEFAULT_FROM: z.string().min(3).default("ReachInbox <no-reply@example.test>"),

  WORKER_CONCURRENCY: z.coerce.number().int().positive().max(100).default(5),
  OUTBOX_POLL_MS: z.coerce.number().int().positive().default(5000),
  SENDER_MIN_DELAY_MS: z.coerce.number().int().nonnegative().default(2000),
  SENDER_HOURLY_LIMIT: z.coerce.number().int().positive().default(200),
  MAX_EMAIL_ATTEMPTS: z.coerce.number().int().positive().max(20).default(3),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  MAX_ATTACHMENT_COUNT: z.coerce.number().int().nonnegative().max(100).default(5),
  MAX_ATTACHMENT_BYTES: z.coerce.number().int().positive().max(25 * 1024 * 1024).default(2 * 1024 * 1024),
  MAX_TOTAL_ATTACHMENT_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(100 * 1024 * 1024)
    .default(10 * 1024 * 1024),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = parsed.data;
export type Env = typeof env;

export const googleOAuthConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
export const slackOAuthConfigured = Boolean(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET);
