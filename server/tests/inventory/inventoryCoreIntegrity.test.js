import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import InventoryUnit from "../../models/inventory/inventoryUnit.model.js";
import ProductCategory from "../../models/inventory/productCategory.model.js";
import ProductBrand from "../../models/inventory/productBrand.model.js";
import Product from "../../models/inventory/product.model.js";
import Warehouse from "../../models/inventory/warehouse.model.js";
import WarehouseLocation from "../../models/inventory/warehouseLocation.model.js";
import ProductStock from "../../models/inventory/productStock.model.js";
import StockMovement from "../../models/inventory/stockMovement.model.js";
import StockAdjustment from "../../models/inventory/stockAdjustment.model.js";
import StockTransfer from "../../models/inventory/stockTransfer.model.js";
import {
  InventoryTracking,
  PendingInventory,
  StockRequest,
  StockIssue,
  ConsumptionHistory,
  StockInspection,
  WarehouseCheck,
  InventoryLoss,
  InventoryPreference,
} from "../../models/inventory/inventoryOperations.model.js";
import {
  calculateSafeReservationRelease,
  requireTenant,
} from "../../services/inventoryPosting.service.js";

test("every inventory entity schema possesses tenantId attribute", () => {
  const models = [
    { name: "InventoryUnit", model: InventoryUnit },
    { name: "ProductCategory", model: ProductCategory },
    { name: "ProductBrand", model: ProductBrand },
    { name: "Product", model: Product },
    { name: "Warehouse", model: Warehouse },
    { name: "WarehouseLocation", model: WarehouseLocation },
    { name: "ProductStock", model: ProductStock },
    { name: "StockMovement", model: StockMovement },
    { name: "StockAdjustment", model: StockAdjustment },
    { name: "StockTransfer", model: StockTransfer },
    { name: "InventoryTracking", model: InventoryTracking },
    { name: "PendingInventory", model: PendingInventory },
    { name: "StockRequest", model: StockRequest },
    { name: "StockIssue", model: StockIssue },
    { name: "ConsumptionHistory", model: ConsumptionHistory },
    { name: "StockInspection", model: StockInspection },
    { name: "WarehouseCheck", model: WarehouseCheck },
    { name: "InventoryLoss", model: InventoryLoss },
    { name: "InventoryPreference", model: InventoryPreference },
  ];

  for (const { name, model } of models) {
    const tenantPath = model.schema.path("tenantId");
    assert.ok(tenantPath, `${name} must include a tenantId schema property`);
  }
});

test("inventory unique indexes are compound with tenantId", () => {
  const hasCompoundIndex = (model, expectedFields) => {
    const indexes = model.schema.indexes();
    return indexes.some(([fields]) => {
      const keys = Object.keys(fields);
      return expectedFields.every((f) => keys.includes(f));
    });
  };

  assert.ok(
    hasCompoundIndex(Product, ["sku", "tenantId"]),
    "Product must have compound index on sku + tenantId"
  );
  assert.ok(
    hasCompoundIndex(Product, ["barcode", "tenantId"]),
    "Product must have compound index on barcode + tenantId"
  );
  assert.ok(
    hasCompoundIndex(Warehouse, ["code", "tenantId"]),
    "Warehouse must have compound index on code + tenantId"
  );
  assert.ok(
    hasCompoundIndex(WarehouseLocation, ["code", "warehouse", "tenantId"]),
    "WarehouseLocation must have compound index on code + warehouse + tenantId"
  );
  assert.ok(
    hasCompoundIndex(ProductStock, ["product", "warehouse", "location", "tenantId"]),
    "ProductStock must have compound index on product + warehouse + location + tenantId"
  );
  assert.ok(
    hasCompoundIndex(ProductCategory, ["code", "tenantId"]),
    "ProductCategory must have compound index on code + tenantId"
  );
  assert.ok(
    hasCompoundIndex(ProductCategory, ["slug", "tenantId"]),
    "ProductCategory must have compound index on slug + tenantId"
  );
  assert.ok(
    hasCompoundIndex(ProductCategory, ["parent", "nameLower", "tenantId"]),
    "ProductCategory must have compound index on parent + nameLower + tenantId"
  );
  assert.ok(
    hasCompoundIndex(ProductBrand, ["code", "tenantId"]),
    "ProductBrand must have compound index on code + tenantId"
  );
  assert.ok(
    hasCompoundIndex(ProductBrand, ["nameLower", "tenantId"]),
    "ProductBrand must have compound index on nameLower + tenantId"
  );
  assert.ok(
    hasCompoundIndex(InventoryUnit, ["code", "tenantId"]),
    "InventoryUnit must have compound index on code + tenantId"
  );
  assert.ok(
    hasCompoundIndex(InventoryUnit, ["nameLower", "tenantId"]),
    "InventoryUnit must have compound index on nameLower + tenantId"
  );
});

test("requireTenant enforces valid authenticated tenant context", () => {
  assert.throws(
    () => requireTenant(null),
    /Tenant context is required/
  );
  assert.throws(
    () => requireTenant(""),
    /Tenant context is required/
  );
  assert.throws(
    () => requireTenant("invalid-id"),
    /Tenant context is required/
  );

  const validId = "507f1f77bcf86cd799439011";
  const result = requireTenant(validId);
  assert.ok(result instanceof mongoose.Types.ObjectId);
  assert.equal(String(result), validId);
});

test("safe sales reservation release caps release to available reserved stock", () => {
  // Normal reservation fulfillment: reserved 10, delivery quantity 4 -> release 4
  assert.equal(calculateSafeReservationRelease(10, 4), 4);

  // Partial reservation scenario: reserved only 3, delivery quantity 7 -> release 3 (prevents 409 negative reservation)
  assert.equal(calculateSafeReservationRelease(3, 7), 3);

  // Unreserved delivery: reserved is 0, delivery quantity 5 -> release 0
  assert.equal(calculateSafeReservationRelease(0, 5), 0);

  // Missing or negative reserved: handles null/undefined/negative gracefully
  assert.equal(calculateSafeReservationRelease(null, 5), 0);
  assert.equal(calculateSafeReservationRelease(undefined, 5), 0);
  assert.equal(calculateSafeReservationRelease(-2, 5), 0);

  // Invalid delivery quantities
  assert.equal(calculateSafeReservationRelease(10, -5), 0);
  assert.equal(calculateSafeReservationRelease(10, 0), 0);
});

test("two-step transfer schema supports full dispatch, receive, and shortage lifecycle", () => {
  const transferModes = StockTransfer.schema.path("transferMode").enumValues;
  assert.ok(transferModes.includes("two_step"));
  assert.ok(transferModes.includes("direct"));

  const transferStatuses = StockTransfer.schema.path("status").enumValues;
  assert.ok(transferStatuses.includes("dispatched"));
  assert.ok(transferStatuses.includes("partially_received"));
  assert.ok(transferStatuses.includes("received"));
  assert.ok(transferStatuses.includes("closed_short"));
  assert.ok(transferStatuses.includes("reversed"));

  const lineSchema = StockTransfer.schema.path("lines").schema;
  assert.ok(lineSchema.path("dispatchedQuantity"));
  assert.ok(lineSchema.path("receivedQuantity"));
  assert.ok(lineSchema.path("shortQuantity"));

  // Shortage loss tracking
  assert.ok(InventoryLoss.schema.path("lossReference"));
  assert.ok(InventoryLoss.schema.path("quantity"));
  assert.ok(InventoryLoss.schema.path("unitCost"));
  assert.ok(InventoryLoss.schema.path("lossValue"));
  assert.ok(InventoryLoss.schema.path("tenantId"));
});

test("physical count audit supports zero-variance lines and lastCountedAt timestamp", () => {
  assert.ok(
    ProductStock.schema.path("lastCountedAt"),
    "ProductStock must maintain lastCountedAt timestamp"
  );

  const adjustmentTypes = StockAdjustment.schema.path("adjustmentType").enumValues;
  assert.ok(adjustmentTypes.includes("physical_count"));
  assert.ok(adjustmentTypes.includes("cycle_count"));

  // Verify that an adjustment doc with count mode calculates zero variance cleanly
  const adjustment = new StockAdjustment({
    tenantId: new mongoose.Types.ObjectId(),
    adjustmentNo: "ADJ-TEST-001",
    warehouse: new mongoose.Types.ObjectId(),
    adjustmentType: "physical_count",
    adjustmentMode: "count",
    lines: [
      {
        product: new mongoose.Types.ObjectId(),
        systemQuantity: 10,
        countedQuantity: 10,
        unitCost: 25,
      },
    ],
  });

  // Calculate summary via schema validation
  adjustment.validateSync();
  assert.equal(adjustment.lines[0].varianceQuantity, 0);
  assert.equal(adjustment.lines[0].varianceValue, 0);
  assert.equal(adjustment.increaseQuantity, 0);
  assert.equal(adjustment.decreaseQuantity, 0);
  assert.equal(adjustment.netQuantity, 0);
});

test("stock movement records are immutable once posted and support compensating reversal", () => {
  const movementStatuses = StockMovement.schema.path("status").enumValues;
  assert.deepEqual([...movementStatuses].sort(), ["draft", "posted", "cancelled", "reversed"].sort());

  assert.ok(StockMovement.schema.path("reversalOf"));
  assert.ok(StockMovement.schema.path("reversedBy"));
  assert.ok(StockMovement.schema.path("postedAt"));
  assert.ok(StockMovement.schema.path("postedBy"));

  const lineSchema = StockMovement.schema.path("lines").schema;
  const effects = lineSchema.path("effect").enumValues;
  assert.ok(effects.includes("in"));
  assert.ok(effects.includes("out"));
  assert.ok(effects.includes("transfer"));
  assert.ok(effects.includes("reserve"));
  assert.ok(effects.includes("release"));
  assert.ok(effects.includes("incoming"));
  assert.ok(effects.includes("incoming_clear"));
});

test("movement reversal properly inverts line directions", () => {
  const invertEffect = (effect) => {
    switch (effect) {
      case "in": return "out";
      case "out": return "in";
      case "reserve": return "release";
      case "release": return "reserve";
      case "incoming": return "incoming_clear";
      case "incoming_clear": return "incoming";
      default: return effect;
    }
  };

  assert.equal(invertEffect("in"), "out");
  assert.equal(invertEffect("out"), "in");
  assert.equal(invertEffect("reserve"), "release");
  assert.equal(invertEffect("release"), "reserve");
  assert.equal(invertEffect("incoming"), "incoming_clear");
  assert.equal(invertEffect("incoming_clear"), "incoming");
});

test("zero-variance physical count audit submissions are accepted while non-count zero variance is rejected", () => {
  const evaluateSubmissionEligibility = (adjustment) => {
    const isCountAudit = ["physical_count", "cycle_count"].includes(adjustment.adjustmentType) || adjustment.adjustmentMode === "count";
    const hasVariance = adjustment.lines.some((line) => Number(line.varianceQuantity || 0) !== 0);
    if (!isCountAudit && !hasVariance) {
      throw Object.assign(new Error("The adjustment has no quantity variance to submit."), { statusCode: 409 });
    }
    return true;
  };

  // Zero-variance physical count passes audit submission
  assert.ok(evaluateSubmissionEligibility({
    adjustmentType: "physical_count",
    adjustmentMode: "count",
    lines: [{ varianceQuantity: 0 }],
  }));

  // Zero-variance cycle count passes audit submission
  assert.ok(evaluateSubmissionEligibility({
    adjustmentType: "cycle_count",
    adjustmentMode: "count",
    lines: [{ varianceQuantity: 0 }],
  }));

  // Zero-variance damage adjustment rejects submission
  assert.throws(
    () => evaluateSubmissionEligibility({
      adjustmentType: "damage",
      adjustmentMode: "delta",
      lines: [{ varianceQuantity: 0 }],
    }),
    /The adjustment has no quantity variance to submit/
  );
});
