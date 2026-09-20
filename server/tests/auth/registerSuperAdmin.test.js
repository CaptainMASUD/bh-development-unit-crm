import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { registerSuperAdmin } from "../../controllers/administration/auth.controller.js";
import User from "../../models/administration/user.model.js";

const createMockRes = () => {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    },
  };
  return res;
};

test("registerSuperAdmin rejects requests when SUPERADMINKEY is missing in request", async () => {
  process.env.SUPERADMINKEY = "test_superadmin_secret_key";

  const req = {
    body: {
      name: "Super Admin",
      email: "superadmin@example.com",
      password: "password123",
      // key is missing
    },
    headers: {},
  };
  const res = createMockRes();

  await registerSuperAdmin(req, res);

  assert.equal(res.statusCode, 401);
  assert.match(res.data.message, /Invalid or unauthorized Super Admin registration key/i);
});

test("registerSuperAdmin rejects requests when provided key is incorrect", async () => {
  process.env.SUPERADMINKEY = "test_superadmin_secret_key";

  const req = {
    body: {
      name: "Super Admin",
      email: "superadmin@example.com",
      password: "password123",
      key: "wrong_key_12345",
    },
    headers: {},
  };
  const res = createMockRes();

  await registerSuperAdmin(req, res);

  assert.equal(res.statusCode, 401);
  assert.match(res.data.message, /Invalid or unauthorized Super Admin registration key/i);
});

test("registerSuperAdmin rejects requests with missing or invalid fields", async () => {
  process.env.SUPERADMINKEY = "test_superadmin_secret_key";

  // Missing name
  const reqNoName = {
    body: {
      key: "test_superadmin_secret_key",
      email: "superadmin@example.com",
      password: "password123",
    },
    headers: {},
  };
  const resNoName = createMockRes();
  await registerSuperAdmin(reqNoName, resNoName);
  assert.equal(resNoName.statusCode, 400);
  assert.match(resNoName.data.message, /Full name is required/i);

  // Invalid email
  const reqBadEmail = {
    body: {
      key: "test_superadmin_secret_key",
      name: "Super Admin",
      email: "not-an-email",
      password: "password123",
    },
    headers: {},
  };
  const resBadEmail = createMockRes();
  await registerSuperAdmin(reqBadEmail, resBadEmail);
  assert.equal(resBadEmail.statusCode, 400);
  assert.match(resBadEmail.data.message, /valid email address is required/i);

  // Short password
  const reqShortPass = {
    body: {
      key: "test_superadmin_secret_key",
      name: "Super Admin",
      email: "superadmin@example.com",
      password: "123",
    },
    headers: {},
  };
  const resShortPass = createMockRes();
  await registerSuperAdmin(reqShortPass, resShortPass);
  assert.equal(resShortPass.statusCode, 400);
  assert.match(resShortPass.data.message, /at least 6 characters/i);
});

test("registerSuperAdmin accepts key from header x-superadmin-key or body aliases", async () => {
  process.env.SUPERADMINKEY = "test_secret_header_key";

  // When key is passed in header, it should pass key check
  const reqHeader = {
    body: {
      name: "Super Admin",
      // password missing to stop before DB write
    },
    headers: {
      "x-superadmin-key": "test_secret_header_key",
    },
  };
  const resHeader = createMockRes();
  await registerSuperAdmin(reqHeader, resHeader);
  // Should have passed the key check and failed on email/password validation
  assert.notEqual(resHeader.statusCode, 401);
  assert.equal(resHeader.statusCode, 400);
});
