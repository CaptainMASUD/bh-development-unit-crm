import BankAccount from "../../models/bankAccount.model.js";
import Branch from "../../models/branch.model.js";
import CashAccount from "../../models/cashAccount.model.js";
import Customer from "../../models/customer.model.js";
import Lead from "../../models/crm/lead.model.js";
import Product from "../../models/inventory/product.model.js";
import Warehouse from "../../models/inventory/warehouse.model.js";
import User from "../../models/user.model.js";
import { assertTenant } from "../../utils/salesError.js";

export const getSalesOptions = async (req, res) => {
  const tenantId = assertTenant(req);
  const tf = tenantId ? { tenantId } : {};

  const [customers, leads, products, warehouses, branches, salespeople, cashAccounts, bankAccounts] = await Promise.all([
    Customer.find({ lifecycleStage: { $ne: "churned" } })
      .select("name companyName email phone lifecycleStage creditHold creditLimit paymentTermsDays billingAddress shippingAddress")
      .sort({ companyName: 1, name: 1, _id: 1 })
      .limit(500)
      .lean(),
    Lead.find({
      status: { $ne: "lost" },
      pipelineStage: { $nin: ["won", "lost"] },
      $or: [{ customerId: null }, { customerId: { $exists: false } }],
    })
      .select("leadNumber contact pipelineStage status leadTemperature priority")
      .sort({ "contact.companyName": 1, "contact.name": 1, _id: 1 })
      .limit(500)
      .lean(),
    Product.find({ ...tf, status: "active" })
      .select("name sku sellingPrice minimumSellingPrice taxRate baseUnit currency productType trackInventory")
      .sort({ nameLower: 1, _id: 1 })
      .limit(500)
      .lean(),
    Warehouse.find({ ...tf, status: "active" })
      .select("name code branch isDefault")
      .sort({ isDefault: -1, nameLower: 1, _id: 1 })
      .lean(),
    Branch.find({ isActive: true })
      .select("name code isMain isDefault")
      .sort({ isDefault: -1, isMain: -1, name: 1 })
      .lean(),
    User.find({ isActive: true, role: { $in: ["admin", "employee"] } })
      .select("name email employeeId role")
      .sort({ nameLower: 1, _id: 1 })
      .limit(500)
      .lean(),
    CashAccount.find({ ...tf, isActive: true })
      .select("name type currency institution accountNo")
      .sort({ nameLower: 1, _id: 1 })
      .lean(),
    BankAccount.find({ ...tf, status: "active", ledgerAccount: { $ne: null } })
      .select("accountName accountNumber accountType currency bank")
      .populate("bank", "name shortName")
      .sort({ accountNameLower: 1, _id: 1 })
      .lean(),
  ]);

  return res.json({
    success: true,
    data: { customers, leads, products, warehouses, branches, salespeople, cashAccounts, bankAccounts },
  });
};
