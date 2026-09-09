import TaxSlab from "../../models/taxSlab.model.js";
import Payroll from "../../models/payroll.model.js";

const roundMoney = (value) => {
  const n = Number(value || 0);
  return Math.round(n * 100) / 100;
};

const clean = (value) => String(value ?? "").trim();

export const getFiscalYearForPayroll = ({ year, month, profile }) => {
  if (profile?.fiscalYear) return clean(profile.fiscalYear);
  return clean(year || new Date().getFullYear());
};

export const getFiscalYearWindow = ({ year, month, profile }) => {
  const startMonth = Math.min(Math.max(Number(profile?.fiscalYearStartMonth || 1), 1), 12);
  const payrollYear = Number(year || new Date().getFullYear());
  const payrollMonth = Number(month || new Date().getMonth() + 1);
  const startYear = payrollMonth >= startMonth ? payrollYear : payrollYear - 1;
  const endYear = startYear + 1;
  return {
    startYear,
    endYear,
    startMonth,
    fiscalYear: profile?.fiscalYear ? clean(profile.fiscalYear) : clean(startYear),
  };
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

    if (Number(slab.fixedAmount || 0) > 0) {
      total = Math.max(total, Number(slab.fixedAmount || 0) + (taxablePortion * Number(slab.rate || 0)) / 100);
      continue;
    }

    total += (taxablePortion * Number(slab.rate || 0)) / 100;
  }

  return roundMoney(total);
};

const normalizeTaxMode = (value) => {
  const mode = clean(value || "auto").toLowerCase();
  return ["auto", "override", "disabled"].includes(mode) ? mode : "auto";
};

const resolveTaxProfile = ({ employee, salaryProfile }) => {
  const salaryTax = salaryProfile?.taxProfile || {};
  const employeeTax = employee?.taxProfile || {};
  if (salaryTax.mode === "disabled" || employeeTax.mode === "disabled") {
    return { ...employeeTax, ...salaryTax, mode: "disabled", enabled: false };
  }
  const source = (salaryTax.mode || salaryTax.enabled === true) ? salaryTax : employeeTax;
  const mode = normalizeTaxMode(source.mode);

  if (mode === "disabled") {
    return { ...source, mode: "disabled", enabled: false };
  }

  if (mode === "override") {
    return { ...source, mode: "override", enabled: true };
  }

  return {
    ...employeeTax,
    ...salaryTax,
    mode: "auto",
    enabled: Boolean(salaryProfile?.isActive !== false && salaryProfile?._id),
    method: "slab",
    taxpayerType: clean(source.taxpayerType || employeeTax.taxpayerType || salaryTax.taxpayerType || "general").toLowerCase(),
    fiscalYearStartMonth: Number(source.fiscalYearStartMonth || employeeTax.fiscalYearStartMonth || salaryTax.fiscalYearStartMonth || 1),
    exemptionAmount: Number(source.exemptionAmount || 0),
    investmentAmount: Number(source.investmentAmount || 0),
  };
};

const calculateTaxableMonthlyIncome = ({ taxableGrossSalary, grossSalary }) => {
  const taxable = Number(taxableGrossSalary || 0);
  if (taxable > 0) return roundMoney(taxable);
  return roundMoney(grossSalary);
};

const getTaxPaidBeforePayroll = async ({ employeeId, fiscalYear, year, month }) => {
  const payrolls = await Payroll.find({
    employee: employeeId,
    $or: [
      { year: { $lt: Number(year) } },
      { year: Number(year), month: { $lt: Number(month) } },
    ],
    status: { $ne: "cancelled" },
    "deductions.source": "tax",
    "deductions.meta.fiscalYear": fiscalYear,
  })
    .select("deductions")
    .lean();

  return roundMoney(
    payrolls.reduce(
      (sum, payroll) =>
        sum +
        (payroll.deductions || [])
          .filter((item) => item.source === "tax" && item.meta?.fiscalYear === fiscalYear)
          .reduce((itemSum, item) => itemSum + Number(item.amount || 0), 0),
      0
    )
  );
};

export const calculateEmployeeTaxDeduction = async ({ employee, salaryProfile, grossSalary, taxableGrossSalary, year, month }) => {
  const profile = resolveTaxProfile({ employee, salaryProfile });
  if (profile.enabled !== true) {
    return { amount: 0, component: null, yearlyTax: 0, fiscalYear: getFiscalYearForPayroll({ year, month, profile }) };
  }

  const method = clean(profile.method || "slab").toLowerCase();
  const monthlyGross = roundMoney(grossSalary);
  const taxableMonthlyIncome = calculateTaxableMonthlyIncome({ taxableGrossSalary, grossSalary: monthlyGross });
  const fiscalYear = getFiscalYearForPayroll({ year, month, profile });
  const fiscalWindow = getFiscalYearWindow({ year, month, profile });
  let amount = 0;
  let yearlyTax = 0;
  let slabs = [];
  let taxableIncome = roundMoney(taxableMonthlyIncome * 12);
  let taxPaidYtd = 0;
  let remainingMonths = 12;

  if (method === "fixed") {
    amount = roundMoney(profile.fixedAmount || 0);
    yearlyTax = roundMoney(amount * 12);
  } else if (method === "percentage") {
    amount = roundMoney((taxableMonthlyIncome * Number(profile.percentage || 0)) / 100);
    yearlyTax = roundMoney(amount * 12);
  } else {
    taxableIncome = Math.max(
      0,
      roundMoney(taxableMonthlyIncome * 12) - Number(profile.exemptionAmount || 0) - Number(profile.investmentAmount || 0)
    );
    slabs = await TaxSlab.find({
      fiscalYear,
      taxpayerType: clean(profile.taxpayerType || "general").toLowerCase(),
      isActive: { $ne: false },
    })
      .sort({ minIncome: 1 })
      .lean();
    yearlyTax = calculateYearlySlabTax({ taxableIncome, slabs });
  }

  if (method === "slab") {
    taxPaidYtd = await getTaxPaidBeforePayroll({
      employeeId: employee?._id,
      fiscalYear,
      year,
      month,
    });
    const elapsedMonths = ((Number(year) - fiscalWindow.startYear) * 12) + (Number(month) - fiscalWindow.startMonth) + 1;
    remainingMonths = Math.max(1, 12 - Math.max(0, elapsedMonths - 1));
    amount = roundMoney(Math.max(0, yearlyTax - taxPaidYtd) / remainingMonths);
  }

  if (amount <= 0) {
    return { amount: 0, component: null, yearlyTax, fiscalYear, taxableIncome, taxPaidYtd, remainingMonths };
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
        taxableMonthlyIncome,
        taxableIncome,
        yearlyTax,
        taxPaidYtd,
        remainingTax: roundMoney(Math.max(0, yearlyTax - taxPaidYtd - amount)),
        remainingMonths,
        exemptionAmount: Number(profile.exemptionAmount || 0),
        investmentAmount: Number(profile.investmentAmount || 0),
        slabCount: slabs.length,
      },
      note: "Tax/TDS deduction from salary tax profile.",
    },
  };
};
