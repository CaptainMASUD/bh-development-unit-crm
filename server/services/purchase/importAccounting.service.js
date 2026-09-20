import BankAccount from "../../models/bankAccount.model.js";
import BankTransaction from "../../models/bankTransaction.model.js";
import AccountingSettings from "../../models/accountingSettings.model.js";
import VendorBill from "../../models/vendorBill.model.js";
import {
  createPostedJournal,
  resolveAccountingAccount,
  roundMoney,
} from "../../services/accountingPosting.service.js";

const withSession = (query, session) => (session ? query.session(session) : query);
const saveOptions = (session) => (session ? { session } : undefined);
const clean = (value) => String(value ?? "").trim();

const getAccountingCurrency = async (session = null) => {
  const query = AccountingSettings.findOne({ key: "company" }).select("currency");
  if (session) query.session(session);
  const settings = await query.lean();
  return clean(settings?.currency || "BDT").toUpperCase();
};

const resolveBankTreasury = async (bankAccountId, session = null) => {
  const bank = await withSession(
    BankAccount.findOne({ _id: bankAccountId, status: "active" }).populate(
      "ledgerAccount",
      "code name type currency isActive isGroup"
    ),
    session
  ).lean();
  if (!bank?.ledgerAccount || bank.ledgerAccount.type !== "asset" || bank.ledgerAccount.isActive === false || bank.ledgerAccount.isGroup) {
    throw Object.assign(new Error("Select an active bank account linked to an active asset ledger account."), { statusCode: 409 });
  }
  return bank;
};

const createBankOutflow = async ({ bankAccount, amount, reference, description, sourceType, sourceId, journalEntry, userId, session }) => {
  const [transaction] = await BankTransaction.create(
    [
      {
        bankAccount: bankAccount._id,
        kind: sourceType === "lc_charge" ? "bank_charge" : "withdrawal",
        direction: "out",
        amount,
        transactionDate: new Date(),
        reference,
        description,
        sourceType,
        sourceId,
        journalEntry: journalEntry?._id || null,
        createdBy: userId,
        updatedBy: userId,
      },
    ],
    saveOptions(session)
  );
  return transaction;
};

export const postLCMarginAccounting = async ({ lc, userId = null, session = null }) => {
  if (lc.marginJournalEntry) return withSession((await import("../../models/journalEntry.model.js")).default.findById(lc.marginJournalEntry), session);
  if (!lc.bankAccount) throw Object.assign(new Error("A bank account is required before posting LC margin."), { statusCode: 409 });

  const bank = await resolveBankTreasury(lc.bankAccount, session);
  const baseCurrency = await getAccountingCurrency(session);
  const bankCurrency = clean(bank.currency || baseCurrency).toUpperCase();
  const lcCurrency = clean(lc.currency || "USD").toUpperCase();
  let amount;
  if (bankCurrency === baseCurrency) amount = roundMoney(lc.marginBaseAmount || 0);
  else if (bankCurrency === lcCurrency) amount = roundMoney(lc.marginAmount || 0);
  else throw Object.assign(new Error("LC margin bank account currency must match either the accounting currency or the LC currency."), { statusCode: 409 });
  if (amount <= 0) return null;
  const marginAccount = await resolveAccountingAccount({
    tenantId: lc.tenantId || null,
    settingsField: "lcMarginAccount",
    fallbackCode: "1320",
    session,
  });
  const reference = lc.lcNumber || lc.applicationNo;
  const memo = `LC margin lodged for ${reference}`;
  const journal = await createPostedJournal({
    tenantId: lc.tenantId || null,
    date: lc.openedDate || new Date(),
    sourceType: "lc_margin",
    sourceId: lc._id,
    voucherType: "contra",
    reference,
    memo,
    currency: bankCurrency,
    paymentMode: "bank",
    treasuryAccountType: "bank",
    bankAccount: bank._id,
    userId,
    session,
    lines: [
      { account: marginAccount._id, debit: amount, credit: 0, description: memo },
      { account: bank.ledgerAccount._id, debit: 0, credit: amount, description: bank.accountName },
    ],
  });
  const transaction = await createBankOutflow({
    bankAccount: bank,
    amount,
    reference,
    description: memo,
    sourceType: "lc_margin",
    sourceId: lc._id,
    journalEntry: journal,
    userId,
    session,
  });
  lc.marginJournalEntry = journal._id;
  lc.marginBankTransaction = transaction._id;
  await lc.save(saveOptions(session));
  return journal;
};

export const postLCChargeAccounting = async ({ lc, charge, userId = null, session = null }) => {
  if (charge.journalEntry) return null;
  const amount = roundMoney(charge.baseAmount || Number(charge.amount || 0) * Number(charge.exchangeRate || 1));
  if (amount <= 0) throw Object.assign(new Error("LC charge amount must be greater than zero."), { statusCode: 400 });
  const bankAccountId = charge.bankAccount || lc.bankAccount;
  if (!bankAccountId) throw Object.assign(new Error("A bank account is required to post an LC/import charge."), { statusCode: 409 });
  const bank = await resolveBankTreasury(bankAccountId, session);
  const baseCurrency = await getAccountingCurrency(session);
  const bankCurrency = clean(bank.currency || baseCurrency).toUpperCase();
  const chargeCurrency = clean(charge.currency || lc.currency || baseCurrency).toUpperCase();
  let postingAmount;
  if (bankCurrency === baseCurrency) postingAmount = amount;
  else if (bankCurrency === chargeCurrency) postingAmount = roundMoney(charge.amount);
  else throw Object.assign(new Error("LC charge bank account currency must match either the accounting currency or the charge currency."), { statusCode: 409 });
  const debitAccount = await resolveAccountingAccount({
    tenantId: lc.tenantId || null,
    settingsField: charge.capitalize === false ? "importChargesExpenseAccount" : "importCostClearingAccount",
    fallbackCode: charge.capitalize === false ? "5130" : "1330",
    session,
  });
  const reference = clean(charge.reference) || `${lc.lcNumber || lc.applicationNo}-${String(charge._id).slice(-6).toUpperCase()}`;
  const memo = charge.description || `${charge.chargeType.replaceAll("_", " ")} for ${lc.lcNumber || lc.applicationNo}`;
  const journal = await createPostedJournal({
    tenantId: lc.tenantId || null,
    date: charge.chargedAt || new Date(),
    sourceType: "lc_charge",
    sourceId: charge._id,
    voucherType: "payment",
    reference,
    memo,
    currency: bankCurrency,
    paymentMode: "bank",
    treasuryAccountType: "bank",
    bankAccount: bank._id,
    userId,
    session,
    lines: [
      { account: debitAccount._id, debit: postingAmount, credit: 0, description: memo },
      { account: bank.ledgerAccount._id, debit: 0, credit: postingAmount, description: bank.accountName },
    ],
  });
  const transaction = await createBankOutflow({
    bankAccount: bank,
    amount: postingAmount,
    reference,
    description: memo,
    sourceType: "lc_charge",
    sourceId: charge._id,
    journalEntry: journal,
    userId,
    session,
  });
  charge.journalEntry = journal._id;
  charge.bankTransaction = transaction._id;
  charge.bankAccount = bank._id;
  await lc.save(saveOptions(session));
  return { journal, bankTransaction: transaction };
};

export const postLCSettlementAccounting = async ({ lc, settlement, userId = null, session = null }) => {
  if (settlement.journalEntry) return null;
  const bill = await withSession(VendorBill.findById(settlement.vendorBill), session);
  if (!bill) throw Object.assign(new Error("Supplier bill not found for LC settlement."), { statusCode: 404 });
  if (!["approved", "partially_paid"].includes(bill.status)) {
    throw Object.assign(new Error("Supplier bill must be approved before LC settlement."), { statusCode: 409 });
  }
  if (bill.purchaseOrder && String(bill.purchaseOrder) !== String(lc.purchaseOrder)) {
    throw Object.assign(new Error("Supplier bill does not belong to the LC purchase order."), { statusCode: 409 });
  }
  if (bill.supplier && String(bill.supplier) !== String(lc.supplier)) {
    throw Object.assign(new Error("Supplier bill does not belong to the LC supplier."), { statusCode: 409 });
  }
  const amount = roundMoney(settlement.amount);
  if (amount <= 0 || amount > Number(bill.dueTotal || 0) + 0.009) {
    throw Object.assign(new Error("LC settlement amount must be greater than zero and cannot exceed the supplier bill due."), { statusCode: 400 });
  }
  const bank = await resolveBankTreasury(settlement.bankAccount, session);
  if (clean(bank.currency).toUpperCase() !== clean(bill.currency).toUpperCase()) {
    throw Object.assign(new Error("The settlement bank account currency must match the supplier bill currency."), { statusCode: 409 });
  }

  const reference = clean(settlement.reference) || lc.lcNumber || lc.applicationNo;
  const memo = clean(settlement.note) || `LC settlement for ${lc.lcNumber || lc.applicationNo}`;
  const journal = await createPostedJournal({
    tenantId: lc.tenantId || null,
    date: settlement.settledAt || new Date(),
    sourceType: "lc_settlement",
    sourceId: settlement._id,
    voucherType: "payment",
    reference,
    memo,
    currency: bill.currency,
    paymentMode: "bank",
    treasuryAccountType: "bank",
    bankAccount: bank._id,
    partyType: "supplier",
    partyId: lc.supplier,
    partyName: bill.vendorName,
    userId,
    session,
    lines: [
      { account: bill.payableAccount, debit: amount, credit: 0, description: bill.vendorName, contactType: "vendor", contactId: lc.supplier },
      { account: bank.ledgerAccount._id, debit: 0, credit: amount, description: bank.accountName },
    ],
  });
  journal.partyType = "supplier";
  journal.partyId = lc.supplier;
  journal.partyName = bill.vendorName;
  journal.linkedDocuments = [{ documentType: "supplier_bill", documentId: bill._id, appliedAmount: amount }];
  journal.settlementAppliedAt = new Date();
  await journal.save(saveOptions(session));

  const transaction = await createBankOutflow({
    bankAccount: bank,
    amount,
    reference,
    description: memo,
    sourceType: "lc_settlement",
    sourceId: settlement._id,
    journalEntry: journal,
    userId,
    session,
  });

  bill.payments.push({
    amount,
    paidAt: settlement.settledAt || new Date(),
    bankAccount: bank._id,
    journalEntry: journal._id,
    reference,
    note: memo,
    paidBy: userId,
  });
  await bill.save(saveOptions(session));

  settlement.journalEntry = journal._id;
  settlement.bankTransaction = transaction._id;
  settlement.bankAccount = bank._id;
  await lc.save(saveOptions(session));
  return { journal, bankTransaction: transaction, vendorBill: bill };
};

export const postLandedCostAccounting = async ({ landedCost, userId = null, session = null }) => {
  if (landedCost.journalEntry) return null;
  const amount = roundMoney(landedCost.allocatedTotal || landedCost.totalLandedCost || 0);
  if (amount <= 0) return null;
  const accountingCurrency = await getAccountingCurrency(session);
  const [inventoryAccount, clearingAccount] = await Promise.all([
    resolveAccountingAccount({ tenantId: landedCost.tenantId || null, settingsField: "inventoryAccount", fallbackCode: "1300", session }),
    resolveAccountingAccount({ tenantId: landedCost.tenantId || null, settingsField: "importCostClearingAccount", fallbackCode: "1330", session }),
  ]);
  const memo = `Landed cost capitalization ${landedCost.landedCostNo}`;
  return createPostedJournal({
    tenantId: landedCost.tenantId || null,
    date: landedCost.finalizedAt || new Date(),
    sourceType: "landed_cost",
    sourceId: landedCost._id,
    voucherType: "purchase",
    reference: landedCost.landedCostNo,
    memo,
    currency: accountingCurrency,
    userId,
    session,
    lines: [
      { account: inventoryAccount._id, debit: amount, credit: 0, description: memo },
      { account: clearingAccount._id, debit: 0, credit: amount, description: memo },
    ],
  });
};
