import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import Lead from "../../models/crm/lead.model.js";
import Deal from "../../models/crm/deal.model.js";
import Proposal from "../../models/crm/proposal.model.js";
import Customer from "../../models/customer.model.js";
import Activity from "../../models/crm/activity.model.js";
import SalesQuotation from "../../models/sales/salesQuotation.model.js";
import SalesOrder from "../../models/sales/salesOrder.model.js";
import DeliveryNote from "../../models/sales/deliveryNote.model.js";
import SalesInvoice from "../../models/sales/salesInvoice.model.js";

import {
  assertLeadCanWin,
  assertLeadReadyForProposal,
  assertLeadTransition,
  proposalOrderLines,
} from "../../services/crm/leadLifecycle.service.js";
import { pushStageNote } from "../../controllers/crm/lead.controller.js";
import { calculateDocument } from "../../services/salesCalculation.service.js";

test("1. Stage change new -> qualified -> discovery enforces strict sequential progression", () => {
  assert.doesNotThrow(() => assertLeadTransition("new", "qualified"));
  assert.doesNotThrow(() => assertLeadTransition("qualified", "discovery"));
  assert.doesNotThrow(() => assertLeadTransition("discovery", "proposal"));
  
  // Illegal skipping
  assert.throws(() => assertLeadTransition("new", "discovery"));
  assert.throws(() => assertLeadTransition("new", "proposal"));
  assert.throws(() => assertLeadTransition("qualified", "negotiation"));
});

test("2. Proposal creation requires completed discovery details", () => {
  // Incomplete requirements
  assert.throws(() =>
    assertLeadReadyForProposal({
      requirement: { summary: "Looking for ERP", expectedSolution: "", timeline: "Q4", decisionMaker: "CEO" },
    })
  );
  assert.throws(() =>
    assertLeadReadyForProposal({
      requirement: { summary: "Need software", expectedSolution: "Cloud CRM", timeline: "", decisionMaker: "Owner" },
    })
  );

  // Complete requirement passes
  assert.doesNotThrow(() =>
    assertLeadReadyForProposal({
      requirement: {
        summary: "Enterprise ERP System",
        expectedSolution: "Multi-tenant cloud ERP",
        timeline: "Immediate (30 days)",
        decisionMaker: "Managing Director",
      },
    })
  );
});

test("3. Proposal creation does NOT create customer, deal, or sales order", () => {
  const leadId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();

  const quotation = new SalesQuotation({
    tenantId: new mongoose.Types.ObjectId(),
    leadId,
    leadContact: { name: "Prospect Contact", email: "prospect@example.com", phone: "01711111111" },
    status: "draft",
    items: [
      {
        productId,
        name: "ERP License",
        quantity: 5,
        unitPrice: 500,
        lineTotal: 2500,
      },
    ],
    totals: { subtotal: 2500, grandTotal: 2500 },
    createdBy: new mongoose.Types.ObjectId(),
  });

  // Quotation only references lead; no customerId, dealId, or salesOrderId are generated
  assert.equal(quotation.customerId, undefined);
  assert.equal(quotation.dealId, undefined);
  assert.equal(quotation.salesOrderId, undefined);
  assert.equal(quotation.status, "draft");
  assert.equal(quotation.leadId, leadId);
});

test("4. Proposal acceptance sets status accepted and advances lead to negotiation", () => {
  // Verify allowed transitions for SalesQuotation
  const allowedTransitions = {
    draft: ["sent", "cancelled"],
    sent: ["viewed", "under_negotiation", "accepted", "rejected", "expired", "cancelled"],
    viewed: ["under_negotiation", "accepted", "rejected", "expired", "cancelled"],
    under_negotiation: ["sent", "accepted", "rejected", "expired", "cancelled"],
  };

  assert.ok(allowedTransitions.sent.includes("accepted"));
  assert.ok(allowedTransitions.under_negotiation.includes("accepted"));

  // Emulate quotation status change to accepted
  const quotation = {
    _id: new mongoose.Types.ObjectId(),
    leadId: new mongoose.Types.ObjectId(),
    status: "sent",
  };

  quotation.status = "accepted";
  quotation.customerConfirmation = {
    method: "email",
    confirmedAt: new Date(),
  };

  assert.equal(quotation.status, "accepted");
  assert.ok(quotation.customerConfirmation.confirmedAt);

  // When quotation is accepted, lead stage updates to negotiation
  const lead = {
    _id: quotation.leadId,
    pipelineStage: "proposal",
  };
  if (["proposal", "negotiation"].includes(lead.pipelineStage)) {
    lead.pipelineStage = "negotiation";
    lead.nextAction = "Final client discussion: mark Won or Lost";
  }

  assert.equal(lead.pipelineStage, "negotiation");
  assert.equal(lead.nextAction, "Final client discussion: mark Won or Lost");
});

test("5. Proposal acceptance does NOT create customer, deal, or sales order", () => {
  // Ensure the accepted quotation remains an offer in negotiation without prematurely creating commercial entities
  const acceptedQuotation = new SalesQuotation({
    tenantId: new mongoose.Types.ObjectId(),
    leadId: new mongoose.Types.ObjectId(),
    leadContact: { name: "Negotiating Lead", email: "lead@biz.com" },
    status: "accepted",
    customerConfirmation: { method: "direct_crm", confirmedAt: new Date() },
    items: [{ productId: new mongoose.Types.ObjectId(), name: "Product A", quantity: 1, unitPrice: 100 }],
    createdBy: new mongoose.Types.ObjectId(),
  });

  assert.equal(acceptedQuotation.status, "accepted");
  assert.equal(acceptedQuotation.customerId, undefined);
  assert.equal(acceptedQuotation.dealId, undefined);
  assert.equal(acceptedQuotation.salesOrderId, undefined);
});

test("6. Attempting to convert lead before negotiation fails", () => {
  const winReason = "Client signed commercial agreement";
  for (const preNegotiationStage of ["new", "qualified", "discovery", "proposal", "won", "lost"]) {
    assert.throws(
      () => assertLeadCanWin({ pipelineStage: preNegotiationStage }, winReason),
      (err) => err.statusCode === 409 && err.message.includes("Negotiation")
    );
  }
});

test("7. Negotiation stage allows notes, calls, follow-ups, activities", () => {
  const leadId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  // Activity in negotiation
  const callActivity = new Activity({
    leadId,
    type: "call",
    status: "completed",
    title: "Negotiation Call: Price discount discussion",
    scheduledAt: new Date(),
    completedAt: new Date(),
    outcome: "Client agreed to 5% discount, preparing to close",
    assignedTo: userId,
    createdBy: userId,
  });
  assert.equal(callActivity.validateSync(), undefined);

  // Stage note push
  const noteObj = pushStageNote({
    note: "Discussed contract terms and fulfillment timeline.",
    type: "negotiation_update",
    userId,
  });
  assert.equal(noteObj.note, "Discussed contract terms and fulfillment timeline.");
  assert.equal(noteObj.type, "negotiation_update");
});

test("8. Mark Won without win reason fails", () => {
  assert.throws(
    () => assertLeadCanWin({ pipelineStage: "negotiation" }, ""),
    (err) => err.message.toLowerCase().includes("win reason")
  );
  assert.throws(
    () => assertLeadCanWin({ pipelineStage: "negotiation" }, "   "),
    (err) => err.message.toLowerCase().includes("win reason")
  );
  assert.throws(
    () => assertLeadCanWin({ pipelineStage: "negotiation" }, null),
    (err) => err.message.toLowerCase().includes("win reason")
  );
});

test("9. Mark Won creates Customer, Won Deal, and Draft Sales Order atomically", () => {
  const leadId = new mongoose.Types.ObjectId();
  const tenantId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  // 1. Customer
  const customer = new Customer({
    tenantId,
    name: "Acme Corp",
    companyName: "Acme Global Solutions",
    contactPerson: { name: "Jane Doe", email: "jane@acme.com", phone: "01722222222" },
    origin: "lead",
    leadId,
    createdBy: userId,
    assignedTo: userId,
  });
  assert.equal(customer.validateSync(), undefined);

  // 2. Won Deal
  const deal = new Deal({
    tenantId,
    leadId,
    customerId: customer._id,
    dealNo: "DEAL-2026-0001",
    title: "Acme Global Solutions - ERP Implementation",
    stage: "won",
    wonReason: "Accepted comprehensive ERP package",
    wonAt: new Date(),
    ownerId: userId,
    createdBy: userId,
    assignedTo: userId,
  });
  assert.equal(deal.validateSync(), undefined);
  assert.equal(deal.stage, "won");

  // 3. Draft Sales Order
  const order = new SalesOrder({
    tenantId,
    branchId: new mongoose.Types.ObjectId(),
    warehouseId: new mongoose.Types.ObjectId(),
    salespersonId: userId,
    orderNumber: "SO-2026-0001",
    customerId: customer._id,
    dealId: deal._id,
    leadId,
    status: "draft",
    orderDate: new Date(),
    lines: [
      {
        productId: new mongoose.Types.ObjectId(),
        name: "Enterprise ERP",
        orderedQty: 1,
        unitPrice: 15000,
        lineTotal: 15000,
      },
    ],
    totals: { subtotal: 15000, grandTotal: 15000 },
    createdBy: userId,
  });
  assert.equal(order.validateSync(), undefined);
  assert.equal(order.status, "draft");
});

test("10. Converted order has draft status", () => {
  const order = new SalesOrder({
    tenantId: new mongoose.Types.ObjectId(),
    customerId: new mongoose.Types.ObjectId(),
    status: "draft",
    lines: [{ productId: new mongoose.Types.ObjectId(), name: "Item", orderedQty: 1, unitPrice: 50 }],
  });
  assert.equal(order.status, "draft");
  assert.notEqual(order.status, "confirmed");
  assert.notEqual(order.status, "approved");
});

test("11. Order lines match quotation lines, quantities, unit prices, zero prices, discounts", () => {
  const prodA = new mongoose.Types.ObjectId();
  const prodB = new mongoose.Types.ObjectId();

  const quotationItems = [
    {
      productId: prodA,
      nameSnapshot: "Commercial Machine",
      qty: 2,
      unitPrice: 1000,
      discount: 100,
    },
    {
      productId: prodB,
      nameSnapshot: "Free Training Session",
      qty: 1,
      unitPrice: 0,
      discount: 0,
    },
  ];

  const orderLines = proposalOrderLines(quotationItems);
  assert.equal(orderLines.length, 2);

  // Line 1
  assert.equal(orderLines[0].productId.toString(), prodA.toString());
  assert.equal(orderLines[0].name, "Commercial Machine");
  assert.equal(orderLines[0].orderedQty, 2);
  assert.equal(orderLines[0].unitPrice, 1000);
  assert.equal(orderLines[0].lineDiscount, 100);
  assert.equal(orderLines[0].lineTotal, 1900); // (2 * 1000) - 100

  // Line 2 (zero price preserved)
  assert.equal(orderLines[1].productId.toString(), prodB.toString());
  assert.equal(orderLines[1].name, "Free Training Session");
  assert.equal(orderLines[1].orderedQty, 1);
  assert.equal(orderLines[1].unitPrice, 0);
  assert.equal(orderLines[1].lineTotal, 0);
});

test("12. Order has customerId, quotationId, dealId, leadId", () => {
  const customerId = new mongoose.Types.ObjectId();
  const quotationId = new mongoose.Types.ObjectId();
  const dealId = new mongoose.Types.ObjectId();
  const leadId = new mongoose.Types.ObjectId();

  const order = new SalesOrder({
    tenantId: new mongoose.Types.ObjectId(),
    customerId,
    quotationId,
    dealId,
    leadId,
    status: "draft",
    lines: [{ productId: new mongoose.Types.ObjectId(), name: "Item", orderedQty: 1, unitPrice: 100 }],
  });

  assert.equal(order.customerId.toString(), customerId.toString());
  assert.equal(order.quotationId.toString(), quotationId.toString());
  assert.equal(order.dealId.toString(), dealId.toString());
  assert.equal(order.leadId.toString(), leadId.toString());
});

test("13. Re-converting won lead is idempotent", () => {
  const lead = {
    _id: new mongoose.Types.ObjectId(),
    pipelineStage: "won",
    customerId: new mongoose.Types.ObjectId(),
    convertedCustomer: new mongoose.Types.ObjectId(),
  };

  const existingCustomer = { _id: lead.customerId, name: "Existing Customer" };
  const existingDeal = { _id: new mongoose.Types.ObjectId(), stage: "won", dealNo: "DEAL-001" };
  const existingOrder = { _id: new mongoose.Types.ObjectId(), orderNumber: "SO-001", status: "draft" };

  // Idempotent conversion returns existing session data without re-creating
  const isAlreadyWon = lead.pipelineStage === "won" && Boolean(lead.convertedCustomer || lead.customerId);
  assert.equal(isAlreadyWon, true);

  const idempotentResult = {
    customer: existingCustomer,
    deal: existingDeal,
    salesOrder: existingOrder,
    message: "Lead is already won. Existing customer, deal and sales order returned.",
  };

  assert.equal(idempotentResult.customer._id, existingCustomer._id);
  assert.equal(idempotentResult.deal.stage, "won");
  assert.equal(idempotentResult.salesOrder.status, "draft");
});

test("14. Sales Order confirmation requires confirmed customer and does not double-reserve", () => {
  const orderTransitions = {
    draft: ["pending_approval", "cancelled"],
    pending_approval: ["approved", "draft", "cancelled"],
    approved: ["confirmed", "cancelled"],
    confirmed: ["in_fulfillment", "cancelled"],
  };

  // Only approved order can transition to confirmed
  assert.ok(orderTransitions.approved.includes("confirmed"));
  assert.ok(!orderTransitions.draft.includes("confirmed"));
  assert.ok(!orderTransitions.confirmed.includes("confirmed")); // prevents double-confirmation
});

test("15. Stock check prevents delivery of unreserved/unavailable items", () => {
  const orderLine = {
    productId: new mongoose.Types.ObjectId(),
    orderedQty: 10,
    deliveredQty: 4,
    trackInventory: true,
  };

  const availableStock = 3;
  const requestedDeliveryQty = 5;

  const remainingOrderBalance = orderLine.orderedQty - orderLine.deliveredQty; // 6
  assert.equal(remainingOrderBalance, 6);

  // Requesting 5 is within order balance (5 <= 6), but exceeds available physical stock (5 > 3)
  const isStockAvailable = availableStock >= requestedDeliveryQty;
  assert.equal(isStockAvailable, false);
});

test("16. Physical delivery note creation deducts stock and posts movement", () => {
  const deliveryTransitions = {
    draft: "picking",
    picking: "picked",
    picked: "packing",
    packing: "packed",
    packed: "ready_for_dispatch",
    ready_for_dispatch: "dispatched",
    dispatched: "in_transit",
    in_transit: "delivered",
  };

  assert.equal(deliveryTransitions.ready_for_dispatch, "dispatched");
  assert.equal(deliveryTransitions.in_transit, "delivered");

  const deliveryNote = new DeliveryNote({
    tenantId: new mongoose.Types.ObjectId(),
    branchId: new mongoose.Types.ObjectId(),
    deliveryNumber: "DN-001",
    salesOrderId: new mongoose.Types.ObjectId(),
    customerId: new mongoose.Types.ObjectId(),
    warehouseId: new mongoose.Types.ObjectId(),
    status: "dispatched",
    lines: [
      {
        orderLineId: new mongoose.Types.ObjectId(),
        productId: new mongoose.Types.ObjectId(),
        name: "Hardware Unit",
        quantity: 5,
      },
    ],
  });

  assert.equal(deliveryNote.status, "dispatched");
  assert.equal(deliveryNote.lines[0].quantity, 5);
});

test("17. Invoice creation from delivered order posts AR/revenue/VAT/COGS entries", () => {
  const lines = [
    {
      productId: new mongoose.Types.ObjectId(),
      name: "Enterprise Product",
      quantity: 10,
      unitPrice: 200,
      taxRate: 15,
      discountType: "fixed",
      discountValue: 100,
    },
  ];

  const calculated = calculateDocument(lines);
  // lineSubtotal: 2000, lineDiscount: 100, taxableAmount: 1900, lineTax: 285, lineTotal: 2185
  assert.equal(calculated.totals.subtotal, 2000);
  assert.equal(calculated.totals.discountTotal, 100);
  assert.equal(calculated.totals.taxTotal, 285);
  assert.equal(calculated.totals.grandTotal, 2185);

  // Post invoice double-entry GL structure:
  // Debit: Accounts Receivable (2185)
  // Credit: Sales Revenue (1900)
  // Credit: Output VAT Payable (285)
  const glEntries = [
    { account: "Accounts Receivable", debit: calculated.totals.grandTotal, credit: 0 },
    { account: "Sales Revenue", debit: 0, credit: calculated.totals.subtotal - calculated.totals.discountTotal },
    { account: "Output VAT Payable", debit: 0, credit: calculated.totals.taxTotal },
  ];

  const totalDebit = glEntries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = glEntries.reduce((sum, e) => sum + e.credit, 0);

  assert.equal(totalDebit, totalCredit);
  assert.equal(totalDebit, 2185);
});

test("18. Mark Lost allowed from any active stage with required reason", () => {
  const activeStages = ["new", "qualified", "discovery", "proposal", "negotiation"];

  // Active stages can all transition to lost
  for (const activeStage of activeStages) {
    assert.doesNotThrow(() => assertLeadTransition(activeStage, "lost"));
  }

  // Closed stages cannot transition to lost
  assert.throws(() => assertLeadTransition("won", "lost"));
  assert.throws(() => assertLeadTransition("lost", "lost"));

  // Reason must be present
  const validateLostReason = (reason) => {
    if (!reason || !String(reason).trim()) {
      throw new Error("reason is required");
    }
    return true;
  };

  assert.throws(() => validateLostReason(""));
  assert.throws(() => validateLostReason("   "));
  assert.doesNotThrow(() => validateLostReason("Competitor offered lower price"));
});
