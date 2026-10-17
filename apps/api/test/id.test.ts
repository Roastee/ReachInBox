import assert from "node:assert/strict";
import test from "node:test";
import { emailJobId, rateLimitNotificationJobId } from "../src/utils/id";

test("email job ids are deterministic", () => {
  assert.equal(emailJobId("email-123"), "email-email-123");
  assert.equal(emailJobId("email-123"), emailJobId("email-123"));
});

test("rate-limit notification ids are stable within a bucket", () => {
  assert.equal(
    rateLimitNotificationJobId("tenant", "email", 42),
    rateLimitNotificationJobId("tenant", "email", 42),
  );
  assert.notEqual(
    rateLimitNotificationJobId("tenant", "email", 42),
    rateLimitNotificationJobId("tenant", "email", 43),
  );
});
