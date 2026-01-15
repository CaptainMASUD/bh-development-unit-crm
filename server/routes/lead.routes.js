// routes/lead.routes.js
import express from "express"
import {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  addLeadNote,
  convertLeadToCustomer,
  deleteLead,
} from "../controllers/lead.controller.js"

import { protect, isAdminOrSuperAdmin } from "../middleware/auth.middleware.js"

const router = express.Router()

router.use(protect)

router.post("/", createLead)
router.get("/", getLeads)
router.get("/:id", getLeadById)
router.patch("/:id", updateLead)
router.post("/:id/notes", addLeadNote)

// ✅ only admin/superadmin
router.post("/:id/convert", isAdminOrSuperAdmin, convertLeadToCustomer)

// ✅ delete lead (admin/superadmin)
router.delete("/:id", isAdminOrSuperAdmin, deleteLead)

export default router
