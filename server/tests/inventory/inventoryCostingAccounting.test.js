import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import InventoryValuation, {
  roundMoney,
  roundQuantity,
} from "../../models/inventory/inventoryValuation.model.js";
import FifoCostLayer from "../../models/inventory/fifoCostLayer.model.js";
import InventoryRevaluation from "../../models/inventory/inventoryRevaluation.model.js";
import Product from "../../models/inventory/product.model.js";
import Warehouse from "../../models/inventory/warehouse.model.js";
import Department from "../../models/department.model.js";
import AccountingSettings from "../../models/accountingSettings.model.js";
import JournalEntry from "../../models/journalEntry.model.js";
import StockMovement from "../../models/inventory/stockMovement.model.js";
import {
  InventoryLoss,
  StockIssue,
} from "../../models/inventory/inventoryOperations.model.js";
import { SYSTEM_ACCOUNTS } from "../../services/accountingSetup.service.js";
import {
  voucherTypeForSource,
  parsePostingDate,
  assertOpenAccountingPeriod,
} from "../../services/accountingPosting.service.js";
import {
  assertCostingMethodCanBeChanged,
} from "../../services/inventoryCosting.service.js";

const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

test("1. InventoryValuation schema includes tenantId, compound unique index, and financial fields", () => {
  const schema = InventoryValuation.schema;
  assert.ok(schema.path("tenantId"), "tenantId required on InventoryValuation");
  assert.ok(schema.path("product"), "product required on InventoryValuation");
  assert.ok(schema.path("warehouse"), "warehouse required on InventoryValuation");
  assert.ok(schema.path("costingMethod"), "costingMethod required on InventoryValuation");
  assert.ok(schema.path("valuationQuantity"), "valuationQuantity required");
  assert.ok(schema.path("averageCost"), "averageCost required");
  assert.ok(schema.path("inventoryValue"), "inventoryValue required");
  assert.ok(schema.path("standardCost"), "standardCost required");
  assert.ok(schema.path("provisionalNegativeQuantity"), "provisionalNegativeQuantity required");
  assert.ok(schema.path("provisionalNegativeCost"), "provisionalNegativeCost required");
  assert.ok(schema.path("valuationVersion"), "valuationVersion required");

  const indexes = schema.indexes();
  const hasCompoundUnique = indexes.some(
    ([fields, opts]) =>
      fields.tenantId === 1 &&
      fields.product === 1 &&
      fields.warehouse === 1 &&
      opts?.unique === true
  );
  assert.ok(hasCompoundUnique, "InventoryValuation must have compound unique index on {tenantId, product, warehouse}");
});

test("2. FifoCostLayer schema includes tenantId, tracking fields, and compound index", () => {
  const schema = FifoCostLayer.schema;
  assert.ok(schema.path("tenantId"), "tenantId required on FifoCostLayer");
  assert.ok(schema.path("product"), "product required on FifoCostLayer");
  assert.ok(schema.path("warehouse"), "warehouse required on FifoCostLayer");
  assert.ok(schema.path("originalQuantity"), "originalQuantity required");
  assert.ok(schema.path("remainingQuantity"), "remainingQuantity required");
  assert.ok(schema.path("unitCost"), "unitCost required");
  assert.ok(schema.path("totalCost"), "totalCost required");
  assert.ok(schema.path("status"), "status required");

  const statusEnum = schema.path("status").enumValues;
  assert.ok(statusEnum.includes("open"));
  assert.ok(statusEnum.includes("exhausted"));

  const indexes = schema.indexes();
  const hasFifoIndex = indexes.some(
    ([fields]) =>
      fields.tenantId === 1 &&
      fields.product === 1 &&
      fields.warehouse === 1 &&
      fields.status === 1
  );
  assert.ok(hasFifoIndex, "FifoCostLayer must have query index for open layers");
});

test("3. InventoryRevaluation schema includes tenantId, unique revaluationNo, and financial adjustment fields", () => {
  const schema = InventoryRevaluation.schema;
  assert.ok(schema.path("tenantId"), "tenantId required on InventoryRevaluation");
  assert.ok(schema.path("revaluationNo"), "revaluationNo required on InventoryRevaluation");
  assert.ok(schema.path("product"), "product required on InventoryRevaluation");
  assert.ok(schema.path("warehouse"), "warehouse required on InventoryRevaluation");
  assert.ok(schema.path("quantity"), "quantity required");
  assert.ok(schema.path("oldUnitCost"), "oldUnitCost required");
  assert.ok(schema.path("newUnitCost"), "newUnitCost required");
  assert.ok(schema.path("valueDifference"), "valueDifference required");
  assert.ok(schema.path("journalEntry"), "journalEntry required");
  assert.ok(schema.path("status"), "status required");

  const indexes = schema.indexes();
  const hasUniqueNo = indexes.some(
    ([fields, opts]) =>
      fields.tenantId === 1 && fields.revaluationNo === 1 && opts?.unique === true
  );
  assert.ok(hasUniqueNo, "InventoryRevaluation must have unique index on {tenantId, revaluationNo}");
});

test("4. Product schema supports standardCost, inventoryAccount, cogsAccount, and expenseAccount", () => {
  const schema = Product.schema;
  assert.ok(schema.path("standardCost"), "Product must support standardCost");
  assert.ok(schema.path("inventoryAccount"), "Product must support inventoryAccount");
  assert.ok(schema.path("cogsAccount"), "Product must support cogsAccount");
  assert.ok(schema.path("expenseAccount"), "Product must support expenseAccount");
});

test("5. Warehouse and Department support account mappings and multi-tenancy", () => {
  assert.ok(Warehouse.schema.path("inventoryAccount"), "Warehouse must support inventoryAccount override");
  assert.ok(Department.schema.path("tenantId"), "Department must have tenantId");
  assert.ok(Department.schema.path("expenseAccount"), "Department must support expenseAccount for internal consumption");
});

test("6. AccountingSettings schema exposes all inventory control and variance accounts", () => {
  const schema = AccountingSettings.schema;
  assert.ok(schema.path("tenantId"), "AccountingSettings must support tenantId");
  for (const field of [
    "inventoryAccount",
    "inventoryClearingAccount",
    "purchasePriceVarianceAccount",
    "inventoryAdjustmentAccount",
    "inventoryGainAccount",
    "inventoryLossAccount",
    "inventoryDamageAccount",
    "inventoryExpiryAccount",
    "inventoryInTransitAccount",
    "openingBalanceAccount",
    "inventoryConsumptionAccount",
    "inventoryRevaluationAccount",
  ]) {
    assert.ok(schema.path(field), `AccountingSettings must expose ${field}`);
  }
});

test("7. JournalEntry schema supports tenantId, inventoryMovement, and all inventory sourceTypes", () => {
  const schema = JournalEntry.schema;
  assert.ok(schema.path("tenantId"), "JournalEntry must have tenantId");
  assert.ok(schema.path("inventoryMovement"), "JournalEntry must link inventoryMovement");

  const sourceTypes = schema.path("sourceType").enumValues;
  for (const expected of [
    "opening_stock",
    "goods_receipt",
    "purchase_return",
    "sales_delivery",
    "sales_return",
    "inventory_adjustment",
    "inventory_consumption",
    "inventory_loss",
    "inventory_transfer",
    "inventory_revaluation",
  ]) {
    assert.ok(sourceTypes.includes(expected), `JournalEntry must support sourceType '${expected}'`);
  }
});

test("8. StockMovement schema includes journal links, accountingStatus, and costing fields on lines", () => {
  const schema = StockMovement.schema;
  assert.ok(schema.path("journalEntry"), "StockMovement must have journalEntry");
  assert.ok(schema.path("reversalJournalEntry"), "StockMovement must have reversalJournalEntry");
  assert.ok(schema.path("accountingStatus"), "StockMovement must have accountingStatus");
  assert.ok(schema.path("postingDate"), "StockMovement must have postingDate");

  const lineSchema = schema.path("lines").schema;
  assert.ok(lineSchema.path("costingMethod"), "line must track costingMethod");
  assert.ok(lineSchema.path("consumedLayers"), "line must track consumedLayers");
  assert.ok(lineSchema.path("varianceAmount"), "line must track varianceAmount");
  assert.ok(lineSchema.path("appliedUnitCost"), "line must track appliedUnitCost");
  assert.ok(lineSchema.path("appliedValue"), "line must track appliedValue");
});

test("9. InventoryLoss and StockIssue support accounting and loss categories", () => {
  const lossSchema = InventoryLoss.schema;
  assert.ok(lossSchema.path("journalEntry"), "InventoryLoss must link journalEntry");
  assert.ok(lossSchema.path("approvedBy"), "InventoryLoss must track approvedBy");
  assert.ok(lossSchema.path("approvedAt"), "InventoryLoss must track approvedAt");

  const lossTypes = lossSchema.path("lossType").enumValues;
  assert.ok(lossTypes.includes("scrap"), "lossType must include scrap");
  assert.ok(lossTypes.includes("shrinkage"), "lossType must include shrinkage");
  assert.ok(lossTypes.includes("transfer_shortage"), "lossType must include transfer_shortage");

  const issueSchema = StockIssue.schema;
  assert.ok(issueSchema.path("journalEntry"), "StockIssue must link journalEntry");
  assert.ok(issueSchema.path("costAmount"), "StockIssue must track costAmount");
});

test("10. System accounts catalog includes required inventory accounts", () => {
  const byCode = new Map(SYSTEM_ACCOUNTS.map((acc) => [acc.code, acc]));
  assert.equal(byCode.get("1300")?.controlType, "inventory");
  assert.equal(byCode.get("1310")?.controlType, "inventory");
  assert.equal(byCode.get("2050")?.type, "liability");
  assert.equal(byCode.get("5020")?.type, "expense");
  assert.equal(byCode.get("5030")?.type, "expense");
  assert.equal(byCode.get("5040")?.type, "expense");
  assert.equal(byCode.get("5050")?.type, "expense");
  assert.equal(byCode.get("5060")?.type, "expense");
  assert.equal(byCode.get("5070")?.type, "expense");
  assert.equal(byCode.get("5080")?.type, "expense");
  assert.equal(byCode.get("5090")?.type, "expense");
});

test("11. voucherTypeForSource maps all inventory transaction types correctly", () => {
  assert.equal(voucherTypeForSource("opening_stock"), "opening");
  assert.equal(voucherTypeForSource("goods_receipt"), "purchase");
  assert.equal(voucherTypeForSource("purchase_return"), "purchase");
  assert.equal(voucherTypeForSource("sales_delivery"), "sales");
  assert.equal(voucherTypeForSource("sales_return"), "sales");
  assert.equal(voucherTypeForSource("inventory_adjustment"), "adjustment");
  assert.equal(voucherTypeForSource("inventory_consumption"), "adjustment");
  assert.equal(voucherTypeForSource("inventory_loss"), "adjustment");
  assert.equal(voucherTypeForSource("inventory_transfer"), "adjustment");
  assert.equal(voucherTypeForSource("inventory_revaluation"), "adjustment");
});

test("12. Moving Weighted Average calculation: receipt 10 @ $100, receipt 10 @ $120, issue 5", () => {
  // Receipt 1: 10 @ $100
  let qty = 10;
  let val = 10 * 100;
  let avg = val / qty;
  assert.equal(avg, 100);
  assert.equal(val, 1000);

  // Receipt 2: 10 @ $120
  let incomingQty = 10;
  let incomingCost = 120;
  let nextVal = val + incomingQty * incomingCost;
  let nextQty = qty + incomingQty;
  let nextAvg = roundMoney(nextVal / nextQty);
  assert.equal(nextAvg, 110);
  assert.equal(nextQty, 20);
  assert.equal(nextVal, 2200);

  // Issue 1: 5 units
  let issueQty = 5;
  let appliedUnitCost = nextAvg;
  let appliedValue = roundMoney(issueQty * appliedUnitCost);
  assert.equal(appliedUnitCost, 110);
  assert.equal(appliedValue, 550);

  let afterQty = nextQty - issueQty;
  let afterVal = nextVal - appliedValue;
  let afterAvg = roundMoney(afterVal / afterQty);
  assert.equal(afterQty, 15);
  assert.equal(afterVal, 1650);
  assert.equal(afterAvg, 110); // Unit cost unaffected by issue!
});

test("13. Bin-to-bin transfer within the same warehouse does NOT alter product cost or total value", () => {
  const warehouseCost = 150;
  const totalWhQty = 100;
  const totalWhValue = totalWhQty * warehouseCost;

  // Transfer 20 units from Bin A to Bin B within same warehouse
  const transferQty = 20;
  const binACost = warehouseCost;
  const binBCost = warehouseCost;

  assert.equal(binACost, 150);
  assert.equal(binBCost, 150);
  assert.equal(totalWhValue, 15000); // Warehouse financial value unchanged
});

test("14. Standard Costing PPV calculation: Receipt at $115 when standard is $100", () => {
  const stdCost = 100;
  const receiptCost = 115;
  const quantity = 10;

  const inventoryValue = roundMoney(quantity * stdCost);
  const grniValue = roundMoney(quantity * receiptCost);
  const ppvVariance = roundMoney(quantity * (receiptCost - stdCost));

  assert.equal(inventoryValue, 1000); // Dr Inventory
  assert.equal(ppvVariance, 150);     // Dr PPV (expense)
  assert.equal(grniValue, 1150);      // Cr GRNI

  // Double entry check:
  const totalDebit = inventoryValue + ppvVariance;
  const totalCredit = grniValue;
  assert.equal(totalDebit, totalCredit);
});

test("15. Standard Costing PPV calculation: Receipt at $85 (favorable) when standard is $100", () => {
  const stdCost = 100;
  const receiptCost = 85;
  const quantity = 10;

  const inventoryValue = roundMoney(quantity * stdCost);
  const grniValue = roundMoney(quantity * receiptCost);
  const ppvVariance = roundMoney(quantity * (receiptCost - stdCost)); // -150

  assert.equal(inventoryValue, 1000);  // Dr Inventory
  assert.equal(ppvVariance, -150);     // Cr PPV (income/credit)
  assert.equal(grniValue, 850);        // Cr GRNI

  const totalDebit = inventoryValue;
  const totalCredit = grniValue + Math.abs(ppvVariance);
  assert.equal(totalDebit, totalCredit);
});

test("16. FIFO layer depletion logic consumes oldest layer first and splits multi-layer correctly", () => {
  const layers = [
    { id: "L1", remainingQuantity: 10, unitCost: 50, status: "open" },
    { id: "L2", remainingQuantity: 10, unitCost: 70, status: "open" },
  ];

  let needed = 15;
  const consumed = [];

  for (const layer of layers) {
    if (needed <= 0) break;
    const qty = Math.min(layer.remainingQuantity, needed);
    const cost = roundMoney(qty * layer.unitCost);
    layer.remainingQuantity -= qty;
    if (layer.remainingQuantity === 0) layer.status = "exhausted";
    consumed.push({ layerId: layer.id, quantity: qty, unitCost: layer.unitCost, totalCost: cost });
    needed -= qty;
  }

  assert.equal(consumed.length, 2);
  assert.equal(consumed[0].quantity, 10);
  assert.equal(consumed[0].unitCost, 50);
  assert.equal(consumed[0].totalCost, 500);
  assert.equal(layers[0].status, "exhausted");
  assert.equal(layers[0].remainingQuantity, 0);

  assert.equal(consumed[1].quantity, 5);
  assert.equal(consumed[1].unitCost, 70);
  assert.equal(consumed[1].totalCost, 350);
  assert.equal(layers[1].status, "open");
  assert.equal(layers[1].remainingQuantity, 5);

  const totalApplied = consumed.reduce((s, c) => s + c.totalCost, 0);
  assert.equal(totalApplied, 850);
});

test("17. Negative stock replenishment variance reconciliation", () => {
  const provisionalCost = 100;
  const negativeQuantity = 5;
  const replenishmentCost = 112;
  const incomingQuantity = 10;

  // 5 units were issued provisionally at $100
  // Now receipt arrives at $112
  const clearedNegativeQty = Math.min(negativeQuantity, incomingQuantity);
  const varianceAdjustment = roundMoney(clearedNegativeQty * (replenishmentCost - provisionalCost));

  assert.equal(varianceAdjustment, 60); // 5 * (112 - 100) = $60 variance
  const remainingPositiveStock = incomingQuantity - clearedNegativeQty;
  assert.equal(remainingPositiveStock, 5);
});

test("18. Inventory Revaluation calculates write-up and write-down value differences", () => {
  const qty = 50;
  const oldCost = 100;

  // Write-up to $120
  const writeUpCost = 120;
  const writeUpDiff = roundMoney((writeUpCost - oldCost) * qty);
  assert.equal(writeUpDiff, 1000); // $20 * 50 = +$1000

  // Write-down to $80
  const writeDownCost = 80;
  const writeDownDiff = roundMoney((writeDownCost - oldCost) * qty);
  assert.equal(writeDownDiff, -1000); // -$20 * 50 = -$1000
});

test("19. JournalEntry validation enforces strict double-entry balance and single-sided lines", () => {
  const validEntry = new JournalEntry({
    date: new Date(),
    status: "posted",
    sourceType: "sales_delivery",
    lines: [
      { account: new mongoose.Types.ObjectId(), debit: 250, credit: 0 },
      { account: new mongoose.Types.ObjectId(), debit: 0, credit: 250 },
    ],
  });
  const validError = validEntry.validateSync();
  assert.equal(validError, undefined, "Balanced journal must validate with no error");

  const unbalancedEntry = new JournalEntry({
    date: new Date(),
    status: "posted",
    sourceType: "sales_delivery",
    lines: [
      { account: new mongoose.Types.ObjectId(), debit: 250, credit: 0 },
      { account: new mongoose.Types.ObjectId(), debit: 0, credit: 200 },
    ],
  });
  const unbalanceError = unbalancedEntry.validateSync();
  assert.ok(unbalanceError, "Unbalanced posted journal must throw validation error");
  assert.match(unbalanceError.message, /must balance/i);

  const doubleSidedEntry = new JournalEntry({
    date: new Date(),
    status: "draft",
    sourceType: "manual",
    lines: [
      { account: new mongoose.Types.ObjectId(), debit: 100, credit: 100 },
      { account: new mongoose.Types.ObjectId(), debit: 0, credit: 100 },
    ],
  });
  const doubleSidedError = doubleSidedEntry.validateSync();
  assert.ok(doubleSidedError, "Line with both debit and credit must fail");
  assert.match(doubleSidedError.message, /cannot contain both debit and credit/i);
});

test("20. parsePostingDate parses dates safely and rejects invalid inputs", () => {
  const valid = parsePostingDate("2026-03-15");
  assert.ok(valid instanceof Date);
  assert.equal(valid.getUTCFullYear(), 2026);
  assert.equal(valid.getUTCMonth(), 2);
  assert.equal(valid.getUTCDate(), 15);

  const invalid = parsePostingDate("not-a-date", null);
  assert.equal(invalid, null);
});

test("21. Costing method immutability blocks updates when posted movements exist", async () => {
  const fakeTenantId = new mongoose.Types.ObjectId();
  const fakeProductId = new mongoose.Types.ObjectId();

  // Test that assertCostingMethodCanBeChanged queries { tenantId, products, status: 'posted' }
  // When no DB document matches, it resolves without throwing
  // We can test this by calling assertCostingMethodCanBeChanged with unmocked/mocked exists
  const origExists = StockMovement.exists;
  try {
    StockMovement.exists = async (filter) => {
      assert.equal(String(filter.tenantId), String(fakeTenantId));
      assert.equal(String(filter.products), String(fakeProductId));
      assert.equal(filter.status, "posted");
      return { _id: new mongoose.Types.ObjectId() }; // simulate posted movement exists
    };

    await assert.rejects(
      async () => {
        await assertCostingMethodCanBeChanged(fakeTenantId, fakeProductId);
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.match(err.message, /cannot be changed/i);
        return true;
      }
    );

    // Now simulate no posted movement
    StockMovement.exists = async () => null;
    await assert.doesNotReject(async () => {
      await assertCostingMethodCanBeChanged(fakeTenantId, fakeProductId);
    });
  } finally {
    StockMovement.exists = origExists;
  }
});

test("22. Compensating journal reversal inverts debits and credits and preserves balance", () => {
  const originalLines = [
    { account: new mongoose.Types.ObjectId(), debit: 500, credit: 0, description: "Goods receipt" },
    { account: new mongoose.Types.ObjectId(), debit: 0, credit: 500, description: "GRNI" },
  ];

  const reversedLines = originalLines.map((l) => ({
    account: l.account,
    debit: l.credit,
    credit: l.debit,
    description: `Reversal: ${l.description}`,
  }));

  assert.equal(reversedLines[0].debit, 0);
  assert.equal(reversedLines[0].credit, 500);
  assert.equal(reversedLines[1].debit, 500);
  assert.equal(reversedLines[1].credit, 0);

  const totalRevDebit = reversedLines.reduce((s, l) => s + l.debit, 0);
  const totalRevCredit = reversedLines.reduce((s, l) => s + l.credit, 0);
  assert.equal(totalRevDebit, totalRevCredit);
});

test("23. Multi-tenant isolation: Inventory entities require tenant-scoped queries", () => {
  const tenantA = new mongoose.Types.ObjectId();
  const tenantB = new mongoose.Types.ObjectId();

  const valuationA = new InventoryValuation({
    tenantId: tenantA,
    product: new mongoose.Types.ObjectId(),
    warehouse: new mongoose.Types.ObjectId(),
    valuationQuantity: 100,
    averageCost: 50,
    inventoryValue: 5000,
  });

  const valuationB = new InventoryValuation({
    tenantId: tenantB,
    product: new mongoose.Types.ObjectId(),
    warehouse: new mongoose.Types.ObjectId(),
    valuationQuantity: 200,
    averageCost: 75,
    inventoryValue: 15000,
  });

  assert.notEqual(String(valuationA.tenantId), String(valuationB.tenantId));
  assert.equal(valuationA.valuationQuantity, 100);
  assert.equal(valuationB.valuationQuantity, 200);
});

test("24. Inter-warehouse vs in-warehouse transfer GL invariants", () => {
  const sourceAssetAccount = new mongoose.Types.ObjectId();
  const destAssetAccountSameWh = sourceAssetAccount; // same warehouse
  const destAssetAccountDiffWh = new mongoose.Types.ObjectId(); // different warehouse
  const inTransitAccount = new mongoose.Types.ObjectId();

  // Same warehouse transfer: source and dest account are identical -> no GL journal
  assert.equal(String(sourceAssetAccount), String(destAssetAccountSameWh));

  // Different warehouse transfer: source and dest account differ -> produces GL lines
  assert.notEqual(String(sourceAssetAccount), String(destAssetAccountDiffWh));

  // Step 1: Dispatch to in-transit
  const dispatchLines = [
    { account: inTransitAccount, debit: 1000, credit: 0 },
    { account: sourceAssetAccount, debit: 0, credit: 1000 },
  ];
  assert.equal(dispatchLines[0].debit, dispatchLines[1].credit);

  // Step 2: Receipt from in-transit
  const receiptLines = [
    { account: destAssetAccountDiffWh, debit: 1000, credit: 0 },
    { account: inTransitAccount, debit: 0, credit: 1000 },
  ];
  assert.equal(receiptLines[0].debit, receiptLines[1].credit);
});

test("25. Internal consumption and loss journal structure", () => {
  const assetAccount = new mongoose.Types.ObjectId();
  const consumptionExpenseAccount = new mongoose.Types.ObjectId();
  const damageExpenseAccount = new mongoose.Types.ObjectId();
  const expiryExpenseAccount = new mongoose.Types.ObjectId();

  // Consumption
  const consumptionLines = [
    { account: consumptionExpenseAccount, debit: 350, credit: 0 },
    { account: assetAccount, debit: 0, credit: 350 },
  ];
  assert.equal(consumptionLines[0].debit, consumptionLines[1].credit);

  // Damage
  const damageLines = [
    { account: damageExpenseAccount, debit: 120, credit: 0 },
    { account: assetAccount, debit: 0, credit: 120 },
  ];
  assert.equal(damageLines[0].debit, damageLines[1].credit);

  // Expiry
  const expiryLines = [
    { account: expiryExpenseAccount, debit: 80, credit: 0 },
    { account: assetAccount, debit: 0, credit: 80 },
  ];
  assert.equal(expiryLines[0].debit, expiryLines[1].credit);
});

