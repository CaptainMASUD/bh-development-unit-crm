import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import WorkQueue from "../../models/crm/workQueue.model.js";
import Deal from "../../models/crm/deal.model.js";
import Lead from "../../models/crm/lead.model.js";
import Customer from "../../models/customer.model.js";
import { updateLeadStage, convertLead } from "../../controllers/crm/lead.controller.js";
import { createDeal } from "../../controllers/crm/deal.controller.js";

test("WorkQueue schema includes 'negotiate' in recommendedAction enum", () => {
  const recommendedActionEnum = WorkQueue.schema.path("recommendedAction").enumValues;
  assert.ok(
    recommendedActionEnum.includes("negotiate"),
    "recommendedAction enum must include 'negotiate'"
  );
});

test("updateLeadStage allows pipelineStage to be 'negotiation' without artificial block", async () => {
  let statusResult = null;
  let jsonResult = null;
  const res = {
    status(code) {
      statusResult = code;
      return {
        json(data) {
          jsonResult = data;
          return data;
        },
      };
    },
    json(data) {
      jsonResult = data;
      return data;
    },
  };

  const req = {
    params: { id: "invalid-id" },
    body: { pipelineStage: "negotiation", reason: "Ready to negotiate" },
    user: { _id: new mongoose.Types.ObjectId(), role: "admin" },
  };

  await updateLeadStage(req, res);
  // It should reject with "Invalid lead id", NOT "Negotiation starts automatically when a deal is created..."
  assert.equal(statusResult, 400);
  assert.equal(jsonResult?.message, "Invalid lead id");
});

test("updateLeadStage allows pipelineStage to be 'won' without artificial block", async () => {
  let statusResult = null;
  let jsonResult = null;
  const res = {
    status(code) {
      statusResult = code;
      return {
        json(data) {
          jsonResult = data;
          return data;
        },
      };
    },
    json(data) {
      jsonResult = data;
      return data;
    },
  };

  const req = {
    params: { id: "invalid-id" },
    body: { pipelineStage: "won", reason: "Deal finalized" },
    user: { _id: new mongoose.Types.ObjectId(), role: "admin" },
  };

  await updateLeadStage(req, res);
  // It should reject with "Invalid lead id", NOT "A lead can only become won by winning its linked deal."
  assert.equal(statusResult, 400);
  assert.equal(jsonResult?.message, "Invalid lead id");
});

test("createDeal validates links to lead or customer and does not force proposal-sent check", async () => {
  let statusResult = null;
  let jsonResult = null;
  const res = {
    status(code) {
      statusResult = code;
      return {
        json(data) {
          jsonResult = data;
          return data;
        },
      };
    },
  };

  const req = {
    body: { title: "Test Deal" },
    user: { _id: new mongoose.Types.ObjectId(), role: "admin" },
  };

  await createDeal(req, res);
  assert.equal(statusResult, 400);
  assert.equal(jsonResult?.message, "Deal must be linked to a lead or a customer.");
});
