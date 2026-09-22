import assert from "node:assert/strict";
import test from "node:test";
import Department from "../../models/payroll/department.model.js";
import User from "../../models/administration/user.model.js";
import { createDepartment, listDepartmentHeads, updateDepartment } from "../../controllers/administration/accessControl.controller.js";

const response = () => ({
  statusCode: 200,
  status(value) { this.statusCode = value; return this; },
  json(value) { this.body = value; return this; },
});

test("department records expose one shared code and head for ERP consumers", () => {
  assert.ok(Department.schema.path("code"), "department code is stored on the shared Department record");
  assert.equal(Department.schema.path("head")?.options.ref, "User");
});

test("Administration requires a department code before creating a record", async () => {
  const original = Department.create;
  Department.create = async () => { throw new Error("a record without code must not be created"); };
  try {
    const res = response();
    await createDepartment({ body: { name: "Finance", description: "" }, user: { _id: "actor" } }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /code/i);
  } finally {
    Department.create = original;
  }
});

test("Administration saves a normalized code, status, and optional same-company head", async () => {
  const originalCreate = Department.create;
  const originalExists = User.exists;
  const tenantId = "507f1f77bcf86cd799439011";
  const head = "507f1f77bcf86cd799439012";
  let saved;
  let headLookup;
  Department.create = async (payload) => { saved = payload; return { _id: "department", ...payload }; };
  User.exists = async (filter) => { headLookup = filter; return { _id: head }; };
  try {
    const res = response();
    await createDepartment({ tenantId, body: { name: " Human Resources ", code: " hr_01 ", description: " People ", status: "inactive", head }, user: { _id: "actor" } }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(saved.name, "Human Resources");
    assert.equal(saved.code, "HR_01");
    assert.equal(saved.description, "People");
    assert.equal(saved.isActive, false);
    assert.equal(saved.head, head);
    assert.deepEqual(headLookup, { _id: head, tenantId, isActive: true });
  } finally {
    Department.create = originalCreate;
    User.exists = originalExists;
  }
});

test("Administration rejects a head outside the active company employee list", async () => {
  const originalCreate = Department.create;
  const originalExists = User.exists;
  Department.create = async () => { throw new Error("invalid head must not be saved"); };
  User.exists = async () => null;
  try {
    const res = response();
    await createDepartment({ tenantId: "507f1f77bcf86cd799439011", body: { name: "Finance", code: "FIN", head: "507f1f77bcf86cd799439012" }, user: { _id: "actor" } }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /head/i);
  } finally {
    Department.create = originalCreate;
    User.exists = originalExists;
  }
});

test("Administration can update department code, head, and status on the shared record", async () => {
  const originalUpdate = Department.findByIdAndUpdate;
  const originalExists = User.exists;
  const head = "507f1f77bcf86cd799439012";
  let updated;
  Department.findByIdAndUpdate = async (_id, patch) => { updated = patch; return { _id, ...patch }; };
  User.exists = async () => ({ _id: head });
  try {
    const res = response();
    await updateDepartment({ tenantId: "507f1f77bcf86cd799439011", params: { id: "507f1f77bcf86cd799439013" }, body: { code: " ops-2 ", head, status: "inactive" } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(updated, { code: "OPS-2", head, isActive: false });
  } finally {
    Department.findByIdAndUpdate = originalUpdate;
    User.exists = originalExists;
  }
});

test("department-head choices include only active users from the verified company", async () => {
  const originalFind = User.find;
  const tenantId = "507f1f77bcf86cd799439011";
  let filter;
  User.find = (query) => {
    filter = query;
    return { select() { return this; }, sort() { return this; }, lean: async () => [{ _id: "head", name: "Ayesha" }] };
  };
  try {
    const res = response();
    await listDepartmentHeads({ tenantId }, res);
    assert.deepEqual(filter, { tenantId, isActive: true });
    assert.deepEqual(res.body.heads, [{ _id: "head", name: "Ayesha" }]);
  } finally { User.find = originalFind; }
});
