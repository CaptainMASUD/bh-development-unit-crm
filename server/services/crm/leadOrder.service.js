import Proposal from "../../models/proposal.model.js";
import { SalesQuotation } from "../../models/sales/salesQuotation.model.js";
import { SalesOrder } from "../../models/sales/salesOrder.model.js";
import Warehouse from "../../models/inventory/warehouse.model.js";
import Branch from "../../models/branch.model.js";
import { nextSalesNumber } from "../sales/salesNumber.service.js";
import { assertTenant, SalesError } from "../../utils/salesError.js";
import { proposalOrderLines } from "./leadLifecycle.service.js";

export async function prepareLeadOrder(req, lead, session) {
  const tenantId = assertTenant(req);
  const quotationQuery = SalesQuotation.findOne({ tenantId, leadId: lead._id, status: "accepted", convertedOrderId: null }).sort({ updatedAt: -1 });
  const quotation = await (session ? quotationQuery.session(session) : quotationQuery);
  const proposalQuery = Proposal.findOne({ leadId: lead._id, status: "accepted" }).sort({ acceptedAt: -1 });
  const proposal = quotation ? null : await (session ? proposalQuery.session(session) : proposalQuery);
  if (!quotation && !proposal) throw new SalesError("Accept a sent proposal or quotation before winning this lead.", 409);
  const branchId = quotation?.branchId || req.body?.branchId || req.membership?.defaultBranch || req.user.defaultBranch;
  const branchQuery = Branch.findOne({ _id: branchId, isActive: true });
  if (!branchId || !await (session ? branchQuery.session(session) : branchQuery)) throw new SalesError("Select an active sales branch before winning.", 400);
  const filter = { tenantId, branch: branchId, status: "active" };
  if (req.body?.warehouseId) filter._id = req.body.warehouseId;
  const warehouseQuery = Warehouse.findOne(filter).sort({ isDefault: -1, _id: 1 });
  const warehouse = await (session ? warehouseQuery.session(session) : warehouseQuery);
  if (!warehouse) throw new SalesError("An active warehouse in the sales branch is required before winning.", 400);
  const lines = quotation ? quotation.lines.map((line) => ({ ...line.toObject(), _id: undefined, orderedQty: line.quantity, warehouseId: warehouse._id })) : proposalOrderLines(proposal.items).map((line) => ({ ...line, warehouseId: warehouse._id }));
  const totals = quotation ? quotation.totals.toObject() : {
    subtotal: lines.reduce((sum, line) => sum + line.lineSubtotal, 0),
    discountTotal: lines.reduce((sum, line) => sum + line.lineDiscount, 0),
    taxTotal: 0,
    grandTotal: lines.reduce((sum, line) => sum + line.lineTotal, 0),
  };
  const data = { tenantId, branchId, warehouseId: warehouse._id, leadId: lead._id, quotationId: quotation?._id, salespersonId: lead.assignedTo || req.user._id, currency: (quotation || proposal).currency, status: "draft", lines, totals, billingAddress: quotation?.billingAddress, shippingAddress: quotation?.shippingAddress, paymentTermsDays: quotation?.paymentTermsDays, createdBy: req.user._id, updatedBy: req.user._id };
  return { data, proposal, quotation };
}

export async function createLeadOrder({ prepared, customer, deal, session }) {
  const orderNumber = await nextSalesNumber({ tenantId: prepared.data.tenantId, documentType: "order", session });
  const [order] = await SalesOrder.create([{ ...prepared.data, orderNumber, customerId: customer._id, dealId: deal._id }], session ? { session } : {});
  deal.salesOrderId = order._id;
  deal.customerId = customer._id;
  deal.proposalId = prepared.proposal?._id || null;
  deal.quotationId = prepared.quotation?._id || null;
  deal.items = order.lines.map((line) => ({ productId: line.productId, nameSnapshot: line.name, qty: line.orderedQty, unitPrice: line.unitPrice, discount: line.lineDiscount, lineTotal: line.lineTotal }));
  deal.subtotal = order.totals.subtotal;
  deal.discountTotal = order.totals.discountTotal;
  deal.grandTotal = order.totals.grandTotal;
  deal.currency = order.currency;
  await deal.save(session ? { session } : {});
  const source = prepared.quotation || prepared.proposal;
  source.customerId = customer._id;
  source.dealId = deal._id;
  if (prepared.quotation) source.convertedOrderId = order._id;
  await source.save(session ? { session } : {});
  return order;
}
