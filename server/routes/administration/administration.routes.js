import express from "express";
import multer from "multer";

import {
  deleteCurrentCompanyLogo,
  getCurrentCompany,
  getCurrentAdministrationDashboard,
  getCurrentSystemSettings,
  patchCurrentCompany,
  patchCurrentSystemSettings,
  putCurrentCompanyLogo,
} from "../../controllers/administration/administration.controller.js";
import {
  isTenantUser,
  protect,
  requireModule,
  requirePermission,
} from "../../middleware/auth.middleware.js";
import {
  getDocumentNumbering, patchDocumentNumbering, previewDocumentNumbering,
} from "../../controllers/administration/documentNumbering.controller.js";
import {
  createDepartment, deleteDepartment, listDepartmentHeads, listDepartments, updateDepartment,
} from "../../controllers/administration/accessControl.controller.js";
import {
  getAuditTrail,
  getAuditTrailDetail,
  getAuditTrailFilters,
} from "../../controllers/administration/auditTrail.controller.js";
import {
  getMatrixCatalog,
  getRole,
  getRoles,
  patchRole,
  postRole,
  removeRole,
} from "../../controllers/administration/roleManagement.controller.js";

const router = express.Router();
const companyLogoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    const allowed = new Set(["image/png", "image/jpeg", "image/webp"]);
    if (!allowed.has(String(file.mimetype || "").toLowerCase())) {
      return callback(Object.assign(new Error("Company logo must be PNG, JPG, or WEBP."), { statusCode: 400 }));
    }
    return callback(null, true);
  },
});

router.use(protect, requireModule("administration"), isTenantUser);

router.get(
  "/dashboard",
  requirePermission("administration-dashboard:view"),
  getCurrentAdministrationDashboard
);

router.get("/company", requirePermission("company:view"), getCurrentCompany);
router.patch("/company", requirePermission("company:manage"), patchCurrentCompany);
router.put(
  "/company/logo",
  requirePermission("company:manage"),
  companyLogoUpload.single("logo"),
  putCurrentCompanyLogo
);
router.delete(
  "/company/logo",
  requirePermission("company:manage"),
  deleteCurrentCompanyLogo
);

router.get(
  "/settings",
  requirePermission("system-settings:view"),
  getCurrentSystemSettings
);
router.patch(
  "/settings",
  requirePermission("system-settings:manage"),
  patchCurrentSystemSettings
);

router.get("/document-numbering", requirePermission("system-settings:view"), getDocumentNumbering);
router.patch("/document-numbering/:typeKey", requirePermission("system-settings:manage"), patchDocumentNumbering);
router.post("/document-numbering/:typeKey/preview", requirePermission("system-settings:view"), previewDocumentNumbering);

router.get("/departments", requirePermission("access-control:view"), listDepartments);
router.get("/department-heads", requirePermission("access-control:view"), listDepartmentHeads);
router.post("/departments", requirePermission("access-control:manage"), createDepartment);
router.patch("/departments/:id", requirePermission("access-control:manage"), updateDepartment);
router.delete("/departments/:id", requirePermission("access-control:manage"), deleteDepartment);

router.get("/audit-trail", requirePermission("access-control:view"), getAuditTrail);
router.get("/audit-trail/filters", requirePermission("access-control:view"), getAuditTrailFilters);
router.get("/audit-trail/:id", requirePermission("access-control:view"), getAuditTrailDetail);

router.get("/roles", requirePermission("access-control:view"), getRoles);
router.get("/roles/matrix", requirePermission("access-control:view"), getMatrixCatalog);
router.get("/roles/:id", requirePermission("access-control:view"), getRole);
router.post("/roles", requirePermission("access-control:manage"), postRole);
router.patch("/roles/:id", requirePermission("access-control:manage"), patchRole);
router.delete("/roles/:id", requirePermission("access-control:manage"), removeRole);

router.use((error, _req, _res, next) => {
  if (error instanceof multer.MulterError) {
    return next(Object.assign(new Error(
      error.code === "LIMIT_FILE_SIZE"
        ? "Company logo must not exceed 5 MB."
        : "Company logo upload is invalid."
    ), { statusCode: 400 }));
  }
  return next(error);
});

export default router;
