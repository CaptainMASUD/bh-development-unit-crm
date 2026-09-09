import mongoose from "mongoose";
import Branch from "../../models/branch.model.js";
import Customer from "../../models/customer.model.js";
import Deal from "../../models/deal.model.js";
import User from "../../models/user.model.js";
import Product from "../../models/inventory/product.model.js";
import Warehouse from "../../models/inventory/warehouse.model.js";
import InventoryUnit from "../../models/inventory/inventoryUnit.model.js";
import Lead from "../../models/lead.model.js";
import LegacyInvoice from "../../models/invoice.model.js";
import { SalesInvoice } from "../../models/sales/salesInvoice.model.js";
import { SalesError } from "../../utils/salesError.js";

const id = (value, label) => {
  if (!mongoose.Types.ObjectId.isValid(String(value || ""))) throw new SalesError(`${label} is invalid.`, 400);
  return value;
};

export const validateSalesPartyContext = async ({ branchId, customerId, leadId, dealId, salespersonId }) => {
  if (!customerId && !leadId) {
    throw new SalesError("Either a customer or an active lead is required.", 400);
  }

  const [branch, customer, lead, salesperson, deal] = await Promise.all([
    Branch.findOne({ _id: id(branchId, "branchId"), isActive: true }).lean(),
    customerId ? Customer.findById(id(customerId, "customerId")).select("lifecycleStage status paymentTermsDays creditHold").lean() : null,
    leadId ? Lead.findById(id(leadId, "leadId")).select("pipelineStage status contact assignedTo requirement").lean() : null,
    User.findOne({ _id: id(salespersonId, "salespersonId"), isActive: true }).select("_id").lean(),
    dealId ? Deal.findById(id(dealId, "dealId")).select("customerId stage ownerId").lean() : null,
  ]);
  if (!branch) throw new SalesError("The selected branch is not active in this company.", 404);
  if (customerId && !customer) throw new SalesError("The selected customer was not found in this company.", 404);
  if (leadId && !lead) throw new SalesError("The selected CRM lead was not found in this company.", 404);
  if (customer?.lifecycleStage === "churned") throw new SalesError("A churned customer cannot receive a new quotation.", 409);
  if (customer?.creditHold) throw new SalesError("This customer is on credit hold.", 409);
  if (lead && (lead.pipelineStage === "lost" || lead.status === "lost")) {
    throw new SalesError("A lost CRM lead cannot receive a new quotation.", 409);
  }
  if (!salesperson) throw new SalesError("The selected salesperson is not an active company user.", 404);
  if (deal && deal.customerId && customerId && String(deal.customerId) !== String(customerId)) {
    throw new SalesError("The selected CRM deal belongs to a different customer.", 409);
  }
  if (deal?.stage === "lost") throw new SalesError("A lost CRM deal cannot be converted into a quotation.", 409);
  return { branch, customer, lead, salesperson, deal };
};

export const validateSalesWarehouse = async ({ warehouseId, branchId }) => {
  const warehouse = await Warehouse.findOne({ _id: id(warehouseId, "warehouseId"), status: "active" }).lean();
  if (!warehouse) throw new SalesError("The selected warehouse is not active in this company.", 404);
  if (warehouse.branch && String(warehouse.branch) !== String(branchId)) {
    throw new SalesError("The selected warehouse does not belong to the sales branch.", 409);
  }
  return warehouse;
};

export const assertCustomerCreditAvailable = async ({ customerId, orderAmount }) => {
  const customer = await Customer.findById(id(customerId, "customerId"))
    .select("creditLimit creditHold companyName name")
    .lean();
  if (!customer) throw new SalesError("The sales-order customer was not found.", 404);
  if (customer.creditHold) throw new SalesError("This customer is on credit hold.", 409);
  if (Number(customer.creditLimit || 0) <= 0) return;
  const [salesRows, legacyRows] = await Promise.all([
    SalesInvoice.aggregate([
      { $match: { customerId: customer._id, status: { $in: ["posted", "sent", "partially_paid", "overdue"] } } },
      { $group: { _id: null, total: { $sum: "$dueAmount" } } },
    ]),
    LegacyInvoice.aggregate([
      { $match: { customerId: customer._id, journalEntry: { $ne: null }, status: { $nin: ["draft", "void", "paid"] } } },
      { $group: { _id: null, total: { $sum: "$dueTotal" } } },
    ]),
  ]);
  const exposure = Number(salesRows[0]?.total || 0) + Number(legacyRows[0]?.total || 0) + Number(orderAmount || 0);
  if (exposure > Number(customer.creditLimit)) {
    throw new SalesError(`Customer credit limit exceeded. Exposure would be ${exposure.toFixed(2)} against a limit of ${Number(customer.creditLimit).toFixed(2)}.`, 409);
  }
};

export const validateAndSnapshotSalesLines = async (lines = []) => {
  if (!Array.isArray(lines) || !lines.length) throw new SalesError("At least one sales line is required.", 400);
  const productIds = [...new Set(lines.map((line) => String(id(line.productId, "productId"))))];
  const unitIds = [...new Set(lines.map((line) => line.uomId).filter(Boolean).map((value) => String(id(value, "uomId"))))];
  const [products, units] = await Promise.all([
    Product.find({ _id: { $in: productIds }, status: "active" }).select("name sku baseUnit sellingPrice minimumSellingPrice taxRate currency productType trackInventory").lean(),
    unitIds.length ? InventoryUnit.find({ _id: { $in: unitIds }, status: "active" }).select("_id").lean() : [],
  ]);
  if (products.length !== productIds.length) throw new SalesError("One or more products are inactive or do not belong to this company.", 409);
  if (units.length !== unitIds.length) throw new SalesError("One or more units of measure are inactive or invalid.", 409);
  const productMap = new Map(products.map((product) => [String(product._id), product]));
  return lines.map((line, index) => {
    const product = productMap.get(String(line.productId));
    const unitPrice = line.unitPrice === undefined ? Number(product.sellingPrice || 0) : Number(line.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < Number(product.minimumSellingPrice || 0)) {
      throw new SalesError(`Line ${index + 1}: unit price is below the product minimum selling price.`, 409);
    }
    return {
      ...line,
      productId: product._id,
      uomId: line.uomId || product.baseUnit || null,
      sku: product.sku,
      name: product.name,
      unitPrice,
      taxRate: line.taxRate === undefined ? Number(product.taxRate || 0) : line.taxRate,
    };
  });
};
