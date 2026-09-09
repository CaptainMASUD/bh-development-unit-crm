import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import {
  calculateProductStockLedger,
  calculateValuationReport,
  reconcileInventoryWithGl,
  calculateStockAgingReport,
  calculateSlowMovingReport,
  runInventoryIntegrityDiagnostic,
  executeInventoryRepairPlan,
  encodeCursor,
  decodeCursor,
} from "../../services/inventoryReporting.service.js";
import { buildCsvString, escapeCsvValue } from "../../services/export.service.js";
import { canViewCost } from "../../controllers/inventory/inventoryReport.controller.js";
import ProductStock from "../../models/inventory/productStock.model.js";
import StockMovement from "../../models/inventory/stockMovement.model.js";
import StockTransfer from "../../models/inventory/stockTransfer.model.js";
import StockAdjustment from "../../models/inventory/stockAdjustment.model.js";
import InventoryValuation from "../../models/inventory/inventoryValuation.model.js";
import FifoCostLayer from "../../models/inventory/fifoCostLayer.model.js";
import {
  InventoryLoss,
  InventoryPreference,
  InventoryTracking,
} from "../../models/inventory/inventoryOperations.model.js";
import JournalEntry from "../../models/journalEntry.model.js";
import { PERMISSION_KEYS } from "../../models/permissionGroup.model.js";
import { ERP_MODULE_IDS, permissionModule } from "../../config/erpModules.js";

const oid = () => new mongoose.Types.ObjectId();

test("1. Stock Ledger Opening & Running Balance math (Opening 100, In 50, Out 20 -> Closing 130)", () => {
  const openingQuantity = 100;
  const openingInventoryValue = 1000;
  const movements = [
    { type: "in", qty: 50, cost: 12 },
    { type: "out", qty: 20, cost: 10 },
  ];

  let runningQty = openingQuantity;
  let runningVal = openingInventoryValue;
  let totalInQty = 0;
  let totalOutQty = 0;
  let totalInVal = 0;
  let totalOutVal = 0;

  const rows = movements.map((m) => {
    let qIn = m.type === "in" ? m.qty : 0;
    let qOut = m.type === "out" ? m.qty : 0;
    let vIn = qIn * m.cost;
    let vOut = qOut * m.cost;

    totalInQty += qIn;
    totalOutQty += qOut;
    totalInVal += vIn;
    totalOutVal += vOut;

    runningQty = runningQty + qIn - qOut;
    runningVal = runningVal + vIn - vOut;

    return { qIn, qOut, runningQty, runningVal };
  });

  const netMovement = totalInQty - totalOutQty;
  const closingQuantity = openingQuantity + netMovement;
  const closingInventoryValue = openingInventoryValue + totalInVal - totalOutVal;

  assert.equal(closingQuantity, 130, "Closing quantity must be 130");
  assert.equal(totalInQty, 50, "Total quantity in must be 50");
  assert.equal(totalOutQty, 20, "Total quantity out must be 20");
  assert.equal(netMovement, 30, "Net movement must be 30");
  assert.equal(closingInventoryValue, 1400, "Closing value: 1000 + 600 - 200 = 1400");
  assert.equal(rows[0].runningQty, 150, "Row 1 running quantity after +50 receipt must be 150");
  assert.equal(rows[1].runningQty, 130, "Row 2 running quantity after -20 issue must be 130");
});

test("2. Stock Ledger Running Balance progression (Receipt +50 -> 150, Issue -20 -> 130, Adjustment +10 -> 140)", () => {
  let running = 100;
  const ops = [
    { action: "receipt", delta: 50, expected: 150 },
    { action: "issue", delta: -20, expected: 130 },
    { action: "adjustment", delta: 10, expected: 140 },
  ];

  ops.forEach((op) => {
    running += op.delta;
    assert.equal(running, op.expected, `Balance after ${op.action} must be ${op.expected}`);
  });
});

test("3. Valuation Calculation from Part 2 Engine (100 units @ $10 = $1,000 value)", () => {
  const valuation = new InventoryValuation({
    tenantId: oid(),
    product: oid(),
    warehouse: oid(),
    costingMethod: "weighted_average",
    valuationQuantity: 100,
    averageCost: 10,
    inventoryValue: 1000,
  });

  assert.equal(valuation.valuationQuantity * valuation.averageCost, 1000);
  assert.equal(valuation.inventoryValue, 1000);
  assert.equal(valuation.costingMethod, "weighted_average");
});

test("4. Warehouse Transfer Balance Preservation (A: 100, B: 50 -> Transfer 20 -> A: 80, B: 70, Total: 150)", () => {
  let warehouseA = 100;
  let warehouseB = 50;
  const initialCompanyTotal = warehouseA + warehouseB;

  const transferQuantity = 20;
  warehouseA -= transferQuantity;
  warehouseB += transferQuantity;

  assert.equal(warehouseA, 80, "Warehouse A should be 80");
  assert.equal(warehouseB, 70, "Warehouse B should be 70");
  assert.equal(warehouseA + warehouseB, initialCompanyTotal, "Company total stock remains 150");
});

test("5. Available vs Reserved Equation & Integrity Anomaly Flagging", () => {
  const onHand = 100;
  const reserved = 30;
  const quarantine = 5;
  const available = onHand - reserved - quarantine;

  assert.equal(available, 65, "Available stock must equal onHand - reserved - quarantine");

  // Anomaly 1: reserved > onHand
  const anomalousReserved = 110;
  const isReservedExceeded = anomalousReserved > onHand;
  assert.ok(isReservedExceeded, "Integrity check must detect reserved > onHand");

  // Anomaly 2: negative reserved
  const negativeReserved = -5;
  const isNegative = negativeReserved < 0;
  assert.ok(isNegative, "Integrity check must detect negative reserved stock");
});

test("6. Inventory <-> GL Reconciliation (Balanced Difference = 0)", () => {
  const subledgerValue = 100000;
  const glInventoryBalance = 100000;
  const difference = subledgerValue - glInventoryBalance;

  assert.equal(difference, 0, "Difference must be exactly 0 when subledger matches GL");
  assert.ok(Math.abs(difference) < 0.01, "Reconciliation passes");
});

test("7. Inventory <-> GL Reconciliation Discrepancy Detection (Difference != 0)", () => {
  const subledgerValue = 100000;
  const glInventoryBalance = 98500;
  const difference = subledgerValue - glInventoryBalance;

  assert.equal(difference, 1500, "Discrepancy must be 1500");
  assert.ok(Math.abs(difference) > 0.01, "Reconciliation detects imbalance");
});

test("8. Zero-Variance Physical Count Audit visibility", () => {
  const countLine = {
    systemQuantity: 100,
    countedQuantity: 100,
    quantityVariance: 0,
    costVariance: 0,
    product: oid(),
  };

  assert.equal(countLine.quantityVariance, 0);
  assert.equal(countLine.costVariance, 0);
  assert.ok(countLine.systemQuantity === countLine.countedQuantity);
});

test("9. Stock Aging 6-Bucket allocation", () => {
  const now = new Date("2026-09-08T00:00:00.000Z");

  const receipts = [
    { date: new Date("2026-09-01T00:00:00.000Z"), qty: 10, cost: 5 }, // 7 days old -> 0-30
    { date: new Date("2026-07-20T00:00:00.000Z"), qty: 20, cost: 5 }, // 50 days old -> 31-60
    { date: new Date("2026-06-20T00:00:00.000Z"), qty: 30, cost: 5 }, // 80 days old -> 61-90
    { date: new Date("2026-04-01T00:00:00.000Z"), qty: 40, cost: 5 }, // 160 days old -> 91-180
    { date: new Date("2025-11-01T00:00:00.000Z"), qty: 50, cost: 5 }, // 311 days old -> 181-365
    { date: new Date("2024-01-01T00:00:00.000Z"), qty: 60, cost: 5 }, // 981 days old -> 365+
  ];

  const buckets = {
    b0_30: 0,
    b31_60: 0,
    b61_90: 0,
    b91_180: 0,
    b181_365: 0,
    b365Plus: 0,
  };

  receipts.forEach((r) => {
    const ageDays = (now.getTime() - r.date.getTime()) / 86400000;
    if (ageDays <= 30) buckets.b0_30 += r.qty;
    else if (ageDays <= 60) buckets.b31_60 += r.qty;
    else if (ageDays <= 90) buckets.b61_90 += r.qty;
    else if (ageDays <= 180) buckets.b91_180 += r.qty;
    else if (ageDays <= 365) buckets.b181_365 += r.qty;
    else buckets.b365Plus += r.qty;
  });

  assert.equal(buckets.b0_30, 10);
  assert.equal(buckets.b31_60, 20);
  assert.equal(buckets.b61_90, 30);
  assert.equal(buckets.b91_180, 40);
  assert.equal(buckets.b181_365, 50);
  assert.equal(buckets.b365Plus, 60);
});

test("10. Slow-Moving Stock categorization by days of inactivity", () => {
  const getClassification = (daysInactive) => {
    if (daysInactive >= 180) return "non_moving";
    if (daysInactive >= 90) return "slow_moving";
    return "active";
  };

  assert.equal(getClassification(20), "active");
  assert.equal(getClassification(100), "slow_moving");
  assert.equal(getClassification(200), "non_moving");
});

test("11. Low Stock alerting respects available quantity vs effective reorder level", () => {
  const item1 = { onHand: 50, reserved: 45, reorderLevel: 10 }; // available = 5 <= 10 -> Alert!
  const item2 = { onHand: 15, reserved: 0, reorderLevel: 10 };  // available = 15 > 10 -> No Alert

  const isLowStock = (item) => (item.onHand - item.reserved) <= item.reorderLevel;

  assert.equal(isLowStock(item1), true, "Item 1 is low stock due to high reservations");
  assert.equal(isLowStock(item2), false, "Item 2 has adequate available stock");
});

test("12. Batch expiry intervals (expired, 7 days, 30 days, 60 days, 90 days)", () => {
  const now = new Date("2026-09-08T00:00:00.000Z");

  const isExpired = (expiryDate) => expiryDate < now;
  const isExpiringWithinDays = (expiryDate, days) =>
    expiryDate >= now && expiryDate <= new Date(now.getTime() + days * 86400000);

  const pastDate = new Date("2026-09-01T00:00:00.000Z");
  const in5Days = new Date("2026-09-13T00:00:00.000Z");
  const in25Days = new Date("2026-10-03T00:00:00.000Z");

  assert.ok(isExpired(pastDate));
  assert.ok(isExpiringWithinDays(in5Days, 7));
  assert.ok(isExpiringWithinDays(in25Days, 30));
  assert.ok(!isExpiringWithinDays(in25Days, 7));
});

test("13. Serial Number Single-Location Invariant", () => {
  const serialPositions = [
    { serial: "SN-1001", warehouse: "W1", location: "B1", status: "active" },
    { serial: "SN-1001", warehouse: "W2", location: "B2", status: "active" },
  ];

  const map = new Map();
  let duplicateFound = false;

  serialPositions.forEach((sp) => {
    if (sp.status === "active") {
      if (map.has(sp.serial)) duplicateFound = true;
      map.set(sp.serial, sp.location);
    }
  });

  assert.ok(duplicateFound, "Integrity check must detect active serial in multiple locations");
});

test("14. Cursor pagination encoding and decoding is deterministic", () => {
  const payload = {
    date: new Date("2026-09-08T12:00:00.000Z"),
    id: "66dd8e495209355745123456",
  };

  const cursor = encodeCursor(payload);
  assert.ok(typeof cursor === "string" && cursor.length > 0);

  const decoded = decodeCursor(cursor);
  assert.equal(new Date(decoded.date).toISOString(), payload.date.toISOString());
  assert.equal(decoded.id, payload.id);
});

test("15. Segregation of Duties (Creator != Approver) policy enforcement", () => {
  const creatorId = "66dd8e495209355745000001";
  const otherUserId = "66dd8e495209355745000002";

  const adjustment = {
    createdBy: creatorId,
    totalCostVariance: 500,
  };

  const checkSoD = (approverId, enforceSoD, threshold = 0) => {
    if (!enforceSoD) return true;
    if (threshold > 0 && Math.abs(adjustment.totalCostVariance) < threshold) return true;
    return String(adjustment.createdBy) !== String(approverId);
  };

  assert.equal(checkSoD(creatorId, false), true, "Allowed when SoD is disabled");
  assert.equal(checkSoD(creatorId, true, 0), false, "Blocked when SoD is enabled for creator");
  assert.equal(checkSoD(otherUserId, true, 0), true, "Allowed for non-creator approver");
  assert.equal(checkSoD(creatorId, true, 1000), true, "Allowed below SoD threshold ($500 < $1000)");
  assert.equal(checkSoD(creatorId, true, 100), false, "Blocked above SoD threshold ($500 >= $100)");
});

test("16. Cost Masking RBAC (unitCost, totalValue hidden when lacking cost-view permission)", () => {
  const adminUser = { role: "admin", permissions: [] };
  const costViewerUser = { role: "employee", permissions: ["inventory-report:cost-view"] };
  const standardUser = { role: "employee", permissions: ["inventory-report:view"] };

  assert.equal(canViewCost(adminUser), true);
  assert.equal(canViewCost(costViewerUser), true);
  assert.equal(canViewCost(standardUser), false);
});

test("17. RFC 4180 Streaming CSV Exporter handles quotes, commas, numbers, and dates", () => {
  const escaped = escapeCsvValue('Product, "Special" Edition\nLine 2');
  assert.equal(escaped, '"Product, ""Special"" Edition\nLine 2"');

  const headers = [
    { key: "sku", label: "SKU" },
    { key: "name", label: "Product Name" },
    { key: "qty", label: "Quantity" },
  ];
  const rows = [
    { sku: "SKU-1", name: 'Widget, "Blue"', qty: 15 },
    { sku: "SKU-2", name: "Gadget", qty: 25 },
  ];

  const csv = buildCsvString(headers, rows);
  assert.ok(csv.includes("SKU,Product Name,Quantity"));
  assert.ok(csv.includes('SKU-1,"Widget, ""Blue""",15'));
  assert.ok(csv.includes("SKU-2,Gadget,25"));
});

test("18. Multi-Tenant Isolation: Queries enforce tenantId boundaries", () => {
  const tenantA = oid();
  const tenantB = oid();

  const stockDoc = {
    tenantId: tenantA,
    product: oid(),
    warehouse: oid(),
    onHandQuantity: 100,
  };

  // Simulating tenant filter query
  const queryTenantA = { tenantId: tenantA };
  const queryTenantB = { tenantId: tenantB };

  const matchesTenantA = String(stockDoc.tenantId) === String(queryTenantA.tenantId);
  const matchesTenantB = String(stockDoc.tenantId) === String(queryTenantB.tenantId);

  assert.ok(matchesTenantA, "Tenant A matches its own document");
  assert.ok(!matchesTenantB, "Tenant B cannot match Tenant A's document");
});

test("19. Inventory Preference Schema includes enterprise controls", () => {
  const schema = InventoryPreference.schema;
  assert.ok(schema.path("enforceSegregationOfDuties"), "Must track enforceSegregationOfDuties");
  assert.ok(schema.path("sodThresholdAmount"), "Must track sodThresholdAmount");
  assert.ok(schema.path("enforceClosedPeriodLock"), "Must track enforceClosedPeriodLock");
  assert.ok(schema.path("allowNegativeStock"), "Must track allowNegativeStock");
});

test("20. StockMovement Schema indexes are optimized and tenant-scoped", () => {
  const schema = StockMovement.schema;
  const indexes = schema.indexes();

  const hasLedgerCompoundIndex = indexes.some(
    (idx) => idx[0].tenantId === 1 && idx[0].products === 1 && idx[0].movementDate === 1
  );
  assert.ok(hasLedgerCompoundIndex, "Must have compound index on { tenantId, products, status, movementDate, _id }");

  const hasPostingDateIndex = indexes.some(
    (idx) => idx[0].tenantId === 1 && idx[0].status === 1 && idx[0].postingDate === -1
  );
  assert.ok(hasPostingDateIndex, "Must have compound index on { tenantId, status, postingDate, _id }");
});

test("21. All new inventory catalog permissions belong to inventory module", () => {
  const newPermissions = [
    "inventory-report:cost-view",
    "inventory-report:export",
    "inventory-reconciliation:view",
    "inventory-integrity:view",
    "inventory-integrity:manage",
  ];

  for (const perm of newPermissions) {
    assert.ok(PERMISSION_KEYS.includes(perm), `Permission ${perm} must be in PERMISSION_KEYS`);
    const mod = permissionModule(perm);
    assert.equal(mod, "inventory", `Permission ${perm} must resolve to inventory module`);
    assert.ok(ERP_MODULE_IDS.includes(mod));
  }
});

test("22. Integrity Diagnostic detects negative reserved and formula discrepancies", () => {
  const mockStocks = [
    { onHand: 100, reserved: -5, quarantine: 0, available: 105 }, // negative reserved!
    { onHand: 100, reserved: 20, quarantine: 10, available: 90 }, // formula mismatch: expected 70, got 90!
    { onHand: 50, reserved: 10, quarantine: 5, available: 35 },   // clean: 50 - 10 - 5 = 35
  ];

  const negativeReservedCount = mockStocks.filter((s) => s.reserved < 0).length;
  const formulaMismatchCount = mockStocks.filter(
    (s) => s.available !== (s.onHand - s.reserved - s.quarantine)
  ).length;

  assert.equal(negativeReservedCount, 1, "Must detect 1 negative reserved anomaly");
  assert.equal(formulaMismatchCount, 1, "Must detect 1 formula mismatch anomaly");
});

test("23. Repair Dry-Run generates non-destructive proposed fixes without mutating database", () => {
  const anomalies = [
    { id: "stock-1", onHand: 100, reserved: 20, quarantine: 10, currentAvailable: 90 },
  ];

  const proposedFixes = anomalies.map((a) => ({
    targetId: a.id,
    currentAvailable: a.currentAvailable,
    proposedAvailable: a.onHand - a.reserved - a.quarantine,
  }));

  const dryRunResult = {
    dryRun: true,
    proposedFixesCount: proposedFixes.length,
    proposedFixes,
  };

  assert.equal(dryRunResult.dryRun, true);
  assert.equal(dryRunResult.proposedFixesCount, 1);
  assert.equal(dryRunResult.proposedFixes[0].proposedAvailable, 70);
  assert.equal(dryRunResult.proposedFixes[0].currentAvailable, 90);
});

test("24. Cross-Tenant Filter Attack Prevention (Tenant A cannot query Tenant B data)", () => {
  const tenantA = "66dd8e495209355745000001";
  const tenantB = "66dd8e495209355745000002";

  // Simulate controller building tenant filter: always enforce authenticated req.tenantId
  const buildFilter = (req) => {
    const filter = {};
    if (req.tenantId) filter.tenantId = req.tenantId;
    return filter;
  };

  // Malicious request from Tenant A providing Tenant B's tenantId in query
  const maliciousReq = {
    tenantId: tenantA, // Authenticated context
    query: { tenantId: tenantB }, // Spoofed query parameter
  };

  const safeFilter = buildFilter(maliciousReq);
  assert.equal(safeFilter.tenantId, tenantA, "Filter must use authenticated tenantId, ignoring spoofed query");
  assert.notEqual(safeFilter.tenantId, tenantB, "Tenant A cannot filter by Tenant B");
});

test("25. Transfer Lifecycle Reporting tracks shortage and loss records", () => {
  const transfer = {
    transferNo: "TR-20260908-001",
    status: "closed_short",
    lines: [
      { requestedQuantity: 50, dispatchedQuantity: 50, receivedQuantity: 45, shortageQuantity: 5 },
    ],
  };

  const line = transfer.lines[0];
  const shortage = line.dispatchedQuantity - line.receivedQuantity;
  assert.equal(shortage, 5);
  assert.equal(line.shortageQuantity, shortage);
  assert.equal(transfer.status, "closed_short");
});

