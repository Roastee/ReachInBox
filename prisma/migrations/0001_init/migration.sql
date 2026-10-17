CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "ScheduleStatus" AS ENUM ('QUEUED', 'COMPLETED', 'PARTIAL_FAILURE', 'CANCELLED');
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED', 'NEEDS_REVIEW');

CREATE TABLE "Tenant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

CREATE TABLE "User" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "googleSub" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "avatarUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Membership" (
  "userId" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Membership_pkey" PRIMARY KEY ("userId", "tenantId"),
  CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Membership_tenantId_idx" ON "Membership"("tenantId");

CREATE TABLE "Schedule" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "createdById" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "sourceName" TEXT,
  "subject" TEXT NOT NULL DEFAULT '',
  "bodyText" TEXT NOT NULL DEFAULT '',
  "defaultFrom" TEXT NOT NULL DEFAULT 'ReachInbox <no-reply@example.test>',
  "delayMs" INTEGER NOT NULL DEFAULT 1000,
  "hourlyLimit" INTEGER NOT NULL DEFAULT 100,
  "idempotencyKey" TEXT,
  "status" "ScheduleStatus" NOT NULL DEFAULT 'QUEUED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Schedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Schedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Schedule_tenantId_createdAt_idx" ON "Schedule"("tenantId", "createdAt");
CREATE UNIQUE INDEX "Schedule_tenantId_idempotencyKey_key" ON "Schedule"("tenantId", "idempotencyKey");

CREATE TABLE "ScheduledEmail" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "scheduleId" UUID NOT NULL,
  "toAddress" TEXT NOT NULL,
  "fromAddress" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "bodyText" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "jobId" TEXT NOT NULL,
  "nextAttemptAt" TIMESTAMP(3),
  "lastError" TEXT,
  "messageId" TEXT,
  "previewUrl" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScheduledEmail_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScheduledEmail_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ScheduledEmail_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ScheduledEmail_jobId_key" ON "ScheduledEmail"("jobId");
CREATE INDEX "ScheduledEmail_tenantId_status_idx" ON "ScheduledEmail"("tenantId", "status");
CREATE INDEX "ScheduledEmail_tenantId_scheduledAt_idx" ON "ScheduledEmail"("tenantId", "scheduledAt");
CREATE INDEX "ScheduledEmail_scheduleId_idx" ON "ScheduledEmail"("scheduleId");

CREATE TABLE "OutboxEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "aggregateId" UUID NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OutboxEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OutboxEvent_kind_aggregateId_key" ON "OutboxEvent"("kind", "aggregateId");
CREATE INDEX "OutboxEvent_publishedAt_createdAt_idx" ON "OutboxEvent"("publishedAt", "createdAt");

CREATE TABLE "SlackConnection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "teamId" TEXT NOT NULL,
  "teamName" TEXT,
  "slackUserId" TEXT,
  "accessToken" TEXT NOT NULL,
  "webhookUrl" TEXT,
  "channelId" TEXT,
  "channelName" TEXT,
  "scope" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SlackConnection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SlackConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SlackConnection_tenantId_key" ON "SlackConnection"("tenantId");
CREATE UNIQUE INDEX "SlackConnection_teamId_key" ON "SlackConnection"("teamId");
