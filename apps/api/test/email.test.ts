import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { getEmail } from "../src/services/email-service";

test("email detail lookup keeps the authenticated tenant in its predicate", async () => {
  let requestedTenant: string | undefined;
  const database = {
    scheduledEmail: {
      findFirst: async ({ where }: { where: { tenantId: string } }) => {
        requestedTenant = where.tenantId;
        return null;
      },
    },
  } as unknown as PrismaClient;

  assert.equal(await getEmail(database, "tenant-b", "email-a"), null);
  assert.equal(requestedTenant, "tenant-b");
});
