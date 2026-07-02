import TaxSlab from "../models/taxSlab.model.js";

const roundMoney = (value) => {
  const n = Number(value || 0);
  return Math.round(n * 100) / 100;
};

const clean = (value) => String(value ?? "").trim();

export const getFiscalYearForPayroll = ({ year, month, profile }) => {
  if (profile?.fiscalYear) return clean(profile.fiscalYear);
  return clean(year || new Date().getFullYear());
};

export const calculateYearlySlabTax = ({ taxableIncome, slabs = [] }) => {
  const income = Math.max(0, Number(taxableIncome || 0));
  let total = 0;

  const activeSlabs = [...slabs]
    .filter((slab) => slab?.isActive !== false)
    .sort((a, b) => Number(a.minIncome || 0) - Number(b.minIncome || 0));

  for (const slab of activeSlabs) {
    const min = Number(slab.minIncome || 0);
    const max = slab.maxIncome === null || slab.maxIncome === undefined ? income : Number(slab.maxIncome);
    if (income <= min) continue;

    const taxablePortion = Math.max(0, Math.min(income, max) - min);
    if (taxablePortion <= 0) continue;

    total += Number(slab.fixedAmount || 0);
    total += (taxablePortion * Number(slab.rate || 0)) / 100;
  }

  return roundMoney(total);
};

export const calculateEmployeeTaxDeduction = async ({ employee, grossSalary, year, month }) => {
  const profile = employee?.taxProfile || {};
  if (profile.enabled !== true) {
    return { amount: 0, component: null, yearlyTax: 0, fiscalYear: getFiscalYearForPayroll({ year, month, profile }) };
  }

  const method = clean(profile.method || "slab").toLowerCase();
  const monthlyGross = roundMoney(grossSalary);
  const fiscalYear = getFiscalYearForPayroll({ year, month, profile });
  let amount = 0;
  let yearlyTax = 0;
  let slabs = [];

  if (method === "fixed") {
    amount = roundMoney(profile.fixedAmount || 0);
    yearlyTax = roundMoney(amount * 12);
  } else if (method === "percentage") {
    amount = roundMoney((monthlyGross * Number(profile.percentage || 0)) / 100);
    yearlyTax = roundMoney(amount * 12);
  } else {
    const annualGross = roundMoney(monthlyGross * 12);
    const taxableIncome = Math.max(
      0,
      annualGross - Number(profile.exemptionAmount || 0) - Number(profile.investmentAmount || 0)
    );
    slabs = await TaxSlab.find({
      fiscalYear,
      taxpayerType: clean(profile.taxpayerType || "general").toLowerCase(),
      isActive: { $ne: false },
    })
      .sort({ minIncome: 1 })
      .lean();
    yearlyTax = calculateYearlySlabTax({ taxableIncome, slabs });
    amount = roundMoney(yearlyTax / 12);
  }

  if (amount <= 0) {
    return { amount: 0, component: null, yearlyTax, fiscalYear };
  }

  return {
    amount,
    yearlyTax,
    fiscalYear,
    component: {
      name: "Tax / TDS Deduction",
      type: "deduction",
      source: "tax",
      calculationType: method === "slab" ? "variable" : method,
      value: method === "percentage" ? Number(profile.percentage || 0) : amount,
      quantity: 1,
      basedOn: "grossSalary",
      amount,
      meta: {
        fiscalYear,
        tin: clean(profile.tin),
        taxpayerType: clean(profile.taxpayerType || "general").toLowerCase(),
        method,
        yearlyTax,
        exemptionAmount: Number(profile.exemptionAmount || 0),
        investmentAmount: Number(profile.investmentAmount || 0),
        slabCount: slabs.length,
      },
      note: "Tax/TDS deduction from employee tax profile.",
    },
  };
};
