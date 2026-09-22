import mongoose from "mongoose";
import CommercialLC from "../../models/commercialLC.model.js";
import ImportShipment, { IMPORT_SHIPMENT_STATUSES } from "../../models/importShipment.model.js";
import ImportDocument, { IMPORT_DOCUMENT_TYPES } from "../../models/importDocument.model.js";
import {
  findCommercialLCForUpdate,
  nextImportDocumentNumber,
  updateLCStatus,
  updatePurchaseOrderImportStatus,
} from "../../services/commercialLC.service.js";
import { runMongoTransaction } from "../../utils/mongoTransaction.js";
import {
  uploadDocumentFile,
  getDocumentDownloadUrl,
  deleteDocumentFile,
} from "../../services/storage/documentStorage.service.js";

const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const sessionOptions = (session) => (session ? { session } : undefined);

const SHIPMENT_TRANSITIONS = Object.freeze({
  planned: ["booked", "shipped", "cancelled"],
  booked: ["shipped", "cancelled"],
  shipped: ["in_transit", "arrived", "documents_received", "cancelled"],
  in_transit: ["arrived", "documents_received", "cancelled"],
  arrived: ["documents_received", "customs_clearance", "customs_cleared"],
  documents_received: ["customs_clearance", "customs_cleared"],
  customs_clearance: ["customs_cleared"],
  customs_cleared: ["delivered"],
  delivered: ["closed"],
  closed: [],
  cancelled: [],
});

const assertShipmentTransition = (from, to) => {
  if (from === to) return;
  if (!(SHIPMENT_TRANSITIONS[from] || []).includes(to)) {
    throw Object.assign(new Error(`Import shipment cannot move from ${from} to ${to}.`), { statusCode: 409 });
  }
};

const populateShipment = (query) => query
  .populate("commercialLC", "applicationNo lcNumber status currency amount")
  .populate("purchaseOrder", "orderNo tradeType importStatus status")
  .populate("supplier", "code businessName status")
  .populate("goodsReceipts", "receiptNo receiptDate status totalAcceptedValue")
  .populate("createdBy", "name email")
  .populate("updatedBy", "name email");

const populateDocument = (query) => query
  .populate("commercialLC", "applicationNo lcNumber status")
  .populate("importShipment", "shipmentNo status billOfLadingNo airwayBillNo")
  .populate("purchaseOrder", "orderNo tradeType importStatus")
  .populate("createdBy", "name email")
  .populate("updatedBy", "name email");

const sendError = (res, error, fallback) => {
  if (error?.code === 11000) return res.status(409).json({ message: "A duplicate import shipment/document already exists." });
  if (["ValidationError", "CastError"].includes(error?.name)) return res.status(400).json({ message: error.message });
  if (error?.name === "VersionError") return res.status(409).json({ message: "The import record changed after it was opened. Reload it and try again." });
  return res.status(error?.statusCode || 500).json({ message: error?.statusCode ? error.message : fallback, ...(process.env.NODE_ENV !== "production" ? { error: error.message } : {}) });
};

export const listImportShipments = async (req, res) => {
  try {
    if (!isId(req.params.lcId)) return res.status(400).json({ message: "Invalid Commercial LC ID." });
    const filter = { commercialLC: req.params.lcId };
    if (req.query.status && req.query.status !== "all") {
      const status = clean(req.query.status).toLowerCase();
      if (!IMPORT_SHIPMENT_STATUSES.includes(status)) return res.status(400).json({ message: "Invalid shipment status." });
      filter.status = status;
    }
    const q = clean(req.query.q || req.query.search);
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { shipmentNo: regex },
        { billOfLadingNo: regex },
        { airwayBillNo: regex },
        { carrierName: regex },
        { vesselName: regex },
        { bookingReference: regex },
      ];
    }
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const skip = req.query.skip !== undefined ? Math.max(Number(req.query.skip) || 0, 0) : (page - 1) * limit;

    const [shipments, total] = await Promise.all([
      populateShipment(ImportShipment.find(filter).sort({ createdAt: -1, _id: -1 })).skip(skip).limit(limit).lean(),
      ImportShipment.countDocuments(filter),
    ]);
    const totalPages = Math.ceil(total / limit) || 1;
    return res.json({ count: shipments.length, shipments, total, page, totalPages, limit, skip });
  } catch (error) {
    return sendError(res, error, "Failed to load import shipments.");
  }
};

export const createImportShipment = async (req, res) => {
  try {
    if (!isId(req.params.lcId)) return res.status(400).json({ message: "Invalid Commercial LC ID." });
    const actorId = req.user?._id || null;
    const shipment = await runMongoTransaction(async (session) => {
      const lc = await findCommercialLCForUpdate(req.params.lcId, session);
      if (["draft", "application_submitted", "settled", "closed", "cancelled"].includes(lc.status)) {
        throw Object.assign(new Error("LC must be opened and active before creating a shipment."), { statusCode: 409 });
      }
      const shipmentNo = await nextImportDocumentNumber({ prefix: "IMPSHP", tenantId: req.tenantId, date: parseDate(req.body.etd) || new Date(), session, providedValue: req.body.shipmentNo });
      const requestedStatus = clean(req.body.status || "planned").toLowerCase();
      if (!IMPORT_SHIPMENT_STATUSES.includes(requestedStatus)) throw Object.assign(new Error("Invalid shipment status."), { statusCode: 400 });
      const [created] = await ImportShipment.create([{
        shipmentNo,
        commercialLC: lc._id,
        purchaseOrder: lc.purchaseOrder,
        supplier: lc.supplier,
        shipmentMode: clean(req.body.shipmentMode || "sea").toLowerCase(),
        carrierName: clean(req.body.carrierName),
        vesselName: clean(req.body.vesselName),
        voyageNo: clean(req.body.voyageNo),
        billOfLadingNo: clean(req.body.billOfLadingNo).toUpperCase(),
        airwayBillNo: clean(req.body.airwayBillNo).toUpperCase(),
        bookingReference: clean(req.body.bookingReference),
        portOfLoading: clean(req.body.portOfLoading || lc.portOfLoading),
        portOfDischarge: clean(req.body.portOfDischarge || lc.portOfDischarge),
        finalDestination: clean(req.body.finalDestination),
        etd: parseDate(req.body.etd),
        eta: parseDate(req.body.eta),
        actualDepartureAt: parseDate(req.body.actualDepartureAt),
        actualArrivalAt: parseDate(req.body.actualArrivalAt),
        customsEntryNo: clean(req.body.customsEntryNo).toUpperCase(),
        cnfAgentName: clean(req.body.cnfAgentName),
        containers: Array.isArray(req.body.containers) ? req.body.containers : [],
        status: requestedStatus,
        notes: clean(req.body.notes),
        createdBy: actorId,
        updatedBy: actorId,
      }], sessionOptions(session));
      if (["shipped", "in_transit", "arrived", "documents_received"].includes(requestedStatus)) {
        await updatePurchaseOrderImportStatus({ purchaseOrderId: lc.purchaseOrder, importStatus: "shipped", userId: actorId, session });
      }
      if (["customs_clearance", "customs_cleared"].includes(requestedStatus)) {
        if (["opened", "documents_received"].includes(lc.status)) await updateLCStatus({ lc, status: "customs_clearance", userId: actorId, session });
      }
      return created;
    });
    return res.status(201).json({ message: "Import shipment created.", shipment: await populateShipment(ImportShipment.findById(shipment._id)).lean() });
  } catch (error) {
    return sendError(res, error, "Failed to create import shipment.");
  }
};

export const updateImportShipment = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid import shipment ID." });
    const shipment = await ImportShipment.findById(req.params.id);
    if (!shipment) return res.status(404).json({ message: "Import shipment not found." });
    if (["closed", "cancelled"].includes(shipment.status)) return res.status(409).json({ message: "Closed/cancelled shipment cannot be edited." });
    const stringFields = ["carrierName", "vesselName", "voyageNo", "billOfLadingNo", "airwayBillNo", "bookingReference", "portOfLoading", "portOfDischarge", "finalDestination", "customsEntryNo", "cnfAgentName", "notes"];
    for (const field of stringFields) if (req.body[field] !== undefined) shipment[field] = clean(req.body[field]);
    if (req.body.shipmentMode !== undefined) shipment.shipmentMode = clean(req.body.shipmentMode).toLowerCase();
    for (const field of ["etd", "eta", "actualDepartureAt", "actualArrivalAt", "customsClearedAt"]) if (req.body[field] !== undefined) shipment[field] = req.body[field] ? parseDate(req.body[field]) : null;
    if (req.body.containers !== undefined) shipment.containers = Array.isArray(req.body.containers) ? req.body.containers : [];
    shipment.updatedBy = req.user?._id || null;
    await shipment.save();
    return res.json({ message: "Import shipment updated.", shipment: await populateShipment(ImportShipment.findById(shipment._id)).lean() });
  } catch (error) {
    return sendError(res, error, "Failed to update import shipment.");
  }
};

export const updateImportShipmentStatus = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid import shipment ID." });
    const target = clean(req.body.status).toLowerCase();
    if (!IMPORT_SHIPMENT_STATUSES.includes(target)) return res.status(400).json({ message: "Invalid import shipment status." });
    const actorId = req.user?._id || null;
    const shipment = await runMongoTransaction(async (session) => {
      const query = ImportShipment.findById(req.params.id); if (session) query.session(session);
      const current = await query;
      if (!current) throw Object.assign(new Error("Import shipment not found."), { statusCode: 404 });
      assertShipmentTransition(current.status, target);
      current.status = target;
      current.updatedBy = actorId;
      if (target === "shipped" && !current.actualDepartureAt) current.actualDepartureAt = new Date();
      if (target === "arrived" && !current.actualArrivalAt) current.actualArrivalAt = new Date();
      if (target === "customs_cleared" && !current.customsClearedAt) current.customsClearedAt = new Date();
      await current.save(sessionOptions(session));
      const lc = await findCommercialLCForUpdate(current.commercialLC, session);
      if (["shipped", "in_transit", "arrived", "documents_received"].includes(target)) {
        await updatePurchaseOrderImportStatus({ purchaseOrderId: current.purchaseOrder, importStatus: "shipped", userId: actorId, session });
      }
      if (["customs_clearance", "customs_cleared"].includes(target)) {
        if (["opened", "documents_received"].includes(lc.status)) await updateLCStatus({ lc, status: "customs_clearance", userId: actorId, session });
        else await updatePurchaseOrderImportStatus({ purchaseOrderId: current.purchaseOrder, importStatus: "customs_clearance", userId: actorId, session });
      }
      return current;
    });
    return res.json({ message: `Import shipment moved to ${target}.`, shipment: await populateShipment(ImportShipment.findById(shipment._id)).lean() });
  } catch (error) {
    return sendError(res, error, "Failed to update import shipment status.");
  }
};

export const listImportDocuments = async (req, res) => {
  try {
    if (!isId(req.params.lcId)) return res.status(400).json({ message: "Invalid Commercial LC ID." });
    const filter = { commercialLC: req.params.lcId };
    if (req.query.documentType && req.query.documentType !== "all") {
      const documentType = clean(req.query.documentType).toLowerCase();
      if (!IMPORT_DOCUMENT_TYPES.includes(documentType)) return res.status(400).json({ message: "Invalid import document type." });
      filter.documentType = documentType;
    }
    if (isId(req.query.importShipment)) filter.importShipment = req.query.importShipment;
    const q = clean(req.query.q || req.query.search);
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ documentNo: regex }, { title: regex }, { issuer: regex }, { fileName: regex }, { originalName: regex }];
    }
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const skip = req.query.skip !== undefined ? Math.max(Number(req.query.skip) || 0, 0) : (page - 1) * limit;

    const [documents, total] = await Promise.all([
      populateDocument(ImportDocument.find(filter).sort({ issueDate: -1, createdAt: -1 })).skip(skip).limit(limit).lean(),
      ImportDocument.countDocuments(filter),
    ]);
    const totalPages = Math.ceil(total / limit) || 1;
    return res.json({ count: documents.length, documents, total, page, totalPages, limit, skip });
  } catch (error) {
    return sendError(res, error, "Failed to load import documents.");
  }
};

export const createImportDocument = async (req, res) => {
  try {
    if (!isId(req.params.lcId)) return res.status(400).json({ message: "Invalid Commercial LC ID." });
    const documentType = clean(req.body.documentType).toLowerCase();
    if (!IMPORT_DOCUMENT_TYPES.includes(documentType)) return res.status(400).json({ message: "Invalid import document type." });
    const lc = await CommercialLC.findById(req.params.lcId);
    if (!lc) return res.status(404).json({ message: "Commercial LC not found." });
    let shipment = null;
    if (req.body.importShipment) {
      if (!isId(req.body.importShipment)) return res.status(400).json({ message: "Invalid import shipment ID." });
      shipment = await ImportShipment.findOne({ _id: req.body.importShipment, commercialLC: lc._id });
      if (!shipment) return res.status(409).json({ message: "Import shipment does not belong to this LC." });
    }

    let storageMeta = {
      storageProvider: "external",
      storageKey: "",
      originalName: clean(req.body.fileName),
      storedName: clean(req.body.fileName),
      fileName: clean(req.body.fileName),
      fileUrl: clean(req.body.fileUrl),
      mimeType: clean(req.body.mimeType),
      fileSize: Math.max(Number(req.body.fileSize || 0), 0),
    };

    if (req.file) {
      const uploaded = await uploadDocumentFile({
        file: req.file,
        tenantId: req.tenantId || lc.tenantId,
        lcId: lc._id,
      });
      storageMeta = {
        storageProvider: uploaded.storageProvider,
        storageKey: uploaded.storageKey,
        originalName: uploaded.originalName,
        storedName: uploaded.storedName,
        fileName: uploaded.originalName,
        fileUrl: uploaded.fileUrl || "",
        mimeType: uploaded.mimeType,
        fileSize: uploaded.fileSize,
      };
    }

    const document = await ImportDocument.create({
      commercialLC: lc._id,
      importShipment: shipment?._id || null,
      purchaseOrder: lc.purchaseOrder,
      documentType,
      documentNo: clean(req.body.documentNo).toUpperCase(),
      title: clean(req.body.title) || storageMeta.originalName || "Import Document",
      issueDate: parseDate(req.body.issueDate),
      expiryDate: parseDate(req.body.expiryDate),
      issuer: clean(req.body.issuer),
      ...storageMeta,
      notes: clean(req.body.notes),
      tenantId: req.tenantId || lc.tenantId || null,
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
    });
    if (lc.status === "opened" && ["commercial_invoice", "packing_list", "bill_of_lading", "airway_bill"].includes(documentType)) {
      await updateLCStatus({ lc, status: "documents_received", userId: req.user?._id || null });
    }
    return res.status(201).json({ message: "Import document recorded.", document: await populateDocument(ImportDocument.findById(document._id)).lean() });
  } catch (error) {
    return sendError(res, error, "Failed to create import document.");
  }
};

export const updateImportDocument = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid import document ID." });
    const document = await ImportDocument.findById(req.params.id);
    if (!document) return res.status(404).json({ message: "Import document not found." });
    if (req.body.documentType !== undefined) {
      const type = clean(req.body.documentType).toLowerCase();
      if (!IMPORT_DOCUMENT_TYPES.includes(type)) return res.status(400).json({ message: "Invalid import document type." });
      document.documentType = type;
    }
    for (const field of ["documentNo", "title", "issuer", "fileName", "fileUrl", "mimeType", "notes"]) if (req.body[field] !== undefined) document[field] = clean(req.body[field]);
    for (const field of ["issueDate", "expiryDate"]) if (req.body[field] !== undefined) document[field] = req.body[field] ? parseDate(req.body[field]) : null;
    if (req.body.fileSize !== undefined) document.fileSize = Math.max(Number(req.body.fileSize || 0), 0);
    document.updatedBy = req.user?._id || null;
    await document.save();
    return res.json({ message: "Import document updated.", document: await populateDocument(ImportDocument.findById(document._id)).lean() });
  } catch (error) {
    return sendError(res, error, "Failed to update import document.");
  }
};

export const deleteImportDocument = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid import document ID." });
    const document = await ImportDocument.findById(req.params.id);
    if (!document) return res.status(404).json({ message: "Import document not found." });
    if (document.storageKey) {
      await deleteDocumentFile({
        storageProvider: document.storageProvider,
        storageKey: document.storageKey,
      });
    }
    await document.deleteOne();
    return res.json({ message: "Import document deleted." });
  } catch (error) {
    return sendError(res, error, "Failed to delete import document.");
  }
};

export const getImportDocumentDownloadUrl = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid import document ID." });
    const document = await ImportDocument.findById(req.params.id).lean();
    if (!document) return res.status(404).json({ message: "Import document not found." });
    const downloadUrl = await getDocumentDownloadUrl({
      storageProvider: document.storageProvider,
      storageKey: document.storageKey,
      fileUrl: document.fileUrl,
      originalName: document.originalName || document.fileName || "document",
    });
    return res.json({
      downloadUrl,
      fileName: document.originalName || document.fileName,
      storageProvider: document.storageProvider,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
    });
  } catch (error) {
    return sendError(res, error, "Failed to generate document download URL.");
  }
};

export const getImportMeta = async (_req, res) => res.json({ shipmentStatuses: IMPORT_SHIPMENT_STATUSES, documentTypes: IMPORT_DOCUMENT_TYPES });
