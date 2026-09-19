/**
 * Currency-agnostic Number-to-Words converter.
 * Supports configurable currency unit and subunit (e.g. BDT: Taka/Poisha, USD: Dollars/Cents).
 */

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

const SCALES = ["", "Thousand", "Million", "Billion", "Trillion"];

export const DEFAULT_CURRENCY_MAP = {
  BDT: { unit: "Taka", unitPlural: "Taka", subunit: "Poisha", subunitPlural: "Poisha" },
  USD: { unit: "Dollar", unitPlural: "Dollars", subunit: "Cent", subunitPlural: "Cents" },
  EUR: { unit: "Euro", unitPlural: "Euros", subunit: "Cent", subunitPlural: "Cents" },
  GBP: { unit: "Pound", unitPlural: "Pounds", subunit: "Pence", subunitPlural: "Pence" },
  INR: { unit: "Rupee", unitPlural: "Rupees", subunit: "Paise", subunitPlural: "Paise" },
  AED: { unit: "Dirham", unitPlural: "Dirhams", subunit: "Fils", subunitPlural: "Fils" },
  SAR: { unit: "Riyal", unitPlural: "Riyals", subunit: "Halala", subunitPlural: "Halalas" },
};

function convertThreeDigits(num) {
  let result = "";
  const hundreds = Math.floor(num / 100);
  const remainder = num % 100;

  if (hundreds > 0) {
    result += `${ONES[hundreds]} Hundred`;
    if (remainder > 0) result += " ";
  }

  if (remainder > 0) {
    if (remainder < 20) {
      result += ONES[remainder];
    } else {
      const ten = Math.floor(remainder / 10);
      const one = remainder % 10;
      result += TENS[ten];
      if (one > 0) result += `-${ONES[one]}`;
    }
  }

  return result;
}

export function convertIntegerToWords(integer) {
  if (integer === 0) return "Zero";
  let num = Math.abs(integer);
  const chunks = [];

  while (num > 0) {
    chunks.push(num % 1000);
    num = Math.floor(num / 1000);
  }

  const parts = [];
  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i];
    if (chunk > 0) {
      const words = convertThreeDigits(chunk);
      const scale = SCALES[i];
      parts.push(scale ? `${words} ${scale}` : words);
    }
  }

  return parts.join(" ");
}

/**
 * Converts any numeric amount into English words with currency unit and subunit.
 *
 * @param {number|string} amount
 * @param {string} currencyCode - e.g. "BDT", "USD"
 * @param {object} customConfig - optional custom unit/subunit overrides
 * @returns {string} - e.g. "Fifty-Four Thousand Two Hundred Fifty Taka and Fifty Poisha Only"
 */
export function numberToWords(amount, currencyCode = "BDT", customConfig = {}) {
  const num = Number(amount || 0);
  if (!Number.isFinite(num) || num === 0) {
    const curr = customConfig.unit || DEFAULT_CURRENCY_MAP[currencyCode]?.unit || currencyCode || "Taka";
    return `Zero ${curr} Only`;
  }

  const code = String(currencyCode || "BDT").trim().toUpperCase();
  const baseDefaults = DEFAULT_CURRENCY_MAP[code] || {
    unit: code,
    unitPlural: code,
    subunit: "Cent",
    subunitPlural: "Cents",
  };

  const config = {
    ...baseDefaults,
    ...customConfig,
    unitPlural: customConfig.unitPlural || (customConfig.unit ? customConfig.unit : baseDefaults.unitPlural),
    subunitPlural: customConfig.subunitPlural || (customConfig.subunit ? customConfig.subunit : baseDefaults.subunitPlural),
  };

  const isNegative = num < 0;
  const abs = Math.abs(num);
  const integerPart = Math.floor(abs);
  const decimalPart = Math.round((abs - integerPart) * 100);

  const integerWords = convertIntegerToWords(integerPart);
  const unitLabel = integerPart === 1 ? config.unit : config.unitPlural || config.unit;

  let result = `${isNegative ? "Negative " : ""}${integerWords} ${unitLabel}`;

  if (decimalPart > 0) {
    const decimalWords = convertIntegerToWords(decimalPart);
    const subunitLabel = decimalPart === 1 ? config.subunit : config.subunitPlural || config.subunit;
    result += ` and ${decimalWords} ${subunitLabel}`;
  }

  return `${result} Only`;
}

export default numberToWords;
