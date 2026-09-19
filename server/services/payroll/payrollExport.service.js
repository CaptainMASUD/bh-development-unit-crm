import * as XLSX from "xlsx";
import { buildCsvString, escapeCsvValue } from "../shared/export.service.js";

/**
 * Sanitizes cell text to prevent formula injection (CWE-1236) in Excel/CSV.
 */
export const sanitizeCellText = (value) => {
  if (value === null || value === undefined) return "";
  const str = String(value).trim();
  const formulaChars = ["=", "+", "-", "@", "\t", "\r"];
  if (formulaChars.some((ch) => str.startsWith(ch))) {
    const isPureNumber = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(str);
    if (!isPureNumber) {
      return `'${str}`;
    }
  }
  return str;
};

/**
 * Formats a payroll record into a flat data object for the Payroll Register.
 */
export const buildPayrollRegisterRow = (payroll, index = 1) => {
  const emp = payroll.employee || {};
  const dept = payroll.department || emp.department || {};
  const pos = payroll.position || emp.position || {};
  const snap = payroll.salarySnapshot || {};
  const payout = payroll.payoutSnapshot || {};

  const basicSalary = Number(snap.basicSalary || payroll.basicSalary || 0);
  const grossSalary = Number(payroll.grossSalary || payroll.totalEarnings || 0);
  const otherEarnings = Math.max(grossSalary - basicSalary, 0);
  const totalDeductions = Number(payroll.totalDeductions || payroll.totalDeduction || 0);
  const taxDeduction = Number(payroll.taxDeduction || 0);
  const otherDeductions = Math.max(totalDeductions - taxDeduction, 0);
  const netPay = Number(payroll.netPayable ?? payroll.netSalary ?? 0);

  const method = String(payout.preferredPayoutMethod || payroll.paymentMethod || "cash").toLowerCase();
  let provider = "—";
  let accountNo = "—";
  if (method === "bank") {
    provider = payout.bankName || "Bank";
    accountNo = payout.accountNumber || "—";
  } else if (method === "mobile_banking" || method === "mfs") {
    provider = payout.mfsProvider || "MFS";
    accountNo = payout.mfsNumber || "—";
  }

  return {
    slNo: index,
    payrollKey: sanitizeCellText(payroll.payrollKey || String(payroll._id)),
    period: `${String(payroll.month).padStart(2, "0")}/${payroll.year}`,
    employeeId: sanitizeCellText(emp.employeeId || emp.email || String(emp._id || "").slice(-6).toUpperCase()),
    employeeName: sanitizeCellText(emp.name || "Unnamed Employee"),
    department: sanitizeCellText(dept.name || "—"),
    designation: sanitizeCellText(pos.title || "—"),
    status: sanitizeCellText(String(payroll.status || "draft").toUpperCase()),
    basicSalary,
    otherEarnings,
    grossSalary,
    taxDeduction,
    otherDeductions,
    totalDeductions,
    netPay,
    currency: payroll.currency || "BDT",
    paymentMethod: sanitizeCellText(method),
    provider: sanitizeCellText(provider),
    accountNo: sanitizeCellText(accountNo),
    paymentDate: payroll.paymentDate ? new Date(payroll.paymentDate).toISOString().slice(0, 10) : "—",
  };
};

/**
 * Builds the Payroll Register in XLSX or CSV format.
 */
export const generatePayrollRegisterExport = ({ payrolls = [], format = "xlsx", periodLabel = "" }) => {
  const rows = payrolls.map((p, idx) => buildPayrollRegisterRow(p, idx + 1));

  // Compute summary totals
  const totalGross = rows.reduce((sum, r) => sum + r.grossSalary, 0);
  const totalTax = rows.reduce((sum, r) => sum + r.taxDeduction, 0);
  const totalDeductions = rows.reduce((sum, r) => sum + r.totalDeductions, 0);
  const totalNet = rows.reduce((sum, r) => sum + r.netPay, 0);

  if (format === "csv") {
    const headers = [
      { key: "slNo", label: "Sl No" },
      { key: "payrollKey", label: "Payroll Ref" },
      { key: "period", label: "Period" },
      { key: "employeeId", label: "Employee ID" },
      { key: "employeeName", label: "Employee Name" },
      { key: "department", label: "Department" },
      { key: "designation", label: "Designation" },
      { key: "status", label: "Status" },
      { key: "basicSalary", label: "Basic Salary" },
      { key: "otherEarnings", label: "Allowances & Others" },
      { key: "grossSalary", label: "Gross Salary" },
      { key: "taxDeduction", label: "Tax / TDS" },
      { key: "otherDeductions", label: "Other Deductions" },
      { key: "totalDeductions", label: "Total Deductions" },
      { key: "netPay", label: "Net Payable" },
      { key: "currency", label: "Currency" },
      { key: "paymentMethod", label: "Payout Method" },
      { key: "provider", label: "Bank / MFS Provider" },
      { key: "accountNo", label: "Account / Wallet No" },
      { key: "paymentDate", label: "Payment Date" },
    ];

    const csvDataRows = [...rows];
    // Add total row
    csvDataRows.push({
      slNo: "",
      payrollKey: "",
      period: "",
      employeeId: "",
      employeeName: "TOTALS",
      department: "",
      designation: "",
      status: "",
      basicSalary: "",
      otherEarnings: "",
      grossSalary: totalGross,
      taxDeduction: totalTax,
      otherDeductions: "",
      totalDeductions,
      netPay: totalNet,
      currency: "",
      paymentMethod: "",
      provider: "",
      accountNo: "",
      paymentDate: "",
    });

    return {
      contentType: "text/csv; charset=utf-8",
      data: buildCsvString(headers, csvDataRows),
      filename: `payroll-register-${periodLabel || "export"}.csv`,
    };
  }

  // XLSX Generation
  const worksheetData = [
    [
      "Sl No", "Payroll Ref", "Period", "Employee ID", "Employee Name", "Department",
      "Designation", "Status", "Basic Salary", "Allowances & Others", "Gross Salary",
      "Tax / TDS", "Other Deductions", "Total Deductions", "Net Payable", "Currency",
      "Payout Method", "Bank / MFS Provider", "Account / Wallet No", "Payment Date",
    ],
    ...rows.map((r) => [
      r.slNo, r.payrollKey, r.period, r.employeeId, r.employeeName, r.department,
      r.designation, r.status, r.basicSalary, r.otherEarnings, r.grossSalary,
      r.taxDeduction, r.otherDeductions, r.totalDeductions, r.netPay, r.currency,
      r.paymentMethod, r.provider, r.accountNo, r.paymentDate,
    ]),
    [
      "", "", "", "", "TOTALS", "", "", "", "", "", totalGross,
      totalTax, "", totalDeductions, totalNet, "", "", "", "", "",
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(worksheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Payroll Register");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    data: buffer,
    filename: `payroll-register-${periodLabel || "export"}.xlsx`,
  };
};

/**
 * Builds the Corporate Bank Disbursement Advice.
 */
export const generateBankDisbursementAdvice = ({ payrolls = [], format = "xlsx", periodLabel = "" }) => {
  // Filter for bank payouts or fallback to bank if info is populated
  const eligible = payrolls.filter((p) => {
    const payout = p.payoutSnapshot || {};
    const method = String(payout.preferredPayoutMethod || p.paymentMethod || "").toLowerCase();
    return method === "bank" || Boolean(payout.accountNumber && payout.bankName);
  });

  const rows = eligible.map((p, idx) => {
    const emp = p.employee || {};
    const payout = p.payoutSnapshot || {};
    const netPay = Number(p.netPayable ?? p.netSalary ?? 0);
    const month = String(p.month || "").padStart(2, "0");

    return {
      slNo: idx + 1,
      employeeId: sanitizeCellText(emp.employeeId || emp.email || String(emp._id || "").slice(-6).toUpperCase()),
      employeeName: sanitizeCellText(emp.name || "Employee"),
      accountHolderName: sanitizeCellText(payout.accountHolderName || emp.name || "—"),
      bankName: sanitizeCellText(payout.bankName || "—"),
      branchName: sanitizeCellText(payout.branchName || "—"),
      accountNumber: sanitizeCellText(payout.accountNumber || "—"),
      routingNumber: sanitizeCellText(payout.routingNumber || "—"),
      amount: netPay,
      currency: p.currency || "BDT",
      narration: sanitizeCellText(`Salary ${month}/${p.year}`),
    };
  });

  const totalAmount = rows.reduce((sum, r) => sum + r.amount, 0);

  if (format === "csv") {
    const headers = [
      { key: "slNo", label: "Sl No" },
      { key: "employeeId", label: "Employee ID" },
      { key: "employeeName", label: "Employee Name" },
      { key: "accountHolderName", label: "Account Holder Name" },
      { key: "bankName", label: "Bank Name" },
      { key: "branchName", label: "Branch Name" },
      { key: "accountNumber", label: "Account Number" },
      { key: "routingNumber", label: "Routing Number" },
      { key: "amount", label: "Amount" },
      { key: "currency", label: "Currency" },
      { key: "narration", label: "Narration" },
    ];

    const csvDataRows = [...rows];
    csvDataRows.push({
      slNo: "",
      employeeId: "",
      employeeName: "TOTAL",
      accountHolderName: "",
      bankName: "",
      branchName: "",
      accountNumber: "",
      routingNumber: "",
      amount: totalAmount,
      currency: "",
      narration: "",
    });

    return {
      contentType: "text/csv; charset=utf-8",
      data: buildCsvString(headers, csvDataRows),
      filename: `bank-advice-${periodLabel || "export"}.csv`,
    };
  }

  // XLSX
  const worksheetData = [
    [
      "Sl No", "Employee ID", "Employee Name", "Account Holder Name", "Bank Name",
      "Branch Name", "Account Number", "Routing Number", "Amount", "Currency", "Narration",
    ],
    ...rows.map((r) => [
      r.slNo, r.employeeId, r.employeeName, r.accountHolderName, r.bankName,
      r.branchName, r.accountNumber, r.routingNumber, r.amount, r.currency, r.narration,
    ]),
    ["", "", "TOTAL", "", "", "", "", "", totalAmount, "", ""],
  ];

  const ws = XLSX.utils.aoa_to_sheet(worksheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Bank Advice");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    data: buffer,
    filename: `bank-advice-${periodLabel || "export"}.xlsx`,
  };
};

/**
 * Builds the Corporate MFS Disbursement Advice (bKash / Nagad / Rocket).
 */
export const generateMfsDisbursementAdvice = ({ payrolls = [], format = "xlsx", periodLabel = "" }) => {
  const eligible = payrolls.filter((p) => {
    const payout = p.payoutSnapshot || {};
    const method = String(payout.preferredPayoutMethod || p.paymentMethod || "").toLowerCase();
    return method === "mobile_banking" || method === "mfs" || Boolean(payout.mfsNumber);
  });

  const rows = eligible.map((p, idx) => {
    const emp = p.employee || {};
    const payout = p.payoutSnapshot || {};
    const netPay = Number(p.netPayable ?? p.netSalary ?? 0);
    const month = String(p.month || "").padStart(2, "0");

    return {
      slNo: idx + 1,
      employeeId: sanitizeCellText(emp.employeeId || emp.email || String(emp._id || "").slice(-6).toUpperCase()),
      employeeName: sanitizeCellText(emp.name || "Employee"),
      mfsProvider: sanitizeCellText(payout.mfsProvider || "bKash"),
      mobileNumber: sanitizeCellText(payout.mfsNumber || "—"),
      amount: netPay,
      currency: p.currency || "BDT",
      narration: sanitizeCellText(`Salary ${month}/${p.year}`),
    };
  });

  const totalAmount = rows.reduce((sum, r) => sum + r.amount, 0);

  if (format === "csv") {
    const headers = [
      { key: "slNo", label: "Sl No" },
      { key: "employeeId", label: "Employee ID" },
      { key: "employeeName", label: "Employee Name" },
      { key: "mfsProvider", label: "MFS Provider" },
      { key: "mobileNumber", label: "Wallet / Mobile Number" },
      { key: "amount", label: "Amount" },
      { key: "currency", label: "Currency" },
      { key: "narration", label: "Narration" },
    ];

    const csvDataRows = [...rows];
    csvDataRows.push({
      slNo: "",
      employeeId: "",
      employeeName: "TOTAL",
      mfsProvider: "",
      mobileNumber: "",
      amount: totalAmount,
      currency: "",
      narration: "",
    });

    return {
      contentType: "text/csv; charset=utf-8",
      data: buildCsvString(headers, csvDataRows),
      filename: `mfs-advice-${periodLabel || "export"}.csv`,
    };
  }

  // XLSX
  const worksheetData = [
    ["Sl No", "Employee ID", "Employee Name", "MFS Provider", "Wallet / Mobile Number", "Amount", "Currency", "Narration"],
    ...rows.map((r) => [r.slNo, r.employeeId, r.employeeName, r.mfsProvider, r.mobileNumber, r.amount, r.currency, r.narration]),
    ["", "", "TOTAL", "", "", totalAmount, "", ""],
  ];

  const ws = XLSX.utils.aoa_to_sheet(worksheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "MFS Advice");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    data: buffer,
    filename: `mfs-advice-${periodLabel || "export"}.xlsx`,
  };
};
