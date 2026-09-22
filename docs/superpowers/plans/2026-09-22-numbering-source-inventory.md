# ERP numbering source inventory

This is the integration checklist for `server/config/documentNumberTypes.js`. Each key's precise `model`, `field`, `producers`, default mode/pattern, context tokens, length and reset policy are stored in that manifest and verified by `server/tests/administration/documentNumberTypes.test.js`. A producer is a current assignment location, not merely a display or reporting consumer. The manifest must be updated when additional producers are found during integration.

| Module | Registry keys | Current creation/numbering sources |
| --- | --- | --- |
| Inventory master data | `inventory.product`, `inventory.category`, `inventory.unit`, `inventory.warehouse`, `inventory.location` | `product.controller.js` scans SKUs by category; other create controllers accept entered codes. |
| Inventory operations | `inventory.stock-request`, `inventory.stock-issue`, `inventory.stock-transfer`, `inventory.stock-adjustment`, `inventory.stock-movement`, `inventory.quality-inspection`, `inventory.stock-inspection`, `inventory.tracking`, `inventory.revaluation`, `inventory.loss` | `inventoryOperations.controller.js` constructs references; stock movement/transfer/adjustment models have pre-save fallback generators; revaluation controller generates its number. |
| Purchase workflow | `purchase.request`, `purchase.analysis`, `purchase.issue`, `purchase.payment`, `purchase.due`, `purchase.quality`, `purchase.price-analysis` | `purchaseWorkflow.controller.js` and `purchaseExecution.service.js` construct references using local `ref`/`makeRef` helpers. |
| Purchase documents | `purchase.order`, `purchase.receipt`, `purchase.return`, `purchase.lc-application`, `purchase.import-shipment`, `purchase.landed-cost` | Order, receipt and return controllers maintain local document counters; import flows use `nextImportDocumentNumber`; quick purchase order creation also occurs in `purchaseExecution.service.js`. |
| Sales | `sales.quotation`, `sales.order`, `sales.delivery`, `sales.invoice`, `sales.return` | `salesNumber.service.js` allocates from `SalesSequence`; Sales controllers and CRM lead-order flow call it. Monthly reset and `PREFIX-YYYYMM-NNNNNN` output are established defaults. |
| Accounting | `accounting.journal`, `accounting.voucher`, `accounting.bill`, `accounting.invoice` | `accountingNumbering.service.js` uses `VoucherSequence`; posting and accounting controllers, CRM invoice creation and Sales integration call it. Fiscal-year reset and existing accounting format are established defaults. |
| Manufacturing | `manufacturing.bom`, `manufacturing.routing`, `manufacturing.plan`, `manufacturing.mrp`, `manufacturing.mo`, `manufacturing.wo`, `manufacturing.issue`, `manufacturing.entry`, `manufacturing.inspection`, `manufacturing.ncr`, `manufacturing.scrap`, `manufacturing.rework`, `manufacturing.schedule`, `manufacturing.maintenance-plan`, `manufacturing.maintenance-order`, `manufacturing.subcontract`, `manufacturing.cost` | `manufacturingNumbering.service.js` allocates from `ManufacturingSequence`; controllers and background services call it, including work-order expansion and preventive maintenance. `PREFIX-YYYY-NNNNNN` output is the established default. |
| CRM | `crm.lead`, `crm.deal`, `crm.proposal`, `crm.invoice` | Lead model pre-save hook and CRM deal/proposal/invoice controllers own these values. CRM `Order.orderNo` is not listed because current order creation uses SalesOrder and `sales.order`. |
| Payroll | `payroll.loan` | `employeeLoan.controller.js` generates or accepts `loanNo`. |
| Supplier | `supplier.company` | `supplier.controller.js` creates immutable supplier `code`; its current index is globally unique and needs a tenant-aware migration before tenant-local Auto codes can be activated. |
| Administration | `administration.branch`, `administration.employee` | Company controller and tenant service create branch `code`; user controller accepts `employeeId`. Platform Company.code is outside a tenant and is not covered by tenant rules. |

## Explicit exclusions

- MongoDB `_id`, source-link IDs, generated in-memory row IDs, and copied references are not independent numbering types.
- Supplier invoice/registration/trade-license numbers, customer purchase-order references, bank cheque or LC bank references, shipping container/voyage/airway-bill/customs references, vehicle numbers, and manufacturer serial numbers belong to external parties; they remain user-supplied.
- Product barcodes, warehouse barcodes and tax codes are not treated as document numbers. Their scanning/standards contracts must remain intact.
- `PurchaseOrder.purchaseReference` and `requestReference` are copied from existing upstream documents rather than allocated again.

## Source-coverage release gate

Before completion, search all `server/controllers`, `server/services` and `server/models` for direct writes to every manifest field and calls to `nextAccountingNumber`, `nextSalesNumber`, `nextManufacturingNumber`, `nextDocumentNumber`, `generateProductSku`, `makeRef`, and timestamp/random-number helpers. Each producer must call the central allocation service or a thin adapter that calls it. Model pre-save fallback numbering must be removed for registered fields. The coverage test in Task 9 enforces this checklist.
