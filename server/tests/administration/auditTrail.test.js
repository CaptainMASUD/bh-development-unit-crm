import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import AuditLog from "../../models/administration/auditLog.model.js";
import {
  getAuditTrailDetail,
  getAuditTrailFilterOptions,
  getAuditTrailStats,
  listAuditTrail,
} from "../../services/administration/auditTrail.service.js";
import { computeFieldDiff } from "../../config/auditRegistry.js";

test("computeFieldDiff identifies modified paths and ignores unchanged fields", () => {
  const before = {
    name: "John",
    role: "staff",
    department: "Sales",
    salary: 50000,
  };

  const after = {
    name: "John Doe",
    role: "staff",
    department: "Marketing",
    salary: 55000,
  };

  const { changes } = computeFieldDiff(before, after);

  assert.equal(changes.length, 3);
  const paths = changes.map((d) => d.path).sort();
  assert.deepEqual(paths, ["department", "name", "salary"]);

  const nameDiff = changes.find((d) => d.path === "name");
  assert.equal(nameDiff.before, "John");
  assert.equal(nameDiff.after, "John Doe");
});

test("computeFieldDiff redacts sensitive fields automatically", () => {
  const before = {
    password: "oldHashPassword123",
    email: "john@example.com",
  };

  const after = {
    password: "newHashPassword456",
    email: "john@example.com",
  };

  const { changes } = computeFieldDiff(before, after);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].path, "password");
  assert.equal(changes[0].before, "[REDACTED]");
  assert.equal(changes[0].after, "[REDACTED]");
});

test("listAuditTrail applies tenant filtering, pagination, and sorting", async (t) => {
  const tenantId = new mongoose.Types.ObjectId();
  const otherTenantId = new mongoose.Types.ObjectId();

  const originalFind = AuditLog.find;
  const originalCount = AuditLog.countDocuments;
  const originalDistinct = AuditLog.distinct;

  const sampleLogs = [
    {
      _id: new mongoose.Types.ObjectId(),
      tenantId,
      action: "update",
      module: "accounting",
      entityType: "Invoice",
      recordIdentifier: "INV-2026-0001",
      actorName: "Alice Accountant",
      createdAt: new Date("2026-09-22T10:00:00Z"),
      changes: [{ path: "status", before: "draft", after: "posted" }],
    },
    {
      _id: new mongoose.Types.ObjectId(),
      tenantId,
      action: "create",
      module: "crm",
      entityType: "Customer",
      recordIdentifier: "Acme Corp",
      actorName: "Bob Builder",
      createdAt: new Date("2026-09-22T11:00:00Z"),
      changes: [],
    },
  ];

  let findQueryCaptured = null;
  AuditLog.countDocuments = async () => sampleLogs.length;

  AuditLog.find = (q) => {
    findQueryCaptured = q;
    return {
      sort() {
        return {
          skip() {
            return {
              limit() {
                return {
                  async lean() {
                    return sampleLogs;
                  },
                };
              },
            };
          },
        };
      },
    };
  };

  AuditLog.distinct = async (field) => {
    if (field === "module") return ["accounting", "crm"];
    if (field === "actorName") return ["Alice Accountant", "Bob Builder"];
    return [];
  };

  t.after(() => {
    AuditLog.find = originalFind;
    AuditLog.countDocuments = originalCount;
    AuditLog.distinct = originalDistinct;
  });

  const result = await listAuditTrail({
    tenantId,
    page: 1,
    limit: 10,
    module: "accounting",
    search: "INV",
  });

  assert.equal(result.items.length, 2);
  assert.equal(result.pagination.total, 2);
  assert.equal(result.pagination.page, 1);
  assert.equal(result.pagination.limit, 10);
  assert.equal(result.stats.totalEvents, 2);
  assert.equal(result.stats.moduleCount, 2);
  assert.equal(result.stats.actorCount, 2);

  assert.equal(findQueryCaptured.tenantId, tenantId);
  assert.equal(findQueryCaptured.module, "accounting");
  assert.ok(findQueryCaptured.$or);
});

test("getAuditTrailDetail retrieves log entry by id and validates tenant ownership", async (t) => {
  const tenantId = new mongoose.Types.ObjectId();
  const logId = new mongoose.Types.ObjectId();

  const originalFindOne = AuditLog.findOne;

  AuditLog.findOne = (q) => {
    return {
      async lean() {
        if (String(q.tenantId) === String(tenantId) && String(q._id) === String(logId)) {
          return {
            _id: logId,
            tenantId,
            action: "delete",
            module: "inventory",
            entityType: "Product",
            recordIdentifier: "Widget X",
          };
        }
        return null;
      },
    };
  };

  t.after(() => {
    AuditLog.findOne = originalFindOne;
  });

  const log = await getAuditTrailDetail({ tenantId, id: logId });
  assert.equal(log.entityType, "Product");
  assert.equal(log.action, "delete");

  // Foreign tenant ID must throw 404
  const foreignTenantId = new mongoose.Types.ObjectId();
  await assert.rejects(
    async () => getAuditTrailDetail({ tenantId: foreignTenantId, id: logId }),
    /not found/i
  );
});

test("getAuditTrailFilterOptions aggregates distinct modules, actions, and actors", async (t) => {
  const tenantId = new mongoose.Types.ObjectId();
  const originalDistinct = AuditLog.distinct;
  const originalAggregate = AuditLog.aggregate;

  AuditLog.distinct = async (field) => {
    if (field === "module") return ["crm", "inventory", "sales"];
    if (field === "action") return ["create", "update", "delete"];
    if (field === "entityType") return ["Customer", "Deal", "Product"];
    return [];
  };

  AuditLog.aggregate = async () => [
    {
      _id: new mongoose.Types.ObjectId(),
      name: "Admin User",
      email: "admin@example.com",
      role: "admin",
    },
  ];

  t.after(() => {
    AuditLog.distinct = originalDistinct;
    AuditLog.aggregate = originalAggregate;
  });

  const options = await getAuditTrailFilterOptions({ tenantId });
  assert.deepEqual(options.modules, ["crm", "inventory", "sales"]);
  assert.deepEqual(options.actions, ["create", "delete", "update"]);
  assert.deepEqual(options.entityTypes, ["Customer", "Deal", "Product"]);
  assert.equal(options.actors.length, 1);
  assert.equal(options.actors[0].name, "Admin User");
});
