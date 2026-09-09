/**
 * Lightweight RFC 4180 compliant streaming CSV generator.
 */

export const escapeCsvValue = (value) => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    try {
      return `"${JSON.stringify(value).replaceAll('"', '""')}"`;
    } catch {
      return "";
    }
  }

  let str = String(value);

  // Spreadsheet formula injection protection (CWE-1236)
  // If string begins with =, +, -, @, \t, \r (or has leading whitespace followed by them), prefix with ' unless it is purely numeric
  const formulaChars = ["=", "+", "-", "@", "\t", "\r"];
  const trimmed = str.trimStart();
  if (formulaChars.some((ch) => str.startsWith(ch) || trimmed.startsWith(ch))) {
    const isPureNumber = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(str.trim());
    if (!isPureNumber) {
      str = `'${str}`;
    }
  }

  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
};

export const buildCsvString = (headers = [], rows = []) => {
  const headerLine = headers.map((h) => escapeCsvValue(h.label || h.key || h)).join(",");
  const dataLines = rows.map((row) =>
    headers
      .map((h) => {
        const key = typeof h === "string" ? h : h.key;
        const val = typeof h.format === "function" ? h.format(row[key], row) : row[key];
        return escapeCsvValue(val);
      })
      .join(",")
  );
  return [headerLine, ...dataLines].join("\r\n");
};

export const sendCsvStream = (res, { filename = "export.csv", headers = [], rows = [] }) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  const headerLine = headers.map((h) => escapeCsvValue(h.label || h.key || h)).join(",");
  res.write(`${headerLine}\r\n`);

  for (const row of rows) {
    const line = headers
      .map((h) => {
        const key = typeof h === "string" ? h : h.key;
        const val = typeof h.format === "function" ? h.format(row[key], row) : row[key];
        return escapeCsvValue(val);
      })
      .join(",");
    res.write(`${line}\r\n`);
  }

  res.end();
};
