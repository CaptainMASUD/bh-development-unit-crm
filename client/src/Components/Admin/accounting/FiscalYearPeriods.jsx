"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import toast, { Toaster } from "react-hot-toast";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Edit02Icon,
  FloppyDiskIcon,
  HierarchySquare01Icon,
  RefreshIcon,
  UnavailableIcon,
} from "@hugeicons/core-free-icons";

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

const shell = "min-h-screen bg-gradient-to-b from-gray-50 to-white";
const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]";
const input =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm font-semibold text-gray-800 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500";
const button =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60";
const buttonPrimary =
  "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700";
const buttonGhost =
  "border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50";
const buttonWarning =
  "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100";
const buttonDanger =
  "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100";

function createEmptyForm() {
  const year = new Date().getFullYear();

  return {
    name: `FY ${year}-${year + 1}`,
    startDate: `${year}-07-01`,
    endDate: `${year + 1}-06-30`,
    periodFrequency: "monthly",
    isCurrentYear: true,
    note: "",
  };
}

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Icon({ icon, size = 18, strokeWidth = 1.8 }) {
  return (
    <HugeiconsIcon
      icon={icon}
      size={size}
      color="currentColor"
      strokeWidth={strokeWidth}
    />
  );
}

function headers() {
  const token = localStorage.getItem("token");

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Request failed");
  }

  return data;
}

function Field({ label, hint, required = false, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-gray-800">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </span>
      {children}
      {hint ? (
        <span className="mt-1.5 block text-xs font-medium leading-5 text-gray-500">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function dateText(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function dateInput(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function StatusBadge({ status }) {
  const normalized = String(status || "unknown").toLowerCase();

  const styles = {
    open: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    soft_closed: "bg-amber-50 text-amber-700 ring-amber-600/10",
    closed: "bg-orange-50 text-orange-700 ring-orange-600/10",
    locked: "bg-rose-50 text-rose-700 ring-rose-600/10",
  };

  const label = normalized.replace(/_/g, " ");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black capitalize ring-1",
        styles[normalized] || "bg-gray-100 text-gray-700 ring-gray-600/10",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" />
      {label}
    </span>
  );
}

function ToggleCard({ checked, onChange, disabled = false }) {
  return (
    <label
      className={cn(
        "flex min-h-[76px] cursor-pointer items-center justify-between gap-4 rounded-2xl border p-4 transition",
        checked
          ? "border-indigo-200 bg-indigo-50/60"
          : "border-gray-200 bg-white hover:bg-gray-50",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-black text-gray-900">
          Current fiscal year
        </span>
        <span className="mt-1 block text-xs font-medium text-gray-500">
          Use as the default year.
        </span>
      </span>

      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition",
          checked ? "bg-indigo-600" : "bg-gray-200",
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          className="sr-only"
        />
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </span>
    </label>
  );
}

function SkeletonBlock({ className = "" }) {
  return (
    <div className={cn("animate-pulse rounded-lg bg-gray-100", className)} />
  );
}

function FiscalYearsSkeleton() {
  return (
    <tbody className="divide-y divide-gray-100">
      {Array.from({ length: 4 }).map((_, index) => (
        <tr key={index} className="bg-white">
          <td className="px-5 py-4">
            <SkeletonBlock className="h-4 w-36" />
            <SkeletonBlock className="mt-2 h-3 w-20" />
          </td>
          <td className="px-5 py-4">
            <SkeletonBlock className="h-4 w-52" />
          </td>
          <td className="px-5 py-4">
            <SkeletonBlock className="h-4 w-20" />
          </td>
          <td className="px-5 py-4">
            <SkeletonBlock className="h-7 w-20 rounded-full" />
          </td>
          <td className="px-5 py-4">
            <SkeletonBlock className="h-4 w-24" />
          </td>
          <td className="px-5 py-4">
            <div className="flex gap-2">
              <SkeletonBlock className="h-10 w-20 rounded-xl" />
              <SkeletonBlock className="h-10 w-28 rounded-xl" />
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  );
}

function PeriodsSkeleton() {
  return (
    <tbody className="divide-y divide-gray-100">
      {Array.from({ length: 6 }).map((_, index) => (
        <tr key={index} className="bg-white">
          <td className="px-5 py-4">
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="mt-2 h-3 w-24" />
          </td>
          <td className="px-5 py-4">
            <SkeletonBlock className="h-4 w-28" />
          </td>
          <td className="px-5 py-4">
            <SkeletonBlock className="h-4 w-28" />
          </td>
          <td className="px-5 py-4">
            <SkeletonBlock className="h-7 w-20 rounded-full" />
          </td>
          <td className="px-5 py-4">
            <div className="flex gap-2">
              <SkeletonBlock className="h-10 w-24 rounded-xl" />
              <SkeletonBlock className="h-10 w-20 rounded-xl" />
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
        <Icon icon={HierarchySquare01Icon} size={21} />
      </span>
      <p className="mt-3 text-sm font-black text-gray-800">{title}</p>
      <p className="mt-1 max-w-md text-sm font-medium leading-6 text-gray-500">
        {description}
      </p>
    </div>
  );
}

function FiscalYearModal({
  open,
  mode,
  form,
  setForm,
  error,
  loading,
  onClose,
  onSubmit,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !loading) onClose?.();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, loading, onClose]);

  if (!open || typeof document === "undefined") return null;

  const editing = mode === "edit";

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close fiscal year form"
        className="absolute inset-0 h-full w-full cursor-default bg-black/40 backdrop-blur-sm"
        onClick={loading ? undefined : onClose}
      />

      <div className="relative flex min-h-full items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
        <div className="my-auto w-full max-w-4xl overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_30px_80px_-32px_rgba(0,0,0,0.65)]">
          <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white">
                <Icon
                  icon={editing ? Edit02Icon : Add01Icon}
                  size={19}
                  strokeWidth={2}
                />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-black text-gray-950">
                  {editing ? "Update fiscal year" : "Create fiscal year"}
                </h2>
                <p className="mt-0.5 text-sm font-medium text-gray-500">
                  {editing
                    ? "Update the selected fiscal year."
                    : "Create a fiscal year and its periods."}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50"
              aria-label="Close"
            >
              <Icon icon={Cancel01Icon} size={19} />
            </button>
          </div>

          <form onSubmit={onSubmit}>
            <div className="max-h-[calc(100vh-13rem)] overflow-y-auto p-5 sm:p-6">
              {error ? (
                <div className="mb-5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {error}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Fiscal Year Name" required>
                  <input
                    className={input}
                    value={form.name}
                    disabled={loading}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        name: event.target.value,
                      }))
                    }
                    required
                  />
                </Field>

                <Field
                  label="Period Frequency"
                  hint="Creates monthly or quarterly periods."
                >
                  <select
                    className={input}
                    value={form.periodFrequency}
                    disabled={loading}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        periodFrequency: event.target.value,
                      }))
                    }
                  >
                    <option value="monthly">Monthly · 12 periods</option>
                    <option value="quarterly">Quarterly · 4 periods</option>
                  </select>
                </Field>

                <Field label="Start Date" required>
                  <input
                    className={input}
                    type="date"
                    value={form.startDate}
                    disabled={loading}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        startDate: event.target.value,
                      }))
                    }
                    required
                  />
                </Field>

                <Field label="End Date" required>
                  <input
                    className={input}
                    type="date"
                    value={form.endDate}
                    disabled={loading}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        endDate: event.target.value,
                      }))
                    }
                    required
                  />
                </Field>

                <div className="md:col-span-2">
                  <Field label="Internal Note" hint="Optional.">
                    <textarea
                      className={cn(input, "min-h-[100px] resize-none py-3")}
                      value={form.note}
                      disabled={loading}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          note: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>

                <div className="md:col-span-2">
                  <ToggleCard
                    checked={form.isCurrentYear}
                    disabled={loading}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        isCurrentYear: event.target.checked,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50/70 p-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                className={cn(button, buttonGhost)}
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={cn(button, buttonPrimary)}
                disabled={loading}
              >
                <span className={loading ? "animate-spin" : ""}>
                  <Icon
                    icon={
                      loading
                        ? RefreshIcon
                        : editing
                          ? FloppyDiskIcon
                          : Add01Icon
                    }
                    size={17}
                  />
                </span>
                {loading
                  ? editing
                    ? "Updating..."
                    : "Creating..."
                  : editing
                    ? "Update fiscal year"
                    : "Create fiscal year"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ConfirmActionModal({
  open,
  action,
  loading,
  reason,
  setReason,
  onClose,
  onConfirm,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !loading) onClose?.();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, loading, onClose]);

  if (!open || !action || typeof document === "undefined") return null;

  const isYear = action.kind === "year";
  const operation = action.operation;

  const content = isYear
    ? {
        title: "Close fiscal year?",
        subtitle: action.item?.name || "Fiscal year",
        message:
          "This creates the year-end retained earnings entry. Close or lock every child period first.",
        confirm: "Close fiscal year",
        danger: true,
      }
    : {
        title:
          operation === "soft_close"
            ? "Soft close accounting period?"
            : operation === "close"
              ? "Close accounting period?"
              : operation === "lock"
                ? "Lock accounting period?"
                : operation === "reopen"
                  ? "Reopen accounting period?"
                  : "Unlock accounting period?",
        subtitle:
          action.item?.name || action.item?.periodKey || "Accounting period",
        message:
          operation === "soft_close"
            ? "Normal postings will be blocked. Only authorized users with an explicit override reason can post entries."
            : operation === "lock"
              ? "Posting and editing will remain unavailable until the period is unlocked."
              : operation === "close"
                ? "The system will check for unfinished draft journals before closing."
                : operation === "reopen"
                  ? "The period will become available for accounting activity again."
                  : "The administrative freeze will be removed.",
        confirm:
          operation === "soft_close"
            ? "Soft close period"
            : operation === "close"
              ? "Close period"
              : operation === "lock"
                ? "Lock period"
                : operation === "reopen"
                  ? "Reopen period"
                  : "Unlock period",
        danger: operation === "lock",
      };

  return createPortal(
    <div className="fixed inset-0 z-[110]" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close confirmation"
        className="absolute inset-0 h-full w-full cursor-default bg-black/40 backdrop-blur-sm"
        onClick={loading ? undefined : onClose}
      />

      <div className="relative flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_30px_80px_-32px_rgba(0,0,0,0.65)]">
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                  content.danger
                    ? "bg-rose-50 text-rose-700"
                    : "bg-indigo-50 text-indigo-700",
                )}
              >
                <Icon
                  icon={
                    content.danger ? UnavailableIcon : CheckmarkCircle02Icon
                  }
                  size={19}
                  strokeWidth={2}
                />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-black text-gray-950">
                  {content.title}
                </h2>
                <p className="mt-1 truncate text-sm font-semibold text-gray-500">
                  {content.subtitle}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50"
              aria-label="Close"
            >
              <Icon icon={Cancel01Icon} size={19} />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div
              className={cn(
                "rounded-2xl border p-4 text-sm font-medium leading-6",
                content.danger
                  ? "border-rose-100 bg-rose-50/60 text-rose-800"
                  : "border-indigo-100 bg-indigo-50/60 text-indigo-800",
              )}
            >
              {content.message}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-gray-700">
                Reason / Audit Note (Optional)
              </label>
              <input
                type="text"
                className={input}
                placeholder="Audit trail note or reason..."
                value={reason || ""}
                onChange={(e) => setReason?.(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50/70 p-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              className={cn(button, buttonGhost)}
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              className={cn(
                button,
                content.danger ? buttonDanger : buttonPrimary,
              )}
              onClick={onConfirm}
              disabled={loading}
            >
              <span className={loading ? "animate-spin" : ""}>
                <Icon
                  icon={
                    loading
                      ? RefreshIcon
                      : content.danger
                        ? UnavailableIcon
                        : CheckmarkCircle02Icon
                  }
                  size={17}
                />
              </span>
              {loading ? "Processing..." : content.confirm}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function FiscalYearPeriods() {
  const [form, setForm] = useState(createEmptyForm);
  const [years, setYears] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [selected, setSelected] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingYear, setSavingYear] = useState(false);
  const [yearFormError, setYearFormError] = useState("");
  const [yearModal, setYearModal] = useState({
    open: false,
    mode: "create",
    year: null,
  });
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionReason, setActionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async (requestedId = "", options = {}) => {
    const { initial = false } = options;

    if (initial) setInitialLoading(true);
    else setRefreshing(true);

    try {
      const fiscalData = await api("/accounting/fiscal-years");
      const nextYears = Array.isArray(fiscalData?.fiscalYears)
        ? fiscalData.fiscalYears
        : [];

      setYears(nextYears);

      const requestedExists = nextYears.some(
        (item) => item._id === requestedId,
      );
      const currentYear = nextYears.find((item) => item.isCurrentYear);
      const targetId = requestedExists
        ? requestedId
        : currentYear?._id || nextYears[0]?._id || "";

      setSelected(targetId);

      if (!targetId) {
        setPeriods([]);
        return;
      }

      const periodData = await api(
        `/accounting/periods?limit=75&fiscalYearRef=${encodeURIComponent(targetId)}`,
      );

      setPeriods(Array.isArray(periodData?.periods) ? periodData.periods : []);
    } catch (error) {
      toast.error(error?.message || "Failed to load fiscal years and periods");
    } finally {
      if (initial) setInitialLoading(false);
      else setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load("", { initial: true });
  }, [load]);

  const openCreateModal = () => {
    setYearFormError("");
    setForm(createEmptyForm());
    setYearModal({ open: true, mode: "create", year: null });
  };

  const openEditModal = (year) => {
    setYearFormError("");
    setForm({
      name: year?.name || "",
      startDate: dateInput(year?.startDate),
      endDate: dateInput(year?.endDate),
      periodFrequency: year?.periodFrequency || "monthly",
      isCurrentYear: Boolean(year?.isCurrentYear),
      note: year?.note || "",
    });
    setYearModal({ open: true, mode: "edit", year });
  };

  const closeYearModal = () => {
    if (savingYear) return;
    setYearFormError("");
    setYearModal({ open: false, mode: "create", year: null });
  };

  const saveFiscalYear = async (event) => {
    event.preventDefault();
    setYearFormError("");

    if (!form.name.trim()) {
      setYearFormError("Fiscal year name is required.");
      return;
    }

    if (!form.startDate || !form.endDate) {
      setYearFormError("Start and end dates are required.");
      return;
    }

    if (new Date(form.startDate) >= new Date(form.endDate)) {
      setYearFormError("End date must be after the start date.");
      return;
    }

    const editing = yearModal.mode === "edit";
    const editingId = yearModal.year?._id;

    setSavingYear(true);

    try {
      const data = await api(
        editing
          ? `/accounting/fiscal-years/${editingId}`
          : "/accounting/fiscal-years",
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify({
            ...form,
            name: form.name.trim(),
            note: form.note.trim(),
          }),
        },
      );

      toast.success(
        editing ? "Fiscal year updated" : "Fiscal year and periods created",
      );
      setYearModal({ open: false, mode: "create", year: null });
      setForm(createEmptyForm());

      const targetId = editing
        ? editingId
        : data?.fiscalYear?._id || data?.item?._id || "";

      await load(targetId || selected);
    } catch (error) {
      setYearFormError(
        error?.message ||
          (editing
            ? "Unable to update fiscal year."
            : "Unable to create fiscal year."),
      );
    } finally {
      setSavingYear(false);
    }
  };

  const requestPeriodAction = (period, operation) => {
    setActionReason("");
    setConfirmAction({
      kind: "period",
      item: period,
      operation,
    });
  };

  const requestCloseYear = (fiscalYear) => {
    setActionReason("");
    setConfirmAction({
      kind: "year",
      item: fiscalYear,
      operation: "close",
    });
  };

  const closeConfirmModal = () => {
    if (actionLoading) return;
    setActionReason("");
    setConfirmAction(null);
  };

  const runConfirmedAction = async () => {
    if (!confirmAction) return;

    setActionLoading(true);

    try {
      const payload = {
        reason: actionReason.trim(),
        note: actionReason.trim(),
      };

      if (confirmAction.kind === "year") {
        const fiscalYear = confirmAction.item;
        const data = await api(
          `/accounting/fiscal-years/${fiscalYear._id}/close`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );

        toast.success(
          data?.openingBalance
            ? "Fiscal year closed; next-year opening draft generated"
            : "Fiscal year closed",
        );
      } else {
        const period = confirmAction.item;
        const operation = confirmAction.operation;
        const endpoint =
          operation === "soft_close"
            ? `/accounting/periods/${encodeURIComponent(period.periodKey)}/soft-close`
            : `/accounting/periods/${encodeURIComponent(period.periodKey)}/${operation}`;

        await api(endpoint, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });

        const labels = {
          soft_close: "soft closed",
          close: "closed",
          lock: "locked",
          reopen: "reopened",
          unlock: "unlocked",
        };

        toast.success(`Period ${labels[operation] || "updated"}`);
      }

      setConfirmAction(null);
      setActionReason("");
      await load(selected);
    } catch (error) {
      toast.error(error?.message || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const selectFiscalYear = async (id) => {
    if (!id || id === selected) return;
    setSelected(id);
    await load(id);
  };

  const busy = initialLoading || refreshing || savingYear || actionLoading;

  return (
    <div className={cn(shell, "px-4 py-6 sm:px-6 lg:px-8")}>
      <Toaster position="top-right" />

      <section className={cn(card, "mb-5 p-5 sm:p-6")}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
              <Icon icon={HierarchySquare01Icon} size={22} strokeWidth={2} />
            </span>

            <div className="min-w-0">
              <h1 className="text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">
                Fiscal Years & Periods
              </h1>
              <p className="mt-1 text-sm font-medium text-gray-500">
                Manage fiscal years and accounting periods.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className={cn(button, buttonGhost)}
              onClick={() => load(selected)}
              disabled={busy}
            >
              <span className={refreshing ? "animate-spin" : ""}>
                <Icon icon={RefreshIcon} size={17} />
              </span>
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              className={cn(button, buttonPrimary)}
              onClick={openCreateModal}
              disabled={busy}
            >
              <Icon icon={Add01Icon} size={17} />
              Create fiscal year
            </button>
          </div>
        </div>
      </section>

      <section className={cn(card, "mb-5 overflow-hidden")}>
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-black text-gray-950">Fiscal years</h2>
          {!initialLoading ? (
            <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-black text-gray-600">
              {years.length}
            </span>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1040px] w-full border-separate border-spacing-0 text-left">
            <thead className="bg-gray-50 text-xs font-black uppercase tracking-wider text-gray-400">
              <tr>
                {[
                  "Fiscal Year",
                  "Dates",
                  "Periods",
                  "Status",
                  "Closing Entry",
                  "Actions",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="border-b border-gray-100 px-5 py-3"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            {initialLoading ? (
              <FiscalYearsSkeleton />
            ) : (
              <tbody className="divide-y divide-gray-100">
                {years.map((item) => {
                  const active = selected === item._id;

                  return (
                    <tr
                      key={item._id}
                      className={cn(
                        "transition-colors",
                        active
                          ? "bg-indigo-50/60"
                          : "bg-white hover:bg-gray-50",
                      )}
                    >
                      <td className="px-5 py-4 align-middle">
                        <button
                          type="button"
                          className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
                          onClick={() => selectFiscalYear(item._id)}
                          disabled={refreshing}
                        >
                          <span className="block text-sm font-black text-indigo-700">
                            {item.name}
                          </span>
                          {item.isCurrentYear ? (
                            <span className="mt-1 inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-black text-indigo-700">
                              CURRENT
                            </span>
                          ) : null}
                        </button>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-gray-700">
                        {dateText(item.startDate)} — {dateText(item.endDate)}
                      </td>

                      <td className="px-5 py-4 text-sm font-black capitalize text-gray-800">
                        {item.periodFrequency || "—"}
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge status={item.status} />
                      </td>

                      <td className="px-5 py-4 text-sm font-semibold text-gray-700">
                        {item.closingEntry ? (
                          <span className="inline-flex items-center gap-2 text-emerald-700">
                            <Icon icon={CheckmarkCircle02Icon} size={16} />
                            Generated
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={cn(button, buttonGhost, "h-10 px-3")}
                            onClick={() => openEditModal(item)}
                            disabled={busy}
                          >
                            <Icon icon={Edit02Icon} size={16} />
                            Edit
                          </button>

                          {item.status === "open" ? (
                            <button
                              type="button"
                              className={cn(button, buttonWarning, "h-10 px-3")}
                              onClick={() => requestCloseYear(item)}
                              disabled={busy}
                            >
                              <Icon icon={CheckmarkCircle02Icon} size={16} />
                              Close year
                            </button>
                          ) : (
                            <span className="inline-flex h-10 items-center text-xs font-bold text-gray-500">
                              Closed {dateText(item.closedAt)}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!years.length ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        title="No fiscal year"
                        description="Create a fiscal year to generate accounting periods."
                      />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            )}
          </table>
        </div>
      </section>

      <section className={cn(card, "overflow-hidden")}>
        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-base font-black text-gray-950">
            Accounting periods
          </h2>

          <div className="w-full sm:w-72">
            <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-gray-400">
              Fiscal year
            </label>
            <select
              className={input}
              value={selected}
              disabled={!years.length || refreshing}
              onChange={(event) => selectFiscalYear(event.target.value)}
            >
              {!years.length ? (
                <option value="">No fiscal year available</option>
              ) : null}
              {years.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                  {item.isCurrentYear ? " · Current" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[820px] w-full border-separate border-spacing-0 text-left">
            <thead className="bg-gray-50 text-xs font-black uppercase tracking-wider text-gray-400">
              <tr>
                {["Period", "Start", "End", "Status", "Actions"].map(
                  (heading) => (
                    <th
                      key={heading}
                      className="border-b border-gray-100 px-5 py-3"
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>

            {initialLoading || refreshing ? (
              <PeriodsSkeleton />
            ) : (
              <tbody className="divide-y divide-gray-100">
                {periods.map((period) => (
                  <tr
                    key={period._id || period.periodKey}
                    className="bg-white transition-colors hover:bg-gray-50"
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-black text-gray-900">
                        {period.name}
                      </p>
                      {period.periodKey ? (
                        <p className="mt-1 text-xs font-semibold text-gray-400">
                          {period.periodKey}
                        </p>
                      ) : null}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-gray-700">
                      {dateText(period.startDate)}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-gray-700">
                      {dateText(period.endDate)}
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge status={period.status} />
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        {period.status === "open" ? (
                          <>
                            <button
                              type="button"
                              className={cn(button, buttonGhost, "h-10")}
                              onClick={() =>
                                requestPeriodAction(period, "soft_close")
                              }
                              disabled={busy}
                            >
                              <Icon icon={UnavailableIcon} size={16} />
                              Soft close
                            </button>
                            <button
                              type="button"
                              className={cn(button, buttonWarning, "h-10")}
                              onClick={() =>
                                requestPeriodAction(period, "close")
                              }
                              disabled={busy}
                            >
                              <Icon icon={CheckmarkCircle02Icon} size={16} />
                              Close
                            </button>
                            <button
                              type="button"
                              className={cn(button, buttonDanger, "h-10")}
                              onClick={() =>
                                requestPeriodAction(period, "lock")
                              }
                              disabled={busy}
                            >
                              <Icon icon={UnavailableIcon} size={16} />
                              Lock
                            </button>
                          </>
                        ) : null}

                        {period.status === "soft_closed" ? (
                          <>
                            <button
                              type="button"
                              className={cn(button, buttonGhost, "h-10")}
                              onClick={() =>
                                requestPeriodAction(period, "reopen")
                              }
                              disabled={busy}
                            >
                              <Icon icon={RefreshIcon} size={16} />
                              Reopen
                            </button>
                            <button
                              type="button"
                              className={cn(button, buttonWarning, "h-10")}
                              onClick={() =>
                                requestPeriodAction(period, "close")
                              }
                              disabled={busy}
                            >
                              <Icon icon={CheckmarkCircle02Icon} size={16} />
                              Close
                            </button>
                            <button
                              type="button"
                              className={cn(button, buttonDanger, "h-10")}
                              onClick={() =>
                                requestPeriodAction(period, "lock")
                              }
                              disabled={busy}
                            >
                              <Icon icon={UnavailableIcon} size={16} />
                              Lock
                            </button>
                          </>
                        ) : null}

                        {period.status === "closed" ? (
                          <>
                            <button
                              type="button"
                              className={cn(button, buttonGhost, "h-10")}
                              onClick={() =>
                                requestPeriodAction(period, "reopen")
                              }
                              disabled={busy}
                            >
                              <Icon icon={RefreshIcon} size={16} />
                              Reopen
                            </button>
                            <button
                              type="button"
                              className={cn(button, buttonDanger, "h-10")}
                              onClick={() =>
                                requestPeriodAction(period, "lock")
                              }
                              disabled={busy}
                            >
                              <Icon icon={UnavailableIcon} size={16} />
                              Lock
                            </button>
                          </>
                        ) : null}

                        {period.status === "locked" ? (
                          <button
                            type="button"
                            className={cn(button, buttonGhost, "h-10")}
                            onClick={() =>
                              requestPeriodAction(period, "unlock")
                            }
                            disabled={busy}
                          >
                            <Icon icon={RefreshIcon} size={16} />
                            Unlock
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}

                {!periods.length ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState
                        title={
                          selected
                            ? "No accounting periods"
                            : "Select a fiscal year"
                        }
                        description={
                          selected
                            ? "No periods were found for this fiscal year."
                            : "Select or create a fiscal year."
                        }
                      />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            )}
          </table>
        </div>
      </section>

      <FiscalYearModal
        open={yearModal.open}
        mode={yearModal.mode}
        form={form}
        setForm={setForm}
        error={yearFormError}
        loading={savingYear}
        onClose={closeYearModal}
        onSubmit={saveFiscalYear}
      />

      <ConfirmActionModal
        open={Boolean(confirmAction)}
        action={confirmAction}
        loading={actionLoading}
        reason={actionReason}
        setReason={setActionReason}
        onClose={closeConfirmModal}
        onConfirm={runConfirmedAction}
      />
    </div>
  );
}
