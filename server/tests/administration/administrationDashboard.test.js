import assert from "node:assert/strict";
import test from "node:test";

import { buildAdministrationDashboard } from "../../services/administration/administrationDashboard.service.js";

test("dashboard derives stable administrative tasks from unresolved configuration", () => {
  const result = buildAdministrationDashboard({
    company: {
      _id: "507f1f77bcf86cd799439011",
      name: "Acme",
      email: "",
      phone: "",
      logo: null,
      address: { line1: "1 Main Road", city: "Dhaka", country: "Bangladesh" },
      settings: { currency: "BDT", timezone: "Asia/Dhaka", fiscalYearStart: "01-01" },
      status: "active",
    },
    settings: {
      tablePageSize: 20,
      auditStorageLimit: 100000,
      auditRetentionMode: "warn_only",
    },
    auditCount: 100001,
    activeEmployeeCount: 8,
    inactiveEmployeeCount: 1,
    lockedAccountCount: 2,
  });

  assert.deepEqual(result.tasks.map((item) => item.key), [
    "company-contact-incomplete",
    "company-logo-missing",
    "audit-storage-limit",
    "locked-accounts",
  ]);
  assert.ok(result.tasks.every((item) => item.navigationTarget.startsWith("/admin/administration/")));
  assert.deepEqual(result.summary, {
    companyStatus: "active",
    activeEmployees: 8,
    inactiveEmployees: 1,
    lockedAccounts: 2,
    auditRecords: 100001,
  });
  assert.ok(result.completeness.percent > 0 && result.completeness.percent < 100);
});

test("dashboard returns a complete, task-free state when no action is required", () => {
  const result = buildAdministrationDashboard({
    company: {
      name: "Acme",
      email: "admin@acme.test",
      phone: "+8801000000000",
      logo: { url: "https://cdn.test/logo.png" },
      address: { line1: "1 Main Road", city: "Dhaka", country: "Bangladesh" },
      settings: { currency: "BDT", timezone: "Asia/Dhaka", fiscalYearStart: "01-01" },
      status: "active",
    },
    settings: { auditStorageLimit: 100000, auditRetentionMode: "warn_only" },
    auditCount: 100,
    activeEmployeeCount: 8,
    inactiveEmployeeCount: 0,
    lockedAccountCount: 0,
  });

  assert.deepEqual(result.tasks, []);
  assert.equal(result.completeness.percent, 100);
  assert.deepEqual(result.completeness.missing, []);
});
