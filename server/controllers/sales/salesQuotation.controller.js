import Lead from "../../models/lead.model.js";
import { SalesQuotation } from "../../models/sales/salesQuotation.model.js";
import AccountingSettings from "../../models/accountingSettings.model.js";
import { SalesOrder } from "../../models/sales/salesOrder.model.js";
import { calculateDocument } from "../../services/salesCalculation.service.js";
import { nextSalesNumber } from "../../services/salesNumber.service.js";
import { markDealWon, logCrmActivity, convertLeadAndGenerateWonDeal } from "../../services/salesIntegration.service.js";
import { runSalesTransaction } from "../../services/salesTransaction.service.js";
import { validateAndSnapshotSalesLines, validateSalesPartyContext, validateSalesWarehouse } from "../../services/salesReference.service.js";
import { SalesError, assertTenant } from "../../utils/salesError.js";
import { getReqMeta, writeAudit } from "../../utils/audit.js";
import { assertLeadReadyForProposal } from "../../services/crm/leadLifecycle.service.js";

const editableStatuses = new Set(["draft", "sent", "viewed", "under_negotiation"]);

const tenantFilter = (req, extra = {}) => ({
  tenantId: assertTenant(req),
  ...extra,
});

export const createQuotation = async (req, res) => {
  const tenantId = assertTenant(req);
  const userId = req.user._id;
  const branchId = req.body.branchId || req.membership?.defaultBranch || req.user.defaultBranch;

  if (!branchId) throw new SalesError("branchId is required.");
  if (!req.body.customerId && !req.body.leadId) {
    throw new SalesError("customerId or leadId is required.");
  }
  if (!req.body.salespersonId && !userId) {
    throw new SalesError("salespersonId is required.");
  }

  const salespersonId = req.body.salespersonId || userId;
  const accountingPolicy = await AccountingSettings.findOne({ key: "company" }).select("taxCalculationMethod currency").lean();
  const normalizedLines = await validateAndSnapshotSalesLines(req.body.lines);
  const party = await validateSalesPartyContext({
    branchId,
    customerId: req.body.customerId,
    leadId: req.body.leadId,
    dealId: req.body.dealId,
    salespersonId,
  });
  if (party.lead && !["discovery", "proposal", "negotiation"].includes(party.lead.pipelineStage)) throw new SalesError("Complete qualification and discovery before creating a quotation.", 409);
  if (party.lead?.pipelineStage === "discovery") assertLeadReadyForProposal(party.lead);
  const calculated = calculateDocument(normalizedLines, {
    shippingCharge: req.body.shippingCharge,
    adjustment: req.body.adjustment,
    taxCalculationMethod: accountingPolicy?.taxCalculationMethod || "exclusive",
  });

  const quotationNumber = await nextSalesNumber({
    tenantId,
    documentType: "quotation",
    providedValue: req.body.quotationNumber,
  });

  const leadContact = req.body.leadContact || (party.lead ? {
    name: party.lead.contact?.name,
    companyName: party.lead.contact?.companyName,
    email: party.lead.contact?.email,
    phone: party.lead.contact?.phone,
  } : undefined);

  const quotation = await SalesQuotation.create({
    tenantId,
    branchId,
    quotationNumber,
    customerId: req.body.customerId || undefined,
    leadId: req.body.leadId || undefined,
    leadContact,
    contactId: req.body.contactId,
    dealId: req.body.dealId,
    salespersonId,
    currency: req.body.currency || accountingPolicy?.currency || "BDT",
    quotationDate: req.body.quotationDate,
    validUntil: req.body.validUntil,
    lines: calculated.lines,
    totals: calculated.totals,
    billingAddress: req.body.billingAddress,
    shippingAddress: req.body.shippingAddress,
    paymentTerms: req.body.paymentTerms,
    paymentTermsDays: req.body.paymentTermsDays ?? party.customer?.paymentTermsDays ?? 0,
    deliveryTerms: req.body.deliveryTerms,
    notes: req.body.notes,
    createdBy: userId,
    updatedBy: userId,
  });
  await writeAudit({ actorId: userId, action: "create", entityType: "SalesQuotation", entityId: quotation._id, after: quotation.toObject(), meta: getReqMeta(req) });

  if (quotation.leadId) await Lead.updateOne({ _id: quotation.leadId, pipelineStage: "discovery" }, { $set: { pipelineStage: "proposal", nextAction: "Send quotation for internal acceptance", nextActionType: "proposal" } });
  res.status(201).json({ success: true, data: quotation });
};

export const listQuotations = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const filter = tenantFilter(req);

  if (req.query.status) filter.status = req.query.status;
  if (req.query.customerId) filter.customerId = req.query.customerId;
  if (req.query.dealId) filter.dealId = req.query.dealId;
  if (req.query.salespersonId) filter.salespersonId = req.query.salespersonId;
  if (req.query.search) {
    filter.$or = [
      { quotationNumber: { $regex: req.query.search, $options: "i" } },
      { notes: { $regex: req.query.search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    SalesQuotation.find(filter)
      .populate("customerId", "name companyName email phone")
      .populate("leadId", "contact leadNumber pipelineStage")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SalesQuotation.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
};

export const getQuotation = async (req, res) => {
  const quotation = await SalesQuotation.findOne(
    tenantFilter(req, { _id: req.params.id })
  )
    .populate("customerId", "name email phone")
    .populate("leadId", "contact leadNumber pipelineStage")
    .populate("salespersonId", "name email")
    .populate("convertedOrderId", "orderNumber status");

  if (!quotation) throw new SalesError("Quotation not found.", 404);
  res.json({ success: true, data: quotation });
};

export const updateQuotation = async (req, res) => {
  const quotation = await SalesQuotation.findOne(
    tenantFilter(req, { _id: req.params.id })
  );
  if (!quotation) throw new SalesError("Quotation not found.", 404);
  if (!editableStatuses.has(quotation.status)) {
    throw new SalesError(`Quotation cannot be edited while status is ${quotation.status}.`, 409);
  }

  const allowed = [
    "customerId",
    "contactId",
    "dealId",
    "salespersonId",
    "currency",
    "quotationDate",
    "validUntil",
    "billingAddress",
    "shippingAddress",
    "paymentTerms",
    "paymentTermsDays",
    "deliveryTerms",
    "notes",
  ];

  for (const field of allowed) {
    if (req.body[field] !== undefined) quotation[field] = req.body[field];
  }

  if (req.body.lines) {
    const normalizedLines = await validateAndSnapshotSalesLines(req.body.lines);
    const calculated = calculateDocument(normalizedLines, {
      shippingCharge:
        req.body.shippingCharge ?? quotation.totals.shippingCharge,
      adjustment: req.body.adjustment ?? quotation.totals.adjustment,
      taxCalculationMethod: quotation.totals.taxCalculationMethod || "exclusive",
    });
    quotation.lines = calculated.lines;
    quotation.totals = calculated.totals;
  } else if (
    req.body.shippingCharge !== undefined ||
    req.body.adjustment !== undefined
  ) {
    const calculated = calculateDocument(quotation.lines.map((line) => line.toObject()), {
      shippingCharge:
        req.body.shippingCharge ?? quotation.totals.shippingCharge,
      adjustment: req.body.adjustment ?? quotation.totals.adjustment,
      taxCalculationMethod: quotation.totals.taxCalculationMethod || "exclusive",
    });
    quotation.lines = calculated.lines;
    quotation.totals = calculated.totals;
  }

  quotation.updatedBy = req.user._id;
  await validateSalesPartyContext({
    branchId: quotation.branchId,
    customerId: quotation.customerId,
    dealId: quotation.dealId,
    salespersonId: quotation.salespersonId,
  });
  await quotation.save();
  await writeAudit({ actorId: req.user._id, action: "update", entityType: "SalesQuotation", entityId: quotation._id, after: quotation.toObject(), meta: getReqMeta(req) });

  res.json({ success: true, data: quotation });
};

export const changeQuotationStatus = async (req, res) => {
  const allowedTransitions = {
    draft: ["sent", "cancelled"],
    sent: ["viewed", "under_negotiation", "accepted", "rejected", "expired", "cancelled"],
    viewed: ["under_negotiation", "accepted", "rejected", "expired", "cancelled"],
    under_negotiation: ["sent", "accepted", "rejected", "expired", "cancelled"],
    accepted: [],
    rejected: [],
    expired: [],
    cancelled: [],
  };

  const quotation = await SalesQuotation.findOne(
    tenantFilter(req, { _id: req.params.id })
  );
  if (!quotation) throw new SalesError("Quotation not found.", 404);

  const nextStatus = req.body.status;
  const previousStatus = quotation.status;
  if (!allowedTransitions[quotation.status]?.includes(nextStatus)) {
    throw new SalesError(
      `Cannot change quotation from ${quotation.status} to ${nextStatus}.`,
      409
    );
  }

  quotation.status = nextStatus;
  quotation.updatedBy = req.user._id;

  if (nextStatus === "accepted") {
    quotation.customerConfirmation = {
      method: req.body.confirmationMethod || "email",
      reference: req.body.reference,
      confirmedByName: req.body.confirmedByName,
      confirmedAt: new Date(),
    };
    if (quotation.leadId) {
      const lead = await Lead.findById(quotation.leadId);
      if (!lead || !["proposal", "negotiation"].includes(lead.pipelineStage)) throw new SalesError("Only a lead at Proposal can enter Negotiation through acceptance.", 409);
    }
  }

  await runSalesTransaction(async (session) => {
    if (quotation.leadId && nextStatus === "accepted") {
      const lead = await Lead.findOneAndUpdate(
        { _id: quotation.leadId, pipelineStage: { $in: ["proposal", "negotiation"] } },
        { $set: { pipelineStage: "negotiation", nextAction: "Final client discussion: mark Won or Lost", nextActionType: "follow_up" } },
        { ...(session ? { session } : {}), new: true }
      );
      if (!lead) throw new SalesError("The lead is no longer eligible for proposal acceptance.", 409);
    }
    await quotation.save(session ? { session } : {});
  });
  await writeAudit({ actorId: req.user._id, action: "status_change", entityType: "SalesQuotation", entityId: quotation._id, before: { status: previousStatus }, after: { status: nextStatus }, meta: { ...getReqMeta(req), oldStatus: previousStatus, newStatus: nextStatus } });

  await logCrmActivity(req, {
    tenantId: quotation.tenantId,
    leadId: quotation.leadId,
    dealId: quotation.dealId,
    customerId: quotation.customerId,
    type: "quotation_status_changed",
    title: nextStatus === "accepted" ? "Quotation accepted - Lead moved to Negotiation" : `Quotation status changed to ${nextStatus}`,
    description: `${quotation.quotationNumber} status changed to ${nextStatus}`,
    performedBy: req.user._id,
  });

  res.json({ success: true, data: quotation });
};

export const convertQuotationToOrder = async (req, res) => {
  const tenantId = assertTenant(req);
  let createdOrder;

  await runSalesTransaction(async (session) => {
      const quotation = await SalesQuotation.findOne({
        _id: req.params.id,
        tenantId,
      }).session(session);

      if (!quotation) throw new SalesError("Quotation not found.", 404);
      if (quotation.status !== "accepted") {
        throw new SalesError("Only an accepted quotation can become a sales order.", 409);
      }
      if (quotation.convertedOrderId) {
        throw new SalesError("This quotation has already been converted.", 409);
      }

      if (quotation.leadId) {
        throw new SalesError("Lead quotations convert automatically when the lead is won in Negotiation. Use Mark Won in CRM.", 409);
      }

      if (!quotation.customerId) {
        throw new SalesError("A customer is required to convert this quotation to a sales order.", 400);
      }

      if (!req.body.warehouseId) {
        throw new SalesError("warehouseId is required to create the sales order.");
      }
      await validateSalesWarehouse({ warehouseId: req.body.warehouseId, branchId: quotation.branchId });

      const orderNumber = await nextSalesNumber({
        tenantId,
        documentType: "order",
        session,
        providedValue: req.body.orderNumber,
      });

      const orderLines = quotation.lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        warehouseId: line.warehouseId || req.body.warehouseId,
        uomId: line.uomId,
        sku: line.sku,
        name: line.name,
        description: line.description,
        orderedQty: line.quantity,
        reservedQty: 0,
        dispatchedQty: 0,
        deliveredQty: 0,
        invoicedQty: 0,
        returnedQty: 0,
        unitPrice: line.unitPrice,
        discountType: line.discountType,
        discountValue: line.discountValue,
        taxRate: line.taxRate,
        lineSubtotal: line.lineSubtotal,
        lineDiscount: line.lineDiscount,
        lineTax: line.lineTax,
        lineTotal: line.lineTotal,
      }));

      const [order] = await SalesOrder.create(
        [
          {
            tenantId,
            branchId: quotation.branchId,
            orderNumber,
            quotationId: quotation._id,
            leadId: quotation.leadId || undefined,
            dealId: quotation.dealId,
            customerId: quotation.customerId,
            contactId: quotation.contactId,
            salespersonId: quotation.salespersonId,
            warehouseId: req.body.warehouseId,
            currency: quotation.currency,
            status: req.body.submitForApproval ? "pending_approval" : "draft",
            orderDate: req.body.orderDate || new Date(),
            promisedDeliveryDate: req.body.promisedDeliveryDate,
            lines: orderLines,
            totals: quotation.totals,
            billingAddress: quotation.billingAddress,
            shippingAddress: quotation.shippingAddress,
            paymentTerms: quotation.paymentTerms,
            paymentTermsDays: quotation.paymentTermsDays,
            deliveryTerms: quotation.deliveryTerms,
            customerReference:
              req.body.customerReference ||
              quotation.customerConfirmation?.reference,
            notes: req.body.notes || quotation.notes,
            approval: req.body.submitForApproval
              ? { requestedAt: new Date(), requestedBy: req.user._id }
              : undefined,
            createdBy: req.user._id,
            updatedBy: req.user._id,
          },
        ],
        { session }
      );

      quotation.convertedOrderId = order._id;
      quotation.updatedBy = req.user._id;
      await quotation.save({ session });
      createdOrder = order;
  });

  if (createdOrder?.dealId) {
    await markDealWon(req, {
      tenantId,
      dealId: createdOrder.dealId,
      salesOrderId: createdOrder._id,
      value: createdOrder.totals.grandTotal,
      wonAt: new Date(),
      performedBy: req.user._id,
    });
  }
  await writeAudit({ actorId: req.user._id, action: "convert", entityType: "SalesQuotation", entityId: req.params.id, after: { salesOrderId: createdOrder?._id }, meta: getReqMeta(req) });

  res.status(201).json({ success: true, data: createdOrder });
};
