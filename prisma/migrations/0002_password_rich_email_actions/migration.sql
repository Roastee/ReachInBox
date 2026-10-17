-- Password users do not have a Google subject. Existing Google users retain
-- their subject while the nullable unique column allows password-only users.
ALTER TABLE "User" ALTER COLUMN "googleSub" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;

ALTER TABLE "Schedule" ADD COLUMN "bodyHtml" TEXT;

ALTER TABLE "ScheduledEmail" ADD COLUMN "bodyHtml" TEXT;
ALTER TABLE "ScheduledEmail" ADD COLUMN "isStarred" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ScheduledEmail" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "ScheduledEmail" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "ScheduledEmail_tenantId_deletedAt_idx" ON "ScheduledEmail"("tenantId", "deletedAt");
CREATE INDEX "ScheduledEmail_tenantId_archivedAt_idx" ON "ScheduledEmail"("tenantId", "archivedAt");
CREATE INDEX "ScheduledEmail_tenantId_isStarred_idx" ON "ScheduledEmail"("tenantId", "isStarred");

CREATE TABLE "EmailAttachment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "scheduledEmailId" UUID NOT NULL,
  "filename" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "content" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailAttachment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmailAttachment_scheduledEmailId_fkey" FOREIGN KEY ("scheduledEmailId") REFERENCES "ScheduledEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "EmailAttachment_scheduledEmailId_idx" ON "EmailAttachment"("scheduledEmailId");
