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
