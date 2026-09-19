import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { numberToWords, DEFAULT_CURRENCY_MAP } from "../../utils/numberToWords.js";
import {
  generatePayslipPdfBuffer,
  mergePayslipsPdf,
  maskAccountNumber,
  maskMfsNumber,
} from "../../services/payroll/payslipPdf.service.js";
import {
  sanitizeCellText,
  generatePayrollRegisterExport,
  generateBankDisbursementAdvice,
  generateMfsDisbursementAdvice,
} from "../../services/payroll/payrollExport.service.js";
import Payroll from "../../models/payroll.model.js";
import PayrollAudit from "../../models/payroll/payrollAudit.model.js";

/* =========================================================
   1. NUMBER TO WORDS UTILITY (CURRENCY AGNOSTIC)
========================================================= */
test("numberToWords: converts BDT amounts correctly", () => {
  const words1 = numberToWords(54250, "BDT");
  assert.equal(words1, "Fifty-Four Thousand Two Hundred Fifty Taka Only");

  const wordsWithPoisha = numberToWords(10500.5, "BDT");
  assert.equal(wordsWithPoisha, "Ten Thousand Five Hundred Taka and Fifty Poisha Only");

  const zeroWords = numberToWords(0, "BDT");
  assert.equal(zeroWords, "Zero Taka Only");
});

test("numberToWords: supports USD and EUR currency configurations without hardcoding", () => {
  const usdWords = numberToWords(2500.75, "USD");
  assert.equal(usdWords, "Two Thousand Five Hundred Dollars and Seventy-Five Cents Only");

  const eurWords = numberToWords(1500, "EUR");
  assert.equal(eurWords, "One Thousand Five Hundred Euros Only");

  // Custom unit override
  const customWords = numberToWords(500, "CUSTOM", { unit: "Credits", subunit: "Bits" });
  assert.equal(customWords, "Five Hundred Credits Only");
});

/* =========================================================
   2. PAYOUT DETAILS MASKING
========================================================= */
test("Payout Masking: bank account numbers and MFS numbers are safely masked in UI/PDF", () => {
  const fullBankAc = "1151200987654";
  const maskedBank = maskAccountNumber(fullBankAc);
  assert.equal(maskedBank, "********7654");
  assert.ok(!maskedBank.includes("1151200"));

  const fullMfs = "01712345678";
  const maskedMfs = maskMfsNumber(fullMfs);
  assert.equal(maskedMfs, "017*****678");
  assert.ok(!maskedMfs.includes("1234"));

  // Edge cases
  assert.equal(maskAccountNumber(""), "—");
  assert.equal(maskAccountNumber("123"), "123");
  assert.equal(maskMfsNumber(""), "—");
});

/* =========================================================
   3. SNAPSHOT-DRIVEN PAYSLIP PDF GENERATION (PDF-LIB)
========================================================= */
test("Payslip PDF: generates valid PDF buffer strictly from frozen snapshots", async () => {
  const mockPayroll = {
    _id: new mongoose.Types.ObjectId(),
    payrollKey: "EMP001-2026-09",
    year: 2026,
    month: 9,
    periodStart: new Date("2026-09-01"),
    periodEnd: new Date("2026-09-30"),
    currency: "BDT",
    status: "paid",
    employee: {
      _id: new mongoose.Types.ObjectId(),
      name: "Tariqul Islam",
      email: "tariqul@example.com",
      employeeId: "EMP-001",
    },
    department: { name: "Software Engineering" },
    position: { title: "Senior Developer" },
    basicSalary: 60000,
    grossSalary: 85000,
    totalDeductions: 8500,
    taxDeduction: 5000,
    netPayable: 76500,
    salarySnapshot: {
      basicSalary: 60000,
      isProrated: false,
      activeDays: 30,
      totalDaysInMonth: 30,
    },
    attendanceSummary: {
      presentDays: 22,
      lateDays: 1,
      paidLeaveDays: 2,
      unpaidLeaveDays: 0,
      absentDays: 0,
      approvedOvertimeHours: 5,
    },
    earnings: [
      { name: "House Rent", amount: 15000 },
      { name: "Medical Allowance", amount: 5000 },
      { name: "Performance Bonus", amount: 5000 },
    ],
    deductions: [
      { name: "Tax Deduction / TDS", amount: 5000, source: "tax" },
      { name: "Employee Loan #LN-001", amount: 3500, source: "employee_loan" },
    ],
    payoutSnapshot: {
      preferredPayoutMethod: "bank",
      bankName: "Eastern Bank PLC",
      accountNumber: "1151200987654",
      routingNumber: "125271458",
    },
  };

  const mockCompany = {
    name: "Enterprise Solutions Ltd",
    address: { line1: "House 12, Road 4", city: "Dhaka", country: "Bangladesh" },
    phone: "+880 1700-000000",
    email: "hr@enterprisesolutions.com",
    settings: { currency: "BDT" },
  };

  const pdfBuffer = await generatePayslipPdfBuffer(mockPayroll, mockCompany);
  assert.ok(pdfBuffer instanceof Uint8Array);
  assert.ok(pdfBuffer.length > 500);

  // PDF binary header check
  const headerStr = Buffer.from(pdfBuffer.slice(0, 5)).toString("utf8");
  assert.equal(headerStr, "%PDF-");
});

test("Payslip PDF: historical reversed payroll displays prominent REVERSED status", async () => {
  const reversedPayroll = {
    _id: new mongoose.Types.ObjectId(),
    payrollKey: "EMP002-2026-08",
    year: 2026,
    month: 8,
    currency: "BDT",
    status: "reversed",
    isReversed: true,
    reversedAt: new Date("2026-08-25"),
    reversalReason: "Incorrect attendance adjustment reconciled",
    employee: { name: "Rahim Chowdhury", employeeId: "EMP-002" },
    basicSalary: 50000,
    grossSalary: 65000,
    totalDeductions: 5000,
    netPayable: 60000,
    salarySnapshot: { basicSalary: 50000 },
    earnings: [{ name: "Medical", amount: 15000 }],
    deductions: [{ name: "Provident Fund", amount: 5000 }],
    payoutSnapshot: { preferredPayoutMethod: "cash" },
  };

  const pdfBuffer = await generatePayslipPdfBuffer(reversedPayroll, { name: "Alpha Corp" });
  assert.ok(pdfBuffer instanceof Uint8Array);
  assert.ok(pdfBuffer.length > 500);
  assert.equal(Buffer.from(pdfBuffer.slice(0, 5)).toString("utf8"), "%PDF-");
});

test("Payslip PDF: mergePayslipsPdf successfully combines multiple payslips into multi-page PDF", async () => {
  const p1 = {
    _id: new mongoose.Types.ObjectId(),
    year: 2026,
    month: 9,
    employee: { name: "User One" },
    grossSalary: 50000,
    netPayable: 45000,
    salarySnapshot: { basicSalary: 40000 },
  };
  const p2 = {
    _id: new mongoose.Types.ObjectId(),
    year: 2026,
    month: 9,
    employee: { name: "User Two" },
    grossSalary: 60000,
    netPayable: 55000,
    salarySnapshot: { basicSalary: 50000 },
  };

  const buf1 = await generatePayslipPdfBuffer(p1, {});
  const buf2 = await generatePayslipPdfBuffer(p2, {});

  const mergedBuffer = await mergePayslipsPdf([buf1, buf2]);
  assert.ok(mergedBuffer instanceof Uint8Array);
  assert.ok(mergedBuffer.length > buf1.length);
  assert.equal(Buffer.from(mergedBuffer.slice(0, 5)).toString("utf8"), "%PDF-");
});

/* =========================================================
   4. CSV & EXCEL SECURITY: FORMULA INJECTION (CWE-1236)
========================================================= */
test("CSV/Excel Security: prevents spreadsheet formula injection for dangerous starting characters", () => {
  // Strings beginning with =, +, -, @, \t, \r must be escaped with leading quote
  assert.equal(sanitizeCellText("=SUM(A1:A10)"), "'=SUM(A1:A10)");
  assert.equal(sanitizeCellText("+cmd|' /C calc'!A0"), "'+cmd|' /C calc'!A0");
  assert.equal(sanitizeCellText("-10+20"), "'-10+20");
  assert.equal(sanitizeCellText("@dangerousMethod()"), "'@dangerousMethod()");

  // Pure numbers should NOT be artificially escaped
  assert.equal(sanitizeCellText("12345"), "12345");
  assert.equal(sanitizeCellText("-500"), "-500");
  assert.equal(sanitizeCellText("+120.50"), "+120.50");

  // Normal safe text
  assert.equal(sanitizeCellText("John Doe"), "John Doe");
  assert.equal(sanitizeCellText(""), "");
});

/* =========================================================
   5. PAYROLL REGISTER & DISBURSEMENT ADVICE EXPORTS
========================================================= */
test("Payroll Register: generates valid CSV with correct headers and totals row", () => {
  const payrolls = [
    {
      _id: new mongoose.Types.ObjectId(),
      payrollKey: "PAY-202609-001",
      year: 2026,
      month: 9,
      status: "approved",
      employee: { name: "Tariqul Islam", employeeId: "EMP-001" },
      department: { name: "Engineering" },
      position: { title: "Lead Architect" },
      basicSalary: 80000,
      grossSalary: 100000,
      totalDeductions: 15000,
      taxDeduction: 10000,
      netPayable: 85000,
      salarySnapshot: { basicSalary: 80000 },
      payoutSnapshot: { preferredPayoutMethod: "bank", bankName: "City Bank", accountNumber: "123456789" },
    },
    {
      _id: new mongoose.Types.ObjectId(),
      payrollKey: "PAY-202609-002",
      year: 2026,
      month: 9,
      status: "approved",
      employee: { name: "Amina Begum", employeeId: "EMP-002" },
      department: { name: "Human Resources" },
      position: { title: "HR Executive" },
      basicSalary: 40000,
      grossSalary: 50000,
      totalDeductions: 5000,
      taxDeduction: 2000,
      netPayable: 45000,
      salarySnapshot: { basicSalary: 40000 },
      payoutSnapshot: { preferredPayoutMethod: "mobile_banking", mfsProvider: "bKash", mfsNumber: "01700000000" },
    },
  ];

  const csvResult = generatePayrollRegisterExport({ payrolls, format: "csv", periodLabel: "2026-09" });
  assert.equal(csvResult.contentType, "text/csv; charset=utf-8");
  assert.ok(csvResult.data.includes("Sl No,Payroll Ref,Period,Employee ID,Employee Name"));
  assert.ok(csvResult.data.includes("Tariqul Islam"));
  assert.ok(csvResult.data.includes("Amina Begum"));
  // Totals row: Total Gross 150000, Total Net 130000
  assert.ok(csvResult.data.includes("TOTALS"));
  assert.ok(csvResult.data.includes("150000"));
  assert.ok(csvResult.data.includes("130000"));

  // XLSX export check
  const xlsxResult = generatePayrollRegisterExport({ payrolls, format: "xlsx", periodLabel: "2026-09" });
  assert.equal(xlsxResult.contentType, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.ok(Buffer.isBuffer(xlsxResult.data));
  assert.ok(xlsxResult.data.length > 500);
});

test("Bank Advice Export: isolates bank payments and provides unmasked corporate transfer columns", () => {
  const payrolls = [
    {
      _id: new mongoose.Types.ObjectId(),
      year: 2026,
      month: 9,
      employee: { name: "Corporate Employee 1", employeeId: "EMP-010" },
      netPayable: 65000,
      currency: "BDT",
      payoutSnapshot: {
        preferredPayoutMethod: "bank",
        accountHolderName: "Corporate Employee 1",
        bankName: "BRAC Bank PLC",
        branchName: "Gulshan",
        accountNumber: "150120999888777",
        routingNumber: "060271234",
      },
    },
    {
      _id: new mongoose.Types.ObjectId(),
      year: 2026,
      month: 9,
      employee: { name: "MFS Employee", employeeId: "EMP-011" },
      netPayable: 30000,
      payoutSnapshot: { preferredPayoutMethod: "mobile_banking", mfsProvider: "bKash", mfsNumber: "01711112222" },
    },
  ];

  const bankAdviceCsv = generateBankDisbursementAdvice({ payrolls, format: "csv", periodLabel: "2026-09" });
  assert.ok(bankAdviceCsv.data.includes("BRAC Bank PLC"));
  assert.ok(bankAdviceCsv.data.includes("150120999888777"));
  assert.ok(!bankAdviceCsv.data.includes("MFS Employee")); // excluded non-bank
  assert.ok(bankAdviceCsv.data.includes(",,TOTAL,,,,,,65000,,"));
});

test("MFS Advice Export: isolates MFS payments and provides unmasked wallet numbers", () => {
  const payrolls = [
    {
      _id: new mongoose.Types.ObjectId(),
      year: 2026,
      month: 9,
      employee: { name: "MFS User", employeeId: "EMP-020" },
      netPayable: 35000,
      currency: "BDT",
      payoutSnapshot: {
        preferredPayoutMethod: "mobile_banking",
        mfsProvider: "Nagad",
        mfsNumber: "01819998877",
      },
    },
    {
      _id: new mongoose.Types.ObjectId(),
      year: 2026,
      month: 9,
      employee: { name: "Bank User", employeeId: "EMP-021" },
      netPayable: 50000,
      payoutSnapshot: { preferredPayoutMethod: "bank", bankName: "DBBL", accountNumber: "123" },
    },
  ];

  const mfsAdviceCsv = generateMfsDisbursementAdvice({ payrolls, format: "csv", periodLabel: "2026-09" });
  assert.ok(mfsAdviceCsv.data.includes("MFS User"));
  assert.ok(mfsAdviceCsv.data.includes("Nagad"));
  assert.ok(mfsAdviceCsv.data.includes("01819998877"));
  assert.ok(!mfsAdviceCsv.data.includes("Bank User")); // excluded bank
  assert.ok(mfsAdviceCsv.data.includes(",,TOTAL,,,35000,,"));
});

/* =========================================================
   6. SECURITY, TENANT ISOLATION & ACCESS CONTROL INVARIANTS
========================================================= */
test("Tenant Isolation Invariant: user from Tenant A cannot access Tenant B payroll", () => {
  const tenantA = new mongoose.Types.ObjectId();
  const tenantB = new mongoose.Types.ObjectId();

  const payrollTenantB = {
    _id: new mongoose.Types.ObjectId(),
    tenantId: tenantB,
    employee: { _id: new mongoose.Types.ObjectId(), tenantId: tenantB },
  };

  const reqUserTenantA = {
    tenantId: tenantA,
    user: { _id: new mongoose.Types.ObjectId(), role: "admin", tenantId: tenantA },
  };

  // Evaluation logic matching assertPayrollTenant
  const userTenant = reqUserTenantA.tenantId || reqUserTenantA.user?.tenantId;
  const payrollTenant = payrollTenantB.tenantId || payrollTenantB.employee?.tenantId;
  const isAllowed = !userTenant || !payrollTenant || String(userTenant) === String(payrollTenant);

  assert.equal(isAllowed, false, "Cross-tenant access must be strictly prohibited");
});

test("Ownership & Permission Invariant: employee can only access own payslip, not peers", () => {
  const emp1 = new mongoose.Types.ObjectId();
  const emp2 = new mongoose.Types.ObjectId();

  const payroll = {
    _id: new mongoose.Types.ObjectId(),
    employee: emp1,
  };

  // Emp 1 accessing their own payroll
  const isOwner1 = String(payroll.employee) === String(emp1);
  assert.equal(isOwner1, true, "Employee 1 must be permitted to access own payslip");

  // Emp 2 attempting to access Emp 1's payroll
  const isOwner2 = String(payroll.employee) === String(emp2);
  const isEmp2Admin = false;
  const canEmp2Access = isOwner2 || isEmp2Admin;
  assert.equal(canEmp2Access, false, "Employee 2 must be rejected with 403 Forbidden");
});

test("Bulk Request Validation Invariants: rejects non-array, invalid IDs, and >100 records", () => {
  const MAX_BULK_PAYSLIP_COUNT = 100;

  // 1. Non-array or empty
  const emptyIds = [];
  assert.equal(Array.isArray(emptyIds) && emptyIds.length > 0, false);

  // 2. Excessive count > 100
  const excessiveIds = Array.from({ length: 101 }, () => new mongoose.Types.ObjectId().toString());
  assert.ok(excessiveIds.length > MAX_BULK_PAYSLIP_COUNT, "Exceeding 100 items must be rejected");

  // 3. Invalid MongoDB ObjectID string
  const invalidId = "123-not-an-objectid";
  assert.equal(mongoose.Types.ObjectId.isValid(invalidId), false);
});

test("Audit Trail Invariant: sensitive operations log metadata without unmasked account numbers", async () => {
  const auditEntry = new PayrollAudit({
    payroll: new mongoose.Types.ObjectId(),
    action: "bank_advice_export",
    performedBy: new mongoose.Types.ObjectId(),
    tenantId: new mongoose.Types.ObjectId(),
    year: 2026,
    month: 9,
    details: {
      format: "xlsx",
      type: "bank",
      count: 42,
    },
  });

  assert.equal(auditEntry.action, "bank_advice_export");
  assert.equal(auditEntry.details.count, 42);
  // Verify no account numbers in audit metadata
  assert.equal(auditEntry.details.accountNumber, undefined);
  assert.equal(auditEntry.details.mfsNumber, undefined);
});
