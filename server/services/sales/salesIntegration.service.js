import mongoose from "mongoose";
import Activity from "../../models/activity.model.js";
import Deal from "../../models/deal.model.js";
import BankAccount from "../../models/bankAccount.model.js";
import BankTransaction from "../../models/bankTransaction.model.js";
import CashAccount from "../../models/cashAccount.model.js";
import JournalEntry from "../../models/journalEntry.model.js";
import StockMovement from "../../models/inventory/stockMovement.model.js";
import { DeliveryNote } from "../../models/sales/deliveryNote.model.js";
import { createPostedJournal, parsePostingDate, resolveAccountingAccount, roundMoney } from "../../services/accountingPosting.service.js";
import { runSalesTransaction } from "../../services/salesTransaction.service.js";
import { SalesError } from "../../utils/salesError.js";

const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const sessionOptions = (session) => session ? { session } : undefined;
const withSession = (query, session) => session ? query.session(session) : query;

import Customer from "../../models/customer.model.js";
import Lead from "../../models/lead.model.js";
import { nextAccountingNumber } from "../../services/accountingNumbering.service.js";
import {
  reserveStock,
  releaseStockReservation,
  issueSalesDeliveryStock,
  receiveSalesReturnStock,
  reverseStockMovement,
} from "../../services/inventoryPosting.service.js";

export const cancelDeliveryInventory = async (req, payload) => {
  const tenantId = req?.tenantId || payload?.tenantId;
  if (!payload.stockMovementId) return null;
  return reverseStockMovement({
    tenantId,
    movementId: payload.stockMovementId,
    reason: payload.reason || "Delivery cancelled or failed",
    userId: payload.performedBy,
  });
};

export const reserveInventory = async (req, payload) => {
  const tenantId = req?.tenantId || payload?.tenantId;
  return reserveStock({
    tenantId,
    salesOrderId: payload.salesOrderId,
    referenceNumber: payload.referenceNumber,
    lines: payload.lines,
    warehouseId: payload.warehouseId,
    userId: payload.performedBy,
  });
};

export const releaseInventory = async (req, payload) => {
  const tenantId = req?.tenantId || payload?.tenantId;
  return releaseStockReservation({
    tenantId,
    salesOrderId: payload.salesOrderId,
    reservationId: payload.reservationId,
    userId: payload.performedBy,
  });
};

export const issueInventory = async (req, payload) => {
  const tenantId = req?.tenantId || payload?.tenantId;
  return issueSalesDeliveryStock({
    tenantId,
    deliveryNoteId: payload.deliveryNoteId,
    salesOrderId: payload.salesOrderId,
    referenceNumber: payload.referenceNumber,
    lines: payload.lines,
    warehouseId: payload.warehouseId,
    userId: payload.performedBy,
  });
};

export const receiveSalesReturn = async (req, payload) => {
  const tenantId = req?.tenantId || payload?.tenantId;
  return receiveSalesReturnStock({
    tenantId,
    returnId: payload.returnId,
    returnNumber: payload.returnNumber,
    lines: payload.lines,
    warehouseId: payload.warehouseId,
    reason: payload.reason,
    userId: payload.performedBy,
  });
};

export const postSalesReturnToAccounting = async (req, payload) => {
  const tenantId = req?.tenantId || payload?.tenantId;
  const existing = await JournalEntry.findOne({
    sourceType: "invoice",
    sourceId: payload.returnId,
    status: "posted",
    ...(tenantId ? { tenantId } : {}),
  });
  if (existing) return { status: "posted", journalEntryId: existing._id };

  const [receivable, revenue, vatPayable] = await Promise.all([
    resolveAccountingAccount({ tenantId, settingsField: "receivableAccount", fallbackCode: "1100" }),
    resolveAccountingAccount({ tenantId, settingsField: "salesAccount", fallbackCode: "4000" }),
    resolveAccountingAccount({ tenantId, settingsField: "vatPayableAccount", fallbackCode: "2100" }),
  ]);

  const lines = [
    { account: revenue._id, debit: payload.netAmount, credit: 0, description: `Sales return ${payload.returnNumber}`, contactType: "customer", contactId: payload.customerId },
    { account: receivable._id, debit: 0, credit: payload.totalAmount, description: `Credit note ${payload.returnNumber}`, contactType: "customer", contactId: payload.customerId },
  ];
  if (payload.taxAmount > 0) {
    lines.push({ account: vatPayable._id, debit: payload.taxAmount, credit: 0, description: `VAT reversal ${payload.returnNumber}`, contactType: "customer", contactId: payload.customerId });
  }

  const journal = await createPostedJournal({
    tenantId,
    date: payload.returnDate,
    lines,
    sourceType: "invoice",
    sourceId: payload.returnId,
    reference: payload.returnNumber,
    memo: `Sales return and credit note ${payload.returnNumber}`,
    currency: payload.currency,
    voucherType: "sales",
    origin: "system",
    userId: payload.performedBy,
  });
  return { status: "posted", journalEntryId: journal._id };
};

const invoiceCost = async ({ salesOrderId, deliveryNoteIds, lines, tenantId = null }) => {
  const deliveryFilter = deliveryNoteIds?.length
    ? { _id: { $in: deliveryNoteIds }, salesOrderId, ...(tenantId ? { tenantId } : {}) }
    : { salesOrderId, status: { $in: ["delivered", "partially_delivered"] }, ...(tenantId ? { tenantId } : {}) };
  const deliveries = await DeliveryNote.find(deliveryFilter).select("inventoryPosting.stockMovementId").lean();
  const movementIds = deliveries.map((item) => item.inventoryPosting?.stockMovementId).filter(isId);
  if (!movementIds.length) return { total: 0, unitCosts: {}, cogsAlreadyPosted: false };
  const movements = await StockMovement.find({
    _id: { $in: movementIds },
    status: "posted",
    ...(tenantId ? { tenantId } : {}),
  }).select("lines journalEntry").lean();

  const cogsAlreadyPosted = movements.some((m) => Boolean(m.journalEntry));
  const costs = new Map();
  for (const movement of movements) {
    for (const line of movement.lines || []) {
      if (line.effect !== "out") continue;
      const key = String(line.product);
      const current = costs.get(key) || { quantity: 0, value: 0 };
      current.quantity += Number(line.quantity || 0);
      current.value += Number(line.appliedValue || 0);
      costs.set(key, current);
    }
  }
  const unitCosts = {};
  const total = roundMoney((lines || []).reduce((total, line) => {
    const cost = costs.get(String(line.productId));
    const unitCost = cost?.quantity > 0 ? cost.value / cost.quantity : 0;
    unitCosts[String(line.productId)] = roundMoney(unitCost);
    return total + Number(line.quantity || 0) * unitCost;
  }, 0));
  return { total, unitCosts, cogsAlreadyPosted };
};

export const postInvoiceToAccounting = async (req, payload) => {
  const tenantId = req?.tenantId || payload?.tenantId;
  const existing = await JournalEntry.findOne({
    sourceType: "invoice",
    sourceId: payload.invoiceId,
    status: { $in: ["posted", "reversed"] },
    reversalOf: null,
    ...(tenantId ? { tenantId } : {}),
  });
  if (existing) {
    if (existing.status === "reversed") throw new SalesError("This invoice posting has already been reversed.", 409);
    return { status: "posted", journalEntryId: existing._id, cogsAmount: 0 };
  }

  const [receivable, revenue, vatPayable] = await Promise.all([
    resolveAccountingAccount({ tenantId, settingsField: "receivableAccount", fallbackCode: "1100" }),
    resolveAccountingAccount({ tenantId, settingsField: "salesAccount", fallbackCode: "4000" }),
    resolveAccountingAccount({ tenantId, settingsField: "vatPayableAccount", fallbackCode: "2100" }),
  ]);
  const taxAmount = roundMoney(payload.totals?.taxTotal);
  const grandTotal = roundMoney(payload.totals?.grandTotal);
  const netRevenue = roundMoney(grandTotal - taxAmount);
  const cost = await invoiceCost({ ...payload, tenantId });
  const cogsAmount = cost.cogsAlreadyPosted ? 0 : cost.total;
  const description = `Sales invoice ${payload.invoiceNumber}`;
  const lines = [
    { account: receivable._id, debit: grandTotal, credit: 0, description, contactType: "customer", contactId: payload.customerId },
    { account: revenue._id, debit: 0, credit: netRevenue, description, contactType: "customer", contactId: payload.customerId },
  ];
  if (taxAmount > 0) lines.push({ account: vatPayable._id, debit: 0, credit: taxAmount, description: `Output VAT - ${payload.invoiceNumber}`, contactType: "customer", contactId: payload.customerId });
  if (cogsAmount > 0) {
    const [inventory, cogs] = await Promise.all([
      resolveAccountingAccount({ tenantId, settingsField: "inventoryAccount", fallbackCode: "1300" }),
      resolveAccountingAccount({ tenantId, settingsField: "cogsAccount", fallbackCode: "5020" }),
    ]);
    lines.push(
      { account: cogs._id, debit: cogsAmount, credit: 0, description: `COGS - ${payload.invoiceNumber}` },
      { account: inventory._id, debit: 0, credit: cogsAmount, description: `Inventory issued - ${payload.invoiceNumber}` }
    );
  }
  const journal = await createPostedJournal({
    tenantId,
    date: payload.invoiceDate,
    lines,
    sourceType: "invoice",
    sourceId: payload.invoiceId,
    reference: payload.invoiceNumber,
    memo: description,
    currency: payload.currency,
    voucherType: "sales",
    origin: "system",
    userId: payload.performedBy,
  });
  return { status: "posted", journalEntryId: journal._id, cogsAmount: cost.total, unitCosts: cost.unitCosts };
};

export const voidInvoiceInAccounting = async (_req, payload) => {
  const original = isId(payload.journalEntryId)
    ? await JournalEntry.findById(payload.journalEntryId)
    : await JournalEntry.findOne({ sourceType: "invoice", sourceId: payload.invoiceId, reversalOf: null });
  if (!original) throw new SalesError("The invoice accounting journal was not found.", 409);
  if (original.status === "reversed" && original.reversedByEntry) {
    return { status: "reversed", reversalJournalEntryId: original.reversedByEntry };
  }
  if (original.status !== "posted") throw new SalesError("Only a posted invoice journal can be reversed.", 409);
  const reversal = await createPostedJournal({
    date: payload.date || new Date(),
    sourceType: "invoice",
    sourceId: payload.invoiceId,
    reference: `REV-${original.entryNo}`,
    memo: clean(payload.reason) || `Reversal of ${original.entryNo}`,
    currency: original.currency,
    voucherType: "sales",
    origin: "system",
    userId: payload.performedBy,
    lines: original.lines.map((line) => ({
      account: line.account,
      debit: line.credit,
      credit: line.debit,
      description: `Reversal: ${line.description}`,
      contactType: line.contactType,
      contactId: line.contactId,
      taxCode: line.taxCode,
    })),
  });
  reversal.reversalOf = original._id;
  reversal.reversalReason = clean(payload.reason);
  await reversal.save();
  original.status = "reversed";
  original.reversedAt = new Date();
  original.reversedBy = payload.performedBy;
  original.reversedByEntry = reversal._id;
  original.reversalReason = clean(payload.reason);
  await original.save();
  return { status: "reversed", reversalJournalEntryId: reversal._id };
};

const resolveTreasury = async (payload) => {
  const id = payload.treasuryAccount || payload.cashAccount || payload.bankAccount;
  if (!isId(id)) throw new SalesError("Select an active cash or bank account.", 400);
  const requestedType = clean(payload.treasuryType).toLowerCase();
  if (requestedType !== "bank") {
    const cash = await CashAccount.findOne({ _id: id, isActive: true }).populate("account", "type currency isActive isGroup").lean();
    if (cash?.account?.type === "asset" && cash.account.isActive !== false && !cash.account.isGroup) {
      if (payload.currency && clean(cash.currency).toUpperCase() !== clean(payload.currency).toUpperCase()) throw new SalesError("Cash account currency does not match the invoice.", 409);
      return { type: "cash", id: cash._id, ledger: cash.account, name: cash.name, paymentMode: cash.type === "cash" ? "cash" : clean(cash.type || "other") };
    }
  }
  if (requestedType !== "cash") {
    const bank = await BankAccount.findOne({ _id: id, status: "active" }).populate("ledgerAccount", "type currency isActive isGroup").lean();
    if (bank?.ledgerAccount?.type === "asset" && bank.ledgerAccount.isActive !== false && !bank.ledgerAccount.isGroup) {
      if (payload.currency && clean(bank.currency).toUpperCase() !== clean(payload.currency).toUpperCase()) throw new SalesError("Bank account currency does not match the invoice.", 409);
      return { type: "bank", id: bank._id, ledger: bank.ledgerAccount, name: bank.accountName, paymentMode: "bank" };
    }
  }
  throw new SalesError("Select an active cash or linked bank account in the invoice currency.", 400);
};

export const postCustomerPayment = async (_req, payload) => {
  const tenantId = _req?.tenantId || payload?.tenantId;
  const existing = await JournalEntry.findOne({
    sourceType: "customer_payment",
    sourceId: payload.paymentId,
    status: "posted",
    ...(tenantId ? { tenantId } : {}),
  });
  if (existing) return { journalEntryId: existing._id, status: "posted", cashAccount: existing.cashAccount, bankAccount: existing.bankAccount };
  const [treasury, receivable] = await Promise.all([
    resolveTreasury(payload),
    resolveAccountingAccount({ tenantId, settingsField: "receivableAccount", fallbackCode: "1100" }),
  ]);
  const journal = await createPostedJournal({
    tenantId,
    date: payload.paymentDate,
    sourceType: "customer_payment",
    sourceId: payload.paymentId,
    reference: payload.reference || payload.invoiceNumber,
    memo: `Customer receipt for ${payload.invoiceNumber}`,
    currency: payload.currency,
    voucherType: "receipt",
    paymentMode: treasury.paymentMode,
    treasuryAccountType: treasury.type,
    cashAccount: treasury.type === "cash" ? treasury.id : null,
    bankAccount: treasury.type === "bank" ? treasury.id : null,
    origin: "system",
    userId: payload.performedBy,
    lines: [
      { account: treasury.ledger._id, debit: payload.amount, credit: 0, description: treasury.name },
      { account: receivable._id, debit: 0, credit: payload.amount, description: payload.invoiceNumber, contactType: "customer", contactId: payload.customerId },
    ],
  });
  if (treasury.type === "bank") {
    await BankTransaction.create({
      bankAccount: treasury.id,
      kind: "deposit",
      direction: "in",
      amount: payload.amount,
      transactionDate: parsePostingDate(payload.paymentDate) || new Date(),
      reference: payload.reference || payload.invoiceNumber,
      description: `Customer receipt for ${payload.invoiceNumber}`,
      status: "posted",
      sourceType: "customer_payment",
      journalEntry: journal._id,
      sourceId: payload.paymentId,
      createdBy: payload.performedBy,
      updatedBy: payload.performedBy,
    });
  }
  return {
    status: "posted",
    journalEntryId: journal._id,
    cashAccount: treasury.type === "cash" ? treasury.id : null,
    bankAccount: treasury.type === "bank" ? treasury.id : null,
  };
};

export const reverseCustomerPayment = async (_req, payload) => {
  const original = await JournalEntry.findOne({ sourceType: "customer_payment", sourceId: payload.paymentId, reversalOf: null });
  if (!original) throw new SalesError("The payment receipt journal was not found.", 409);
  if (original.status === "reversed" && original.reversedByEntry) return { status: "reversed", reversalJournalEntryId: original.reversedByEntry };
  if (original.status !== "posted") throw new SalesError("Only a posted customer receipt can be reversed.", 409);
  const bankTransaction = await BankTransaction.findOne({ journalEntry: original._id });
  if (bankTransaction?.reconciled) throw new SalesError("This receipt is bank-reconciled. Reopen the reconciliation before reversing it.", 409);
  const reversal = await createPostedJournal({
    date: payload.date || new Date(),
    sourceType: "customer_payment",
    sourceId: payload.paymentId,
    reference: `REV-${original.entryNo}`,
    memo: clean(payload.reason) || `Reversal of ${original.entryNo}`,
    currency: original.currency,
    voucherType: "receipt",
    origin: "system",
    userId: payload.performedBy,
    lines: original.lines.map((line) => ({
      account: line.account, debit: line.credit, credit: line.debit,
      description: `Reversal: ${line.description}`, contactType: line.contactType, contactId: line.contactId,
    })),
  });
  reversal.reversalOf = original._id;
  reversal.reversalReason = clean(payload.reason);
  await reversal.save();
  original.status = "reversed";
  original.reversedAt = new Date();
  original.reversedBy = payload.performedBy;
  original.reversedByEntry = reversal._id;
  original.reversalReason = clean(payload.reason);
  await original.save();
  if (bankTransaction) {
    bankTransaction.status = "void";
    bankTransaction.updatedBy = payload.performedBy;
    await bankTransaction.save();
  }
  return { status: "reversed", reversalJournalEntryId: reversal._id };
};

export const postCustomerRefund = async (_req, payload) => {
  const tenantId = _req?.tenantId || payload?.tenantId;
  const existing = await JournalEntry.findOne({
    sourceType: "customer_payment",
    sourceId: payload.refundId,
    status: "posted",
    ...(tenantId ? { tenantId } : {}),
  });
  if (existing) return { status: "posted", journalEntryId: existing._id };
  const [treasury, receivable] = await Promise.all([
    resolveTreasury(payload),
    resolveAccountingAccount({ tenantId, settingsField: "receivableAccount", fallbackCode: "1100" }),
  ]);
  const journal = await createPostedJournal({
    tenantId,
    date: payload.refundDate,
    sourceType: "customer_payment",
    sourceId: payload.refundId,
    reference: payload.reference || payload.returnNumber,
    memo: `Customer refund for ${payload.returnNumber}`,
    currency: payload.currency,
    voucherType: "payment",
    paymentMode: treasury.paymentMode,
    treasuryAccountType: treasury.type,
    cashAccount: treasury.type === "cash" ? treasury.id : null,
    bankAccount: treasury.type === "bank" ? treasury.id : null,
    origin: "system",
    userId: payload.performedBy,
    lines: [
      { account: receivable._id, debit: payload.amount, credit: 0, description: payload.returnNumber, contactType: "customer", contactId: payload.customerId },
      { account: treasury.ledger._id, debit: 0, credit: payload.amount, description: treasury.name },
    ],
  });
  if (treasury.type === "bank") {
    await BankTransaction.create({
      bankAccount: treasury.id, kind: "withdrawal", direction: "out", amount: payload.amount,
      transactionDate: parsePostingDate(payload.refundDate) || new Date(), reference: payload.reference || payload.returnNumber,
      description: `Customer refund for ${payload.returnNumber}`, status: "posted", sourceType: "customer_payment",
      journalEntry: journal._id, sourceId: payload.refundId, createdBy: payload.performedBy, updatedBy: payload.performedBy,
    });
  }
  return { status: "posted", journalEntryId: journal._id };
};

export const markDealWon = async (_req, payload) => {
  if (!isId(payload.dealId)) return null;
  const deal = await Deal.findById(payload.dealId);
  if (!deal) throw new SalesError("The linked CRM deal was not found.", 404);
  deal.stage = "won";
  deal.probability = 100;
  deal.wonAt = payload.wonAt || new Date();
  deal.wonReason = `Converted to sales order ${payload.salesOrderId}`;
  deal.lastStageChangedAt = new Date();
  deal.lastActivityAt = new Date();
  await deal.save();
  return deal;
};

export const logCrmActivity = async (_req, payload) => {
  if (!payload.dealId && !payload.customerId && !payload.leadId) return null;
  return Activity.create({
    leadId: payload.leadId || null,
    dealId: payload.dealId || null,
    customerId: payload.customerId || null,
    type: "note",
    status: "completed",
    title: payload.title || (payload.type === "sales_order_confirmed" ? "Sales order confirmed" : "Sales quotation updated"),
    body: payload.description || payload.type || "Sales activity",
    completedAt: new Date(),
    source: "system",
    autoGenerated: true,
    createdBy: payload.performedBy,
    assignedTo: payload.performedBy,
  });
};

export const convertLeadAndGenerateWonDeal = async (req, { quotation, session = null }) => {
  const tenantId = req?.tenantId || quotation?.tenantId;
  let customerId = quotation.customerId;
  let dealId = quotation.dealId;

  // A quotation linked to a lead may only be used after the lead conversion
  // transaction has created its customer. Acceptance alone never enters here.
  if (quotation.leadId) {
    const lead = await Lead.findById(quotation.leadId).session(session);
    if (!lead || lead.pipelineStage !== "won" || !lead.customerId) {
      throw new SalesError("Win the lead through Negotiation before creating sales records.", 409);
    }
    customerId = customerId || lead.customerId;
  }

  // 2. Automatically create or link Deal with status = WON
  if (customerId && !dealId) {
    const dealFilter = { quotationId: quotation._id, ...(tenantId ? { tenantId } : {}) };
    let deal = await Deal.findOne(dealFilter).session(session);

    if (!deal) {
      const dealData = {
        dealNo: await nextAccountingNumber("deal", new Date(), { tenantId, session }),
        title: quotation.notes || `Deal for Quotation ${quotation.quotationNumber}`,
        customerId,
        leadId: quotation.leadId || null,
        quotationId: quotation._id,
        stage: "won",
        probability: 100,
        currency: quotation.currency || "BDT",
        grandTotal: quotation.totals?.grandTotal || 0,
        subtotal: quotation.totals?.subtotal || 0,
        taxTotal: quotation.totals?.taxTotal || 0,
        discountTotal: quotation.totals?.discountTotal || 0,
        items: (quotation.lines || []).map((line) => ({
          productId: line.productId,
          nameSnapshot: line.name,
          qty: line.quantity,
          unitPrice: line.unitPrice,
          discount: line.lineDiscount || 0,
          lineTotal: line.lineTotal || 0,
        })),
        ownerId: quotation.salespersonId || req?.user?._id,
        wonAt: new Date(),
        wonReason: `Quotation ${quotation.quotationNumber} accepted`,
        createdBy: req?.user?._id || quotation.createdBy,
      };
      if (tenantId) dealData.tenantId = tenantId;

      [deal] = await Deal.create([dealData], session ? { session } : undefined);
    } else {
      deal.stage = "won";
      deal.probability = 100;
      deal.wonAt = new Date();
      deal.wonReason = `Quotation ${quotation.quotationNumber} accepted`;
      await deal.save(session ? { session } : undefined);
    }
    dealId = deal._id;
  }

  return { customerId, dealId };
};
