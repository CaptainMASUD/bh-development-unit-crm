import mongoose from "mongoose";
import Activity from "../models/activity.model.js";
import Deal from "../models/deal.model.js";
import BankAccount from "../models/bankAccount.model.js";
import BankTransaction from "../models/bankTransaction.model.js";
import CashAccount from "../models/cashAccount.model.js";
import JournalEntry from "../models/journalEntry.model.js";
import StockMovement from "../models/inventory/stockMovement.model.js";
import { DeliveryNote } from "../models/sales/deliveryNote.model.js";
import { createPostedJournal, parsePostingDate, resolveAccountingAccount, roundMoney } from "./accountingPosting.service.js";
import { runSalesTransaction } from "./salesTransaction.service.js";
import { SalesError } from "../utils/salesError.js";

const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const sessionOptions = (session) => session ? { session } : undefined;
const withSession = (query, session) => session ? query.session(session) : query;

const requireAtomicInventorySession = (session) => {
  if (!session) {
    throw new SalesError(
      "Inventory posting requires MongoDB replica-set transactions. Configure MongoDB as a replica set before confirming or dispatching sales orders.",
      409
    );
  }
};

const existingPostedMovement = async (idempotencyKey, session = null) =>
  withSession(StockMovement.findOne({ idempotencyKey, status: "posted" }), session);

const createAndPostMovement = async ({
  movementType,
  reference,
  sourceType,
  sourceId,
  idempotencyKey,
  currency = "BDT",
  reason,
  lines,
  userId,
}) => runSalesTransaction(async (session) => {
  requireAtomicInventorySession(session);
  const existing = await existingPostedMovement(idempotencyKey, session);
  if (existing) return existing;

  const [movement] = await StockMovement.create([{
    movementType,
    status: "draft",
    reference,
    sourceType,
    sourceId,
    idempotencyKey,
    currency,
    reason,
    lines,
    createdBy: userId,
    updatedBy: userId,
  }], { session });
  return StockMovement.postMovementDocument({ movementId: movement._id, userId, session });
});

export const reserveInventory = async (_req, payload) => {
  const movement = await createAndPostMovement({
    movementType: "reservation",
    reference: payload.referenceNumber,
    sourceType: "sales_order_reservation",
    sourceId: payload.salesOrderId,
    idempotencyKey: `sales:reserve:${payload.salesOrderId}`,
    reason: `Stock reserved for sales order ${payload.referenceNumber}`,
    userId: payload.performedBy,
    lines: payload.lines.map((line) => ({
      product: line.productId,
      effect: "reserve",
      sourceWarehouse: line.warehouseId || payload.warehouseId,
      quantity: line.quantity,
      note: `Sales order line ${line.orderLineId}`,
    })),
  });
  return { status: "reserved", reservationId: movement._id, stockMovementId: movement._id };
};

export const releaseInventory = async (_req, payload) => {
  if (!isId(payload.reservationId)) return { status: "released", reversalMovementId: null };
  return runSalesTransaction(async (session) => {
    requireAtomicInventorySession(session);
    const reservation = await withSession(StockMovement.findById(payload.reservationId), session);
    if (!reservation) return { status: "released", reversalMovementId: null };
    if (reservation.status === "reversed") {
      return { status: "released", reversalMovementId: reservation.reversedBy || null };
    }
    const reversal = await StockMovement.reverseMovementDocument({
      movementId: reservation._id,
      userId: payload.performedBy,
      reason: `Sales order reservation released for ${payload.salesOrderId}`,
      session,
    });
    return { status: "released", reversalMovementId: reversal._id };
  });
};

export const issueInventory = async (_req, payload) => {
  const movement = await createAndPostMovement({
    movementType: "sales_issue",
    reference: payload.referenceNumber,
    sourceType: "sales_delivery",
    sourceId: payload.deliveryNoteId,
    idempotencyKey: `sales:issue:${payload.deliveryNoteId}`,
    reason: `Goods dispatched for delivery ${payload.referenceNumber}`,
    userId: payload.performedBy,
    lines: payload.lines.flatMap((line) => [
      {
        product: line.productId,
        effect: "release",
        sourceWarehouse: payload.warehouseId,
        quantity: line.quantity,
        note: `Release reservation for sales order line ${line.orderLineId}`,
      },
      {
        product: line.productId,
        effect: "out",
        sourceWarehouse: payload.warehouseId,
        quantity: line.quantity,
        lotNumber: clean(line.lotNumber || line.batchId),
        serialNumbers: line.serialNumbers || [],
        note: `Delivery line for sales order ${payload.salesOrderId}`,
      },
    ]),
  });
  return { status: "posted", stockMovementId: movement._id, totalValue: movement.totalValue };
};

export const receiveSalesReturn = async (_req, payload) => {
  const restockLines = (payload.lines || []).filter((line) => line.restock);
  if (!restockLines.length) return { status: "not_required", stockMovementId: null, totalValue: 0 };
  const movement = await createAndPostMovement({
    movementType: "sales_return",
    reference: payload.returnNumber,
    sourceType: "sales_return",
    sourceId: payload.returnId,
    idempotencyKey: `sales:return:${payload.returnId}`,
    reason: payload.reason || `Customer return ${payload.returnNumber}`,
    userId: payload.performedBy,
    lines: restockLines.map((line) => ({
      product: line.productId,
      effect: "in",
      destinationWarehouse: payload.warehouseId,
      quantity: line.quantity,
      requestedUnitCost: line.unitCost,
      note: `Customer return ${payload.returnNumber}: ${line.reason}`,
    })),
  });
  return { status: "posted", stockMovementId: movement._id, totalValue: movement.totalValue };
};

export const postSalesReturnToAccounting = async (_req, payload) => {
  const existing = await JournalEntry.findOne({ sourceType: "invoice", sourceId: payload.returnId, status: "posted" });
  if (existing) return { status: "posted", journalEntryId: existing._id };
  const [receivable, revenue, vatPayable, inventory, cogs] = await Promise.all([
    resolveAccountingAccount("receivableAccount", "1100"),
    resolveAccountingAccount("salesAccount", "4000"),
    resolveAccountingAccount("vatPayableAccount", "2100"),
    resolveAccountingAccount("inventoryAccount", "1300"),
    resolveAccountingAccount("cogsAccount", "5020"),
  ]);
  const lines = [
    { account: revenue._id, debit: payload.netAmount, credit: 0, description: `Sales return ${payload.returnNumber}`, contactType: "customer", contactId: payload.customerId },
    { account: receivable._id, debit: 0, credit: payload.totalAmount, description: `Credit note ${payload.returnNumber}`, contactType: "customer", contactId: payload.customerId },
  ];
  if (payload.taxAmount > 0) lines.push({ account: vatPayable._id, debit: payload.taxAmount, credit: 0, description: `VAT reversal ${payload.returnNumber}`, contactType: "customer", contactId: payload.customerId });
  if (payload.inventoryValue > 0) {
    lines.push(
      { account: inventory._id, debit: payload.inventoryValue, credit: 0, description: `Returned inventory ${payload.returnNumber}` },
      { account: cogs._id, debit: 0, credit: payload.inventoryValue, description: `COGS reversal ${payload.returnNumber}` }
    );
  }
  const journal = await createPostedJournal({
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

const invoiceCost = async ({ salesOrderId, deliveryNoteIds, lines }) => {
  const deliveryFilter = deliveryNoteIds?.length
    ? { _id: { $in: deliveryNoteIds }, salesOrderId }
    : { salesOrderId, status: { $in: ["delivered", "partially_delivered"] } };
  const deliveries = await DeliveryNote.find(deliveryFilter).select("inventoryPosting.stockMovementId").lean();
  const movementIds = deliveries.map((item) => item.inventoryPosting?.stockMovementId).filter(isId);
  if (!movementIds.length) return { total: 0, unitCosts: {} };
  const movements = await StockMovement.find({ _id: { $in: movementIds }, status: "posted" }).select("lines").lean();
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
  return { total, unitCosts };
};

export const postInvoiceToAccounting = async (_req, payload) => {
  const existing = await JournalEntry.findOne({
    sourceType: "invoice",
    sourceId: payload.invoiceId,
    status: { $in: ["posted", "reversed"] },
    reversalOf: null,
  });
  if (existing) {
    if (existing.status === "reversed") throw new SalesError("This invoice posting has already been reversed.", 409);
    return { status: "posted", journalEntryId: existing._id, cogsAmount: 0 };
  }

  const [receivable, revenue, vatPayable, inventory, cogs] = await Promise.all([
    resolveAccountingAccount("receivableAccount", "1100"),
    resolveAccountingAccount("salesAccount", "4000"),
    resolveAccountingAccount("vatPayableAccount", "2100"),
    resolveAccountingAccount("inventoryAccount", "1300"),
    resolveAccountingAccount("cogsAccount", "5020"),
  ]);
  const taxAmount = roundMoney(payload.totals?.taxTotal);
  const grandTotal = roundMoney(payload.totals?.grandTotal);
  const netRevenue = roundMoney(grandTotal - taxAmount);
  const cost = await invoiceCost(payload);
  const cogsAmount = cost.total;
  const description = `Sales invoice ${payload.invoiceNumber}`;
  const lines = [
    { account: receivable._id, debit: grandTotal, credit: 0, description, contactType: "customer", contactId: payload.customerId },
    { account: revenue._id, debit: 0, credit: netRevenue, description, contactType: "customer", contactId: payload.customerId },
  ];
  if (taxAmount > 0) lines.push({ account: vatPayable._id, debit: 0, credit: taxAmount, description: `Output VAT - ${payload.invoiceNumber}`, contactType: "customer", contactId: payload.customerId });
  if (cogsAmount > 0) {
    lines.push(
      { account: cogs._id, debit: cogsAmount, credit: 0, description: `COGS - ${payload.invoiceNumber}` },
      { account: inventory._id, debit: 0, credit: cogsAmount, description: `Inventory issued - ${payload.invoiceNumber}` }
    );
  }
  const journal = await createPostedJournal({
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
  return { status: "posted", journalEntryId: journal._id, cogsAmount, unitCosts: cost.unitCosts };
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
  const existing = await JournalEntry.findOne({ sourceType: "customer_payment", sourceId: payload.paymentId, status: "posted" });
  if (existing) return { journalEntryId: existing._id, status: "posted", cashAccount: existing.cashAccount, bankAccount: existing.bankAccount };
  const [treasury, receivable] = await Promise.all([
    resolveTreasury(payload),
    resolveAccountingAccount("receivableAccount", "1100"),
  ]);
  const journal = await createPostedJournal({
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
  const existing = await JournalEntry.findOne({ sourceType: "customer_payment", sourceId: payload.refundId, status: "posted" });
  if (existing) return { status: "posted", journalEntryId: existing._id };
  const [treasury, receivable] = await Promise.all([
    resolveTreasury(payload), resolveAccountingAccount("receivableAccount", "1100"),
  ]);
  const journal = await createPostedJournal({
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
  if (!payload.dealId && !payload.customerId) return null;
  return Activity.create({
    dealId: payload.dealId || null,
    customerId: payload.customerId || null,
    type: "note",
    status: "completed",
    title: payload.type === "sales_order_confirmed" ? "Sales order confirmed" : "Sales quotation updated",
    body: payload.description || payload.type || "Sales activity",
    completedAt: new Date(),
    source: "system",
    autoGenerated: true,
    createdBy: payload.performedBy,
    assignedTo: payload.performedBy,
  });
};
