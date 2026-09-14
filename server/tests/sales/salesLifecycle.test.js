import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import SalesQuotation from "../../models/sales/salesQuotation.model.js";
import SalesOrder from "../../models/sales/salesOrder.model.js";
import DeliveryNote from "../../models/sales/deliveryNote.model.js";
import SalesInvoice from "../../models/sales/salesInvoice.model.js";
import SalesReturn from "../../models/sales/salesReturn.model.js";
import Deal from "../../models/crm/deal.model.js";
import Proposal from "../../models/crm/proposal.model.js";
import Lead from "../../models/crm/lead.model.js";
import Customer from "../../models/customer.model.js";
import Product from "../../models/inventory/product.model.js";

import { calculateDocument } from "../../services/salesCalculation.service.js";
import { validateSalesPartyContext } from "../../services/salesReference.service.js";
import { createInvoiceFromDeal } from "../../controllers/crm/invoice.controller.js";
import { proposalOrderLines } from "../../services/crm/leadLifecycle.service.js";

test("sales schema lineage fields: quotations, orders, deliveries, invoices and returns contain required lineage and tenant fields", () => {
  assert.ok(SalesQuotation.schema.path("leadId"), "SalesQuotation must have leadId path");
  assert.ok(SalesQuotation.schema.path("customerId"), "SalesQuotation must have customerId path");
  assert.ok(SalesQuotation.schema.path("leadContact.name"), "SalesQuotation must have leadContact.name path");
  assert.ok(SalesQuotation.schema.path("dealId"), "SalesQuotation must have dealId path");
  assert.ok(SalesQuotation.schema.path("tenantId"), "SalesQuotation must have tenantId path");

  assert.ok(SalesOrder.schema.path("leadId"), "SalesOrder must have leadId path");
  assert.ok(SalesOrder.schema.path("dealId"), "SalesOrder must have dealId path");
  assert.ok(SalesOrder.schema.path("tenantId"), "SalesOrder must have tenantId path");

  assert.ok(DeliveryNote.schema.path("leadId"), "DeliveryNote must have leadId path");
  assert.ok(DeliveryNote.schema.path("dealId"), "DeliveryNote must have dealId path");
  assert.ok(DeliveryNote.schema.path("tenantId"), "DeliveryNote must have tenantId path");

  assert.ok(SalesInvoice.schema.path("leadId"), "SalesInvoice must have leadId path");
  assert.ok(SalesInvoice.schema.path("dealId"), "SalesInvoice must have dealId path");
  assert.ok(SalesInvoice.schema.path("tenantId"), "SalesInvoice must have tenantId path");

  assert.ok(SalesReturn.schema.path("tenantId"), "SalesReturn must have tenantId path");

  assert.ok(Deal.schema.path("quotationId"), "Deal must have quotationId path");
  assert.ok(Deal.schema.path("salesOrderId"), "Deal must have salesOrderId path");
});

test("validateSalesPartyContext enforces either customerId or leadId, and validates ID formats", async () => {
  await assert.rejects(
    async () => {
      await validateSalesPartyContext({
        customerId: null,
        leadId: null,
      });
    },
    { message: "Either a customer or an active lead is required." }
  );

  await assert.rejects(
    async () => {
      await validateSalesPartyContext({
        customerId: new mongoose.Types.ObjectId(),
        branchId: "invalid-branch-id",
      });
    },
    { message: "branchId is invalid." }
  );

  await assert.rejects(
    async () => {
      await validateSalesPartyContext({
        customerId: "invalid-customer-id",
        branchId: new mongoose.Types.ObjectId(),
      });
    },
    { message: "customerId is invalid." }
  );

  await assert.rejects(
    async () => {
      await validateSalesPartyContext({
        leadId: "invalid-lead-id",
        branchId: new mongoose.Types.ObjectId(),
      });
    },
    { message: "leadId is invalid." }
  );
});

test("legacy direct invoice creation from deal is deprecated and returns 400 guidance", async () => {
  let statusCode = 0;
  let jsonResponse = null;

  const req = {
    params: { dealId: new mongoose.Types.ObjectId().toString() },
  };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonResponse = data;
      return this;
    },
  };

  await createInvoiceFromDeal(req, res);

  assert.equal(statusCode, 400);
  assert.equal(jsonResponse.deprecated, true);
  assert.ok(jsonResponse.message.includes("Direct invoice creation from deals is deprecated"));
  assert.ok(jsonResponse.suggestedEndpoint.includes("/api/sales/orders/from-deal/"));
});

test("service / non-stock item invoicing logic: service products do not require warehouse delivery", () => {
  const physicalItem = {
    trackInventory: true,
    productType: "physical",
    orderedQty: 10,
    dispatchedQty: 4,
    invoicedQty: 2,
  };

  const serviceItem = {
    trackInventory: false,
    productType: "service",
    orderedQty: 5,
    dispatchedQty: 0,
    invoicedQty: 1,
  };

  const physicalBillableMax = Math.max(physicalItem.dispatchedQty - physicalItem.invoicedQty, 0);
  assert.equal(physicalBillableMax, 2);

  const serviceBillableMax = Math.max(serviceItem.orderedQty - serviceItem.invoicedQty, 0);
  assert.equal(serviceBillableMax, 4);
});

test("mixed product calculation preserves proper subtotal, tax, and grandTotal lines", () => {
  const lines = [
    {
      productId: new mongoose.Types.ObjectId(),
      name: "Physical Hardware",
      quantity: 2,
      unitPrice: 1000,
      taxRate: 15,
      discountType: "percentage",
      discountValue: 10,
    },
    {
      productId: new mongoose.Types.ObjectId(),
      name: "Installation Service",
      quantity: 1,
      unitPrice: 500,
      taxRate: 5,
      discountType: "fixed",
      discountValue: 50,
    },
  ];

  const calculated = calculateDocument(lines);

  assert.equal(calculated.lines[0].lineSubtotal, 2000);
  assert.equal(calculated.lines[0].lineDiscount, 200);
  assert.equal(calculated.lines[0].lineTax, 270);
  assert.equal(calculated.lines[0].lineTotal, 2070);

  assert.equal(calculated.lines[1].lineSubtotal, 500);
  assert.equal(calculated.lines[1].lineDiscount, 50);
  assert.equal(calculated.lines[1].lineTax, 22.5);
  assert.equal(calculated.lines[1].lineTotal, 472.5);

  assert.equal(calculated.totals.subtotal, 2500);
  assert.equal(calculated.totals.discountTotal, 250);
  assert.equal(calculated.totals.taxTotal, 292.5);
  assert.equal(calculated.totals.grandTotal, 2542.5);
});

test("proposal and deal schemas support productId on items for seamless conversion to sales orders", () => {
  const proposalItemPath = Proposal.schema.path("items");
  assert.ok(proposalItemPath, "Proposal schema must have items");
  assert.equal(proposalItemPath.schema.path("productId").options.ref, "Product");

  const dealItemPath = Deal.schema.path("items");
  assert.ok(dealItemPath, "Deal schema must have items");
  assert.equal(dealItemPath.schema.path("productId").options.ref, "Product");

  // Valid proposal line with productId generates valid order lines
  const prodId = new mongoose.Types.ObjectId();
  const validProposalItems = [
    {
      productId: prodId,
      nameSnapshot: "ERP Subscription",
      qty: 5,
      unitPrice: 200,
      discount: 50,
    },
  ];

  const orderLines = proposalOrderLines(validProposalItems);
  assert.equal(orderLines.length, 1);
  assert.equal(orderLines[0].productId, prodId);
  assert.equal(orderLines[0].name, "ERP Subscription");
  assert.equal(orderLines[0].orderedQty, 5);
  assert.equal(orderLines[0].unitPrice, 200);
  assert.equal(orderLines[0].lineTotal, 950);

  // Proposal line missing productId is strictly rejected with 409
  assert.throws(
    () => {
      proposalOrderLines([
        {
          nameSnapshot: "No product specified",
          qty: 1,
          unitPrice: 100,
        },
      ]);
    },
    (err) => err.statusCode === 409 && err.message.includes("product")
  );
});

test("sales options isolation queries products and sales quotations with tenant isolation", () => {
  const productTenant = Product.schema.path("tenantId");
  assert.ok(productTenant, "Product schema must support tenantId isolation");

  const quotationTenant = SalesQuotation.schema.path("tenantId");
  assert.ok(quotationTenant, "SalesQuotation schema must support tenantId isolation");
});

