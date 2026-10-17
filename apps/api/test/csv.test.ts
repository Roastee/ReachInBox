import assert from "node:assert/strict";
import test from "node:test";
import { CsvInputError, parseScheduleCsv } from "../src/utils/csv";

test("parses quoted CSV fields and optional schedule columns", () => {
  const rows = parseScheduleCsv(
    'To,Subject,Body,From,Scheduled At\r\n"person@example.com","Hello","Line 1, with comma\nLine 2",sender@example.com,2030-01-02T03:04:05.000Z',
  );
  assert.deepEqual(rows, [
    {
      to: "person@example.com",
      subject: "Hello",
      body: "Line 1, with comma\nLine 2",
      from: "sender@example.com",
      scheduledAt: "2030-01-02T03:04:05.000Z",
    },
  ]);
});

test("rejects an upload without required headers", () => {
  assert.throws(
    () => parseScheduleCsv("to,subject\nperson@example.com,Hello"),
    (error: unknown) => error instanceof CsvInputError && /body columns/.test(error.message),
  );
});

test("accepts a plain text recipient list with form defaults", () => {
  assert.deepEqual(
    parseScheduleCsv("first@example.com\nsecond@example.com", {
      subject: "A thoughtful note",
      body: "Hello from ReachInbox",
      from: "sender@example.com",
      scheduledAt: "2030-01-02T03:04:05.000Z",
    }),
    [
      {
        to: "first@example.com",
        subject: "A thoughtful note",
        body: "Hello from ReachInbox",
        from: "sender@example.com",
        scheduledAt: "2030-01-02T03:04:05.000Z",
      },
      {
        to: "second@example.com",
        subject: "A thoughtful note",
        body: "Hello from ReachInbox",
        from: "sender@example.com",
        scheduledAt: "2030-01-02T03:04:05.000Z",
      },
    ],
  );
});

test("derives searchable text while preserving rich HTML bodies", () => {
  assert.deepEqual(
    parseScheduleCsv("to,subject,bodyHtml\nrecipient@example.com,Welcome,\"<p>Hello <strong>there</strong></p><p>Next step</p>\""),
    [
      {
        to: "recipient@example.com",
        subject: "Welcome",
        body: "Hello there\nNext step",
        bodyHtml: "<p>Hello <strong>there</strong></p><p>Next step</p>",
      },
    ],
  );
});
