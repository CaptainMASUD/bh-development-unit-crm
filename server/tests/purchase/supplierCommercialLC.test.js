import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import Supplier, {
  SUPPLIER_SCOPES,
  PAYMENT_TERM_TYPES,
  INCOTERMS,
} from "../../models/supplier.model.js";
import PurchaseOrder from "../../models/purchaseOrder.model.js";
import CommercialLC from "../../models/commercialLC.model.js";
import ImportShipment from "../../models/importShipment.model.js";
import GoodsReceipt from "../../models/goodsReceipt.model.js";
import LandedCost from "../../models/landedCost.model.js";
import VendorBill from "../../models/vendorBill.model.js";
import { supplierReferenceData } from "../../services/supplier.service.js";

test("Supplier scope supports local, international, and foreign", () => {
  assert.ok(SUPPLIER_SCOPES.includes("local"));
  assert.ok(SUPPLIER_SCOPES.includes("international"));
  assert.ok(SUPPLIER_SCOPES.includes("foreign"));
  assert.ok(SUPPLIER_SCOPES.includes("both"));
});

test("Supplier supports Commercial LC payment terms and Incoterms", () => {
  for (const term of ["immediate", "net_30", "lc", "sight_lc", "usance_lc", "deferred", "cad", "advance"]) {
    assert.ok(PAYMENT_TERM_TYPES.includes(term), `${term} should be valid payment term type`);
  }
  for (const incoterm of ["FOB", "CIF", "CFR", "EXW", "DDP"]) {
    assert.ok(INCOTERMS.includes(incoterm), `${incoterm} should be a valid Incoterm`);
  }
});

test("Supplier schema has required Commercial LC / Import fields", () => {
  assert.ok(Supplier.schema.path("country"), "country should exist on Supplier");
  assert.ok(Supplier.schema.path("supplierScope"), "supplierScope should exist on Supplier");
  assert.ok(Supplier.schema.path("supplierType"), "supplierType should exist on Supplier");
  assert.ok(Supplier.schema.path("procurement.currency"), "procurement.currency should exist on Supplier");
  assert.ok(Supplier.schema.path("procurement.incoterm"), "procurement.incoterm should exist on Supplier");
  assert.ok(Supplier.schema.path("procurement.paymentTermType"), "procurement.paymentTermType should exist on Supplier");

  const bankAccountSchema = Supplier.schema.path("bankAccounts").schema;
  assert.ok(bankAccountSchema.path("bankName"), "bankName should exist on bankAccount");
  assert.ok(bankAccountSchema.path("branchName"), "branchName should exist on bankAccount");
  assert.ok(bankAccountSchema.path("accountNumber"), "accountNumber should exist on bankAccount");
  assert.ok(bankAccountSchema.path("accountName"), "accountName should exist on bankAccount");
  assert.ok(bankAccountSchema.path("beneficiaryName"), "beneficiaryName should exist on bankAccount");
  assert.ok(bankAccountSchema.path("swiftCode"), "swiftCode should exist on bankAccount");
  assert.ok(bankAccountSchema.path("bicCode"), "bicCode should exist on bankAccount");
  assert.ok(bankAccountSchema.path("bankAddress"), "bankAddress should exist on bankAccount");
  assert.ok(bankAccountSchema.path("bankCountry"), "bankCountry should exist on bankAccount");
});

test("Supplier pre-validation normalizes country and bank aliases", async () => {
  const foreignSupplier = new Supplier({
    code: "SUPP-TEST-001",
    businessName: "Shanghai Precision Machinery Co., Ltd.",
    supplierScope: "foreign",
    country: "China",
    bankAccounts: [
      {
        bankName: "Bank of China",
        branchName: "Pudong Branch",
        beneficiaryName: "Shanghai Precision Machinery Co., Ltd.",
        accountNumber: "62220210001234567",
        bicCode: "BKCHCNBJ300",
        bankAddress: "No. 200 Century Avenue, Pudong New Area, Shanghai",
        bankCountry: "China",
        currency: "USD",
        isPrimary: true,
      },
    ],
    procurement: {
      currency: "USD",
      paymentTermType: "sight_lc",
      incoterm: "FOB",
    },
  });

  await foreignSupplier.validate();

  assert.equal(foreignSupplier.country, "China");
  assert.equal(foreignSupplier.supplierScope, "foreign");
  assert.equal(foreignSupplier.bankAccounts[0].accountName, "Shanghai Precision Machinery Co., Ltd.");
  assert.equal(foreignSupplier.bankAccounts[0].beneficiaryName, "Shanghai Precision Machinery Co., Ltd.");
  assert.equal(foreignSupplier.bankAccounts[0].swiftCode, "BKCHCNBJ300");
  assert.equal(foreignSupplier.bankAccounts[0].bicCode, "BKCHCNBJ300");
  assert.equal(foreignSupplier.bankAccounts[0].bankAddress, "No. 200 Century Avenue, Pudong New Area, Shanghai");
  assert.equal(foreignSupplier.bankAccounts[0].bankCountry, "China");
  assert.equal(foreignSupplier.defaultCurrency, "USD");
  assert.equal(foreignSupplier.defaultIncoterm, "FOB");
});

test("Supplier reference data includes incoterms and updated payment terms", () => {
  assert.ok(Array.isArray(supplierReferenceData.incoterms));
  assert.ok(supplierReferenceData.incoterms.includes("FOB"));
  assert.ok(supplierReferenceData.supplierScopes.includes("foreign"));
  assert.ok(supplierReferenceData.paymentTermTypes.includes("sight_lc"));
});

test("Commercial LC Import Workflow end-to-end link integrity", () => {
  // 1. PurchaseOrder references Supplier
  assert.ok(PurchaseOrder.schema.path("supplier"));
  assert.equal(PurchaseOrder.schema.path("supplier").options.ref, "Supplier");

  // 2. CommercialLC references Supplier and PurchaseOrder
  assert.ok(CommercialLC.schema.path("supplier"));
  assert.equal(CommercialLC.schema.path("supplier").options.ref, "Supplier");
  assert.ok(CommercialLC.schema.path("purchaseOrder"));
  assert.equal(CommercialLC.schema.path("purchaseOrder").options.ref, "PurchaseOrder");
  assert.ok(CommercialLC.schema.path("beneficiaryBankName"));
  assert.ok(CommercialLC.schema.path("beneficiaryBankSwift"));

  // 3. ImportShipment references Supplier, CommercialLC, PurchaseOrder
  assert.ok(ImportShipment.schema.path("supplier"));
  assert.equal(ImportShipment.schema.path("supplier").options.ref, "Supplier");
  assert.ok(ImportShipment.schema.path("commercialLC"));
  assert.equal(ImportShipment.schema.path("commercialLC").options.ref, "CommercialLC");
  assert.ok(ImportShipment.schema.path("purchaseOrder"));
  assert.equal(ImportShipment.schema.path("purchaseOrder").options.ref, "PurchaseOrder");

  // 4. GoodsReceipt references Supplier, CommercialLC, ImportShipment, PurchaseOrder
  assert.ok(GoodsReceipt.schema.path("supplier"));
  assert.equal(GoodsReceipt.schema.path("supplier").options.ref, "Supplier");
  assert.ok(GoodsReceipt.schema.path("commercialLC"));
  assert.equal(GoodsReceipt.schema.path("commercialLC").options.ref, "CommercialLC");
  assert.ok(GoodsReceipt.schema.path("importShipment"));
  assert.equal(GoodsReceipt.schema.path("importShipment").options.ref, "ImportShipment");
  assert.ok(GoodsReceipt.schema.path("purchaseOrder"));
  assert.equal(GoodsReceipt.schema.path("purchaseOrder").options.ref, "PurchaseOrder");

  // 5. LandedCost references CommercialLC, ImportShipment, PurchaseOrder, GoodsReceipt
  assert.ok(LandedCost.schema.path("commercialLC"));
  assert.ok(LandedCost.schema.path("importShipment"));
  assert.ok(LandedCost.schema.path("purchaseOrder"));
  assert.ok(LandedCost.schema.path("goodsReceipts"));

  // 6. VendorBill references Supplier and PurchaseOrder
  assert.ok(VendorBill.schema.path("supplier"));
  assert.equal(VendorBill.schema.path("supplier").options.ref, "Supplier");
  assert.ok(VendorBill.schema.path("purchaseOrder"));
  assert.equal(VendorBill.schema.path("purchaseOrder").options.ref, "PurchaseOrder");
});
