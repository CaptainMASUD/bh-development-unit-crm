import mongoose from "mongoose";
import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { SalesInvoice } from "../../models/sales/salesInvoice.model.js";
import { SalesOrder } from "../../models/sales/salesOrder.model.js";
import { DeliveryNote } from "../../models/sales/deliveryNote.model.js";
import Product from "../../models/inventory/product.model.js";
import { calculateDocument, roundMoney } from "../../services/salesCalculation.service.js";
import { nextSalesNumber } from "../../services/salesNumber.service.js";
import {
  postInvoiceToAccounting,
  postCustomerPayment,
  reverseCustomerPayment,
  voidInvoiceInAccounting,
} from "../../services/salesIntegration.service.js";
import {
  generatePaymentSchedule,
  resolveEffectivePaymentTerm,
  allocatePaymentToSchedule,
  reversePaymentFromSchedule,
} from "../../services/accounting/paymentTerms.service.js";
import { runSalesTransaction } from "../../services/salesTransaction.service.js";
import { SalesError, assertTenant } from "../../utils/salesError.js";
import { getReqMeta, writeAudit } from "../../utils/audit.js";

const tenantFilter = (req, extra = {}) => ({
  tenantId: assertTenant(req),
  ...extra,
});

export const createSalesInvoice = async (req, res) => {
  const tenantId = assertTenant(req);
  let invoice;

  await runSalesTransaction(async (session) => {
      const order = await SalesOrder.findOne({
        _id: req.body.salesOrderId,
        tenantId,
      }).session(session);

      if (!order) throw new SalesError("Sales order not found.", 404);
      if (["draft", "pending_approval", "approved", "cancelled"].includes(order.status)) {
        throw new SalesError("Order must be confirmed before invoicing.", 409);
      }

      let sourceQuantities = new Map();

      if (Array.isArray(req.body.deliveryNoteIds) && req.body.deliveryNoteIds.length) {
        const deliveries = await DeliveryNote.find({
          _id: { $in: req.body.deliveryNoteIds },
          tenantId,
          salesOrderId: order._id,
          status: { $in: ["delivered", "partially_delivered"] },
        }).session(session);

        if (deliveries.length !== req.body.deliveryNoteIds.length) {
          throw new SalesError("One or more delivery notes are invalid or not delivered.");
        }

        for (const delivery of deliveries) {
          for (const line of delivery.lines) {
            const key = String(line.orderLineId);
            sourceQuantities.set(
              key,
              (sourceQuantities.get(key) || 0) + line.quantity
            );
          }
        }
      }

      const productIds = order.lines.map((l) => l.productId).filter(Boolean);
      const products = await Product.find({ _id: { $in: productIds } }).select("productType trackInventory").session(session).lean();
      const productMap = new Map(products.map((p) => [String(p._id), p]));

      const isNonStockLine = (line) => {
        const prod = productMap.get(String(line.productId));
        return prod?.trackInventory === false || prod?.productType === "service" || req.body.allowAdvance === true;
      };

      const requestedLines = Array.isArray(req.body.lines) && req.body.lines.length
        ? req.body.lines
        : order.lines
            .map((line) => {
              const nonStock = isNonStockLine(line);
              const remaining = nonStock
                ? line.orderedQty - line.invoicedQty
                : line.deliveredQty - line.invoicedQty;
              const deliveryBased = (sourceQuantities.size && !nonStock)
                ? Math.min(sourceQuantities.get(String(line._id)) || 0, remaining)
                : remaining;
              return {
                orderLineId: line._id,
                quantity: deliveryBased,
              };
            })
            .filter((line) => line.quantity > 0);

      if (!requestedLines.length) {
        throw new SalesError("There is no quantity available to invoice.", 409);
      }

      const orderLineMap = new Map(
        order.lines.map((line) => [String(line._id), line])
      );

      const rawInvoiceLines = requestedLines.map((requested) => {
        const orderLine = orderLineMap.get(String(requested.orderLineId));
        if (!orderLine) {
          throw new SalesError(`Invalid orderLineId: ${requested.orderLineId}`);
        }

        const nonStock = isNonStockLine(orderLine);
        const maxInvoiceQty = nonStock
          ? orderLine.orderedQty - orderLine.invoicedQty
          : orderLine.deliveredQty - orderLine.invoicedQty;
        const quantity = Number(requested.quantity);

        if (!Number.isFinite(quantity) || quantity <= 0 || quantity > maxInvoiceQty) {
          throw new SalesError(
            `Invoice quantity for ${orderLine.name} must be between 0 and ${maxInvoiceQty}.`
          );
        }

        return {
          orderLineId: orderLine._id,
          productId: orderLine.productId,
          variantId: orderLine.variantId,
          uomId: orderLine.uomId,
          sku: orderLine.sku,
          name: orderLine.name,
          description: orderLine.description,
          quantity,
          unitPrice: orderLine.unitPrice,
          discountType: orderLine.discountType,
          discountValue:
            orderLine.discountType === "fixed"
              ? roundMoney(
                  (orderLine.discountValue / orderLine.orderedQty) * quantity
                )
              : orderLine.discountValue,
          taxRate: orderLine.taxRate,
        };
      });

      const calculated = calculateDocument(rawInvoiceLines, {
        shippingCharge: req.body.shippingCharge || 0,
        adjustment: req.body.adjustment || 0,
        taxCalculationMethod: order.totals?.taxCalculationMethod || "exclusive",
      });

      const invoiceNumber = await nextSalesNumber({
        tenantId,
        documentType: "invoice",
        session,
      });
      const invoiceDate = new Date(req.body.invoiceDate || Date.now());
      const paymentTermsDays = Number(req.body.paymentTermsDays ?? order.paymentTermsDays ?? 0);
      const fallbackDueDate = req.body.dueDate
        ? new Date(req.body.dueDate)
        : new Date(invoiceDate.getTime() + paymentTermsDays * 86_400_000);

      const effectiveTerm = await resolveEffectivePaymentTerm({
        tenantId,
        transactionTermId: req.body.paymentTermId || req.body.paymentTerm || null,
        customerId: order.customerId,
        side: "sales",
        session,
      });

      const { paymentSchedule, finalDueDate } = generatePaymentSchedule({
        documentType: "SalesInvoice",
        documentDate: invoiceDate,
        documentTotal: calculated.totals.grandTotal,
        paymentTerm: effectiveTerm,
        customSchedule: req.body.customSchedule,
      });

      const resolvedDueDate = finalDueDate || fallbackDueDate;
      if (Number.isNaN(invoiceDate.getTime()) || Number.isNaN(resolvedDueDate.getTime())) {
        throw new SalesError("Invoice date and due date must be valid dates.", 400);
      }
      if (resolvedDueDate < invoiceDate) throw new SalesError("Invoice due date cannot be before the invoice date.", 400);

      [invoice] = await SalesInvoice.create(
        [
          {
            tenantId,
            branchId: order.branchId,
            invoiceNumber,
            salesOrderId: order._id,
            leadId: order.leadId || undefined,
            dealId: order.dealId || undefined,
            deliveryNoteIds: req.body.deliveryNoteIds || [],
            customerId: order.customerId,
            salespersonId: order.salespersonId,
            currency: order.currency,
            status: "draft",
            invoiceDate,
            dueDate: resolvedDueDate,
            finalDueDate: resolvedDueDate,
            paymentTerm: effectiveTerm?._id || null,
            paymentSchedule,
            lines: calculated.lines,
            totals: calculated.totals,
            paidAmount: 0,
            dueAmount: calculated.totals.grandTotal,
            billingAddress: req.body.billingAddress || order.billingAddress,
            paymentTerms: req.body.paymentTerms || order.paymentTerms,
            paymentTermsDays,
            notes: req.body.notes,
            createdBy: req.user._id,
            updatedBy: req.user._id,
          },
        ],
        { session }
      );

      for (const invoiceLine of invoice.lines) {
        const orderLine = orderLineMap.get(String(invoiceLine.orderLineId));
        orderLine.invoicedQty += invoiceLine.quantity;
      }

      const fullyInvoiced = order.lines.every(
        (line) => line.invoicedQty >= line.deliveredQty
      );
      const anyInvoiced = order.lines.some((line) => line.invoicedQty > 0);

      order.invoiceStatus = fullyInvoiced
        ? "fully_invoiced"
        : anyInvoiced
          ? "partially_invoiced"
          : "not_invoiced";
      order.updatedBy = req.user._id;
      await order.save({ session });
  });
  await writeAudit({ actorId: req.user._id, action: "create", entityType: "SalesInvoice", entityId: invoice._id, after: invoice.toObject(), meta: getReqMeta(req) });

  res.status(201).json({ success: true, data: invoice });
};

export const listSalesInvoices = async (req, res) => {
  const filter = tenantFilter(req);
  for (const field of ["status", "customerId", "salesOrderId"]) {
    if (req.query[field]) filter[field] = req.query[field];
  }

  if (req.query.overdue === "true") {
    filter.dueDate = { $lt: new Date() };
    filter.status = { $in: ["posted", "sent", "partially_paid"] };
  }

  const items = await SalesInvoice.find(filter)
    .populate("customerId", "name companyName email phone")
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(req.query.limit) || 50, 100))
    .lean();

  res.json({ success: true, data: items });
};

export const getSalesInvoice = async (req, res) => {
  const invoice = await SalesInvoice.findOne(
    tenantFilter(req, { _id: req.params.id })
  )
    .populate("customerId", "name email phone")
    .populate("salesOrderId", "orderNumber status");

  if (!invoice) throw new SalesError("Sales invoice not found.", 404);
  res.json({ success: true, data: invoice });
};

export const downloadSalesInvoicePdf = async (req, res) => {
  const invoice = await SalesInvoice.findOne(tenantFilter(req, { _id: req.params.id }))
    .populate("customerId", "name companyName email phone billingAddress")
    .populate("salesOrderId", "orderNumber");
  if (!invoice) throw new SalesError("Sales invoice not found.", 404);
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = 595;
  const height = 842;
  let page;
  let y;
  const addPage = () => {
    page = pdf.addPage([width, height]);
    y = 800;
    page.drawText(req.company?.legalName || req.company?.name || "Company", { x: 45, y, size: 16, font: bold, color: rgb(0.08, 0.12, 0.2) });
    y -= 28;
  };
  const row = (label, value, { strong = false } = {}) => {
    if (y < 70) addPage();
    page.drawText(String(label), { x: 45, y, size: 9, font: strong ? bold : regular });
    page.drawText(String(value ?? ""), { x: 230, y, size: 9, font: strong ? bold : regular });
    y -= 17;
  };
  addPage();
  page.drawText("SALES INVOICE", { x: 410, y: 800, size: 14, font: bold });
  row("Invoice number", invoice.invoiceNumber, { strong: true });
  row("Order number", invoice.salesOrderId?.orderNumber || "");
  row("Invoice date", new Date(invoice.invoiceDate).toISOString().slice(0, 10));
  row("Due date", invoice.dueDate ? new Date(invoice.dueDate).toISOString().slice(0, 10) : "");
  row("Customer", invoice.customerId?.companyName || invoice.customerId?.name || "");
  row("Currency", invoice.currency);
  y -= 8;
  page.drawText("Item", { x: 45, y, size: 9, font: bold });
  page.drawText("Qty", { x: 320, y, size: 9, font: bold });
  page.drawText("Unit price", { x: 385, y, size: 9, font: bold });
  page.drawText("Total", { x: 490, y, size: 9, font: bold });
  y -= 18;
  for (const line of invoice.lines) {
    if (y < 90) addPage();
    page.drawText(String(line.name || line.sku || "Item").slice(0, 44), { x: 45, y, size: 8, font: regular });
    page.drawText(String(line.quantity), { x: 320, y, size: 8, font: regular });
    page.drawText(Number(line.unitPrice || 0).toFixed(2), { x: 385, y, size: 8, font: regular });
    page.drawText(Number(line.lineTotal || 0).toFixed(2), { x: 490, y, size: 8, font: regular });
    y -= 16;
  }
  y -= 8;
  row("Subtotal", Number(invoice.totals.subtotal || 0).toFixed(2));
  row("Discount", Number(invoice.totals.discountTotal || 0).toFixed(2));
  row("VAT / Tax", Number(invoice.totals.taxTotal || 0).toFixed(2));
  row("Grand total", Number(invoice.totals.grandTotal || 0).toFixed(2), { strong: true });
  row("Paid", Number(invoice.paidAmount || 0).toFixed(2));
  row("Amount due", Number(invoice.dueAmount || 0).toFixed(2), { strong: true });
  const bytes = await pdf.save();
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`);
  return res.send(Buffer.from(bytes));
};

export const postSalesInvoice = async (req, res) => {
  const invoice = await SalesInvoice.findOne(
    tenantFilter(req, { _id: req.params.id })
  );
  if (!invoice) throw new SalesError("Sales invoice not found.", 404);
  if (invoice.status !== "draft") {
    throw new SalesError("Only a draft invoice can be posted.", 409);
  }

  const accounting = await postInvoiceToAccounting(req, {
    tenantId: invoice.tenantId,
    branchId: invoice.branchId,
    invoiceId: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    customerId: invoice.customerId,
    currency: invoice.currency,
    totals: invoice.totals,
    lines: invoice.lines,
    salesOrderId: invoice.salesOrderId,
    deliveryNoteIds: invoice.deliveryNoteIds,
    performedBy: req.user._id,
  });

  if (accounting.status === "failed") {
    throw new SalesError(
      accounting.message || "Accounting posting failed.",
      409,
      accounting
    );
  }

  invoice.status = "posted";
  invoice.accountingPosting.status = accounting.status;
  invoice.accountingPosting.journalEntryId = accounting.journalEntryId;
  invoice.accountingPosting.message = accounting.message;
  invoice.accountingPosting.cogsAmount = accounting.cogsAmount || 0;
  for (const line of invoice.lines) {
    line.unitCost = Number(accounting.unitCosts?.[String(line.productId)] || 0);
  }
  invoice.accountingPosting.postedAt =
    accounting.status === "posted" ? new Date() : undefined;
  invoice.updatedBy = req.user._id;
  await invoice.save();
  await writeAudit({ actorId: req.user._id, action: "confirm", entityType: "SalesInvoice", entityId: invoice._id, after: { status: invoice.status, accountingPosting: invoice.accountingPosting }, meta: getReqMeta(req) });

  res.json({ success: true, data: invoice, integration: accounting });
};

export const sendSalesInvoice = async (req, res) => {
  const invoice = await SalesInvoice.findOne(
    tenantFilter(req, { _id: req.params.id })
  );
  if (!invoice) throw new SalesError("Sales invoice not found.", 404);
  if (!["posted", "sent", "partially_paid"].includes(invoice.status)) {
    throw new SalesError("Invoice must be posted before sending.", 409);
  }

  if (invoice.status === "posted") invoice.status = "sent";
  invoice.sentAt = new Date();
  invoice.updatedBy = req.user._id;
  await invoice.save();
  await writeAudit({ actorId: req.user._id, action: "send", entityType: "SalesInvoice", entityId: invoice._id, after: { status: invoice.status, sentAt: invoice.sentAt }, meta: getReqMeta(req) });

  res.json({ success: true, data: invoice });
};

export const allocatePayment = async (req, res) => {
  const invoice = await SalesInvoice.findOne(
    tenantFilter(req, { _id: req.params.id })
  );
  if (!invoice) throw new SalesError("Sales invoice not found.", 404);
  if (["draft", "void", "cancelled"].includes(invoice.status)) {
    throw new SalesError(`Cannot receive payment for a ${invoice.status} invoice.`, 409);
  }

  const amount = roundMoney(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new SalesError("Payment amount must be greater than 0.");
  }
  if (amount > invoice.dueAmount) {
    throw new SalesError("Payment amount cannot exceed invoice due amount.");
  }

  const idempotencyKey = String(req.get("Idempotency-Key") || req.body.idempotencyKey || "").trim();
  if (!idempotencyKey) throw new SalesError("Idempotency-Key header is required when recording a customer payment.", 400);
  const existing = invoice.paymentAllocations.find((item) => item.idempotencyKey === idempotencyKey);
  if (existing) return res.json({ success: true, data: invoice, payment: existing, idempotentReplay: true });
  const paymentId = new mongoose.Types.ObjectId(
    createHash("sha256").update(`${invoice.tenantId}:${invoice._id}:${idempotencyKey}`).digest("hex").slice(0, 24)
  );
  const paymentDate = req.body.paymentDate || new Date();
  const posting = await postCustomerPayment(req, {
    paymentId,
    invoiceId: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    customerId: invoice.customerId,
    currency: invoice.currency,
    amount,
    paymentDate,
    reference: req.body.reference,
    method: req.body.method,
    treasuryAccount: req.body.treasuryAccount,
    treasuryType: req.body.treasuryType,
    cashAccount: req.body.cashAccount,
    bankAccount: req.body.bankAccount,
    performedBy: req.user._id,
  });

  invoice.paymentAllocations.push({
    paymentId,
    idempotencyKey,
    reference: req.body.reference,
    amount,
    paymentDate,
    method: req.body.method,
    recordedBy: req.user._id,
    cashAccount: posting.cashAccount,
    bankAccount: posting.bankAccount,
    journalEntry: posting.journalEntryId,
  });

  invoice.paidAmount = roundMoney(invoice.paidAmount + amount);
  invoice.dueAmount = roundMoney(Math.max(invoice.totals.grandTotal + Number(invoice.debitedAmount || 0) - Number(invoice.creditedAmount || 0) - invoice.paidAmount, 0));
  invoice.status = invoice.dueAmount === 0 ? "paid" : "partially_paid";

  const scheduleAlloc = allocatePaymentToSchedule(
    invoice.paymentSchedule,
    amount,
    req.body.installmentSequence || null
  );
  invoice.paymentSchedule = scheduleAlloc.schedule;

  invoice.updatedBy = req.user._id;
  await invoice.save();
  await writeAudit({ actorId: req.user._id, action: "payment_received", entityType: "SalesInvoice", entityId: invoice._id, after: { status: invoice.status, paidAmount: invoice.paidAmount, dueAmount: invoice.dueAmount }, meta: { ...getReqMeta(req), amount } });

  const order = await SalesOrder.findOne({
    _id: invoice.salesOrderId,
    tenantId: invoice.tenantId,
  });

  if (order) {
    const siblingInvoices = await SalesInvoice.find({
      tenantId: invoice.tenantId,
      salesOrderId: order._id,
      status: { $nin: ["void", "cancelled"] },
    }).select("totals.grandTotal creditedAmount debitedAmount paidAmount");

    const total = siblingInvoices.reduce(
      (sum, item) => sum + Number(item.totals?.grandTotal || 0) + Number(item.debitedAmount || 0) - Number(item.creditedAmount || 0),
      0
    );
    const paid = siblingInvoices.reduce(
      (sum, item) => sum + item.paidAmount,
      0
    );

    order.paymentStatus =
      total > 0 && paid >= total
        ? "paid"
        : paid > 0
          ? "partially_paid"
          : "unpaid";
    order.updatedBy = req.user._id;
    await order.save();
  }

  res.json({ success: true, data: invoice });
};

export const reversePayment = async (req, res) => {
  const invoice = await SalesInvoice.findOne(tenantFilter(req, { _id: req.params.id }));
  if (!invoice) throw new SalesError("Sales invoice not found.", 404);
  const allocation = invoice.paymentAllocations.id(req.params.paymentId) ||
    invoice.paymentAllocations.find((item) => String(item.paymentId) === String(req.params.paymentId));
  if (!allocation) throw new SalesError("Payment allocation was not found.", 404);
  if (!String(req.body.reason || "").trim()) throw new SalesError("Payment reversal reason is required.", 400);
  const reversal = await reverseCustomerPayment(req, {
    paymentId: allocation.paymentId,
    date: req.body.date || new Date(),
    reason: req.body.reason,
    performedBy: req.user._id,
  });
  invoice.paidAmount = roundMoney(Math.max(Number(invoice.paidAmount || 0) - Number(allocation.amount || 0), 0));
  invoice.dueAmount = roundMoney(Math.max(Number(invoice.totals.grandTotal || 0) + Number(invoice.debitedAmount || 0) - Number(invoice.creditedAmount || 0) - invoice.paidAmount, 0));
  invoice.paymentAllocations.pull(allocation._id);
  invoice.status = invoice.paidAmount > 0 ? "partially_paid" : invoice.sentAt ? "sent" : "posted";

  const scheduleRev = reversePaymentFromSchedule(
    invoice.paymentSchedule,
    allocation.amount,
    null
  );
  invoice.paymentSchedule = scheduleRev.schedule;

  invoice.updatedBy = req.user._id;
  await invoice.save();
  await writeAudit({ actorId: req.user._id, action: "reverse", entityType: "SalesInvoice", entityId: invoice._id, after: { paidAmount: invoice.paidAmount, dueAmount: invoice.dueAmount }, meta: { ...getReqMeta(req), reason: req.body.reason, amount: allocation.amount } });
  const order = await SalesOrder.findById(invoice.salesOrderId);
  if (order) {
    const siblings = await SalesInvoice.find({
      tenantId: invoice.tenantId,
      salesOrderId: order._id,
      status: { $nin: ["void", "cancelled"] },
    }).select("totals.grandTotal creditedAmount debitedAmount paidAmount");
    const total = siblings.reduce((sum, item) => sum + Number(item.totals?.grandTotal || 0) + Number(item.debitedAmount || 0) - Number(item.creditedAmount || 0), 0);
    const paid = siblings.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0);
    order.paymentStatus = total > 0 && paid >= total ? "paid" : paid > 0 ? "partially_paid" : "unpaid";
    order.updatedBy = req.user._id;
    await order.save();
  }
  return res.json({ success: true, data: invoice, reversal });
};

export const voidSalesInvoice = async (req, res) => {
  const invoice = await SalesInvoice.findOne(
    tenantFilter(req, { _id: req.params.id })
  );
  if (!invoice) throw new SalesError("Sales invoice not found.", 404);
  if (!["posted", "sent"].includes(invoice.status)) {
    throw new SalesError("Only an unpaid posted invoice can be voided.", 409);
  }
  if (invoice.paidAmount > 0) {
    throw new SalesError("Reverse allocated payments before voiding the invoice.", 409);
  }
  if (Number(invoice.creditedAmount || 0) > 0 || Number(invoice.debitedAmount || 0) > 0) {
    throw new SalesError("Reverse linked adjustment notes/sales returns before voiding this invoice.", 409);
  }
  if (!req.body.reason) throw new SalesError("Void reason is required.");

  const accounting = await voidInvoiceInAccounting(req, {
    tenantId: invoice.tenantId,
    invoiceId: invoice._id,
    journalEntryId: invoice.accountingPosting.journalEntryId,
    reason: req.body.reason,
    date: req.body.date || new Date(),
    performedBy: req.user._id,
  });

  invoice.status = "void";
  invoice.voidedAt = new Date();
  invoice.voidedBy = req.user._id;
  invoice.voidReason = req.body.reason;
  invoice.accountingPosting.status =
    accounting.status === "reversed" ? "reversed" : invoice.accountingPosting.status;
  invoice.accountingPosting.reversalJournalEntryId =
    accounting.reversalJournalEntryId;
  invoice.accountingPosting.reversedAt =
    accounting.status === "reversed" ? new Date() : undefined;
  invoice.updatedBy = req.user._id;
  await invoice.save();
  const order = await SalesOrder.findById(invoice.salesOrderId);
  if (order) {
    const orderLines = new Map(order.lines.map((line) => [String(line._id), line]));
    for (const line of invoice.lines) {
      const orderLine = orderLines.get(String(line.orderLineId));
      if (orderLine) orderLine.invoicedQty = Math.max(Number(orderLine.invoicedQty || 0) - Number(line.quantity || 0), 0);
    }
    const anyInvoiced = order.lines.some((line) => line.invoicedQty > 0);
    const fullyInvoiced = order.lines.every((line) => line.invoicedQty >= line.deliveredQty && line.deliveredQty > 0);
    order.invoiceStatus = fullyInvoiced ? "fully_invoiced" : anyInvoiced ? "partially_invoiced" : "not_invoiced";
    order.updatedBy = req.user._id;
    await order.save();
  }
  await writeAudit({ actorId: req.user._id, action: "void", entityType: "SalesInvoice", entityId: invoice._id, after: { status: invoice.status, voidReason: invoice.voidReason }, meta: { ...getReqMeta(req), reason: req.body.reason } });

  res.json({ success: true, data: invoice, integration: accounting });
};
