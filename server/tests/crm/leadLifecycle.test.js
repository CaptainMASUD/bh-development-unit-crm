import test from "node:test";
import assert from "node:assert/strict";
import { assertLeadCanWin, assertLeadReadyForProposal, assertLeadTransition, proposalOrderLines } from "../../services/crm/leadLifecycle.service.js";
import Customer from "../../models/customer.model.js";
import Lead from "../../models/lead.model.js";
import mongoose from "mongoose";

test("only negotiation can convert, and a win reason is required", () => {
  for (const pipelineStage of ["new", "qualified", "discovery", "proposal", "won", "lost"]) {
    assert.throws(() => assertLeadCanWin({ pipelineStage }, "Agreed"));
  }
  assert.throws(() => assertLeadCanWin({ pipelineStage: "negotiation" }, " "));
  assert.doesNotThrow(() => assertLeadCanWin({ pipelineStage: "negotiation" }, "Agreed"));
});

test("stage changes cannot skip discovery, accept a proposal, or reopen a won lead", () => {
  assert.doesNotThrow(() => assertLeadTransition("new", "qualified"));
  assert.doesNotThrow(() => assertLeadTransition("qualified", "discovery"));
  assert.doesNotThrow(() => assertLeadTransition("discovery", "proposal"));
  assert.throws(() => assertLeadTransition("new", "proposal"));
  assert.throws(() => assertLeadTransition("proposal", "negotiation"));
  for (const activeStage of ["new", "qualified", "discovery", "proposal", "negotiation"]) {
    assert.doesNotThrow(() => assertLeadTransition(activeStage, "lost"));
  }
  assert.throws(() => assertLeadTransition("won", "lost"));
  assert.throws(() => assertLeadTransition("lost", "lost"));
});

test("proposal creation requires completed discovery details", () => {
  assert.throws(() => assertLeadReadyForProposal({ requirement: { summary: "Need", expectedSolution: "", timeline: "Q4", decisionMaker: "Buyer" } }));
  assert.doesNotThrow(() => assertLeadReadyForProposal({ requirement: { summary: "Need", expectedSolution: "Solution", timeline: "Q4", decisionMaker: "Buyer" } }));
});

test("won leads can advertise the next sales-order action", () => {
  assert.ok(Lead.schema.path("nextActionType").enumValues.includes("sales_order"));
});

test("order lines preserve agreed zero prices and discounts", () => {
  const lines = proposalOrderLines([{ productId: "product", nameSnapshot: "Sample", qty: 2, unitPrice: 10, discount: 3 }]);
  assert.equal(lines[0].lineTotal, 17);
  assert.equal(lines[0].orderedQty, 2);
  assert.equal(proposalOrderLines([{ productId: "product", nameSnapshot: "Free", qty: 1, unitPrice: 0 }])[0].unitPrice, 0);
  for (const items of [[], [{ qty: 1 }], [{ productId: "p", qty: 0 }], [{ productId: "p", qty: 1, unitPrice: 2, discount: 3 }]]) {
    assert.throws(() => proposalOrderLines(items));
  }
});

test("lead conversion customer payload includes the required primary contact", () => {
  const id = new mongoose.Types.ObjectId();
  const customer = new Customer({
    name: "A Lead",
    companyName: "A Company",
    contactPerson: { name: "A Lead", email: "lead@example.com", phone: "01700000000" },
    origin: "lead",
    createdBy: id,
    assignedTo: id,
    leadId: id,
  });
  assert.equal(customer.validateSync(), undefined);
});
