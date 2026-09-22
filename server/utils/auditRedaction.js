export const SENSITIVE_AUDIT_KEY = /(password|passcode|token|secret|otp|credential|authorization|cookie|sessionid|resetcode)/i;

export function isSensitiveAuditKey(key) {
  return SENSITIVE_AUDIT_KEY.test(String(key || ""));
}

export function redactAuditValue(value, seen = new WeakSet()) {
  if (value == null || typeof value !== "object") return value;
  if (seen.has(value)) return "[CIRCULAR]";

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactAuditValue(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_AUDIT_KEY.test(key)
        ? "[REDACTED]"
        : redactAuditValue(item, seen),
    ])
  );
}

export default redactAuditValue;
