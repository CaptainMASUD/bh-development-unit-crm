import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { numberToWords } from "../../utils/numberToWords.js";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const maskAccountNumber = (val) => {
  const str = String(val || "").trim();
  if (!str) return "—";
  if (str.length <= 4) return str;
  const lastFour = str.slice(-4);
  return `${"*".repeat(Math.min(str.length - 4, 8))}${lastFour}`;
};

export const maskMfsNumber = (val) => {
  const str = String(val || "").trim();
  if (!str) return "—";
  if (str.length <= 6) return str;
  const prefix = str.slice(0, 3);
  const suffix = str.slice(-3);
  return `${prefix}*****${suffix}`;
};

const formatMoney = (val, currency = "BDT") => {
  const num = Number(val || 0);
  return `${currency} ${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (val) => {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

/**
 * Generates an official, print-ready, snapshot-driven A4 Payslip PDF buffer.
 *
 * @param {object} payroll - The frozen payroll record
 * @param {object} [company] - The company/tenant branding settings
 * @returns {Promise<Uint8Array>}
 */
export async function generatePayslipPdfBuffer(payroll, company = {}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 Portrait (points)
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Palette
  const colorPrimary = rgb(0.12, 0.23, 0.54); // Slate Indigo #1e3a8a
  const colorDark = rgb(0.06, 0.09, 0.16);    // Gray-900
  const colorMuted = rgb(0.39, 0.45, 0.55);   // Gray-500
  const colorBorder = rgb(0.88, 0.91, 0.94);  // Gray-200
  const colorBg = rgb(0.96, 0.97, 0.99);      // Gray-50
  const colorSuccess = rgb(0.04, 0.60, 0.35); // Emerald
  const colorDanger = rgb(0.88, 0.14, 0.22);  // Rose-600
  const colorWarning = rgb(0.85, 0.50, 0.05); // Amber-600

  const margin = 36; // 0.5 inch margins
  const contentWidth = width - margin * 2;
  let cursorY = height - margin;

  // 1. Company Information & Branding
  const companyName = String(company?.name || company?.legalName || "Organization Payslip").trim();
  const addressParts = [];
  if (company?.address) {
    const { line1, line2, city, state, postalCode, country } = company.address;
    if (line1) addressParts.push(line1);
    if (line2) addressParts.push(line2);
    if (city) addressParts.push(city);
    if (state) addressParts.push(state);
    if (postalCode) addressParts.push(postalCode);
    if (country) addressParts.push(country);
  }
  const companyAddress = addressParts.join(", ");
  const companyContact = [company?.phone, company?.email, company?.website].filter(Boolean).join("  |  ");

  // Company Name
  page.drawText(companyName.toUpperCase(), {
    x: margin,
    y: cursorY - 14,
    size: 14,
    font: fontBold,
    color: colorPrimary,
  });

  // Confidential Stamp
  const confidentialText = "CONFIDENTIAL PAYSLIP";
  const confWidth = fontBold.widthOfTextAtSize(confidentialText, 9);
  page.drawRectangle({
    x: width - margin - confWidth - 14,
    y: cursorY - 18,
    width: confWidth + 14,
    height: 18,
    color: colorBg,
    borderColor: colorBorder,
    borderWidth: 1,
  });
  page.drawText(confidentialText, {
    x: width - margin - confWidth - 7,
    y: cursorY - 13,
    size: 9,
    font: fontBold,
    color: colorPrimary,
  });

  cursorY -= 28;

  if (companyAddress) {
    page.drawText(companyAddress, {
      x: margin,
      y: cursorY,
      size: 8,
      font: fontRegular,
      color: colorMuted,
    });
    cursorY -= 12;
  }

  if (companyContact) {
    page.drawText(companyContact, {
      x: margin,
      y: cursorY,
      size: 8,
      font: fontRegular,
      color: colorMuted,
    });
    cursorY -= 12;
  }

  cursorY -= 6;
  // Header rule
  page.drawLine({
    start: { x: margin, y: cursorY },
    end: { x: width - margin, y: cursorY },
    color: colorBorder,
    thickness: 1,
  });

  cursorY -= 16;

  // 2. Payslip Period & Status Banner
  const monthLabel = MONTH_NAMES[(payroll?.month || 1) - 1] || `Month ${payroll?.month}`;
  const periodTitle = `SALARY SLIP FOR ${monthLabel.toUpperCase()} ${payroll?.year || ""}`;
  const statusStr = String(payroll?.status || "calculated").toUpperCase();
  const isReversed = payroll?.status === "reversed" || Boolean(payroll?.isReversed);

  page.drawText(periodTitle, {
    x: margin,
    y: cursorY,
    size: 12,
    font: fontBold,
    color: colorDark,
  });

  // Status Badge
  const statusBadgeText = isReversed ? "REVERSED" : statusStr;
  const statusColor = isReversed
    ? colorDanger
    : statusStr === "PAID"
    ? colorSuccess
    : statusStr === "APPROVED"
    ? colorWarning
    : colorPrimary;

  const badgeWidth = fontBold.widthOfTextAtSize(statusBadgeText, 9) + 16;
  page.drawRectangle({
    x: width - margin - badgeWidth,
    y: cursorY - 4,
    width: badgeWidth,
    height: 18,
    color: isReversed ? rgb(1, 0.94, 0.95) : colorBg,
    borderColor: statusColor,
    borderWidth: 1,
  });
  page.drawText(statusBadgeText, {
    x: width - margin - badgeWidth + 8,
    y: cursorY + 1,
    size: 9,
    font: fontBold,
    color: statusColor,
  });

  cursorY -= 20;

  // 3. Prominent REVERSED Alert Banner (if reversed)
  if (isReversed) {
    const revHeight = 28;
    page.drawRectangle({
      x: margin,
      y: cursorY - revHeight,
      width: contentWidth,
      height: revHeight,
      color: rgb(1, 0.92, 0.93),
      borderColor: colorDanger,
      borderWidth: 1.5,
    });

    const revNotice = `ATTENTION: THIS PAYROLL RECORD WAS REVERSED ON ${formatDate(payroll?.reversedAt).toUpperCase()}`;
    const revReason = payroll?.reversalReason ? ` | REASON: ${payroll.reversalReason}` : "";
    page.drawText(`${revNotice}${revReason}`.slice(0, 95), {
      x: margin + 10,
      y: cursorY - 18,
      size: 8.5,
      font: fontBold,
      color: colorDanger,
    });

    cursorY -= (revHeight + 12);
  }

  // 4. Employee & Payroll Snapshot Information Block (2 columns)
  const blockHeight = 78;
  page.drawRectangle({
    x: margin,
    y: cursorY - blockHeight,
    width: contentWidth,
    height: blockHeight,
    color: colorBg,
    borderColor: colorBorder,
    borderWidth: 1,
  });

  const emp = payroll?.employee || {};
  const dept = payroll?.department || emp?.department || {};
  const pos = payroll?.position || emp?.position || {};
  const payout = payroll?.payoutSnapshot || {};
  const currency = String(payroll?.currency || company?.settings?.currency || "BDT").toUpperCase();

  const col1X = margin + 12;
  const col2X = margin + contentWidth / 2 + 12;
  let rowY = cursorY - 18;

  // Left Column
  const drawField = (label, val, x, y) => {
    page.drawText(label, { x, y, size: 7.5, font: fontBold, color: colorMuted });
    page.drawText(String(val || "—"), { x: x + 85, y, size: 8, font: fontRegular, color: colorDark });
  };

  drawField("Employee Name:", emp?.name || "Unnamed Employee", col1X, rowY);
  drawField("Slip Reference:", payroll?.payrollKey || String(payroll?._id || "").slice(-8).toUpperCase(), col2X, rowY);

  rowY -= 15;
  drawField("Employee ID / Email:", emp?.employeeId || emp?.email || String(emp?._id || "").slice(-6).toUpperCase(), col1X, rowY);
  drawField("Pay Period:", `${formatDate(payroll?.periodStart)} - ${formatDate(payroll?.periodEnd)}`, col2X, rowY);

  rowY -= 15;
  drawField("Department:", dept?.name || "General", col1X, rowY);
  drawField("Payment Date:", payroll?.paymentDate ? formatDate(payroll.paymentDate) : "Pending", col2X, rowY);

  rowY -= 15;
  drawField("Designation:", pos?.title || "Staff Member", col1X, rowY);

  // Masked Payout Method
  const method = String(payout?.preferredPayoutMethod || payroll?.paymentMethod || "cash").toLowerCase();
  let payoutDesc = "Cash Disbursement";
  if (method === "bank") {
    const bankName = payout?.bankName || "Bank Transfer";
    const maskedAc = maskAccountNumber(payout?.accountNumber);
    payoutDesc = `${bankName} (${maskedAc})`;
  } else if (method === "mobile_banking" || method === "mfs") {
    const provider = payout?.mfsProvider || "MFS";
    const maskedMfs = maskMfsNumber(payout?.mfsNumber);
    payoutDesc = `${provider} (${maskedMfs})`;
  } else if (method === "cheque") {
    payoutDesc = "Bank Cheque";
  }
  drawField("Payout Method:", payoutDesc, col2X, rowY);

  cursorY -= (blockHeight + 14);

  // 5. Attendance Summary Bar
  const att = payroll?.attendanceSummary || {};
  const attHeight = 32;
  page.drawRectangle({
    x: margin,
    y: cursorY - attHeight,
    width: contentWidth,
    height: attHeight,
    color: rgb(0.98, 0.99, 1),
    borderColor: rgb(0.85, 0.89, 0.95),
    borderWidth: 1,
  });

  const attItems = [
    { label: "PRESENT DAYS", val: att.presentDays || 0 },
    { label: "LATE DAYS", val: att.lateDays || 0 },
    { label: "PAID LEAVE", val: att.paidLeaveDays || 0 },
    { label: "UNPAID LEAVE", val: att.unpaidLeaveDays || 0 },
    { label: "ABSENT DAYS", val: att.absentDays || 0 },
    { label: "OT HOURS", val: att.approvedOvertimeHours || 0 },
  ];

  const colW = contentWidth / attItems.length;
  attItems.forEach((item, idx) => {
    const itemX = margin + idx * colW;
    page.drawText(item.label, {
      x: itemX + 8,
      y: cursorY - 13,
      size: 6.5,
      font: fontBold,
      color: colorMuted,
    });
    page.drawText(String(item.val), {
      x: itemX + 8,
      y: cursorY - 26,
      size: 10,
      font: fontBold,
      color: colorPrimary,
    });
  });

  cursorY -= (attHeight + 16);

  // 6. Side-by-side Earnings & Deductions Breakdown
  const tableW = (contentWidth - 14) / 2;
  const colEarningsX = margin;
  const colDeductionsX = margin + tableW + 14;

  const headerH = 22;
  // Earnings Header
  page.drawRectangle({
    x: colEarningsX,
    y: cursorY - headerH,
    width: tableW,
    height: headerH,
    color: colorPrimary,
  });
  page.drawText("EARNINGS & ALLOWANCES", {
    x: colEarningsX + 10,
    y: cursorY - 15,
    size: 8.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("AMOUNT", {
    x: colEarningsX + tableW - 60,
    y: cursorY - 15,
    size: 8.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  // Deductions Header
  page.drawRectangle({
    x: colDeductionsX,
    y: cursorY - headerH,
    width: tableW,
    height: headerH,
    color: rgb(0.24, 0.28, 0.36),
  });
  page.drawText("DEDUCTIONS & ADJUSTMENTS", {
    x: colDeductionsX + 10,
    y: cursorY - 15,
    size: 8.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("AMOUNT", {
    x: colDeductionsX + tableW - 60,
    y: cursorY - 15,
    size: 8.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  cursorY -= headerH;

  // Build rows from frozen snapshots
  const salarySnap = payroll?.salarySnapshot || {};
  const earningsList = [];
  const basicSalaryVal = Number(salarySnap.basicSalary || payroll?.basicSalary || 0);
  const isProrated = Boolean(salarySnap.isProrated);
  const prorationNote = isProrated && salarySnap.activeDays
    ? ` (Prorated: ${salarySnap.activeDays}/${salarySnap.totalDaysInMonth || 30} days)`
    : "";

  earningsList.push({
    name: `Basic Salary${prorationNote}`,
    amount: basicSalaryVal,
  });

  (payroll?.earnings || []).forEach((item) => {
    if (item.source === "basic_salary") return; // already counted
    earningsList.push({
      name: item.name || "Allowance",
      amount: Number(item.amount || 0),
    });
  });

  const deductionsList = [];
  (payroll?.deductions || []).forEach((item) => {
    deductionsList.push({
      name: item.name || (item.source === "tax" ? "Tax Deduction / TDS" : "Deduction"),
      amount: Number(item.amount || 0),
    });
  });

  if (deductionsList.length === 0 && Number(payroll?.taxDeduction || 0) > 0) {
    deductionsList.push({
      name: "Tax Deduction / TDS",
      amount: Number(payroll.taxDeduction),
    });
  }

  const maxRows = Math.max(earningsList.length, deductionsList.length, 1);
  const itemRowH = 18;

  for (let i = 0; i < maxRows; i++) {
    const rowBg = i % 2 === 1 ? rgb(0.98, 0.98, 0.99) : rgb(1, 1, 1);

    // Earnings cell
    page.drawRectangle({
      x: colEarningsX,
      y: cursorY - itemRowH,
      width: tableW,
      height: itemRowH,
      color: rowBg,
      borderColor: colorBorder,
      borderWidth: 0.5,
    });
    if (earningsList[i]) {
      const eName = earningsList[i].name.length > 28 ? `${earningsList[i].name.slice(0, 26)}...` : earningsList[i].name;
      page.drawText(eName, {
        x: colEarningsX + 8,
        y: cursorY - 13,
        size: 7.5,
        font: fontRegular,
        color: colorDark,
      });
      const amtStr = formatMoney(earningsList[i].amount, currency);
      const amtW = fontRegular.widthOfTextAtSize(amtStr, 7.5);
      page.drawText(amtStr, {
        x: colEarningsX + tableW - amtW - 8,
        y: cursorY - 13,
        size: 7.5,
        font: fontRegular,
        color: colorDark,
      });
    }

    // Deductions cell
    page.drawRectangle({
      x: colDeductionsX,
      y: cursorY - itemRowH,
      width: tableW,
      height: itemRowH,
      color: rowBg,
      borderColor: colorBorder,
      borderWidth: 0.5,
    });
    if (deductionsList[i]) {
      const dName = deductionsList[i].name.length > 28 ? `${deductionsList[i].name.slice(0, 26)}...` : deductionsList[i].name;
      page.drawText(dName, {
        x: colDeductionsX + 8,
        y: cursorY - 13,
        size: 7.5,
        font: fontRegular,
        color: colorDark,
      });
      const amtStr = formatMoney(deductionsList[i].amount, currency);
      const amtW = fontRegular.widthOfTextAtSize(amtStr, 7.5);
      page.drawText(amtStr, {
        x: colDeductionsX + tableW - amtW - 8,
        y: cursorY - 13,
        size: 7.5,
        font: fontRegular,
        color: colorDanger,
      });
    }

    cursorY -= itemRowH;
  }

  // Totals Sub-banner
  const totalRowH = 22;
  // Total Earnings
  page.drawRectangle({
    x: colEarningsX,
    y: cursorY - totalRowH,
    width: tableW,
    height: totalRowH,
    color: colorBg,
    borderColor: colorBorder,
    borderWidth: 1,
  });
  page.drawText("TOTAL GROSS EARNINGS", {
    x: colEarningsX + 8,
    y: cursorY - 15,
    size: 7.5,
    font: fontBold,
    color: colorDark,
  });
  const grossStr = formatMoney(payroll?.grossSalary || payroll?.totalEarnings || 0, currency);
  const grossW = fontBold.widthOfTextAtSize(grossStr, 8.5);
  page.drawText(grossStr, {
    x: colEarningsX + tableW - grossW - 8,
    y: cursorY - 15,
    size: 8.5,
    font: fontBold,
    color: colorPrimary,
  });

  // Total Deductions
  page.drawRectangle({
    x: colDeductionsX,
    y: cursorY - totalRowH,
    width: tableW,
    height: totalRowH,
    color: colorBg,
    borderColor: colorBorder,
    borderWidth: 1,
  });
  page.drawText("TOTAL DEDUCTIONS", {
    x: colDeductionsX + 8,
    y: cursorY - 15,
    size: 7.5,
    font: fontBold,
    color: colorDark,
  });
  const dedStr = formatMoney(payroll?.totalDeductions || payroll?.totalDeduction || 0, currency);
  const dedW = fontBold.widthOfTextAtSize(dedStr, 8.5);
  page.drawText(dedStr, {
    x: colDeductionsX + tableW - dedW - 8,
    y: cursorY - 15,
    size: 8.5,
    font: fontBold,
    color: colorDanger,
  });

  cursorY -= (totalRowH + 16);

  // 7. Net Pay Highlight Box
  const netPayVal = Number(payroll?.netPayable ?? payroll?.netSalary ?? 0);
  const netBoxH = 50;
  page.drawRectangle({
    x: margin,
    y: cursorY - netBoxH,
    width: contentWidth,
    height: netBoxH,
    color: isReversed ? rgb(1, 0.96, 0.96) : rgb(0.95, 0.97, 1),
    borderColor: isReversed ? colorDanger : colorPrimary,
    borderWidth: 1.5,
  });

  page.drawText("NET PAYABLE AMOUNT", {
    x: margin + 14,
    y: cursorY - 18,
    size: 8,
    font: fontBold,
    color: isReversed ? colorDanger : colorPrimary,
  });

  const netPayFormatted = formatMoney(netPayVal, currency);
  page.drawText(netPayFormatted, {
    x: margin + 14,
    y: cursorY - 38,
    size: 16,
    font: fontBold,
    color: isReversed ? colorDanger : colorDark,
  });

  // Net Pay in Words (Currency Agnostic!)
  const inWords = numberToWords(netPayVal, currency);
  page.drawText("IN WORDS:", {
    x: margin + contentWidth / 2,
    y: cursorY - 18,
    size: 7.5,
    font: fontBold,
    color: colorMuted,
  });
  page.drawText(inWords.slice(0, 56), {
    x: margin + contentWidth / 2,
    y: cursorY - 32,
    size: 7.5,
    font: fontOblique,
    color: colorDark,
  });
  if (inWords.length > 56) {
    page.drawText(inWords.slice(56, 112), {
      x: margin + contentWidth / 2,
      y: cursorY - 42,
      size: 7.5,
      font: fontOblique,
      color: colorDark,
    });
  }

  cursorY -= (netBoxH + 34);

  // 8. Signatures & Authorization Section
  const sigBoxW = contentWidth / 4 - 8;
  const sigY = Math.max(cursorY, margin + 44);

  const sigLines = [
    { label: "Prepared By", sub: "Payroll Officer" },
    { label: "Verified By", sub: "HR & Compliance" },
    { label: "Approved By", sub: "Finance / Management" },
    { label: "Received By", sub: "Employee Signature" },
  ];

  sigLines.forEach((item, idx) => {
    const x = margin + idx * (sigBoxW + 10);
    // Signature dotted line
    page.drawLine({
      start: { x, y: sigY + 18 },
      end: { x: x + sigBoxW, y: sigY + 18 },
      color: colorMuted,
      thickness: 0.75,
    });
    page.drawText(item.label, {
      x,
      y: sigY + 6,
      size: 8,
      font: fontBold,
      color: colorDark,
    });
    page.drawText(item.sub, {
      x,
      y: sigY - 5,
      size: 7,
      font: fontRegular,
      color: colorMuted,
    });
  });

  // Footer Disclaimer
  page.drawText(
    "This is an official system-generated salary slip. Values reflect the finalized frozen payroll record.",
    {
      x: margin,
      y: margin + 8,
      size: 7,
      font: fontRegular,
      color: colorMuted,
    }
  );

  return pdfDoc.save();
}

/**
 * Merges multiple individual PDF byte arrays into a single combined multi-page PDF document.
 *
 * @param {Array<Uint8Array|Buffer>} pdfBuffers
 * @returns {Promise<Uint8Array>}
 */
export async function mergePayslipsPdf(pdfBuffers = []) {
  const mergedDoc = await PDFDocument.create();

  for (const buf of pdfBuffers) {
    if (!buf || !buf.length) continue;
    const subDoc = await PDFDocument.load(buf);
    const copiedPages = await mergedDoc.copyPages(subDoc, subDoc.getPageIndices());
    copiedPages.forEach((p) => mergedDoc.addPage(p));
  }

  return mergedDoc.save();
}
