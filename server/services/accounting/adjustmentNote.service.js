import mongoose from "mongoose";
import AdjustmentNote from "../../models/accounting/adjustmentNote.model.js";
import SalesInvoice from "../../models/sales/salesInvoice.model.js";
import VendorBill from "../../models/accounting/vendorBill.model.js";
import SalesReturn from "../../models/sales/salesReturn.model.js";
import PurchaseReturn from "../../models/purchase/purchaseReturn.model.js";
import JournalEntry from "../../models/accounting/journalEntry.model.js";
import Customer from "../../models/customer.model.js";
import Supplier from "../../models/supplier.model.js";
import { runMongoTransaction } from "../../utils/mongoTransaction.js";
import { writeAudit } from "../../utils/audit.js";
import { nextAccountingNumber } from "./accountingNumbering.service.js";
import {
  createPostedJournal,
  createReversalJournal,
  resolveAccountingAccount,
  assertAccountingPeriodOpen,
  roundMoney,
} from "./accountingPosting.service.js";
import { validatePostingDimensions } from "./accountingDimension.service.js";
import {
  applyAdjustmentToSchedule,
  reverseAdjustmentFromSchedule,
} from "./paymentTerms.service.js";

const clean = (val) => String(val ?? "").trim();
const isId = (val) => mongoose.Types.ObjectId.isValid(String(val || ""));

/**
 * Calculates remaining eligible adjustment amounts and line quantities for a source document.
 */
export const calculateEligibleAdjustment = async ({
  documentType,
  documentId,
  tenantId = null,
  excludeNoteId = null,
  session = null,
}) => {
  if (!isId(documentId)) {
    throw Object.assign(new Error("Invalid document ID."), { statusCode: 400 });
  }

  const queryFilter = { _id: documentId, ...(tenantId ? { tenantId } : {}) };

  if (documentType === "SalesInvoice") {
    const docQuery = SalesInvoice.findOne(queryFilter);
    if (session) docQuery.session(session);
    const invoice = await docQuery.lean();
    if (!invoice) {
      throw Object.assign(new Error("Sales invoice was not found."), { statusCode: 404 });
    }

    if (["void", "cancelled"].includes(invoice.status)) {
      throw Object.assign(new Error("Cannot create adjustment notes against a voided or cancelled invoice."), { statusCode: 409 });
    }

    const noteFilter = {
      originalDocumentType: "SalesInvoice",
      originalDocumentId: invoice._id,
      status: { $in: ["draft", "approved", "posted"] },
      ...(tenantId ? { tenantId } : {}),
      ...(excludeNoteId ? { _id: { $ne: excludeNoteId } } : {}),
    };
    const notesQuery = AdjustmentNote.find(noteFilter).lean();
    if (session) notesQuery.session(session);
    const existingNotes = await notesQuery;

    let cumulativeCredited = 0;
    let cumulativeDebited = 0;
    const lineCreditedMap = new Map();

    for (const note of existingNotes) {
      if (note.noteType === "credit_note") {
        cumulativeCredited += Number(note.totals?.grandTotal || 0);
        for (const line of note.lines || []) {
          if (line.sourceLineId) {
            const key = String(line.sourceLineId);
            lineCreditedMap.set(key, (lineCreditedMap.get(key) || 0) + Number(line.quantity || 0));
          }
        }
      } else if (note.noteType === "debit_note") {
        cumulativeDebited += Number(note.totals?.grandTotal || 0);
      }
    }

    cumulativeCredited = roundMoney(cumulativeCredited);
    cumulativeDebited = roundMoney(cumulativeDebited);

    const originalTotal = roundMoney(invoice.totals?.grandTotal ?? invoice.grandTotal ?? invoice.totalAmount ?? 0);
    const maxAdjustableTotal = roundMoney(originalTotal + cumulativeDebited);
    const remainingCreditEligible = roundMoney(Math.max(maxAdjustableTotal - cumulativeCredited, 0));

    const eligibleLines = (invoice.lines || []).map((line) => {
      const creditedQty = lineCreditedMap.get(String(line._id)) || 0;
      const originalQty = Number(line.quantity || 0);
      const remainingQty = Math.max(originalQty - creditedQty, 0);
      return {
        sourceLineId: line._id,
        productId: line.productId,
        sku: line.sku,
        name: line.name,
        description: line.description,
        originalQuantity: originalQty,
        creditedQuantity: creditedQty,
        remainingQuantity: remainingQty,
        unitPrice: line.unitPrice,
        taxRate: line.taxRate || 0,
        originalLineTotal: line.lineTotal,
      };
    });

    return {
      documentType: "SalesInvoice",
      documentId: invoice._id,
      documentNumber: invoice.invoiceNumber,
      documentDate: invoice.invoiceDate,
      partyType: "customer",
      partyId: invoice.customerId,
      status: invoice.status,
      currency: "BDT",
      originalTotal,
      paidAmount: invoice.paidAmount || 0,
      dueAmount: invoice.dueAmount || 0,
      cumulativeCredited,
      cumulativeDebited,
      remainingCreditEligible,
      branchId: invoice.branchId,
      lines: eligibleLines,
    };
  }

  if (documentType === "VendorBill") {
    const docQuery = VendorBill.findOne(queryFilter);
    if (session) docQuery.session(session);
    const bill = await docQuery.lean();
    if (!bill) {
      throw Object.assign(new Error("Vendor bill was not found."), { statusCode: 404 });
    }

    if (["void"].includes(bill.status)) {
      throw Object.assign(new Error("Cannot create adjustment notes against a voided vendor bill."), { statusCode: 409 });
    }

    const noteFilter = {
      originalDocumentType: "VendorBill",
      originalDocumentId: bill._id,
      status: { $in: ["draft", "approved", "posted"] },
      ...(tenantId ? { tenantId } : {}),
      ...(excludeNoteId ? { _id: { $ne: excludeNoteId } } : {}),
    };
    const notesQuery = AdjustmentNote.find(noteFilter).lean();
    if (session) notesQuery.session(session);
    const existingNotes = await notesQuery;

    let cumulativeCredited = 0;
    let cumulativeDebited = 0;

    for (const note of existingNotes) {
      if (note.noteType === "credit_note") {
        cumulativeCredited += Number(note.totals?.grandTotal || 0);
      } else if (note.noteType === "debit_note") {
        cumulativeDebited += Number(note.totals?.grandTotal || 0);
      }
    }

    cumulativeCredited = roundMoney(cumulativeCredited);
    cumulativeDebited = roundMoney(cumulativeDebited);

    const originalTotal = roundMoney(bill.total || 0);
    const maxAdjustableTotal = roundMoney(originalTotal + cumulativeDebited);
    const remainingCreditEligible = roundMoney(Math.max(maxAdjustableTotal - cumulativeCredited, 0));

    return {
      documentType: "VendorBill",
      documentId: bill._id,
      documentNumber: bill.billNo,
      documentDate: bill.billDate,
      partyType: "supplier",
      partyId: bill.supplier,
      partyName: bill.vendorName,
      status: bill.status,
      currency: bill.currency || "BDT",
      originalTotal,
      paidAmount: bill.paidTotal || 0,
      dueAmount: bill.dueTotal || 0,
      cumulativeCredited,
      cumulativeDebited,
      remainingCreditEligible,
      expenseAccount: bill.expenseAccount,
      payableAccount: bill.payableAccount,
    };
  }

  throw Object.assign(new Error("Unsupported document type for adjustment."), { statusCode: 400 });
};

/**
 * Creates a new AdjustmentNote in Draft status (or directly posted if requested).
 */
export const createAdjustmentNote = async (data = {}, user = null, tenantId = null) => {
  const noteType = clean(data.noteType).toLowerCase();
  if (!["credit_note", "debit_note"].includes(noteType)) {
    throw Object.assign(new Error("Valid noteType ('credit_note' or 'debit_note') is required."), { statusCode: 400 });
  }

  const sourceSide = clean(data.sourceSide || (data.originalDocumentType === "SalesInvoice" ? "sales" : "purchase")).toLowerCase();
  if (!["sales", "purchase"].includes(sourceSide)) {
    throw Object.assign(new Error("Valid sourceSide ('sales' or 'purchase') is required."), { statusCode: 400 });
  }

  const originalDocumentType = clean(data.originalDocumentType);
  if (!["SalesInvoice", "VendorBill"].includes(originalDocumentType)) {
    throw Object.assign(new Error("Valid originalDocumentType ('SalesInvoice' or 'VendorBill') is required."), { statusCode: 400 });
  }

  const originalDocumentId = data.originalDocumentId;
  if (!isId(originalDocumentId)) {
    throw Object.assign(new Error("Valid originalDocumentId is required."), { statusCode: 400 });
  }

  // Determine explicit financial direction
  let financialDirection = "";
  if (sourceSide === "sales") {
    financialDirection = noteType === "credit_note" ? "DECREASES_RECEIVABLE" : "INCREASES_RECEIVABLE";
  } else {
    financialDirection = noteType === "credit_note" ? "DECREASES_PAYABLE" : "INCREASES_PAYABLE";
  }

  // Calculate eligible limits
  const eligibility = await calculateEligibleAdjustment({
    documentType: originalDocumentType,
    documentId: originalDocumentId,
    tenantId,
  });

  const postingDate = data.postingDate ? new Date(data.postingDate) : new Date();
  if (Number.isNaN(postingDate.getTime())) {
    throw Object.assign(new Error("Valid posting date is required."), { statusCode: 400 });
  }

  // Calculate totals from lines or body
  let subtotal = 0;
  let taxTotal = 0;
  const rawLines = Array.isArray(data.lines) && data.lines.length > 0 ? data.lines : null;
  let processedLines = [];

  if (rawLines) {
    processedLines = rawLines.map((line) => {
      const qty = Number(line.quantity || 1);
      const price = roundMoney(line.unitPrice || 0);
      const adjAmt = line.adjustmentAmount !== undefined ? roundMoney(line.adjustmentAmount) : roundMoney(qty * price);
      const taxRate = Number(line.taxRate || 0);
      const taxAmt = line.taxAmount !== undefined ? roundMoney(line.taxAmount) : roundMoney((adjAmt * taxRate) / 100);
      const lineTot = roundMoney(adjAmt + taxAmt);
      subtotal += adjAmt;
      taxTotal += taxAmt;

      return {
        sourceLineId: isId(line.sourceLineId) ? line.sourceLineId : null,
        productId: isId(line.productId) ? line.productId : null,
        productName: clean(line.productName || line.name),
        sku: clean(line.sku),
        description: clean(line.description),
        quantity: qty,
        unitPrice: price,
        adjustmentAmount: adjAmt,
        taxRate,
        taxAmount: taxAmt,
        totalAmount: lineTot,
        account: isId(line.account) ? line.account : null,
        costCenter: isId(line.costCenter) ? line.costCenter : null,
        department: isId(line.department) ? line.department : null,
        branch: isId(line.branch) ? line.branch : null,
        project: isId(line.project) ? line.project : null,
        dimensions: line.dimensions || new Map(),
        restock: Boolean(line.restock),
      };
    });
  } else {
    subtotal = roundMoney(data.subtotal || data.totals?.subtotal || data.amount || 0);
    taxTotal = roundMoney(data.taxAmount || data.taxTotal || data.totals?.taxTotal || 0);
    const grandTotal = roundMoney(subtotal + taxTotal);
    processedLines = [
      {
        description: clean(data.reason || "General adjustment"),
        quantity: 1,
        unitPrice: subtotal,
        adjustmentAmount: subtotal,
        taxRate: subtotal > 0 ? roundMoney((taxTotal / subtotal) * 100) : 0,
        taxAmount: taxTotal,
        totalAmount: grandTotal,
        costCenter: isId(data.costCenter) ? data.costCenter : null,
        department: isId(data.department) ? data.department : null,
        branch: isId(data.branch) ? data.branch : null,
        project: isId(data.project) ? data.project : null,
        dimensions: data.dimensions || new Map(),
      },
    ];
  }

  subtotal = roundMoney(subtotal);
  taxTotal = roundMoney(taxTotal);
  const grandTotal = roundMoney(subtotal + taxTotal);

  if (grandTotal <= 0) {
    throw Object.assign(new Error("Adjustment note grand total must be greater than zero."), { statusCode: 400 });
  }

  // Prevent over-crediting
  if (noteType === "credit_note") {
    if (grandTotal > eligibility.remainingCreditEligible) {
      throw Object.assign(
        new Error(`Adjustment exceeds eligible remaining balance (${eligibility.remainingCreditEligible.toLocaleString()} BDT).`),
        { statusCode: 409, code: "ADJUSTMENT_EXCEEDS_ELIGIBLE_AMOUNT" }
      );
    }
  }

  // Generate sequence number
  const prefixMap = {
    "sales:credit_note": "scn",
    "sales:debit_note": "sdn",
    "purchase:credit_note": "pcn",
    "purchase:debit_note": "pdn",
  };
  const numberingKey = prefixMap[`${sourceSide}:${noteType}`] || "scn";
  const noteNumber = clean(data.noteNumber) || (await nextAccountingNumber(numberingKey, postingDate));

  const note = new AdjustmentNote({
    tenantId,
    branchId: isId(data.branchId) ? data.branchId : eligibility.branchId || null,
    noteNumber,
    noteType,
    sourceSide,
    financialDirection,
    originalDocumentType,
    originalDocumentId,
    originalDocumentNumber: eligibility.documentNumber,
    partyType: eligibility.partyType,
    partyId: eligibility.partyId,
    partyName: clean(data.partyName || eligibility.partyName),
    postingDate,
    reasonCode: clean(data.reasonCode || "other"),
    reason: clean(data.reason),
    status: "draft",
    lines: processedLines,
    totals: { subtotal, taxTotal, grandTotal },
    hasInventoryMovement: Boolean(data.hasInventoryMovement),
    salesReturnId: isId(data.salesReturnId) ? data.salesReturnId : null,
    purchaseReturnId: isId(data.purchaseReturnId) ? data.purchaseReturnId : null,
    costCenter: isId(data.costCenter) ? data.costCenter : null,
    department: isId(data.department) ? data.department : null,
    branch: isId(data.branch) ? data.branch : null,
    project: isId(data.project) ? data.project : null,
    dimensions: data.dimensions || new Map(),
    createdBy: user?._id || null,
  });

  await note.save();

  if (data.post === true) {
    return postAdjustmentNote(note._id, { date: postingDate }, user, tenantId);
  }

  return note;
};

/**
 * Updates a Draft AdjustmentNote.
 */
export const updateAdjustmentNote = async (id, data = {}, user = null, tenantId = null) => {
  const note = await AdjustmentNote.findOne({ _id: id, ...(tenantId ? { tenantId } : {}) });
  if (!note) {
    throw Object.assign(new Error("Adjustment note was not found."), { statusCode: 404 });
  }

  if (note.status !== "draft") {
    throw Object.assign(new Error("Only draft adjustment notes can be updated."), { statusCode: 409 });
  }

  // Re-verify eligibility excluding this note's prior values
  if (note.noteType === "credit_note") {
    const eligibility = await calculateEligibleAdjustment({
      documentType: note.originalDocumentType,
      documentId: note.originalDocumentId,
      tenantId,
      excludeNoteId: note._id,
    });

    const newSubtotal = data.subtotal !== undefined ? roundMoney(data.subtotal) : note.totals.subtotal;
    const newTaxTotal = data.taxTotal !== undefined ? roundMoney(data.taxTotal) : note.totals.taxTotal;
    const newGrandTotal = roundMoney(newSubtotal + newTaxTotal);

    if (newGrandTotal > eligibility.remainingCreditEligible) {
      throw Object.assign(
        new Error(`Adjustment exceeds eligible remaining balance (${eligibility.remainingCreditEligible.toLocaleString()} BDT).`),
        { statusCode: 409, code: "ADJUSTMENT_EXCEEDS_ELIGIBLE_AMOUNT" }
      );
    }
  }

  if (data.reasonCode) note.reasonCode = clean(data.reasonCode);
  if (data.reason !== undefined) note.reason = clean(data.reason);
  if (data.postingDate) note.postingDate = new Date(data.postingDate);
  if (data.costCenter !== undefined) note.costCenter = isId(data.costCenter) ? data.costCenter : null;
  if (data.department !== undefined) note.department = isId(data.department) ? data.department : null;
  if (data.branch !== undefined) note.branch = isId(data.branch) ? data.branch : null;
  if (data.project !== undefined) note.project = isId(data.project) ? data.project : null;
  if (data.dimensions) note.dimensions = data.dimensions;
  if (user?._id) note.updatedBy = user._id;

  await note.save();
  return note;
};

/**
 * Transitions a draft note to approved.
 */
export const approveAdjustmentNote = async (id, user = null, tenantId = null) => {
  const note = await AdjustmentNote.findOne({ _id: id, ...(tenantId ? { tenantId } : {}) });
  if (!note) {
    throw Object.assign(new Error("Adjustment note was not found."), { statusCode: 404 });
  }

  if (note.status === "approved" || note.status === "posted") {
    return note;
  }

  if (note.status !== "draft") {
    throw Object.assign(new Error(`Cannot approve a note with status ${note.status}.`), { statusCode: 409 });
  }

  note.status = "approved";
  note.approvedBy = user?._id || null;
  note.approvedAt = new Date();
  note.updatedBy = user?._id || null;
  await note.save();

  return note;
};

/**
 * Posts an AdjustmentNote to General Ledger and updates source document balances.
 * Executed atomically in a Mongo transaction with strict Period Lock and dimension validation.
 */
export const postAdjustmentNote = async (id, options = {}, user = null, tenantId = null) => {
  return runMongoTransaction(async (session) => {
    const noteQuery = AdjustmentNote.findOne({ _id: id, ...(tenantId ? { tenantId } : {}) });
    if (session) noteQuery.session(session);
    const note = await noteQuery;

    if (!note) {
      throw Object.assign(new Error("Adjustment note was not found."), { statusCode: 404 });
    }

    if (note.status === "posted") {
      return { note, alreadyPosted: true };
    }

    if (note.status === "cancelled") {
      throw Object.assign(new Error("Cannot post a cancelled adjustment note."), { statusCode: 409, code: "NOTE_ALREADY_CANCELLED" });
    }

    const postingDate = options.date ? new Date(options.date) : note.postingDate || new Date();
    if (Number.isNaN(postingDate.getTime())) {
      throw Object.assign(new Error("Valid posting date is required."), { statusCode: 400 });
    }

    // Verify Period Closing & Lock
    await assertAccountingPeriodOpen(postingDate, {
      session,
      tenantId: note.tenantId,
      user,
      overrideReason: options.overrideReason || "",
    });

    // Re-verify remaining eligible balance inside the transaction
    const eligibility = await calculateEligibleAdjustment({
      documentType: note.originalDocumentType,
      documentId: note.originalDocumentId,
      tenantId: note.tenantId,
      excludeNoteId: note._id,
      session,
    });

    if (note.noteType === "credit_note") {
      if (note.totals.grandTotal > eligibility.remainingCreditEligible) {
        throw Object.assign(
          new Error(`Adjustment exceeds remaining eligible balance (${eligibility.remainingCreditEligible.toLocaleString()} BDT).`),
          { statusCode: 409, code: "ADJUSTMENT_EXCEEDS_ELIGIBLE_AMOUNT" }
        );
      }
    }

    // Resolve GL accounts based on direction
    const tId = note.tenantId;
    const glLines = [];

    if (note.financialDirection === "DECREASES_RECEIVABLE") {
      // Sales Credit Note: Dr Sales Return (4100/4000), Dr Output VAT (2100), Cr Accounts Receivable (1100)
      const [receivable, revenue, vatPayable] = await Promise.all([
        resolveAccountingAccount({ tenantId: tId, settingsField: "receivableAccount", fallbackCode: "1100", session }),
        resolveAccountingAccount({ tenantId: tId, settingsField: "salesReturnAccount", fallbackCode: "4100", session }).catch(() =>
          resolveAccountingAccount({ tenantId: tId, settingsField: "salesAccount", fallbackCode: "4000", session })
        ),
        resolveAccountingAccount({ tenantId: tId, settingsField: "vatPayableAccount", fallbackCode: "2100", session }),
      ]);

      glLines.push({
        account: revenue._id,
        debit: note.totals.subtotal,
        credit: 0,
        description: `Credit note ${note.noteNumber} - Revenue reduction for ${note.originalDocumentNumber}`,
        contactType: "customer",
        contactId: note.partyId,
        costCenter: note.costCenter,
        department: note.department,
        branch: note.branch,
        project: note.project,
        dimensions: note.dimensions,
      });

      if (note.totals.taxTotal > 0) {
        glLines.push({
          account: vatPayable._id,
          debit: note.totals.taxTotal,
          credit: 0,
          description: `Credit note ${note.noteNumber} - Output VAT reversal`,
          contactType: "customer",
          contactId: note.partyId,
        });
      }

      glLines.push({
        account: receivable._id,
        debit: 0,
        credit: note.totals.grandTotal,
        description: `Credit note ${note.noteNumber} - AR reduction for ${note.originalDocumentNumber}`,
        contactType: "customer",
        contactId: note.partyId,
        costCenter: note.costCenter,
        department: note.department,
        branch: note.branch,
        project: note.project,
        dimensions: note.dimensions,
      });
    } else if (note.financialDirection === "INCREASES_RECEIVABLE") {
      // Sales Debit Note: Dr Accounts Receivable (1100), Cr Sales Revenue (4000), Cr Output VAT (2100)
      const [receivable, revenue, vatPayable] = await Promise.all([
        resolveAccountingAccount({ tenantId: tId, settingsField: "receivableAccount", fallbackCode: "1100", session }),
        resolveAccountingAccount({ tenantId: tId, settingsField: "salesAccount", fallbackCode: "4000", session }),
        resolveAccountingAccount({ tenantId: tId, settingsField: "vatPayableAccount", fallbackCode: "2100", session }),
      ]);

      glLines.push({
        account: receivable._id,
        debit: note.totals.grandTotal,
        credit: 0,
        description: `Debit note ${note.noteNumber} - AR addition for ${note.originalDocumentNumber}`,
        contactType: "customer",
        contactId: note.partyId,
        costCenter: note.costCenter,
        department: note.department,
        branch: note.branch,
        project: note.project,
        dimensions: note.dimensions,
      });

      glLines.push({
        account: revenue._id,
        debit: 0,
        credit: note.totals.subtotal,
        description: `Debit note ${note.noteNumber} - Additional revenue for ${note.originalDocumentNumber}`,
        contactType: "customer",
        contactId: note.partyId,
        costCenter: note.costCenter,
        department: note.department,
        branch: note.branch,
        project: note.project,
        dimensions: note.dimensions,
      });

      if (note.totals.taxTotal > 0) {
        glLines.push({
          account: vatPayable._id,
          debit: 0,
          credit: note.totals.taxTotal,
          description: `Debit note ${note.noteNumber} - Output VAT addition`,
          contactType: "customer",
          contactId: note.partyId,
        });
      }
    } else if (note.financialDirection === "DECREASES_PAYABLE") {
      // Purchase Credit Note: Dr Accounts Payable (2000), Cr Expense/Purchase (5000), Cr Input Tax (1200)
      const [payable, expense, inputTax] = await Promise.all([
        resolveAccountingAccount({ tenantId: tId, settingsField: "payableAccount", fallbackCode: "2000", session }),
        resolveAccountingAccount({ tenantId: tId, settingsField: "expenseAccount", fallbackCode: "5000", session }),
        resolveAccountingAccount({ tenantId: tId, settingsField: "inputTaxAccount", fallbackCode: "1200", session }).catch(() =>
          resolveAccountingAccount({ tenantId: tId, settingsField: "vatPayableAccount", fallbackCode: "2100", session })
        ),
      ]);

      glLines.push({
        account: payable._id,
        debit: note.totals.grandTotal,
        credit: 0,
        description: `Supplier credit note ${note.noteNumber} - AP reduction for ${note.originalDocumentNumber}`,
        contactType: "vendor",
        contactId: note.partyId,
        costCenter: note.costCenter,
        department: note.department,
        branch: note.branch,
        project: note.project,
        dimensions: note.dimensions,
      });

      glLines.push({
        account: expense._id,
        debit: 0,
        credit: note.totals.subtotal,
        description: `Supplier credit note ${note.noteNumber} - Expense reduction for ${note.originalDocumentNumber}`,
        contactType: "vendor",
        contactId: note.partyId,
        costCenter: note.costCenter,
        department: note.department,
        branch: note.branch,
        project: note.project,
        dimensions: note.dimensions,
      });

      if (note.totals.taxTotal > 0) {
        glLines.push({
          account: inputTax._id,
          debit: 0,
          credit: note.totals.taxTotal,
          description: `Supplier credit note ${note.noteNumber} - Input tax reversal`,
          contactType: "vendor",
          contactId: note.partyId,
        });
      }
    } else if (note.financialDirection === "INCREASES_PAYABLE") {
      // Purchase Debit Note: Dr Expense/Purchase (5000), Dr Input Tax (1200), Cr Accounts Payable (2000)
      const [payable, expense, inputTax] = await Promise.all([
        resolveAccountingAccount({ tenantId: tId, settingsField: "payableAccount", fallbackCode: "2000", session }),
        resolveAccountingAccount({ tenantId: tId, settingsField: "expenseAccount", fallbackCode: "5000", session }),
        resolveAccountingAccount({ tenantId: tId, settingsField: "inputTaxAccount", fallbackCode: "1200", session }).catch(() =>
          resolveAccountingAccount({ tenantId: tId, settingsField: "vatPayableAccount", fallbackCode: "2100", session })
        ),
      ]);

      glLines.push({
        account: expense._id,
        debit: note.totals.subtotal,
        credit: 0,
        description: `Supplier debit note ${note.noteNumber} - Additional charge for ${note.originalDocumentNumber}`,
        contactType: "vendor",
        contactId: note.partyId,
        costCenter: note.costCenter,
        department: note.department,
        branch: note.branch,
        project: note.project,
        dimensions: note.dimensions,
      });

      if (note.totals.taxTotal > 0) {
        glLines.push({
          account: inputTax._id,
          debit: note.totals.taxTotal,
          credit: 0,
          description: `Supplier debit note ${note.noteNumber} - Additional input tax`,
          contactType: "vendor",
          contactId: note.partyId,
        });
      }

      glLines.push({
        account: payable._id,
        debit: 0,
        credit: note.totals.grandTotal,
        description: `Supplier debit note ${note.noteNumber} - AP addition for ${note.originalDocumentNumber}`,
        contactType: "vendor",
        contactId: note.partyId,
        costCenter: note.costCenter,
        department: note.department,
        branch: note.branch,
        project: note.project,
        dimensions: note.dimensions,
      });
    }

    const resolvedSourceType =
      note.sourceSide === "sales"
        ? note.noteType === "credit_note"
          ? "sales_credit_note"
          : "sales_debit_note"
        : note.noteType === "credit_note"
        ? "purchase_credit_note"
        : "purchase_debit_note";

    // Post to accounting via central service
    const journal = await createPostedJournal({
      tenantId: note.tenantId,
      date: postingDate,
      sourceType: resolvedSourceType,
      sourceId: note._id,
      originalDocumentId: note.originalDocumentId,
      sourceNumber: note.noteNumber,
      reference: note.noteNumber,
      memo: note.reason || `${note.noteType === "credit_note" ? "Credit" : "Debit"} note ${note.noteNumber} for ${note.originalDocumentNumber}`,
      currency: "BDT",
      userId: user?._id || null,
      session,
      lines: glLines,
    });

    // Update original document balances
    let sourceDocument = null;
    if (note.originalDocumentType === "SalesInvoice") {
      const invQuery = SalesInvoice.findById(note.originalDocumentId);
      if (session) invQuery.session(session);
      sourceDocument = await invQuery;

      if (note.noteType === "credit_note") {
        const priorDue = Number(sourceDocument.dueAmount || 0);
        const allocatedAgainstDue = Math.min(priorDue, note.totals.grandTotal);
        const excessCredit = Math.max(note.totals.grandTotal - priorDue, 0);

        sourceDocument.creditedAmount = roundMoney(Number(sourceDocument.creditedAmount || 0) + note.totals.grandTotal);
        sourceDocument.dueAmount = roundMoney(Math.max(priorDue - note.totals.grandTotal, 0));

        if (sourceDocument.paidAmount > 0 && excessCredit > 0) {
          sourceDocument.refundDue = roundMoney(Number(sourceDocument.refundDue || 0) + excessCredit);
        }

        note.allocatedAmount = allocatedAgainstDue;
        note.remainingCredit = excessCredit;

        if (sourceDocument.dueAmount === 0 && Number(sourceDocument.refundDue || 0) === 0) {
          sourceDocument.status = "paid";
        }
      } else if (note.noteType === "debit_note") {
        sourceDocument.debitedAmount = roundMoney(Number(sourceDocument.debitedAmount || 0) + note.totals.grandTotal);
        sourceDocument.dueAmount = roundMoney(Math.max(Number(sourceDocument.dueAmount || 0) + note.totals.grandTotal, 0));
        if (sourceDocument.dueAmount > 0 && sourceDocument.paidAmount > 0) {
          sourceDocument.status = "partially_paid";
        }
      }

      if (sourceDocument.paymentSchedule && Array.isArray(sourceDocument.paymentSchedule) && sourceDocument.paymentSchedule.length > 0) {
        applyAdjustmentToSchedule(sourceDocument.paymentSchedule, {
          adjustmentType: note.noteType === "credit_note" ? "credit" : "debit",
          amount: note.totals.grandTotal,
        });
      }

      sourceDocument.updatedBy = user?._id || null;
      await sourceDocument.save({ session });
    } else if (note.originalDocumentType === "VendorBill") {
      const billQuery = VendorBill.findById(note.originalDocumentId);
      if (session) billQuery.session(session);
      sourceDocument = await billQuery;

      if (note.noteType === "credit_note") {
        const priorDue = Number(sourceDocument.dueTotal || 0);
        const allocatedAgainstDue = Math.min(priorDue, note.totals.grandTotal);
        const excessCredit = Math.max(note.totals.grandTotal - priorDue, 0);

        sourceDocument.creditedAmount = roundMoney(Number(sourceDocument.creditedAmount || 0) + note.totals.grandTotal);
        sourceDocument.dueTotal = roundMoney(Math.max(Number(sourceDocument.total ?? sourceDocument.grandTotal ?? 0) + Number(sourceDocument.debitedAmount || 0) - Number(sourceDocument.creditedAmount || 0) - Number(sourceDocument.paidTotal || 0), 0));
        note.allocatedAmount = allocatedAgainstDue;
        note.remainingCredit = excessCredit;
      } else if (note.noteType === "debit_note") {
        sourceDocument.debitedAmount = roundMoney(Number(sourceDocument.debitedAmount || 0) + note.totals.grandTotal);
        sourceDocument.dueTotal = roundMoney(Math.max(Number(sourceDocument.total ?? sourceDocument.grandTotal ?? 0) + Number(sourceDocument.debitedAmount || 0) - Number(sourceDocument.creditedAmount || 0) - Number(sourceDocument.paidTotal || 0), 0));
      }

      if (sourceDocument.paymentSchedule && Array.isArray(sourceDocument.paymentSchedule) && sourceDocument.paymentSchedule.length > 0) {
        applyAdjustmentToSchedule(sourceDocument.paymentSchedule, {
          adjustmentType: note.noteType === "credit_note" ? "credit" : "debit",
          amount: note.totals.grandTotal,
        });
      }

      await sourceDocument.save({ session });
    }

    // Stamp note status
    note.status = "posted";
    note.postingDate = postingDate;
    note.journalEntryId = journal._id;
    note.postedAt = new Date();
    note.postedBy = user?._id || null;
    note.updatedBy = user?._id || null;
    await note.save({ session });

    await writeAudit({
      actorId: user?._id || null,
      action: "post",
      entityType: "AdjustmentNote",
      entityId: note._id,
      after: typeof note.toObject === "function" ? note.toObject() : note,
    });

    return { note, journal, sourceDocument };
  });
};

/**
 * Cancels a posted AdjustmentNote by creating a reversal journal and restoring source balances.
 */
export const cancelAdjustmentNote = async (id, { reason = "" } = {}, user = null, tenantId = null) => {
  return runMongoTransaction(async (session) => {
    const noteQuery = AdjustmentNote.findOne({ _id: id, ...(tenantId ? { tenantId } : {}) });
    if (session) noteQuery.session(session);
    const note = await noteQuery;

    if (!note) {
      throw Object.assign(new Error("Adjustment note was not found."), { statusCode: 404 });
    }

    if (note.status === "cancelled") {
      return { note, alreadyCancelled: true };
    }

    if (note.status !== "posted") {
      // If note was draft or approved, we can simply mark it cancelled without accounting reversal
      note.status = "cancelled";
      note.cancellationReason = clean(reason);
      note.cancelledAt = new Date();
      note.cancelledBy = user?._id || null;
      note.updatedBy = user?._id || null;
      await note.save({ session });
      return { note };
    }

    if (!note.journalEntryId) {
      throw Object.assign(new Error("Posted note does not have a linked journal entry."), { statusCode: 409 });
    }

    // Create reversal journal
    const reversalJournal = await createReversalJournal({
      originalJournalId: note.journalEntryId,
      date: new Date(),
      reason: clean(reason) || `Cancellation of ${note.noteNumber}`,
      userId: user?._id || null,
      session,
    });

    // Revert source document balance
    let sourceDocument = null;
    if (note.originalDocumentType === "SalesInvoice") {
      const invQuery = SalesInvoice.findById(note.originalDocumentId);
      if (session) invQuery.session(session);
      sourceDocument = await invQuery;

      if (sourceDocument) {
        if (note.noteType === "credit_note") {
          sourceDocument.creditedAmount = roundMoney(Math.max(Number(sourceDocument.creditedAmount || 0) - note.totals.grandTotal, 0));
        } else if (note.noteType === "debit_note") {
          sourceDocument.debitedAmount = roundMoney(Math.max(Number(sourceDocument.debitedAmount || 0) - note.totals.grandTotal, 0));
        }

        const originalTotal = Number(sourceDocument.totals?.grandTotal ?? sourceDocument.grandTotal ?? sourceDocument.totalAmount ?? 0);
        const netInvoiced = roundMoney(
          originalTotal +
            Number(sourceDocument.debitedAmount || 0) -
            Number(sourceDocument.creditedAmount || 0)
        );
        sourceDocument.dueAmount = roundMoney(Math.max(netInvoiced - Number(sourceDocument.paidAmount || 0), 0));
        sourceDocument.refundDue = roundMoney(Math.max(Number(sourceDocument.paidAmount || 0) - netInvoiced, 0));

        if (sourceDocument.dueAmount === 0 && sourceDocument.paidAmount > 0) {
          sourceDocument.status = "paid";
        } else if (sourceDocument.paidAmount > 0) {
          sourceDocument.status = "partially_paid";
        } else {
          sourceDocument.status = sourceDocument.sentAt ? "sent" : "posted";
        }

        if (sourceDocument.paymentSchedule && Array.isArray(sourceDocument.paymentSchedule) && sourceDocument.paymentSchedule.length > 0) {
          reverseAdjustmentFromSchedule(sourceDocument.paymentSchedule, {
            adjustmentType: note.noteType === "credit_note" ? "credit" : "debit",
            amount: note.totals.grandTotal,
          });
        }

        sourceDocument.updatedBy = user?._id || null;
        await sourceDocument.save({ session });
      }
    } else if (note.originalDocumentType === "VendorBill") {
      const billQuery = VendorBill.findById(note.originalDocumentId);
      if (session) billQuery.session(session);
      sourceDocument = await billQuery;

      if (sourceDocument) {
        if (note.noteType === "credit_note") {
          sourceDocument.creditedAmount = roundMoney(Math.max(Number(sourceDocument.creditedAmount || 0) - note.totals.grandTotal, 0));
        } else if (note.noteType === "debit_note") {
          sourceDocument.debitedAmount = roundMoney(Math.max(Number(sourceDocument.debitedAmount || 0) - note.totals.grandTotal, 0));
        }
        sourceDocument.dueTotal = roundMoney(Math.max(Number(sourceDocument.total ?? sourceDocument.grandTotal ?? 0) + Number(sourceDocument.debitedAmount || 0) - Number(sourceDocument.creditedAmount || 0) - Number(sourceDocument.paidTotal || 0), 0));

        if (sourceDocument.paymentSchedule && Array.isArray(sourceDocument.paymentSchedule) && sourceDocument.paymentSchedule.length > 0) {
          reverseAdjustmentFromSchedule(sourceDocument.paymentSchedule, {
            adjustmentType: note.noteType === "credit_note" ? "credit" : "debit",
            amount: note.totals.grandTotal,
          });
        }

        await sourceDocument.save({ session });
      }
    }

    note.status = "cancelled";
    note.reversalJournalEntryId = reversalJournal._id;
    note.cancellationReason = clean(reason);
    note.cancelledAt = new Date();
    note.cancelledBy = user?._id || null;
    note.updatedBy = user?._id || null;
    await note.save({ session });

    await writeAudit({
      actorId: user?._id || null,
      action: "cancel",
      entityType: "AdjustmentNote",
      entityId: note._id,
      after: typeof note.toObject === "function" ? note.toObject() : note,
    });

    return { note, reversalJournal, sourceDocument };
  });
};

/**
 * Allocates open credit balance from a Credit Note to another open document of the same customer/supplier.
 */
export const allocateCreditNoteBalance = async ({
  creditNoteId,
  targetDocumentType,
  targetDocumentId,
  amount,
  user = null,
  tenantId = null,
}) => {
  return runMongoTransaction(async (session) => {
    const noteQuery = AdjustmentNote.findOne({
      _id: creditNoteId,
      noteType: "credit_note",
      status: "posted",
      ...(tenantId ? { tenantId } : {}),
    });
    if (session) noteQuery.session(session);
    const creditNote = await noteQuery;

    if (!creditNote) {
      throw Object.assign(new Error("Posted credit note was not found."), { statusCode: 404 });
    }

    const allocAmount = roundMoney(amount);
    if (allocAmount <= 0) {
      throw Object.assign(new Error("Allocation amount must be greater than zero."), { statusCode: 400 });
    }

    if (allocAmount > Number(creditNote.remainingCredit || 0)) {
      throw Object.assign(
        new Error(`Allocation amount (${allocAmount}) exceeds available credit (${creditNote.remainingCredit}).`),
        { statusCode: 409 }
      );
    }

    if (targetDocumentType === "SalesInvoice") {
      const invQuery = SalesInvoice.findOne({
        _id: targetDocumentId,
        customerId: creditNote.partyId,
        status: { $nin: ["void", "cancelled", "paid"] },
        ...(tenantId ? { tenantId } : {}),
      });
      if (session) invQuery.session(session);
      const targetInvoice = await invQuery;

      if (!targetInvoice) {
        throw Object.assign(new Error("Target open sales invoice for this customer was not found."), { statusCode: 404 });
      }

      const due = Number(targetInvoice.dueAmount || 0);
      if (allocAmount > due) {
        throw Object.assign(new Error(`Allocation amount (${allocAmount}) exceeds invoice due (${due}).`), { statusCode: 409 });
      }

      targetInvoice.creditedAmount = roundMoney(Number(targetInvoice.creditedAmount || 0) + allocAmount);
      targetInvoice.dueAmount = roundMoney(Math.max(due - allocAmount, 0));
      if (targetInvoice.dueAmount === 0) targetInvoice.status = "paid";
      targetInvoice.updatedBy = user?._id || null;
      await targetInvoice.save({ session });
    } else if (targetDocumentType === "VendorBill") {
      const billQuery = VendorBill.findOne({
        _id: targetDocumentId,
        supplier: creditNote.partyId,
        status: { $in: ["approved", "partially_paid"] },
        ...(tenantId ? { tenantId } : {}),
      });
      if (session) billQuery.session(session);
      const targetBill = await billQuery;

      if (!targetBill) {
        throw Object.assign(new Error("Target open vendor bill for this supplier was not found."), { statusCode: 404 });
      }

      const due = Number(targetBill.dueTotal || 0);
      if (allocAmount > due) {
        throw Object.assign(new Error(`Allocation amount (${allocAmount}) exceeds bill due (${due}).`), { statusCode: 409 });
      }

      targetBill.creditedAmount = roundMoney(Number(targetBill.creditedAmount || 0) + allocAmount);
      await targetBill.save({ session });
    } else {
      throw Object.assign(new Error("Unsupported target document type."), { statusCode: 400 });
    }

    creditNote.allocatedAmount = roundMoney(Number(creditNote.allocatedAmount || 0) + allocAmount);
    creditNote.remainingCredit = roundMoney(Math.max(Number(creditNote.remainingCredit || 0) - allocAmount, 0));
    creditNote.updatedBy = user?._id || null;
    await creditNote.save({ session });

    return { creditNote, allocatedAmount: allocAmount };
  });
};
