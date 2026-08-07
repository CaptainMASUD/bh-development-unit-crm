import { Router } from "express";
import { protect, requireAnyPermission, requirePermission } from "../../middleware/auth.middleware.js";
import { asyncHandler } from "../../utils/salesError.js";

import {
  createQuotation,
  listQuotations,
  getQuotation,
  updateQuotation,
  changeQuotationStatus,
  convertQuotationToOrder,
} from "../../controllers/sales/salesQuotation.controller.js";

import {
  listSalesOrders,
  getSalesOrder,
  updateSalesOrder,
  submitSalesOrderForApproval,
  approveSalesOrder,
  rejectSalesOrder,
  confirmSalesOrder,
  cancelSalesOrder,
  closeSalesOrder,
} from "../../controllers/sales/salesOrder.controller.js";

import {
  createDeliveryNote,
  listDeliveryNotes,
  getDeliveryNote,
  updateDeliveryStatus,
  confirmDelivery,
} from "../../controllers/sales/deliveryNote.controller.js";

import {
  createSalesInvoice,
  downloadSalesInvoicePdf,
  listSalesInvoices,
  getSalesInvoice,
  postSalesInvoice,
  sendSalesInvoice,
  allocatePayment,
  reversePayment,
  voidSalesInvoice,
} from "../../controllers/sales/salesInvoice.controller.js";
import { getSalesSummary } from "../../controllers/sales/salesReport.controller.js";
import {
  approveSalesReturn,
  cancelSalesReturn,
  createSalesReturn,
  getSalesReturn,
  listSalesReturns,
  rejectSalesReturn,
  refundSalesReturn,
  submitSalesReturn,
} from "../../controllers/sales/salesReturn.controller.js";
import { getSalesOptions } from "../../controllers/sales/salesOptions.controller.js";

export const SALES_PERMISSIONS = Object.freeze({
  QUOTATION_VIEW: "sales-quotation:view",
  QUOTATION_MANAGE: "sales-quotation:manage",
  ORDER_VIEW: "sales-order:view",
  ORDER_MANAGE: "sales-order:manage",
  ORDER_APPROVE: "sales-order:approve",
  DELIVERY_VIEW: "sales-delivery:view",
  DELIVERY_MANAGE: "sales-delivery:manage",
  DELIVERY_POST: "sales-delivery:post",
  INVOICE_VIEW: "sales-invoice:view",
  INVOICE_MANAGE: "sales-invoice:manage",
  INVOICE_POST: "sales-invoice:post",
  PAYMENT_MANAGE: "sales-payment:manage",
  REPORT_VIEW: "sales-report:view",
  RETURN_VIEW: "sales-return:view",
  RETURN_MANAGE: "sales-return:manage",
  RETURN_APPROVE: "sales-return:approve",
});

const router = Router();
router.use(protect);

router.get(
  "/options",
  requireAnyPermission([
    SALES_PERMISSIONS.QUOTATION_MANAGE,
    SALES_PERMISSIONS.ORDER_MANAGE,
    SALES_PERMISSIONS.DELIVERY_MANAGE,
    SALES_PERMISSIONS.INVOICE_MANAGE,
    SALES_PERMISSIONS.PAYMENT_MANAGE,
    SALES_PERMISSIONS.RETURN_MANAGE,
  ]),
  asyncHandler(getSalesOptions)
);

router.get("/dashboard", requirePermission(SALES_PERMISSIONS.REPORT_VIEW), asyncHandler(getSalesSummary));
router.get("/reports/summary", requirePermission(SALES_PERMISSIONS.REPORT_VIEW), asyncHandler(getSalesSummary));

router.route("/returns")
  .get(requirePermission(SALES_PERMISSIONS.RETURN_VIEW), asyncHandler(listSalesReturns))
  .post(requirePermission(SALES_PERMISSIONS.RETURN_MANAGE), asyncHandler(createSalesReturn));
router.get("/returns/:id", requirePermission(SALES_PERMISSIONS.RETURN_VIEW), asyncHandler(getSalesReturn));
router.post("/returns/:id/submit", requirePermission(SALES_PERMISSIONS.RETURN_MANAGE), asyncHandler(submitSalesReturn));
router.post("/returns/:id/approve", requirePermission(SALES_PERMISSIONS.RETURN_APPROVE), asyncHandler(approveSalesReturn));
router.post("/returns/:id/reject", requirePermission(SALES_PERMISSIONS.RETURN_APPROVE), asyncHandler(rejectSalesReturn));
router.post("/returns/:id/cancel", requirePermission(SALES_PERMISSIONS.RETURN_MANAGE), asyncHandler(cancelSalesReturn));
router.post("/returns/:id/refund", requirePermission(SALES_PERMISSIONS.PAYMENT_MANAGE), asyncHandler(refundSalesReturn));

  // Quotations
  router
    .route("/quotations")
    .get(requirePermission(SALES_PERMISSIONS.QUOTATION_VIEW), asyncHandler(listQuotations))
    .post(requirePermission(SALES_PERMISSIONS.QUOTATION_MANAGE), asyncHandler(createQuotation));

  router
    .route("/quotations/:id")
    .get(requirePermission(SALES_PERMISSIONS.QUOTATION_VIEW), asyncHandler(getQuotation))
    .patch(requirePermission(SALES_PERMISSIONS.QUOTATION_MANAGE), asyncHandler(updateQuotation));

  router.patch(
    "/quotations/:id/status",
    requirePermission(SALES_PERMISSIONS.QUOTATION_MANAGE),
    asyncHandler(changeQuotationStatus)
  );

  router.post(
    "/quotations/:id/convert-to-order",
    requirePermission(SALES_PERMISSIONS.ORDER_MANAGE),
    asyncHandler(convertQuotationToOrder)
  );

  // Sales orders
  router
    .route("/orders")
    .get(requirePermission(SALES_PERMISSIONS.ORDER_VIEW), asyncHandler(listSalesOrders));

  router
    .route("/orders/:id")
    .get(requirePermission(SALES_PERMISSIONS.ORDER_VIEW), asyncHandler(getSalesOrder))
    .patch(requirePermission(SALES_PERMISSIONS.ORDER_MANAGE), asyncHandler(updateSalesOrder));

  router.post(
    "/orders/:id/submit",
    requirePermission(SALES_PERMISSIONS.ORDER_MANAGE),
    asyncHandler(submitSalesOrderForApproval)
  );
  router.post(
    "/orders/:id/approve",
    requirePermission(SALES_PERMISSIONS.ORDER_APPROVE),
    asyncHandler(approveSalesOrder)
  );
  router.post(
    "/orders/:id/reject",
    requirePermission(SALES_PERMISSIONS.ORDER_APPROVE),
    asyncHandler(rejectSalesOrder)
  );
  router.post(
    "/orders/:id/confirm",
    requirePermission(SALES_PERMISSIONS.ORDER_APPROVE),
    asyncHandler(confirmSalesOrder)
  );
  router.post(
    "/orders/:id/cancel",
    requirePermission(SALES_PERMISSIONS.ORDER_MANAGE),
    asyncHandler(cancelSalesOrder)
  );
  router.post(
    "/orders/:id/close",
    requirePermission(SALES_PERMISSIONS.ORDER_APPROVE),
    asyncHandler(closeSalesOrder)
  );

  // Delivery notes
  router
    .route("/deliveries")
    .get(requirePermission(SALES_PERMISSIONS.DELIVERY_VIEW), asyncHandler(listDeliveryNotes))
    .post(requirePermission(SALES_PERMISSIONS.DELIVERY_MANAGE), asyncHandler(createDeliveryNote));

  router.get(
    "/deliveries/:id",
    requirePermission(SALES_PERMISSIONS.DELIVERY_VIEW),
    asyncHandler(getDeliveryNote)
  );
  router.patch(
    "/deliveries/:id/status",
    requirePermission(SALES_PERMISSIONS.DELIVERY_MANAGE),
    asyncHandler(updateDeliveryStatus)
  );
  router.post(
    "/deliveries/:id/confirm-delivery",
    requirePermission(SALES_PERMISSIONS.DELIVERY_POST),
    asyncHandler(confirmDelivery)
  );

  // Sales invoices
  router
    .route("/invoices")
    .get(requirePermission(SALES_PERMISSIONS.INVOICE_VIEW), asyncHandler(listSalesInvoices))
    .post(requirePermission(SALES_PERMISSIONS.INVOICE_MANAGE), asyncHandler(createSalesInvoice));

router.get(
  "/invoices/:id",
    requirePermission(SALES_PERMISSIONS.INVOICE_VIEW),
    asyncHandler(getSalesInvoice)
);
router.get(
  "/invoices/:id/pdf",
  requirePermission(SALES_PERMISSIONS.INVOICE_VIEW),
  asyncHandler(downloadSalesInvoicePdf)
);
  router.post(
    "/invoices/:id/post",
    requirePermission(SALES_PERMISSIONS.INVOICE_POST),
    asyncHandler(postSalesInvoice)
  );
  router.post(
    "/invoices/:id/send",
    requirePermission(SALES_PERMISSIONS.INVOICE_MANAGE),
    asyncHandler(sendSalesInvoice)
  );
router.post(
  "/invoices/:id/payments",
    requirePermission(SALES_PERMISSIONS.PAYMENT_MANAGE),
    asyncHandler(allocatePayment)
);
router.post(
  "/invoices/:id/payments/:paymentId/reverse",
  requirePermission(SALES_PERMISSIONS.PAYMENT_MANAGE),
  asyncHandler(reversePayment)
);
  router.post(
    "/invoices/:id/void",
    requirePermission(SALES_PERMISSIONS.INVOICE_POST),
    asyncHandler(voidSalesInvoice)
  );

export default router;
