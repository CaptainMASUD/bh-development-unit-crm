import assert from "node:assert/strict";
import test from "node:test";

import AuditLog from "../../models/administration/auditLog.model.js";
import { writeAudit } from "../../utils/audit.js";
import { redactAuditValue } from "../../utils/auditRedaction.js";

test("audit redaction removes nested credentials and preserves safe business values", () => {
  const circular = { label: "loop" };
  circular.self = circular;

  assert.deepEqual(
    redactAuditValue({
      name: "Acme",
      password: "plain text",
      nested: {
        accessToken: "jwt",
        phone: "+8801000000000",
        headers: { authorization: "Bearer secret" },
      },
      cookies: ["session=secret"],
      circular,
    }),
    {
      name: "Acme",
      password: "[REDACTED]",
      nested: {
        accessToken: "[REDACTED]",
        phone: "+8801000000000",
        headers: { authorization: "[REDACTED]" },
      },
      cookies: "[REDACTED]",
      circular: { label: "loop", self: "[CIRCULAR]" },
    }
  );
});

test("writeAudit redacts snapshots before persistence", async (t) => {
  const originalCreate = AuditLog.create;
  let savedPayload = null;
  AuditLog.create = async (payload) => {
    savedPayload = payload;
    return payload;
  };
  t.after(() => {
    AuditLog.create = originalCreate;
  });

  await writeAudit({
    actorId: "507f1f77bcf86cd799439011",
    action: "update",
    entityType: "Company",
    entityId: "507f1f77bcf86cd799439012",
    before: { apiSecret: "before", name: "Old" },
    after: { resetToken: "after", name: "New" },
    meta: { extra: { otp: "123456", reason: "profile update" } },
  });

  assert.deepEqual(savedPayload.before, { apiSecret: "[REDACTED]", name: "Old" });
  assert.deepEqual(savedPayload.after, { resetToken: "[REDACTED]", name: "New" });
  assert.deepEqual(savedPayload.meta.extra, { otp: "[REDACTED]", reason: "profile update" });
});

test("strict audit mode rejects persistence failures while default mode remains best effort", async (t) => {
  const originalCreate = AuditLog.create;
  const originalConsoleError = console.error;
  const failure = new Error("audit database unavailable");
  AuditLog.create = async () => {
    throw failure;
  };
  console.error = () => {};
  t.after(() => {
    AuditLog.create = originalCreate;
    console.error = originalConsoleError;
  });

  const payload = {
    actorId: "507f1f77bcf86cd799439011",
    action: "update",
    entityType: "SystemSettings",
    entityId: "507f1f77bcf86cd799439012",
  };

  assert.equal(await writeAudit(payload), null);
  await assert.rejects(() => writeAudit(payload, { strict: true }), /audit database unavailable/);
});
