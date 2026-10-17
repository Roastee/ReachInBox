import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { createSchedule } from "../src/services/schedule-service";

test("schedule persistence keeps rich bodies and attachment bytes per recipient", async () => {
  const scheduleCreates: Array<Record<string, unknown>> = [];
  const emailCreates: Array<Record<string, unknown>> = [];
  const outboxCreates: Array<Record<string, unknown>> = [];

  const transaction = {
    schedule: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        scheduleCreates.push(data);
        return data;
      },
      findFirst: async () => null,
    },
    scheduledEmail: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        emailCreates.push(data);
        return data;
      },
    },
    outboxEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        outboxCreates.push(data);
        return data;
      },
    },
  };
  const database = {
    schedule: { findFirst: async () => null },
    scheduledEmail: { findMany: async () => [] },
    $transaction: async (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction),
  } as unknown as PrismaClient;

  const attachment = Buffer.from("attachment-content", "utf8");
  const result = await createSchedule(database, {
    tenantId: "tenant-1",
    createdById: "user-1",
    defaultFrom: "sender@example.com",
    defaultSubject: "Hello",
    defaultBodyHtml: "<p>Hello <strong>there</strong></p>",
    attachments: [
      {
        filename: "brief.txt",
        contentType: "text/plain",
        sizeBytes: attachment.byteLength,
        content: attachment,
      },
    ],
    csv: "first@example.com\nFIRST@example.com\nsecond@example.com",
  });

  assert.equal(result.emailCount, 2);
  assert.equal(scheduleCreates[0]?.bodyHtml, "<p>Hello <strong>there</strong></p>");
  assert.equal(emailCreates.length, 2);
  assert.equal(emailCreates[0]?.bodyHtml, "<p>Hello <strong>there</strong></p>");
  const attachments = emailCreates[0]?.attachments as { create: Array<Record<string, unknown>> };
  assert.equal(attachments.create[0]?.filename, "brief.txt");
  assert.deepEqual(attachments.create[0]?.content, attachment);
  assert.equal(outboxCreates.length, 4);
  assert.deepEqual(outboxCreates.map((event) => event.kind), [
    "EMAIL_SCHEDULED",
    "EMAIL_INDEX",
    "EMAIL_SCHEDULED",
    "EMAIL_INDEX",
  ]);
});
