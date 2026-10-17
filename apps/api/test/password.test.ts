import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "../src/auth/password";

test("password hashes verify without storing the cleartext", async () => {
  const password = "correct horse battery staple";
  const encoded = await hashPassword(password);

  assert.notEqual(encoded, password);
  assert.match(encoded, /^scrypt\$/);
  assert.equal(await verifyPassword(password, encoded), true);
  assert.equal(await verifyPassword("wrong password", encoded), false);
  assert.equal(await verifyPassword(password, "not-a-password-hash"), false);
});
