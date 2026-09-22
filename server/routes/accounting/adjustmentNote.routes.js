import express from "express";
import { protect, requireModule, requirePermission } from "../../middleware/auth.middleware.js";
import {
  listAdjustmentNotes,
  getAdjustmentNoteById,
  getEligibleAdjustmentInfo,
  createNote,
  updateNote,
  approveNote,
  postNote,
  cancelNote,
  allocateCredit,
} from "../../controllers/accounting/adjustmentNote.controller.js";

const router = express.Router();

router.use(protect, requireModule("accounting"));

router.get("/eligible", requirePermission("finance:credit-note:view"), getEligibleAdjustmentInfo);
router.get("/", requirePermission("finance:credit-note:view"), listAdjustmentNotes);
router.get("/:id", requirePermission("finance:credit-note:view"), getAdjustmentNoteById);

router.post("/", requirePermission("finance:credit-note:manage"), createNote);
router.put("/:id", requirePermission("finance:credit-note:manage"), updateNote);
router.patch("/:id/approve", requirePermission("finance:credit-note:manage"), approveNote);
router.post("/:id/post", requirePermission("finance:credit-note:manage"), postNote);
router.post("/:id/cancel", requirePermission("finance:credit-note:manage"), cancelNote);
router.post("/:id/allocate", requirePermission("finance:credit-note:manage"), allocateCredit);

export default router;
