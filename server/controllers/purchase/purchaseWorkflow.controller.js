import mongoose from "mongoose";
import BankAccount from "../../models/bankAccount.model.js";
import CashAccount from "../../models/cashAccount.model.js";
import Product from "../../models/inventory/product.model.js";
import ProductStock from "../../models/inventory/productStock.model.js";
import GoodsReceipt from "../../models/goodsReceipt.model.js";
import PurchaseOrder from "../../models/purchaseOrder.model.js";
import Supplier, { SupplierProduct, SupplierAudit } from "../../models/supplier.model.js";
import { PriceAnalysis, PurchaseAnalysis, PurchaseDue, PurchaseIssue, PurchasePayment, PurchaseQualityInspection, PurchaseRequest } from "../../models/purchaseWorkflow.model.js";
import { finalizePurchaseIssue, postPurchasePayment } from "../../services/purchaseExecution.service.js";
import { runMongoTransaction } from "../../utils/mongoTransaction.js";
import { sameTenant } from "../../config/tenantContext.js";
import { assignDocumentNumber } from "../../services/administration/documentNumbering.service.js";

const number = async (tenantId, typeKey, { providedValue, session, idempotencyKey } = {}) => (
  await assignDocumentNumber({ tenantId, typeKey, providedValue, session, idempotencyKey, source: "purchase.workflow" })
).value;

const clean = (v) => String(v ?? "").trim(); const n = (v) => Number(v || 0); const round = (v) => Math.round((n(v) + Number.EPSILON) * 1e6) / 1e6;
const pretty = (v) => String(v || "").replace(/_/g, " ");
const paging = (q = {}) => {
  const limit = Math.min(Math.max(Number(q.limit) || 30, 1), 200);
  const page = Math.max(Number(q.page) || 1, 1);
  const skip = q.skip !== undefined ? Math.max(Number(q.skip) || 0, 0) : (page - 1) * limit;
  return { limit, skip, page };
};
const pageMeta = ({ items = [], total = 0, limit = 30, skip = 0, page = 1 }) => {
  const resolvedPage = page || Math.floor(skip / limit) + 1;
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    items,
    total,
    page: resolvedPage,
    totalPages,
    limit,
    skip,
    count: items.length,
  };
};
const send = (res,e,msg) => res.status(e.statusCode || (e.name === "ValidationError" ? 400 : 500)).json({ message: e.statusCode || e.name === "ValidationError" ? e.message : msg, error:e.message });
const populateRequest = (q) => q.populate("product","name sku minimumStock maximumStock generalOrderQuantity baseUnit").populate("requester approver rejectedBy","name employeeId").populate("department","name");
const issueTypes = new Set(["quick_purchase", "industrial_purchase"]);
const paymentPlans = new Set(["full_payment", "full_due", "partial_payment"]);
const inSession = (query, session) => session ? query.session(session) : query;
const objectId = (value) => value?._id || value || null;

export const buildIssueFilter = (query = {}) => {
  const filter = {};
  if (query.status && query.status !== "all") filter.status = clean(query.status);
  if (issueTypes.has(clean(query.purchaseType))) filter.purchaseType = clean(query.purchaseType);
  if (mongoose.isValidObjectId(query.supplier)) filter.supplier = query.supplier;
  if (mongoose.isValidObjectId(query.product)) filter.product = query.product;
  const q = clean(query.q || query.search);
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ purchaseReference: regex }, { sourceRequestReference: regex }, { bankCheckNumber: regex }];
  }
  return filter;
};

export const prepareQuickPurchaseDraft = (body = {}) => {
  const quantity = round(body.quantity);
  const unitPrice = round(body.unitPrice);
  const discountPercent = round(body.discountPercent);
  const paymentPlan = clean(body.paymentPlan);
  if (!Number.isFinite(quantity) || quantity <= 0) throw Object.assign(new Error("Quantity must be greater than zero."), { statusCode: 400 });
  if (!Number.isFinite(unitPrice) || unitPrice < 0) throw Object.assign(new Error("Unit price cannot be negative."), { statusCode: 400 });
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) throw Object.assign(new Error("Discount must be between 0 and 100."), { statusCode: 400 });
  if (!paymentPlans.has(paymentPlan)) throw Object.assign(new Error("Select a valid payment plan."), { statusCode: 400 });
  const grossAmount = Math.round(quantity * unitPrice * 100) / 100;
  const discountAmount = Math.round(grossAmount * discountPercent) / 100;
  const netAmount = Math.round(Math.max(grossAmount - discountAmount, 0) * 100) / 100;
  let paidAmount = Math.round(n(body.paidAmount) * 100) / 100;
  if (paymentPlan === "full_payment") paidAmount = netAmount;
  if (["full_due", "after_quality_inspection"].includes(paymentPlan)) paidAmount = 0;
  if (paymentPlan === "partial_payment" && !(paidAmount > 0 && paidAmount < netAmount)) {
    throw Object.assign(new Error("Partial payment must be greater than zero and less than the net amount."), { statusCode: 400 });
  }
  if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > netAmount) throw Object.assign(new Error("Paid amount cannot exceed the net amount."), { statusCode: 400 });
  const dueAmount = Math.round(Math.max(netAmount - paidAmount, 0) * 100) / 100;
  return { quantity, unitPrice, discountPercent, grossAmount, discountAmount, netAmount, paymentPlan, paidAmount, dueAmount };
};

export const normalizeQuickPurchaseIssue = (item = {}) => {
  const source = item?.toObject ? item.toObject() : item;
  return {
    ...source,
    paidAmount: source?.due?.currentPaidAmount ?? source?.paidAmount ?? 0,
    dueAmount: source?.due?.remainingDue ?? source?.dueAmount ?? 0,
  };
};

export const prepareIndustrialIssueDraft = (analysis = {}, body = {}) => {
  if (analysis.status !== "completed") throw Object.assign(new Error("Select a completed Purchase Analysis."), { statusCode: 409 });
  return {
    purchaseType: "industrial_purchase",
    request: objectId(analysis.request),
    analysis: objectId(analysis),
    sourceRequestReference: analysis.request?.requestReference || "",
    product: objectId(analysis.product),
    supplier: objectId(analysis.selectedSupplier),
    supplierProduct: objectId(analysis.selectedSupplierProduct),
    quantity: round(analysis.finalQuantity),
    unitPrice: n(analysis.purchaseUnitPrice),
    catalogueUnitPrice: n(analysis.catalogueUnitPrice),
    discountPercent: n(analysis.discountPercent),
    paymentPlan: "full_due",
    paidAmount: 0,
    note: clean(body.note),
  };
};

export const assertEligibleAnalysisRequest = (request = {}) => {
  if (request.status !== "approved") throw Object.assign(new Error("Select an approved Purchase Request."), { statusCode: 409 });
  if (request.analysis) throw Object.assign(new Error("This Purchase Request already has an Analysis."), { statusCode: 409 });
  return request;
};

export const prepareQualityResult = (body = {}) => {
  const receivedQuantity = round(body.receivedQuantity);
  const inspectedQuantity = round(body.inspectedQuantity);
  const acceptedQuantity = round(body.acceptedQuantity);
  const rejectedQuantity = round(body.rejectedQuantity);
  const quarantineQuantity = round(body.quarantineQuantity);
  const values = [receivedQuantity, inspectedQuantity, acceptedQuantity, rejectedQuantity, quarantineQuantity];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) throw Object.assign(new Error("Quality quantities must be non-negative numbers."), { statusCode: 400 });
  if (inspectedQuantity > receivedQuantity) throw Object.assign(new Error("Inspected quantity cannot exceed received quantity."), { statusCode: 400 });
  if (acceptedQuantity + rejectedQuantity + quarantineQuantity > inspectedQuantity) throw Object.assign(new Error("Accepted, rejected, and quarantine quantities cannot exceed inspected quantity."), { statusCode: 400 });
  let status = "partially_accepted";
  if (inspectedQuantity > 0 && acceptedQuantity === inspectedQuantity) status = "passed";
  else if (inspectedQuantity > 0 && rejectedQuantity === inspectedQuantity) status = "rejected";
  return { receivedQuantity, inspectedQuantity, acceptedQuantity, rejectedQuantity, quarantineQuantity, status };
};

const populateIssue = (query) => query
  .populate("product", "name sku baseUnit trackingType")
  .populate("supplier", "businessName code")
  .populate("purchaseOrder", "orderNo status inventoryStatus")
  .populate("due", "currentPaidAmount remainingDue paymentDeadline status")
  .populate("pendingInventory", "reference status remainingQuantity");

export const listRequests = async (req, res) => {
  const { limit, skip, page } = paging(req.query);
  const filter = {};
  if (req.query.status && req.query.status !== "all") filter.status = clean(req.query.status);
  if (req.query.purpose && req.query.purpose !== "all") filter.purpose = clean(req.query.purpose);
  if (mongoose.isValidObjectId(req.query.product)) filter.product = req.query.product;
  const q = clean(req.query.q || req.query.search);
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ requestReference: regex }, { reason: regex }, { inventoryReference: regex }];
  }
  const [items, total] = await Promise.all([
    populateRequest(PurchaseRequest.find(filter)).sort({ requestDate: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    PurchaseRequest.countDocuments(filter),
  ]);
  res.json(pageMeta({ items, total, limit, skip, page }));
};

export const createRequest = async (req, res) => {
  try {
    const product = await Product.findById(req.body.product);
    if (!product || product.status !== "active") return res.status(400).json({ message: "Select an active Product." });
    if (product.tenantId && req.tenantId && !sameTenant(product.tenantId, req.tenantId)) {
      return res.status(404).json({ message: "Product not found or does not belong to your company." });
    }
    const requester = req.user.role === "admin" && mongoose.isValidObjectId(req.body.requester) ? req.body.requester : req.user._id;
    const user = String(requester) === String(req.user._id) ? req.user : await mongoose.model("User").findById(requester);
    const stock = await ProductStock.aggregate([
      { $match: { product: product._id, status: "active", ...(req.tenantId ? { tenantId: req.tenantId } : {}) } },
      { $group: { _id: null, available: { $sum: "$availableQuantity" } } },
    ]);
    const current = n(stock[0]?.available);
    const suggested = Math.max(n(product.generalOrderQuantity), n(product.minimumStock) - current, 0);
    const item = await PurchaseRequest.create({
      requestReference: await number(req.tenantId, "purchase.request", { providedValue: req.body.requestReference }),
      product: product._id,
      purpose: req.body.purpose || "manual",
      requiredQuantity: round(req.body.requiredQuantity),
      requester,
      department: user?.department || null,
      reason: clean(req.body.reason),
      inventoryReference: clean(req.body.inventoryReference),
      currentStockSnapshot: current,
      minimumStockSnapshot: product.minimumStock,
      maximumStockSnapshot: product.maximumStock,
      suggestedQuantitySnapshot: suggested,
      createdBy: req.user._id,
      updatedBy: req.user._id,
      ...(req.tenantId ? { tenantId: req.tenantId } : {}),
    });
    res.status(201).json(item);
  } catch (e) {
    send(res, e, "Failed to create purchase request.");
  }
};

export const approveRequest = async (req, res) => {
  try {
    const item = await PurchaseRequest.findOne({ _id: req.params.id, status: "pending" }).populate("product");
    if (!item) return res.status(409).json({ message: "Only pending requests can be approved." });
    if (item.tenantId && req.tenantId && !sameTenant(item.tenantId, req.tenantId)) {
      return res.status(404).json({ message: "Purchase Request not found." });
    }
    const approved = round(req.body.approvedQuantity || item.requiredQuantity);
    const stock = await ProductStock.aggregate([
      { $match: { product: item.product._id, status: "active", ...(req.tenantId ? { tenantId: req.tenantId } : {}) } },
      { $group: { _id: null, available: { $sum: "$availableQuantity" } } },
    ]);
    if (item.product.maximumStock > 0 && n(stock[0]?.available) + approved > item.product.maximumStock) {
      return res.status(409).json({ message: "Approved quantity would exceed the Product maximum stock." });
    }
    item.approvedQuantity = approved;
    item.status = "approved";
    item.approver = req.user._id;
    item.approvedAt = new Date();
    item.updatedBy = req.user._id;
    await item.save();
    res.json(item);
  } catch (e) {
    send(res, e, "Failed to approve request.");
  }
};

export const rejectRequest = async (req, res) => {
  try {
    const item = await PurchaseRequest.findOne({ _id: req.params.id, status: { $in: ["pending", "approved"] } });
    if (!item) return res.status(409).json({ message: "Request cannot be rejected." });
    if (item.tenantId && req.tenantId && !sameTenant(item.tenantId, req.tenantId)) {
      return res.status(404).json({ message: "Purchase Request not found." });
    }
    item.status = "rejected";
    item.rejectedBy = req.user._id;
    item.rejectedAt = new Date();
    item.rejectionReason = clean(req.body.reason);
    await item.save();
    res.json(item);
  } catch (e) {
    send(res, e, "Failed to reject request.");
  }
};

export const getSupplierOffers = async (req, res) => {
  try {
    const quantity = Math.max(n(req.query.quantity), 0);
    const items = await SupplierProduct.find({ product: req.params.productId, status: "active" })
      .populate("supplier", "code businessName status performanceRating tenantId")
      .populate("purchaseUnit", "name abbreviation decimalSupport")
      .sort({ isPreferred: -1, unitPrice: 1 })
      .lean();
    res.json({
      items: items
        .filter((x) => x.supplier?.status === "active" && (!req.tenantId || !x.supplier?.tenantId || sameTenant(x.supplier.tenantId, req.tenantId)))
        .map((x) => ({
          ...x,
          effectiveUnitCost: Math.round(x.unitPrice * (quantity >= n(x.minimumOrderQuantity) ? 1 - n(x.discountPercent) / 100 : 1) * 100) / 100,
        })),
    });
  } catch (e) {
    send(res, e, "Failed to load supplier offers.");
  }
};

export const listAnalyses = async (req, res) => {
  const { limit, skip, page } = paging(req.query);
  const filter = {};
  if (req.query.status && req.query.status !== "all") filter.status = clean(req.query.status);
  if (mongoose.isValidObjectId(req.query.supplier)) filter.selectedSupplier = req.query.supplier;
  if (mongoose.isValidObjectId(req.query.product)) filter.product = req.query.product;
  const q = clean(req.query.q || req.query.search);
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ analysisReference: regex }, { note: regex }];
  }
  const [items, total] = await Promise.all([
    PurchaseAnalysis.find(filter)
      .populate({ path: "request", populate: [{ path: "requester", select: "name employeeId" }, { path: "department", select: "name" }] })
      .populate("product", "name sku")
      .populate("selectedSupplier", "businessName code")
      .populate("analyzer", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PurchaseAnalysis.countDocuments(filter),
  ]);
  res.json(pageMeta({ items, total, limit, skip, page }));
};

export const getAnalysisOptions = async (_req, res) => {
  try {
    const requests = await populateRequest(PurchaseRequest.find({ status: "approved", analysis: null }))
      .sort({ requestDate: -1 })
      .limit(500)
      .lean();
    return res.json({ requests });
  } catch (e) {
    return send(res, e, "Failed to load analysis options.");
  }
};

export const createAnalysis = async (req, res) => {
  try {
    let item;
    await runMongoTransaction(async (session) => {
      const request = await inSession(PurchaseRequest.findById(req.body.request).populate("product"), session);
      if (!request) throw Object.assign(new Error("Purchase Request not found."), { statusCode: 404 });
      if (request.tenantId && req.tenantId && !sameTenant(request.tenantId, req.tenantId)) {
        throw Object.assign(new Error("Purchase Request not found."), { statusCode: 404 });
      }
      assertEligibleAnalysisRequest(request);
      const finalQuantity = round(req.body.finalQuantity || request.approvedQuantity);
      if (!(finalQuantity > 0)) throw Object.assign(new Error("Final quantity must be greater than zero."), { statusCode: 400 });
      item = new PurchaseAnalysis({
        analysisReference: await number(req.tenantId, "purchase.analysis", { providedValue: req.body.analysisReference, session }),
        request: request._id,
        product: request.product._id,
        actualDemand: request.approvedQuantity,
        finalQuantity,
        catalogueUnitPrice: 0,
        purchaseUnitPrice: 0,
        discountPercent: 0,
        note: clean(req.body.note),
        status: "pending",
        createdBy: req.user._id,
        updatedBy: req.user._id,
        ...(req.tenantId ? { tenantId: req.tenantId } : {}),
      });
      await item.save(session ? { session } : undefined);
      request.status = "in_analysis";
      request.analysis = item._id;
      request.updatedBy = req.user._id;
      await request.save(session ? { session } : undefined);
    });
    return res.status(201).json(item);
  } catch (e) {
    return send(res, e, "Failed to create purchase analysis.");
  }
};

export const completeAnalysis = async (req, res) => {
  try {
    let item;
    await runMongoTransaction(async (session) => {
      item = await inSession(PurchaseAnalysis.findOne({ _id: req.params.id, status: "pending" }), session);
      if (!item) throw Object.assign(new Error("Only a pending Purchase Analysis can be completed."), { statusCode: 409 });
      if (item.tenantId && req.tenantId && !sameTenant(item.tenantId, req.tenantId)) {
        throw Object.assign(new Error("Purchase Analysis not found."), { statusCode: 404 });
      }
      const supplierProduct = await inSession(SupplierProduct.findOne({ _id: req.body.supplierProduct, product: item.product, status: "active" }).populate("supplier"), session);
      if (!supplierProduct || supplierProduct.supplier?.status !== "active") throw Object.assign(new Error("Select an active Supplier Catalogue offer."), { statusCode: 400 });
      if (supplierProduct.supplier?.tenantId && req.tenantId && !sameTenant(supplierProduct.supplier.tenantId, req.tenantId)) {
        throw Object.assign(new Error("Supplier catalogue offer not found."), { statusCode: 404 });
      }
      const finalQuantity = round(req.body.finalQuantity || item.finalQuantity);
      const unitPrice = n(req.body.unitPrice ?? supplierProduct.unitPrice);
      const discount = finalQuantity >= n(supplierProduct.minimumOrderQuantity) ? n(req.body.discountPercent ?? supplierProduct.discountPercent) : 0;
      if (!(finalQuantity > 0) || unitPrice < 0 || discount < 0 || discount > 100) throw Object.assign(new Error("Enter valid analysis quantities and pricing."), { statusCode: 400 });
      Object.assign(item, {
        finalQuantity,
        selectedSupplier: supplierProduct.supplier._id,
        selectedSupplierProduct: supplierProduct._id,
        catalogueUnitPrice: supplierProduct.unitPrice,
        purchaseUnitPrice: unitPrice,
        discountPercent: discount,
        analyzer: req.user._id,
        note: clean(req.body.note || item.note),
        status: "completed",
        completedAt: new Date(),
        updatedBy: req.user._id,
      });
      await item.save(session ? { session } : undefined);
      await PurchaseRequest.updateOne({ _id: item.request }, { $set: { status: "analyzed", updatedBy: req.user._id } }, { session });
      if (Math.abs(unitPrice - Number(supplierProduct.unitPrice || 0)) > 0.001) {
        const existingPA = await inSession(PriceAnalysis.findOne({ analysis: item._id }), session);
        if (!existingPA) {
          await inSession(
            PriceAnalysis.create([
              {
                analysisReference: await number(req.tenantId, "purchase.price-analysis", { session }),
                analysis: item._id,
                product: item.product,
                supplier: supplierProduct.supplier._id,
                supplierProduct: supplierProduct._id,
                catalogueUnitPrice: supplierProduct.unitPrice,
                purchaseUnitPrice: unitPrice,
                priceDifference: Math.round((unitPrice - supplierProduct.unitPrice) * 100) / 100,
                catalogueDiscount: supplierProduct.discountPercent || 0,
                purchaseDiscount: discount,
                discountDifference: Math.round((discount - (supplierProduct.discountPercent || 0)) * 100) / 100,
                status: "pending_review",
                purchaseDate: new Date(),
                ...(req.tenantId ? { tenantId: req.tenantId } : {}),
              },
            ]),
            session
          );
        }
      }
    });
    return res.json(item);
  } catch (e) {
    return send(res, e, "Failed to complete purchase analysis.");
  }
};

export const listIssues = async (req, res) => {
  const { limit, skip, page } = paging(req.query);
  const filter = buildIssueFilter(req.query);
  const [items, total] = await Promise.all([
    populateIssue(PurchaseIssue.find(filter)).populate("request analysis qualityInspection").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    PurchaseIssue.countDocuments(filter),
  ]);
  res.json(pageMeta({ items: items.map(normalizeQuickPurchaseIssue), total, limit, skip, page }));
};

export const getIndustrialIssueOptions = async (_req, res) => {
  try {
    const analyses = await PurchaseAnalysis.find({ status: "completed", issue: null })
      .populate("request", "requestReference status")
      .populate("product", "name sku")
      .populate("selectedSupplier", "businessName code")
      .sort({ completedAt: -1 })
      .limit(500)
      .lean();
    return res.json({ analyses });
  } catch (e) {
    return send(res, e, "Failed to load Industrial Issue options.");
  }
};

export const createIndustrialPurchaseIssue = async (req, res) => {
  try {
    let item;
    await runMongoTransaction(async (session) => {
      const analysis = await inSession(PurchaseAnalysis.findOne({ _id: req.body.analysis, status: "completed", issue: null }).populate("request"), session);
      if (!analysis) throw Object.assign(new Error("Select a completed Purchase Analysis that has not been issued."), { statusCode: 409 });
      if (analysis.tenantId && req.tenantId && !sameTenant(analysis.tenantId, req.tenantId)) {
        throw Object.assign(new Error("Purchase Analysis not found."), { statusCode: 404 });
      }
      const draft = prepareIndustrialIssueDraft(analysis, req.body);
      item = new PurchaseIssue({
        ...draft,
        purchaseReference: await number(req.tenantId, "purchase.issue", { providedValue: req.body.purchaseReference, session }),
        status: "draft",
        createdBy: req.user._id,
        updatedBy: req.user._id,
        ...(req.tenantId ? { tenantId: req.tenantId } : {}),
      });
      await item.save(session ? { session } : undefined);
      analysis.issue = item._id;
      analysis.updatedBy = req.user._id;
      await analysis.save(session ? { session } : undefined);
    });
    return res.status(201).json(item);
  } catch (e) {
    return send(res, e, "Failed to create Industrial Purchase Issue.");
  }
};
export const submitIndustrialPurchaseIssue = async (req,res) => { try { const item=await PurchaseIssue.findOne({_id:req.params.id,purchaseType:"industrial_purchase",status:"draft"});if(!item)return res.status(409).json({message:"Only a draft Industrial Purchase Issue can be submitted."});item.status="ready";item.updatedBy=req.user._id;await item.save();return res.json(item);}catch(e){return send(res,e,"Failed to submit Industrial Purchase Issue.");} };
export const finalizeIndustrialPurchaseIssue = async (req,res) => { try { const item=await runMongoTransaction(async(session)=>{const issue=await inSession(PurchaseIssue.findOne({_id:req.params.id,purchaseType:"industrial_purchase"}),session);if(!issue)throw Object.assign(new Error("Industrial Purchase Issue not found."),{statusCode:404});if(issue.status==="completed"&&issue.purchaseOrder)return issue;if(issue.status!=="ready")throw Object.assign(new Error("Only a submitted Industrial Purchase Issue can create a Purchase Order."),{statusCode:409});const finalized=await finalizePurchaseIssue({issue,userId:req.user._id,session});await PurchaseRequest.updateOne({_id:issue.request},{$set:{status:"issued",issue:issue._id,updatedBy:req.user._id}},{session});return finalized;});const populated=await populateIssue(PurchaseIssue.findById(item._id)).lean();return res.json(populated);}catch(e){return send(res,e,"Failed to create Purchase Order from Industrial Purchase Issue.");} };

export const getQuickPurchaseOptions = async (_req, res) => {
  try {
    const [suppliers, products, cashAccounts, bankAccounts] = await Promise.all([
      Supplier.find({ status: "active" }).select("businessName code").sort({ businessNameLower: 1 }).limit(500).lean(),
      Product.find({ status: "active" }).select("name sku baseUnit trackingType purchasePrice").populate("baseUnit", "name abbreviation").sort({ nameLower: 1 }).limit(500).lean(),
      CashAccount.find({ isActive: { $ne: false }, account: { $ne: null } }).select("name type account").populate("account", "code name type currency isActive").sort({ nameLower: 1 }).limit(200).lean(),
      BankAccount.find({ status: "active", ledgerAccount: { $ne: null } }).select("accountName accountNumber currency bank ledgerAccount").populate("bank", "bankName shortName").populate("ledgerAccount", "code name type currency isActive").sort({ accountNameLower: 1 }).limit(200).lean(),
    ]);
    return res.json({
      suppliers,
      products,
      cashAccounts: cashAccounts.filter((item) => item.account?.type === "asset" && item.account?.isActive !== false),
      bankAccounts: bankAccounts.filter((item) => item.ledgerAccount?.type === "asset" && item.ledgerAccount?.isActive !== false),
    });
  } catch (error) {
    return send(res, error, "Failed to load Quick Purchase options.");
  }
};

export const createQuickPurchase = async (req, res) => {
  const idempotencyKey = clean(req.headers["idempotency-key"] || req.body.idempotencyKey);
  try {
    if (!idempotencyKey || idempotencyKey.length > 200) return res.status(400).json({ message: "A valid idempotency key is required." });
    if (!mongoose.isValidObjectId(req.body.supplier)) return res.status(400).json({ message: "Select an active Supplier." });
    if (!mongoose.isValidObjectId(req.body.product)) return res.status(400).json({ message: "Select an active Product." });
    const draft = prepareQuickPurchaseDraft(req.body);
    const paymentAccountType = clean(req.body.paymentAccountType).toLowerCase();
    const cashAccount = mongoose.isValidObjectId(req.body.cashAccount) ? req.body.cashAccount : null;
    const bankAccount = mongoose.isValidObjectId(req.body.bankAccount) ? req.body.bankAccount : null;
    const bankCheckNumber = clean(req.body.bankCheckNumber);
    if (draft.paidAmount > 0 && !["cash", "bank"].includes(paymentAccountType)) return res.status(400).json({ message: "Select cash or bank as the payment account type." });
    if (draft.paidAmount > 0 && paymentAccountType === "cash" && !cashAccount) return res.status(400).json({ message: "Select an active cash account." });
    if (draft.paidAmount > 0 && paymentAccountType === "bank" && (!bankAccount || !bankCheckNumber)) return res.status(400).json({ message: "Select an active bank account and enter the check/reference number." });
    const paymentDeadline = req.body.paymentDeadline ? new Date(req.body.paymentDeadline) : null;
    if (paymentDeadline && Number.isNaN(paymentDeadline.getTime())) return res.status(400).json({ message: "Enter a valid payment deadline." });

    let created = false;
    const issue = await runMongoTransaction(async (session) => {
      const existing = await inSession(PurchaseIssue.findOne({ idempotencyKey }), session);
      if (existing) return finalizePurchaseIssue({ issue: existing, userId: req.user._id, session });
      const [supplier, product] = await Promise.all([
        inSession(Supplier.findOne({ _id: req.body.supplier, status: "active" }), session),
        inSession(Product.findOne({ _id: req.body.product, status: "active" }), session),
      ]);
      if (!supplier) throw Object.assign(new Error("Select an active Supplier."), { statusCode: 400 });
      if (!product) throw Object.assign(new Error("Select an active Product."), { statusCode: 400 });
      const item = new PurchaseIssue({
        purchaseReference: await number(req.tenantId, "purchase.issue", { providedValue: req.body.purchaseReference, session, idempotencyKey }),
        purchaseType: "quick_purchase",
        product: product._id,
        supplier: supplier._id,
        quantity: draft.quantity,
        unitPrice: draft.unitPrice,
        catalogueUnitPrice: draft.unitPrice,
        discountPercent: draft.discountPercent,
        paymentPlan: draft.paymentPlan,
        paidAmount: draft.paidAmount,
        dueAmount: draft.dueAmount,
        paymentDeadline,
        paymentAccountType: draft.paidAmount > 0 ? paymentAccountType : "",
        cashAccount: draft.paidAmount > 0 && paymentAccountType === "cash" ? cashAccount : null,
        bankAccount: draft.paidAmount > 0 && paymentAccountType === "bank" ? bankAccount : null,
        bankCheckNumber: draft.paidAmount > 0 && paymentAccountType === "bank" ? bankCheckNumber : "",
        idempotencyKey,
        status: "ready",
        createdBy: req.user._id,
        updatedBy: req.user._id,
      });
      await item.save(session ? { session } : undefined);
      created = true;
      return finalizePurchaseIssue({ issue: item, userId: req.user._id, session });
    });
    const responseItem = await populateIssue(PurchaseIssue.findById(issue._id)).lean();
    return res.status(created ? 201 : 200).json({ item: normalizeQuickPurchaseIssue(responseItem), duplicate: !created });
  } catch (error) {
    if (error?.code === 11000 && idempotencyKey) {
      const existing = await populateIssue(PurchaseIssue.findOne({ idempotencyKey })).lean();
      if (existing) return res.status(200).json({ item: normalizeQuickPurchaseIssue(existing), duplicate: true });
    }
    return send(res, error, "Failed to create Quick Purchase.");
  }
};
export const listDues = async (req, res) => {
  const { limit, skip, page } = paging(req.query);
  const filter = req.query.status && req.query.status !== "all" ? { status: req.query.status } : {};
  if (mongoose.isValidObjectId(req.query.supplier)) filter.supplier = req.query.supplier;
  if (mongoose.isValidObjectId(req.query.product)) filter.product = req.query.product;
  const q = clean(req.query.q || req.query.search);
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ dueReference: regex }, { bankCheckNumber: regex }];
  }
  const [items, total, summary] = await Promise.all([
    PurchaseDue.find(filter)
      .populate("supplier", "businessName code")
      .populate("product", "name sku")
      .populate("purchaseOrder", "orderNo grandTotal paidAmount dueAmount paymentStatus currency")
      .populate({
        path: "payments",
        populate: [
          { path: "cashAccount", select: "name" },
          { path: "bankAccount", select: "accountName accountNumber" },
          { path: "paidBy", select: "name" },
        ],
      })
      .sort({ paymentDeadline: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PurchaseDue.countDocuments(filter),
    PurchaseDue.aggregate([
      { $match: filter },
      { $group: { _id: "$status", amount: { $sum: "$remainingDue" }, count: { $sum: 1 } } },
    ]),
  ]);
  res.json({ ...pageMeta({ items, total, limit, skip, page }), summary });
};

export const getDueById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid due ID." });
    const item = await PurchaseDue.findById(req.params.id)
      .populate("supplier", "businessName code")
      .populate("product", "name sku")
      .populate("purchaseOrder", "orderNo grandTotal paidAmount dueAmount paymentStatus orderDate currency")
      .populate({
        path: "payments",
        populate: [
          { path: "cashAccount", select: "name" },
          { path: "bankAccount", select: "accountName accountNumber" },
          { path: "paidBy", select: "name" },
        ],
      })
      .lean();
    if (!item) return res.status(404).json({ message: "Purchase due not found." });
    return res.json({ item });
  } catch (error) {
    return send(res, error, "Failed to load purchase due.");
  }
};

export const getDuePaymentOptions = async (_req, res) => {
  try {
    const [cashAccounts, bankAccounts] = await Promise.all([
      CashAccount.find({ isActive: { $ne: false }, account: { $ne: null } })
        .select("name type account")
        .populate("account", "code name type currency isActive")
        .sort({ nameLower: 1 })
        .limit(200)
        .lean(),
      BankAccount.find({ status: "active", ledgerAccount: { $ne: null } })
        .select("accountName accountNumber currency bank ledgerAccount")
        .populate("bank", "bankName shortName")
        .populate("ledgerAccount", "code name type currency isActive")
        .sort({ accountNameLower: 1 })
        .limit(200)
        .lean(),
    ]);
    return res.json({
      cashAccounts: cashAccounts.filter((item) => item.account?.type === "asset" && item.account?.isActive !== false),
      bankAccounts: bankAccounts.filter((item) => item.ledgerAccount?.type === "asset" && item.ledgerAccount?.isActive !== false),
    });
  } catch (error) {
    return send(res, error, "Failed to load payment options.");
  }
};

export function calculateDuePaymentSettlement(due, paymentAmount) {
  const amount = Math.round((Number(paymentAmount || 0) + Number.EPSILON) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw Object.assign(new Error("Payment amount must be greater than zero."), { statusCode: 400 });
  }
  const remainingDue = Math.round((Number(due.remainingDue ?? (due.originalNetAmount - due.currentPaidAmount)) + Number.EPSILON) * 100) / 100;
  if (["paid", "cancelled"].includes(due.status) || remainingDue <= 0) {
    throw Object.assign(new Error("This due is already fully paid or cancelled."), { statusCode: 400 });
  }
  if (amount > remainingDue) {
    throw Object.assign(new Error(`Payment amount cannot exceed the remaining due (${remainingDue}).`), { statusCode: 400 });
  }
  const currentPaid = Math.round((Number(due.currentPaidAmount || 0) + Number.EPSILON) * 100) / 100;
  const nextPaid = Math.round((currentPaid + amount + Number.EPSILON) * 100) / 100;
  const nextRemaining = Math.round((Math.max(remainingDue - amount, 0) + Number.EPSILON) * 100) / 100;
  const nextStatus = nextRemaining <= 0 ? "paid" : "partial";
  return {
    amount,
    previousRemaining: remainingDue,
    nextRemaining,
    previousPaid: currentPaid,
    nextPaid,
    nextStatus,
    isFullSettlement: nextRemaining <= 0,
  };
}

export const payDue = async (req, res) => {
  const { id } = req.params;
  const idempotencyKey = clean(req.headers["idempotency-key"] || req.body.idempotencyKey || `DUE-PAY:${id}:${req.body.reference || Date.now()}`);
  try {
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid purchase due ID." });
    const amount = Math.round((Number(req.body.amount || 0) + Number.EPSILON) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "Payment amount must be greater than zero." });
    }

    const paymentAccountType = clean(req.body.paymentAccountType).toLowerCase();
    if (!["cash", "bank"].includes(paymentAccountType)) {
      return res.status(400).json({ message: "Select cash or bank as the payment account type." });
    }
    const cashAccount = mongoose.isValidObjectId(req.body.cashAccount) ? req.body.cashAccount : null;
    const bankAccount = mongoose.isValidObjectId(req.body.bankAccount) ? req.body.bankAccount : null;
    const bankCheckNumber = clean(req.body.bankCheckNumber || req.body.reference);

    if (paymentAccountType === "cash" && !cashAccount) {
      return res.status(400).json({ message: "Select an active cash account." });
    }
    if (paymentAccountType === "bank" && (!bankAccount || !bankCheckNumber)) {
      return res.status(400).json({ message: "Select an active bank account and enter the check/reference number." });
    }

    const paymentDate = req.body.paymentDate ? new Date(req.body.paymentDate) : new Date();
    if (Number.isNaN(paymentDate.getTime())) {
      return res.status(400).json({ message: "Enter a valid payment date." });
    }

    let paymentRecord = null;
    const updatedDue = await runMongoTransaction(async (session) => {
      const due = await inSession(PurchaseDue.findById(id), session);
      if (!due) throw Object.assign(new Error("Purchase due not found."), { statusCode: 404 });
      if (due.locked) throw Object.assign(new Error(`Due is locked: ${due.lockReason || "locked"}`), { statusCode: 409 });
      
      const settlement = calculateDuePaymentSettlement(due, amount);

      const issueObj = {
        _id: due.issue,
        purchaseReference: due.dueReference,
        purchaseOrder: due.purchaseOrder,
        supplier: due.supplier,
        paymentAccountType,
        cashAccount,
        bankAccount,
        bankCheckNumber,
      };

      paymentRecord = await postPurchasePayment({
        issue: issueObj,
        amount,
        userId: req.user._id,
        session,
        due,
        idempotencyKey,
        paymentDate,
        note: clean(req.body.note),
        reference: bankCheckNumber,
      });

      due.currentPaidAmount = settlement.nextPaid;
      due.remainingDue = settlement.nextRemaining;
      due.status = settlement.nextStatus;
      if (!due.payments.includes(paymentRecord._id)) {
        due.payments.push(paymentRecord._id);
      }
      due.recordVersion = (due.recordVersion || 0) + 1;
      due.updatedBy = req.user._id;
      await due.save({ session });

      if (due.purchaseOrder) {
        const po = await inSession(PurchaseOrder.findById(due.purchaseOrder), session);
        if (po) {
          po.paidAmount = Math.round(((po.paidAmount || 0) + amount) * 100) / 100;
          po.dueAmount = Math.round(Math.max(po.grandTotal - po.paidAmount, 0) * 100) / 100;
          po.paymentStatus = po.dueAmount <= 0 ? "paid" : (po.paidAmount > 0 ? "partial" : "unpaid");
          po.updatedBy = req.user._id;
          await po.save({ session });
        }
      }

      if (due.issue) {
        const issue = await inSession(PurchaseIssue.findById(due.issue), session);
        if (issue) {
          issue.paidAmount = Math.round(((issue.paidAmount || 0) + amount) * 100) / 100;
          issue.dueAmount = Math.round(Math.max(issue.netAmount - issue.paidAmount, 0) * 100) / 100;
          issue.updatedBy = req.user._id;
          await issue.save({ session });
        }
      }

      return due;
    });

    const populated = await PurchaseDue.findById(updatedDue._id)
      .populate("supplier", "businessName code")
      .populate("product", "name sku")
      .populate("purchaseOrder", "orderNo grandTotal paidAmount dueAmount paymentStatus currency")
      .populate({
        path: "payments",
        populate: [
          { path: "cashAccount", select: "name" },
          { path: "bankAccount", select: "accountName accountNumber" },
          { path: "paidBy", select: "name" },
        ],
      })
      .lean();

    return res.json({ message: "Payment recorded successfully.", due: populated, payment: paymentRecord });
  } catch (error) {
    return send(res, error, "Failed to record payment on purchase due.");
  }
};

export const listQuality = async (req, res) => {
  const { limit, skip, page } = paging(req.query);
  const filter = {};
  if (req.query.status && req.query.status !== "all") filter.status = clean(req.query.status);
  if (mongoose.isValidObjectId(req.query.supplier)) filter.supplier = req.query.supplier;
  if (mongoose.isValidObjectId(req.query.product)) filter.product = req.query.product;
  const q = clean(req.query.q || req.query.search);
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ inspectionReference: regex }, { itemName: regex }, { note: regex }];
  }
  const [items, total] = await Promise.all([
    PurchaseQualityInspection.find(filter)
      .populate("product", "name sku")
      .populate("supplier", "businessName code")
      .populate("warehouse", "name code")
      .populate("purchaseOrder", "orderNo status")
      .populate("goodsReceipt", "receiptNo status")
      .populate("inspector", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PurchaseQualityInspection.countDocuments(filter),
  ]);
  res.json(pageMeta({ items, total, limit, skip, page }));
};

export const startQualityInspection = async (req, res) => {
  try {
    const item = await PurchaseQualityInspection.findOne({ _id: req.params.id, status: "waiting" });
    if (!item) return res.status(409).json({ message: "Only a waiting inspection can be started." });
    if (item.tenantId && req.tenantId && !sameTenant(item.tenantId, req.tenantId)) {
      return res.status(403).json({ message: "Cross-tenant quality inspection is not allowed." });
    }
    item.status = "processing";
    item.inspector = req.user._id;
    item.startedAt = new Date();
    await item.save();
    return res.json(item);
  } catch (e) {
    return send(res, e, "Failed to start quality inspection.");
  }
};

export const recordQualityInspection = async (req, res) => {
  try {
    let item;
    await runMongoTransaction(async (session) => {
      item = await inSession(PurchaseQualityInspection.findOne({ _id: req.params.id, status: { $in: ["waiting", "processing"] } }), session);
      if (!item) throw Object.assign(new Error("Only a waiting or processing inspection can receive results."), { statusCode: 409 });
      if (item.tenantId && req.tenantId && !sameTenant(item.tenantId, req.tenantId)) {
        throw Object.assign(new Error("Cross-tenant quality inspection is not allowed."), { statusCode: 403 });
      }
      const result = prepareQualityResult({ ...req.body, receivedQuantity: item.purchasedQuantity });
      if (result.inspectedQuantity !== round(item.purchasedQuantity) || result.acceptedQuantity + result.rejectedQuantity + result.quarantineQuantity !== result.inspectedQuantity) {
        throw Object.assign(new Error("The full received quantity must be inspected and allocated before completion."), { statusCode: 400 });
      }
      Object.assign(item, result, { inspector: req.user._id, inspectedAt: new Date(), note: clean(req.body.note), updatedBy: req.user._id });
      await item.save(session ? { session } : undefined);
      const receipt = await inSession(GoodsReceipt.findById(item.goodsReceipt), session);
      const line = receipt?.lines?.id(item.goodsReceiptLine);
      if (!receipt || !line) throw Object.assign(new Error("The linked Goods Receipt line was not found."), { statusCode: 409 });
      line.acceptedQuantity = result.acceptedQuantity;
      line.quarantineQuantity = result.quarantineQuantity;
      line.rejectedQuantity = result.rejectedQuantity;
      line.qualityStatus = result.status === "passed" ? "accepted" : result.status === "rejected" ? "rejected" : "partially_accepted";
      line.inspectionNotes = item.note;
      receipt.updatedBy = req.user._id;
      await receipt.save(session ? { session } : undefined);
    });
    return res.json(item);
  } catch (e) {
    return send(res, e, "Failed to record quality inspection results.");
  }
};

export const completeQualityInspection = async (req, res) => {
  try {
    const item = await PurchaseQualityInspection.findOne({ _id: req.params.id, status: { $in: ["passed", "partially_accepted", "rejected"] } });
    if (!item) return res.status(409).json({ message: "Record a complete quality result before completing the inspection." });
    if (item.tenantId && req.tenantId && !sameTenant(item.tenantId, req.tenantId)) {
      return res.status(403).json({ message: "Cross-tenant quality inspection is not allowed." });
    }
    if (!item.completedAt) {
      item.completedAt = new Date();
      item.inspector = item.inspector || req.user._id;
      await item.save();
    }
    return res.json(item);
  } catch (e) {
    return send(res, e, "Failed to complete quality inspection.");
  }
};

export const listPriceAnalysis = async (req, res) => {
  const { limit, skip, page } = paging(req.query);
  const filter = {};
  if (req.query.status && req.query.status !== "all") filter.status = clean(req.query.status);
  if (mongoose.isValidObjectId(req.query.supplier)) filter.supplier = req.query.supplier;
  if (mongoose.isValidObjectId(req.query.product)) filter.product = req.query.product;
  const q = clean(req.query.q || req.query.search);
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ analysisReference: regex }, { note: regex }];
  }
  const [items, total] = await Promise.all([
    PriceAnalysis.find(filter)
      .populate("product", "name sku")
      .populate("supplier", "businessName code")
      .populate("reviewedBy", "name")
      .sort({ purchaseDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PriceAnalysis.countDocuments(filter),
  ]);
  res.json(pageMeta({ items, total, limit, skip, page }));
};

export function validatePriceAnalysisDecision(decision) {
  const cleaned = clean(decision);
  const validDecisions = ["accepted_no_update", "catalogue_updated", "rejected"];
  if (!validDecisions.includes(cleaned)) {
    throw Object.assign(new Error("Select a valid review decision: accepted_no_update, catalogue_updated, or rejected."), { statusCode: 400 });
  }
  return cleaned;
}

export const reviewPriceAnalysis = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid price analysis ID." });
    const decision = validatePriceAnalysisDecision(req.body.decision);

    const item = await PriceAnalysis.findById(id);
    if (!item) return res.status(404).json({ message: "Price analysis record not found." });
    if (item.tenantId && req.tenantId && !sameTenant(item.tenantId, req.tenantId)) {
      return res.status(403).json({ message: "Cross-tenant price analysis review is not allowed." });
    }

    const note = clean(req.body.note);

    if (decision === "catalogue_updated") {
      let sp = item.supplierProduct ? await SupplierProduct.findById(item.supplierProduct) : null;
      if (!sp && item.supplier && item.product) {
        sp = await SupplierProduct.findOne({ supplier: item.supplier, product: item.product, status: "active" });
      }
      if (sp) {
        const oldPrice = sp.unitPrice;
        sp.unitPrice = item.purchaseUnitPrice;
        sp.updatedBy = req.user._id;
        await sp.save();

        await SupplierAudit.create({
          supplier: item.supplier,
          supplierProduct: sp._id,
          action: "price_analysis_update",
          actor: req.user._id,
          changes: { unitPrice: { from: oldPrice, to: item.purchaseUnitPrice } },
          note: note || `Updated price from Price Analysis ${item.analysisReference}`,
        });
      }
    }

    item.status = decision;
    item.reviewedBy = req.user._id;
    item.reviewedAt = new Date();
    if (note) item.note = note;
    await item.save();

    const populated = await PriceAnalysis.findById(item._id)
      .populate("product", "name sku")
      .populate("supplier", "businessName code")
      .populate("reviewedBy", "name")
      .lean();

    return res.json({ message: `Price analysis review recorded as '${pretty(decision)}'.`, item: populated });
  } catch (error) {
    return send(res, error, "Failed to record price analysis review.");
  }
};

export const dashboard = async (_req,res) => { const [requests,analyses,issues,dues,orders,spend]=await Promise.all([PurchaseRequest.aggregate([{$group:{_id:"$status",count:{$sum:1}}}]),PurchaseAnalysis.countDocuments({status:"pending"}),PurchaseIssue.countDocuments({status:{$in:["draft","ready"]}}),PurchaseDue.aggregate([{$match:{status:{$nin:["paid","cancelled"]}}},{$group:{_id:null,amount:{$sum:"$remainingDue"},count:{$sum:1}}}]),PurchaseOrder.countDocuments({status:{$nin:["cancelled","rejected"]}}),PurchaseOrder.aggregate([{$match:{status:{$nin:["cancelled","rejected"]}}},{$group:{_id:null,total:{$sum:"$grandTotal"}}}])]);res.json({requests,analysesPending:analyses,issuesPending:issues,outstandingDues:dues[0]||{amount:0,count:0},purchaseOrders:orders,totalSpend:n(spend[0]?.total)}); };

export function normalizeReportRows({ monthlyRaw = [], suppliersRaw = [], productsRaw = [], paymentRaw = [] } = {}) {
  const monthly = (monthlyRaw || []).map((item) => ({
    month: item._id,
    amount: Math.round(Number(item.amount || 0) * 100) / 100,
    orders: Number(item.orders || 0),
  }));

  const suppliers = (suppliersRaw || []).map((item) => ({
    supplierId: item._id,
    supplierName: item.supplierDoc?.businessName || item.supplierDoc?.name || "Unknown Supplier",
    supplierCode: item.supplierDoc?.code || "",
    amount: Math.round(Number(item.amount || 0) * 100) / 100,
    orders: Number(item.orders || 0),
  }));

  const products = (productsRaw || []).map((item) => ({
    productId: item._id,
    productName: item.productDoc?.name || "Unknown Product",
    sku: item.productDoc?.sku || "",
    quantity: Math.round(Number(item.quantity || 0) * 100) / 100,
    amount: Math.round(Number(item.amount || 0) * 100) / 100,
  }));

  const payment = (paymentRaw || []).map((item) => ({
    paymentStatus: item._id || "unpaid",
    amount: Math.round(Number(item.amount || 0) * 100) / 100,
    paid: Math.round(Number(item.paid || 0) * 100) / 100,
    due: Math.round(Number(item.due || 0) * 100) / 100,
    orders: Number(item.orders || 0),
  }));

  const totalSpend = Math.round(monthly.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  const totalOrders = monthly.reduce((sum, item) => sum + item.orders, 0);
  const totalPaid = Math.round(payment.reduce((sum, item) => sum + item.paid, 0) * 100) / 100;
  const totalDue = Math.round(payment.reduce((sum, item) => sum + item.due, 0) * 100) / 100;

  return {
    summary: { totalSpend, totalOrders, totalPaid, totalDue },
    monthly,
    suppliers,
    products,
    payment,
  };
}

export const purchaseReports = async (req, res) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 365 * 86400000);
    const to = req.query.to ? new Date(req.query.to) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return res.status(400).json({ message: "Invalid date range parameters." });
    }
    const toEndOfDay = new Date(to);
    toEndOfDay.setHours(23, 59, 59, 999);

    const match = {
      orderDate: { $gte: from, $lte: toEndOfDay },
      status: { $nin: ["cancelled", "rejected"] },
    };

    if (req.query.supplier && mongoose.isValidObjectId(req.query.supplier)) {
      match.supplier = new mongoose.Types.ObjectId(req.query.supplier);
    }
    if (req.query.purchaseType && req.query.purchaseType !== "all") {
      match.purchaseType = clean(req.query.purchaseType);
    }
    if (req.query.paymentStatus && req.query.paymentStatus !== "all") {
      match.paymentStatus = clean(req.query.paymentStatus);
    }

    const [monthlyRaw, suppliersRaw, productsRaw, paymentRaw] = await Promise.all([
      PurchaseOrder.aggregate([
        { $match: match },
        { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$orderDate" } }, amount: { $sum: "$grandTotal" }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      PurchaseOrder.aggregate([
        { $match: match },
        { $group: { _id: "$supplier", amount: { $sum: "$grandTotal" }, orders: { $sum: 1 } } },
        { $sort: { amount: -1 } },
        { $limit: 50 },
        { $lookup: { from: "suppliers", localField: "_id", foreignField: "_id", as: "supplierDoc" } },
        { $unwind: { path: "$supplierDoc", preserveNullAndEmptyArrays: true } },
      ]),
      PurchaseOrder.aggregate([
        { $match: match },
        { $unwind: "$lines" },
        ...(req.query.product && mongoose.isValidObjectId(req.query.product)
          ? [{ $match: { "lines.product": new mongoose.Types.ObjectId(req.query.product) } }]
          : []),
        { $group: { _id: "$lines.product", quantity: { $sum: "$lines.orderedQuantity" }, amount: { $sum: "$lines.lineTotal" } } },
        { $sort: { amount: -1 } },
        { $limit: 50 },
        { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "productDoc" } },
        { $unwind: { path: "$productDoc", preserveNullAndEmptyArrays: true } },
      ]),
      PurchaseOrder.aggregate([
        { $match: match },
        { $group: { _id: "$paymentStatus", amount: { $sum: "$grandTotal" }, paid: { $sum: "$paidAmount" }, due: { $sum: "$dueAmount" }, orders: { $sum: 1 } } },
      ]),
    ]);

    const normalized = normalizeReportRows({ monthlyRaw, suppliersRaw, productsRaw, paymentRaw });

    return res.json({
      period: { from, to },
      summary: normalized.summary,
      monthly: normalized.monthly,
      suppliers: normalized.suppliers,
      products: normalized.products,
      payment: normalized.payment,
    });
  } catch (error) {
    return send(res, error, "Failed to load purchase reports.");
  }
};
