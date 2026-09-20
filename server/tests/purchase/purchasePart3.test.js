import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import "../../config/tenant.plugin.js";
import { sameTenant } from "../../config/tenantContext.js";
import { ERP_MODULES } from "../../config/erpModules.js";
import { PERMISSION_KEYS } from "../../models/administration/permissionGroup.model.js";
import {
  buildIssueFilter,
  assertEligibleAnalysisRequest,
  prepareIndustrialIssueDraft,
  prepareQualityResult,
} from "../../controllers/purchase/purchaseWorkflow.controller.js";
import {
  isDangerousFile,
  isImageMimeType,
  uploadDocumentFile,
  getDocumentDownloadUrl,
  deleteDocumentFile,
} from "../../services/storage/documentStorage.service.js";

// ---------------------------------------------------------------------------
// 1. Multi-Tenant / Company Isolation Tests
// ---------------------------------------------------------------------------
test("sameTenant correctly validates identical and rejects cross-tenant IDs", () => {
  const tenantA = new mongoose.Types.ObjectId();
  const tenantB = new mongoose.Types.ObjectId();
  const tenantAStr = tenantA.toString();

  assert.equal(sameTenant(tenantA, tenantA), true);
  assert.equal(sameTenant(tenantA, tenantAStr), true);
  assert.equal(sameTenant(tenantAStr, tenantA), true);
  assert.equal(sameTenant(tenantA, tenantB), false);
  assert.equal(sameTenant(tenantA, null), false);
  assert.equal(sameTenant(null, tenantB), false);
  assert.equal(sameTenant(null, null), false);
});

test("assertEligibleAnalysisRequest enforces approved state and prevents duplicate analysis", () => {
  const validRequest = {
    _id: new mongoose.Types.ObjectId(),
    status: "approved",
    analysis: null,
    tenantId: new mongoose.Types.ObjectId(),
  };

  assert.equal(assertEligibleAnalysisRequest(validRequest).status, "approved");

  assert.throws(
    () => assertEligibleAnalysisRequest({ ...validRequest, status: "pending" }),
    /approved Purchase Request/i
  );
  assert.throws(
    () => assertEligibleAnalysisRequest({ ...validRequest, status: "rejected" }),
    /approved Purchase Request/i
  );
  assert.throws(
    () => assertEligibleAnalysisRequest({ ...validRequest, analysis: new mongoose.Types.ObjectId() }),
    /already has an Analysis/i
  );
});

test("prepareIndustrialIssueDraft validates completed status and lineages", () => {
  const analysisId = new mongoose.Types.ObjectId();
  const requestId = new mongoose.Types.ObjectId();
  const supplierId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();

  const completedAnalysis = {
    _id: analysisId,
    status: "completed",
    request: { _id: requestId, requestReference: "PR-2026-001" },
    product: productId,
    selectedSupplier: supplierId,
    selectedSupplierProduct: null,
    finalQuantity: 50,
    purchaseUnitPrice: 100,
    catalogueUnitPrice: 110,
    discountPercent: 5,
  };

  const draft = prepareIndustrialIssueDraft(completedAnalysis, {
    paymentPlan: "full_due",
    note: "Industrial procurement issue",
  });

  assert.equal(draft.purchaseType, "industrial_purchase");
  assert.equal(String(draft.analysis), String(analysisId));
  assert.equal(String(draft.request), String(requestId));
  assert.equal(draft.sourceRequestReference, "PR-2026-001");
  assert.equal(draft.quantity, 50);
  assert.equal(draft.unitPrice, 100);
  assert.equal(draft.paymentPlan, "full_due");

  assert.throws(
    () => prepareIndustrialIssueDraft({ ...completedAnalysis, status: "pending" }, {}),
    /completed purchase analysis/i
  );
});

// ---------------------------------------------------------------------------
// 2. Purchase Permission Matrix & Scope Tests
// ---------------------------------------------------------------------------
test("ERP modules registry declares granular purchase sub-module permission prefixes", () => {
  const purchaseModule = ERP_MODULES.find((m) => m.id === "purchase");
  assert.ok(purchaseModule, "Purchase module must exist in ERP_MODULES");

  const prefixes = purchaseModule.permissionPrefixes || [];
  assert.ok(prefixes.includes("purchase-request"), "Must include purchase-request");
  assert.ok(prefixes.includes("purchase-analysis"), "Must include purchase-analysis");
  assert.ok(prefixes.includes("purchase-issue"), "Must include purchase-issue");
  assert.ok(prefixes.includes("purchase-quality"), "Must include purchase-quality");
  assert.ok(prefixes.includes("purchase-due"), "Must include purchase-due");
  assert.ok(prefixes.includes("price-analysis"), "Must include price-analysis");
  assert.ok(prefixes.includes("purchase-type"), "Must include purchase-type");
});

test("PERMISSION_KEYS contains all canonical purchase sub-module permissions", () => {
  const requiredPermissions = [
    "purchase-request:view",
    "purchase-request:manage",
    "purchase-request:approve",
    "purchase-analysis:view",
    "purchase-analysis:manage",
    "purchase-issue:view",
    "purchase-issue:manage",
    "purchase-quality:view",
    "purchase-quality:manage",
    "purchase-due:view",
    "purchase-due:pay",
    "price-analysis:view",
    "price-analysis:review",
    "purchase-type:view",
    "purchase-type:manage",
  ];

  for (const perm of requiredPermissions) {
    assert.ok(
      PERMISSION_KEYS.includes(perm),
      `PERMISSION_KEYS must contain '${perm}'`
    );
  }
});

// ---------------------------------------------------------------------------
// 3. Document Storage Service (Cloudinary & Cloudflare R2) Tests
// ---------------------------------------------------------------------------
test("isDangerousFile rejects executables and scripts while allowing safe business docs", () => {
  assert.equal(isDangerousFile("malware.exe", "application/x-msdownload"), true);
  assert.equal(isDangerousFile("script.bat", ""), true);
  assert.equal(isDangerousFile("exploit.sh", "application/x-sh"), true);
  assert.equal(isDangerousFile("installer.msi", ""), true);
  assert.equal(isDangerousFile("invoice.pdf.exe", ""), true);

  assert.equal(isDangerousFile("commercial_invoice.pdf", "application/pdf"), false);
  assert.equal(isDangerousFile("packing_list.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), false);
  assert.equal(isDangerousFile("bill_of_lading.jpg", "image/jpeg"), false);
  assert.equal(isDangerousFile("certificate.png", "image/png"), false);
});

test("isImageMimeType distinguishes standard raster images from vectors/documents", () => {
  assert.equal(isImageMimeType("image/jpeg"), true);
  assert.equal(isImageMimeType("image/png"), true);
  assert.equal(isImageMimeType("image/webp"), true);
  assert.equal(isImageMimeType("image/gif"), true);

  assert.equal(isImageMimeType("image/svg+xml"), false, "SVG must be treated as document for script injection safety");
  assert.equal(isImageMimeType("application/pdf"), false);
  assert.equal(isImageMimeType("text/plain"), false);
});

test("uploadDocumentFile routes business document to R2 storage with secure key and no permanent public URL", async () => {
  const dummyPdf = Buffer.from("%PDF-1.4 sample commercial invoice content");
  const tenantId = new mongoose.Types.ObjectId();
  const lcId = new mongoose.Types.ObjectId();

  const result = await uploadDocumentFile({
    file: {
      originalname: "bill_of_lading_102.pdf",
      mimetype: "application/pdf",
      buffer: dummyPdf,
      size: dummyPdf.length,
    },
    tenantId,
    lcId,
  });

  assert.equal(result.storageProvider, "r2");
  assert.equal(result.originalName, "bill_of_lading_102.pdf");
  assert.equal(result.fileUrl, "", "Private R2 document must never expose permanent public URL");
  assert.ok(result.storageKey.startsWith(`commercial-lc/${tenantId}/${lcId}/`));
  assert.equal(result.fileSize, dummyPdf.length);

  // Generate on-demand presigned URL
  const downloadUrl = await getDocumentDownloadUrl({
    storageProvider: result.storageProvider,
    storageKey: result.storageKey,
    originalName: result.originalName,
    expiresIn: 300,
  });

  assert.ok(downloadUrl.length > 0, "Presigned URL must be generated");
  assert.ok(downloadUrl.includes(encodeURIComponent(result.storageKey)) || downloadUrl.startsWith("http"));

  // Clean up asset
  const deleted = await deleteDocumentFile({
    storageProvider: result.storageProvider,
    storageKey: result.storageKey,
  });
  assert.equal(deleted, true);
});

test("uploadDocumentFile rejects dangerous executable files with 400 error", async () => {
  const dummyExe = Buffer.from("MZ malicious executable header");

  await assert.rejects(
    () =>
      uploadDocumentFile({
        file: {
          originalname: "invoice_malware.exe",
          mimetype: "application/x-msdownload",
          buffer: dummyExe,
          size: dummyExe.length,
        },
      }),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /Executable or unsafe file formats are not permitted/i);
      return true;
    }
  );
});

// ---------------------------------------------------------------------------
// 4. Server-Side Pagination & Filtering Tests
// ---------------------------------------------------------------------------
test("buildIssueFilter correctly sets up search and attribute queries", () => {
  const supplierId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();

  const filter = buildIssueFilter({
    status: "ready",
    purchaseType: "industrial_purchase",
    supplier: String(supplierId),
    product: String(productId),
    q: "PO-2026",
  });

  assert.equal(filter.status, "ready");
  assert.equal(filter.purchaseType, "industrial_purchase");
  assert.equal(filter.supplier, String(supplierId));
  assert.equal(filter.product, String(productId));
  assert.ok(Array.isArray(filter.$or));
  assert.equal(filter.$or.length, 3);
});

test("prepareQualityResult validates total received quantity allocation across accepted, rejected, quarantine", () => {
  const result = prepareQualityResult({
    inspectedQuantity: 100,
    acceptedQuantity: 80,
    quarantineQuantity: 10,
    rejectedQuantity: 10,
    receivedQuantity: 100,
    note: "All units inspected",
  });

  assert.equal(result.inspectedQuantity, 100);
  assert.equal(result.acceptedQuantity, 80);
  assert.equal(result.quarantineQuantity, 10);
  assert.equal(result.rejectedQuantity, 10);
  assert.equal(result.status, "partially_accepted");

  // Rejects quantities exceeding inspected quantity
  assert.throws(
    () =>
      prepareQualityResult({
        inspectedQuantity: 100,
        acceptedQuantity: 80,
        quarantineQuantity: 20,
        rejectedQuantity: 10, // sum is 110 > 100
        receivedQuantity: 100,
      }),
    /exceed inspected quantity/i
  );
});
