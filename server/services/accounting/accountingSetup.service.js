import Account from "../../models/account.model.js";

export const SYSTEM_ACCOUNTS = [
  { code: "A000", name: "ASSETS", type: "asset", subType: "Asset", isGroup: true },
  { code: "L000", name: "LIABILITIES", type: "liability", subType: "Liability", isGroup: true },
  { code: "E000", name: "EQUITY", type: "equity", subType: "Equity", isGroup: true },
  { code: "I000", name: "INCOME", type: "revenue", subType: "Income", isGroup: true },
  { code: "X000", name: "EXPENSES", type: "expense", subType: "Expense", isGroup: true },
  { code: "X100", name: "DIRECT EXPENSES", type: "expense", subType: "Direct Expense", parentCode: "X000", isGroup: true, description: "" },
  { code: "X200", name: "INDIRECT EXPENSES", type: "expense", subType: "Indirect Expense", parentCode: "X000", isGroup: true, description: "" },
  { code: "1000", name: "Cash on Hand", type: "asset", subType: "Current Asset", parentCode: "A000" },
  { code: "1010", name: "Bank Account", type: "asset", subType: "Current Asset", parentCode: "A000" },
  { code: "1100", name: "Accounts Receivable", type: "asset", subType: "Current Asset", parentCode: "A000", isControlAccount: true, controlType: "receivable" },
  { code: "1200", name: "Input VAT / Tax Receivable", type: "asset", subType: "Current Asset", parentCode: "A000", isControlAccount: true, controlType: "tax" },
  { code: "1300", name: "Inventory", type: "asset", subType: "Current Asset", parentCode: "A000", isControlAccount: true, controlType: "inventory", description: "Inventory control account for the value of stock on hand." },
  { code: "1310", name: "Inventory In Transit", type: "asset", subType: "Current Asset", parentCode: "A000", isControlAccount: true, controlType: "inventory", description: "Inventory dispatched between warehouses awaiting receipt." },
  { code: "1320", name: "LC Margin / Restricted Cash", type: "asset", subType: "Current Asset", parentCode: "A000", description: "Cash margin lodged with a bank against import letters of credit." },
  { code: "1330", name: "Import Cost Clearing", type: "asset", subType: "Current Asset", parentCode: "A000", description: "Temporary clearing account for capitalizable freight, duty, insurance, bank, port, C&F, and other import costs before allocation to inventory." },
  { code: "1500", name: "Furniture", type: "asset", subType: "Fixed Asset", parentCode: "A000", description: "Furniture and fixtures used in business operations." },
  { code: "2000", name: "Accounts Payable", type: "liability", subType: "Current Liability", parentCode: "L000", isControlAccount: true, controlType: "payable" },
  { code: "2050", name: "Goods Received Not Invoiced", type: "liability", subType: "Current Liability", parentCode: "L000", description: "Accrued inventory receipts awaiting a matched supplier invoice." },
  { code: "2100", name: "Output VAT / Tax Payable", type: "liability", subType: "Current Liability", parentCode: "L000", isControlAccount: true, controlType: "tax" },
  { code: "2200", name: "Payroll Payable", type: "liability", subType: "Current Liability", parentCode: "L000" },
  { code: "2300", name: "Loan", type: "liability", subType: "Long-term Liability", parentCode: "L000", description: "Outstanding long-term loan principal payable." },
  { code: "3000", name: "Owner Equity", type: "equity", subType: "Capital", parentCode: "E000" },
  { code: "3100", name: "Opening Balance Equity", type: "equity", subType: "Equity", parentCode: "E000" },
  { code: "3200", name: "Retained Earnings", type: "equity", subType: "Retained Earnings", parentCode: "E000" },
  { code: "4000", name: "Sales Revenue", type: "revenue", subType: "Operating Income", parentCode: "I000" },
  { code: "5000", name: "Operating Expense", type: "expense", subType: "Indirect Expense", parentCode: "X200" },
  { code: "5010", name: "Purchases", type: "expense", subType: "Direct Expense", parentCode: "X100" },
  { code: "5020", name: "Cost of Goods Sold", type: "expense", subType: "Direct Expense", parentCode: "X100", description: "Recognized cost of inventory delivered through posted sales invoices." },
  { code: "5030", name: "Purchase Price Variance", type: "expense", subType: "Direct Expense", parentCode: "X100", description: "Difference between received inventory cost and matched supplier invoice cost." },
  { code: "5040", name: "Inventory Adjustment Gain or Loss", type: "expense", subType: "Direct Expense", parentCode: "X100", description: "Controlled offset for approved inventory count and valuation adjustments." },
  { code: "5050", name: "Inventory Damage Expense", type: "expense", subType: "Direct Expense", parentCode: "X100", description: "Write-off of damaged stock discovered during inspection or counting." },
  { code: "5060", name: "Inventory Expiry Expense", type: "expense", subType: "Direct Expense", parentCode: "X100", description: "Write-off of expired goods removed from stock." },
  { code: "5070", name: "Inventory Shrinkage and Loss", type: "expense", subType: "Direct Expense", parentCode: "X100", description: "Discrepancy and shrinkage losses from cycle counts and shortages." },
  { code: "5080", name: "Internal Inventory Consumption", type: "expense", subType: "Direct Expense", parentCode: "X100", description: "Internal company consumption of inventory items." },
  { code: "5090", name: "Inventory Revaluation Gain or Loss", type: "expense", subType: "Direct Expense", parentCode: "X100", description: "Valuation adjustments resulting from standard or market cost changes." },
  { code: "5100", name: "Payroll Expense", type: "expense", subType: "Indirect Expense", parentCode: "X200" },
  { code: "5110", name: "Salary Expense", type: "expense", subType: "Indirect Expense", parentCode: "X200" },
  { code: "5120", name: "Rent Expense", type: "expense", subType: "Indirect Expense", parentCode: "X200" },
  { code: "5130", name: "Import & LC Charges", type: "expense", subType: "Indirect Expense", parentCode: "X200", description: "Non-capitalizable bank and import processing charges." },
  { code: "5200", name: "Tax Expense", type: "expense", subType: "Indirect Expense", parentCode: "X200" },
];

/**
 * Creates the immutable accounting foundation inside the active verified tenant.
 * Existing accounts are updated only for an explicit administrator bootstrap;
 * lazy provisioning never overwrites a tenant's configured account details.
 */
export async function provisionSystemAccounts({ userId = null, updateExisting = false } = {}) {
  const created = [];
  const updated = [];
  const ordered = [...SYSTEM_ACCOUNTS].sort(
    (left, right) => Number(Boolean(left.parentCode)) - Number(Boolean(right.parentCode))
  );

  for (const source of ordered) {
    const item = { ...source };
    delete item.parentCode;
    if (source.parentCode) {
      item.parent = (await Account.findOne({ code: source.parentCode }).select("_id").lean())?._id || null;
    }

    let existing = await Account.findOne({ code: item.code });
    if (existing) {
      if (updateExisting) {
        existing.set({ ...item, isSystem: true, isActive: existing.isActive !== false, updatedBy: userId });
        await existing.save();
        updated.push(existing);
      }
      continue;
    }

    try {
      created.push(await Account.create({ ...item, isSystem: true, createdBy: userId }));
    } catch (error) {
      // Two first requests can provision a new tenant concurrently. The
      // tenant-scoped unique account code makes that race safe and idempotent.
      if (error?.code !== 11000) throw error;
      existing = await Account.findOne({ code: item.code });
      if (!existing) throw error;
    }
  }

  return { created, updated };
}
