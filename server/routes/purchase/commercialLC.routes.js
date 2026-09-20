import express from "express";
import {
  addCommercialLCCharge,
  amendCommercialLC,
  cancelCommercialLC,
  closeCommercialLC,
  createCommercialLC,
  getCommercialLC,
  getCommercialLCMeta,
  getCommercialLCSummary,
  listCommercialLCs,
  openCommercialLC,
  settleCommercialLC,
  submitCommercialLC,
  updateCommercialLC,
} from "../../controllers/commercialLC.controller.js";
import multer from "multer";
import {
  createImportDocument,
  createImportShipment,
  deleteImportDocument,
  getImportDocumentDownloadUrl,
  getImportMeta,
  listImportDocuments,
  listImportShipments,
  updateImportDocument,
  updateImportShipment,
  updateImportShipmentStatus,
} from "../../controllers/importShipment.controller.js";
import {
  createLandedCost,
  finalizeLandedCost,
  getLandedCost,
  getLandedCostMeta,
  listLandedCosts,
  reverseLandedCost,
  updateLandedCost,
} from "../../controllers/landedCost.controller.js";
import { protect, requirePermission } from "../../middleware/auth.middleware.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

const router = express.Router();
router.use(protect);

router.get("/meta", requirePermission("commercial-lc:view"), getCommercialLCMeta);
router.get("/import-meta", requirePermission("commercial-lc:view"), getImportMeta);
router.get("/landed-cost-meta", requirePermission("commercial-lc:view"), getLandedCostMeta);
router.get("/summary", requirePermission("commercial-lc:view"), getCommercialLCSummary);

router.get("/documents/:id/download-url", requirePermission("commercial-lc:view"), getImportDocumentDownloadUrl);
router.get("/:lcId/documents", requirePermission("commercial-lc:view"), listImportDocuments);
router.post("/:lcId/documents", requirePermission("commercial-lc:manage"), upload.single("file"), createImportDocument);
router.patch("/documents/:id", requirePermission("commercial-lc:manage"), updateImportDocument);
router.delete("/documents/:id", requirePermission("commercial-lc:manage"), deleteImportDocument);
router.patch("/shipments/:id", requirePermission("commercial-lc:manage"), updateImportShipment);
router.post("/shipments/:id/status", requirePermission("commercial-lc:manage"), updateImportShipmentStatus);

router.get("/landed-costs/:id", requirePermission("commercial-lc:view"), getLandedCost);
router.patch("/landed-costs/:id", requirePermission("commercial-lc:manage"), updateLandedCost);
router.post("/landed-costs/:id/finalize", requirePermission("commercial-lc:approve"), finalizeLandedCost);
router.post("/landed-costs/:id/reverse", requirePermission("commercial-lc:approve"), reverseLandedCost);

router.get("/:lcId/shipments", requirePermission("commercial-lc:view"), listImportShipments);
router.post("/:lcId/shipments", requirePermission("commercial-lc:manage"), createImportShipment);
router.get("/:lcId/landed-costs", requirePermission("commercial-lc:view"), listLandedCosts);
router.post("/:lcId/landed-costs", requirePermission("commercial-lc:manage"), createLandedCost);

router.get("/", requirePermission("commercial-lc:view"), listCommercialLCs);
router.post("/", requirePermission("commercial-lc:manage"), createCommercialLC);
router.get("/:id", requirePermission("commercial-lc:view"), getCommercialLC);
router.patch("/:id", requirePermission("commercial-lc:manage"), updateCommercialLC);
router.post("/:id/submit", requirePermission("commercial-lc:manage"), submitCommercialLC);
router.post("/:id/open", requirePermission("commercial-lc:open"), openCommercialLC);
router.post("/:id/amend", requirePermission("commercial-lc:amend"), amendCommercialLC);
router.post("/:id/charges", requirePermission("commercial-lc:manage"), addCommercialLCCharge);
router.post("/:id/settle", requirePermission("commercial-lc:settle"), settleCommercialLC);
router.post("/:id/close", requirePermission("commercial-lc:close"), closeCommercialLC);
router.post("/:id/cancel", requirePermission("commercial-lc:manage"), cancelCommercialLC);

export default router;
