"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Delete01Icon,
  Edit02Icon,
  FilterIcon,
  FloppyDiskIcon,
  Folder01Icon,
  HierarchySquare01Icon,
  MoreVerticalIcon,
  RefreshIcon,
  SearchIcon,
  UnavailableIcon,
} from "@hugeicons/core-free-icons";
import { excludeBankManagedAccounts } from "./accountVisibility";

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

const shell = "min-h-screen bg-gradient-to-b from-gray-50 to-white";
const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]";
const btn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60";
const btnPrimary = "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700";
const btnGhost =
  "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50";
const btnSuccess =
  "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100";
const btnDanger =
  "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50";
const iconBtn =
  "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50";
const input =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-300 focus:border-transparent focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500";

const EMPTY_FORM = {
  code: "",
  name: "",
  type: "asset",
  subType: "Current Asset",
  parent: "",
  currency: "BDT",
  isGroup: false,
  isControlAccount: false,
  controlType: "",
  taxApplicability: "none",
  description: "",
};

const SUB_TYPES = {
  asset: ["Current Asset", "Fixed Asset", "Other Asset"],
  liability: ["Current Liability", "Long-term Liability", "Other Liability"],
  equity: ["Capital", "Retained Earnings", "Other Equity"],
  revenue: ["Operating Income", "Other Income"],
  expense: [
    "Direct Expense",
    "Indirect Expense",
    "Cost of Goods Sold",
    "Other Expense",
  ],
};

const ACCOUNT_TYPES = Object.keys(SUB_TYPES);
const CORE_ACCOUNT_CODES = ["A000", "L000", "E000", "I000", "X000"];
const CORE_ACCOUNT_ORDER = new Map(
  CORE_ACCOUNT_CODES.map((code, index) => [code, index]),
);

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

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function pretty(value) {
  if (value === "revenue") return "Income";

  return String(value || "-")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function isCoreAccount(account) {
  return Boolean(account?.isSystem && CORE_ACCOUNT_ORDER.has(account?.code));
}

function formatBalance(value, currency = "BDT") {
  const amount = Number(value || 0);

  return `${String(currency || "BDT").toUpperCase()} ${amount.toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
  )}`;
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

function RequiredMark() {
  return <span className="ml-1 text-rose-500">*</span>;
}

function Field({ label, children, hint, required = false }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-gray-800">
        {label}
        {required ? <RequiredMark /> : null}
      </label>

      {children}

      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

function Badge({ value, variant = "default" }) {
  const key = String(value || "").toLowerCase();

  let style = "bg-slate-100 text-slate-700 ring-slate-200";

  if (variant === "status") {
    style =
      key === "active"
        ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
        : "bg-gray-100 text-gray-700 ring-gray-200";
  } else if (variant === "origin") {
    style =
      key === "core"
        ? "bg-indigo-50 text-indigo-700 ring-indigo-100"
        : key === "system"
          ? "bg-slate-100 text-slate-700 ring-slate-200"
          : "bg-cyan-50 text-cyan-700 ring-cyan-100";
  } else if (variant === "posting") {
    style =
      key === "group"
        ? "bg-indigo-50 text-indigo-700 ring-indigo-100"
        : "bg-sky-50 text-sky-700 ring-sky-100";
  } else if (key === "asset") {
    style = "bg-indigo-50 text-indigo-700 ring-indigo-100";
  } else if (key === "liability") {
    style = "bg-amber-50 text-amber-700 ring-amber-100";
  } else if (key === "equity") {
    style = "bg-violet-50 text-violet-700 ring-violet-100";
  } else if (key === "revenue") {
    style = "bg-emerald-50 text-emerald-700 ring-emerald-100";
  } else if (key === "expense") {
    style = "bg-rose-50 text-rose-700 ring-rose-100";
  }

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-black ring-1",
        style,
      )}
    >
      {pretty(value)}
    </span>
  );
}

function FilterChip({ label, value, onClear }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex max-w-full items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
      title={`Remove ${label} filter`}
      aria-label={`Remove ${label} filter`}
    >
      <span className="shrink-0 text-indigo-400">{label}:</span>
      <span className="max-w-[170px] truncate sm:max-w-[230px]">{value}</span>
      <span className="shrink-0 text-indigo-600">
        <Icon icon={Cancel01Icon} size={13} strokeWidth={2} />
      </span>
    </button>
  );
}

function AccountSearchFilters({
  query,
  setQuery,
  typeFilter,
  setTypeFilter,
  activeFilterCount,
  onOpenFilters,
  resetFilters,
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!focused && !query) setDraft("");
  }, [focused, query]);

  const handleFocus = () => {
    setFocused(true);
    setDraft(query || "");
  };

  const handleChange = (event) => {
    const value = event.target.value;
    setDraft(value);
    setQuery(value);
  };

  const handleBlur = () => {
    setFocused(false);
    setDraft("");
  };

  return (
    <div
      className={cn(
        "w-full transition-all duration-200",
        activeFilterCount
          ? "xl:min-w-[560px] xl:max-w-[780px] xl:flex-[0_1_780px]"
          : "xl:max-w-[680px] xl:flex-[0_1_680px]",
      )}
    >
      <div className="flex min-h-[46px] w-full flex-wrap items-center gap-1.5 rounded-2xl border border-gray-200 bg-[#f7f8fb] px-2.5 py-1 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]">
        <span className="shrink-0 text-gray-400">
          <Icon icon={SearchIcon} size={17} />
        </span>

        {query.trim() && !focused ? (
          <FilterChip
            label="Search"
            value={query.trim()}
            onClear={() => {
              setQuery("");
              setDraft("");
            }}
          />
        ) : null}

        {typeFilter !== "all" ? (
          <FilterChip
            label="Type"
            value={pretty(typeFilter)}
            onClear={() => setTypeFilter("all")}
          />
        ) : null}

        <input
          className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-2 text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400 focus:outline-none focus:ring-0"
          value={focused ? draft : ""}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          placeholder={
            activeFilterCount
              ? "Search more accounts..."
              : "Search account code, name, sub-type, or description..."
          }
          type="text"
          aria-label="Search Chart of Accounts"
        />

        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onOpenFilters}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-2 rounded-xl px-2.5 text-xs font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30",
            activeFilterCount
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100",
          )}
        >
          <Icon icon={FilterIcon} size={14} strokeWidth={2} />
          Filters
          {activeFilterCount ? (
            <span className="rounded-full bg-white/20 px-1.5 text-[10px]">
              {activeFilterCount}
            </span>
          ) : null}
        </button>

        {activeFilterCount ? (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              resetFilters();
              setDraft("");
            }}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
            title="Clear search and filters"
            aria-label="Clear search and filters"
          >
            <Icon icon={Cancel01Icon} size={15} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  maxWidthClass = "max-w-3xl",
}) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6">
          <motion.button
            type="button"
            aria-label="Close modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 cursor-default bg-black/40 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className={cn(
              "relative w-full overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.65)]",
              maxWidthClass,
            )}
          >
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-gray-50/70 p-4 sm:p-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
                  {icon}
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold text-gray-900 sm:text-lg">
                    {title}
                  </h2>

                  {subtitle ? (
                    <p className="truncate text-sm text-gray-600">{subtitle}</p>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-gray-700 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
                aria-label="Close modal"
              >
                <Icon icon={Cancel01Icon} size={20} />
              </button>
            </div>

            <div className="max-h-[calc(100vh-14rem)] overflow-y-auto bg-white p-4 sm:p-5">
              {children}
            </div>

            {footer ? (
              <div className="sticky bottom-0 z-20 border-t border-gray-100 bg-white p-4 sm:p-5">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function AccountFilterModal({
  open,
  onClose,
  query,
  setQuery,
  typeFilter,
  setTypeFilter,
  resetFilters,
}) {
  const [localType, setLocalType] = useState(typeFilter);

  useEffect(() => {
    if (open) setLocalType(typeFilter);
  }, [open, typeFilter]);

  const localActiveCount =
    Number(Boolean(query.trim())) + Number(localType !== "all");

  const applyFilters = () => {
    setTypeFilter(localType);
    onClose?.();
  };

  const resetAll = () => {
    setLocalType("all");
    resetFilters();
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Filter Chart of Accounts"
      subtitle="Narrow the account hierarchy without leaving the search bar."
      icon={<Icon icon={FilterIcon} size={20} strokeWidth={2} />}
      maxWidthClass="max-w-2xl"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span
            className={cn(
              "inline-flex w-fit items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold ring-1",
              localActiveCount
                ? "bg-indigo-50 text-indigo-700 ring-indigo-600/10"
                : "bg-gray-100 text-gray-600 ring-gray-600/10",
            )}
          >
            {localActiveCount} active filter
            {localActiveCount === 1 ? "" : "s"}
          </span>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={cn(btn, btnGhost)}
              onClick={resetAll}
            >
              Reset
            </button>
            <button
              type="button"
              className={cn(btn, btnPrimary)}
              onClick={applyFilters}
            >
              Apply filters
            </button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4">
        <Field label="Account type">
          <select
            className={input}
            value={localType}
            onChange={(event) => setLocalType(event.target.value)}
          >
            <option value="all">All account types</option>
            {ACCOUNT_TYPES.map((item) => (
              <option key={item} value={item}>
                {pretty(item)}
              </option>
            ))}
          </select>
        </Field>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
          <p className="text-sm font-black text-gray-900">Active filters</p>
          <p className="mt-1 text-sm text-gray-500">
            Filters are shown as removable chips inside the search field.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {query.trim() ? (
              <FilterChip
                label="Search"
                value={query.trim()}
                onClear={() => setQuery("")}
              />
            ) : null}

            {localType !== "all" ? (
              <FilterChip
                label="Type"
                value={pretty(localType)}
                onClear={() => setLocalType("all")}
              />
            ) : null}

            {!localActiveCount ? (
              <span className="text-sm font-semibold text-gray-500">
                No active filters selected.
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function ToggleCard({
  title,
  description,
  checked,
  disabled = false,
  onChange,
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition",
        checked
          ? "border-indigo-200 bg-indigo-50/60"
          : "border-gray-200 bg-white hover:bg-gray-50",
        disabled && "cursor-not-allowed opacity-55",
      )}
    >
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />

      <span className="min-w-0">
        <span className="block text-sm font-black text-gray-900">{title}</span>
        <span className="mt-1 block text-xs font-medium leading-5 text-gray-500">
          {description}
        </span>
      </span>
    </label>
  );
}

function AccountFormModal({
  open,
  account,
  form,
  setForm,
  accounts,
  error,
  saving,
  onClose,
  onSubmit,
}) {
  const systemLocked = Boolean(account?.isSystem);
  const coreLocked = isCoreAccount(account);

  const parentOptions = accounts.filter(
    (item) =>
      item.isGroup &&
      item.isActive &&
      item.type === form.type &&
      item._id !== account?._id,
  );

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={account ? "Update account" : "Add account"}
      subtitle={
        account
          ? `${form.code || "Account"} · ${form.name || "Edit account information"}`
          : "Create a group or postable account in the chart."
      }
      icon={
        <Icon
          icon={account ? Edit02Icon : Add01Icon}
          size={20}
          strokeWidth={2}
        />
      }
      maxWidthClass="max-w-5xl"
      footer={
        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          <button
            className={cn(btn, btnGhost)}
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            className={cn(btn, btnPrimary)}
            type="submit"
            form="chart-account-form"
            disabled={saving}
          >
            <span className={saving ? "animate-pulse" : ""}>
              <Icon icon={FloppyDiskIcon} size={17} />
            </span>
            {saving ? "Saving..." : account ? "Update account" : "Save account"}
          </button>
        </div>
      }
    >
      {systemLocked ? (
        <div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <Icon icon={UnavailableIcon} size={16} strokeWidth={2} />
            </span>
            <div>
              <p className="text-sm font-black text-gray-900">
                Protected system account
              </p>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                Structural fields are locked to preserve the accounting
                hierarchy.
                {coreLocked
                  ? " This is one of the five fundamental Chart of Accounts roots."
                  : " This account is part of the standard backend structure."}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      <form id="chart-account-form" onSubmit={onSubmit}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Account Code" required>
            <input
              className={input}
              value={form.code}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  code: event.target.value,
                }))
              }
              placeholder="110100"
              required
              disabled={systemLocked}
            />
          </Field>

          <Field label="Account Name" required>
            <input
              className={input}
              value={form.name}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  name: event.target.value,
                }))
              }
              placeholder="Cash in Hand"
              required
              disabled={coreLocked}
            />
          </Field>

          <Field label="Account Type" required>
            <select
              className={input}
              value={form.type}
              onChange={(event) => {
                const nextType = event.target.value;

                setForm((previous) => ({
                  ...previous,
                  type: nextType,
                  parent: "",
                  subType: SUB_TYPES[nextType][0],
                }));
              }}
              required
              disabled={systemLocked}
            >
              {ACCOUNT_TYPES.map((item) => (
                <option key={item} value={item}>
                  {pretty(item)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Sub-type" required>
            <select
              className={input}
              value={form.subType}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  subType: event.target.value,
                }))
              }
              required
              disabled={coreLocked}
            >
              {SUB_TYPES[form.type].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Parent Group"
            hint="Optional. Leave empty for a top-level account."
          >
            <select
              className={input}
              value={form.parent}
              disabled={systemLocked}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  parent: event.target.value,
                }))
              }
            >
              <option value="">Top level</option>
              {parentOptions.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.code} — {item.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Currency" required>
            <input
              className={input}
              value={form.currency}
              maxLength={3}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  currency: event.target.value.toUpperCase(),
                }))
              }
              placeholder="BDT"
              required
              disabled={coreLocked}
            />
          </Field>

          <Field label="Tax Applicability">
            <select
              className={input}
              value={form.taxApplicability}
              disabled={coreLocked}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  taxApplicability: event.target.value,
                }))
              }
            >
              <option value="none">None</option>
              <option value="taxable">Taxable</option>
              <option value="exempt">Exempt</option>
              <option value="zero_rated">Zero rated</option>
            </select>
          </Field>

          <Field
            label="Control Type"
            hint={
              form.isControlAccount
                ? "Required for a control account."
                : "Enable Control account to select a type."
            }
            required={form.isControlAccount}
          >
            <select
              className={input}
              disabled={!form.isControlAccount || systemLocked}
              value={form.controlType}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  controlType: event.target.value,
                }))
              }
              required={form.isControlAccount}
            >
              <option value="">Select control type</option>
              <option value="receivable">Receivable</option>
              <option value="payable">Payable</option>
              <option value="inventory">Inventory</option>
              <option value="tax">Tax</option>
            </select>
          </Field>

          <div className="md:col-span-2 lg:col-span-3">
            <Field
              label="Description"
              hint="Optional internal description for this account."
            >
              <textarea
                className={cn(input, "min-h-[110px] resize-none")}
                value={form.description}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    description: event.target.value,
                  }))
                }
                placeholder="Describe how this account should be used."
              />
            </Field>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <ToggleCard
            title="Group / header account"
            description="Used only to organize child accounts. Direct journal posting is blocked."
            checked={form.isGroup}
            disabled={systemLocked}
            onChange={(event) =>
              setForm((previous) => ({
                ...previous,
                isGroup: event.target.checked,
                isControlAccount: event.target.checked
                  ? false
                  : previous.isControlAccount,
                controlType: event.target.checked ? "" : previous.controlType,
              }))
            }
          />

          <ToggleCard
            title="Control account"
            description="A system-managed postable account such as receivable, payable, inventory, or tax."
            checked={form.isControlAccount}
            disabled={form.isGroup || systemLocked}
            onChange={(event) =>
              setForm((previous) => ({
                ...previous,
                isControlAccount: event.target.checked,
                controlType: event.target.checked ? previous.controlType : "",
              }))
            }
          />
        </div>
      </form>
    </ModalShell>
  );
}

function ConfirmStatusModal({ open, account, loading, onClose, onConfirm }) {
  const activating = account ? !account.isActive : false;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={activating ? "Activate account" : "Deactivate account"}
      subtitle={account ? `${account.code} · ${account.name}` : ""}
      icon={
        <Icon
          icon={activating ? CheckmarkCircle02Icon : UnavailableIcon}
          size={20}
          strokeWidth={2}
        />
      }
      maxWidthClass="max-w-lg"
      footer={
        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          <button
            className={cn(btn, btnGhost)}
            type="button"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>

          <button
            className={cn(btn, activating ? btnPrimary : btnDanger)}
            type="button"
            onClick={onConfirm}
            disabled={loading}
          >
            <Icon
              icon={activating ? CheckmarkCircle02Icon : UnavailableIcon}
              size={17}
            />
            {loading
              ? "Updating..."
              : activating
                ? "Activate account"
                : "Deactivate account"}
          </button>
        </div>
      }
    >
      <div
        className={cn(
          "rounded-2xl border p-4",
          activating
            ? "border-indigo-100 bg-indigo-50/50"
            : "border-rose-100 bg-rose-50/50",
        )}
      >
        <p className="text-sm font-black text-gray-900">
          {activating
            ? "This account will become available again."
            : "This account will be hidden from new transactions."}
        </p>
        <p className="mt-1 text-sm leading-6 text-gray-600">
          Historical accounting data will remain unchanged. You can reverse this
          status later.
        </p>
      </div>
    </ModalShell>
  );
}

function ConfirmDeleteModal({ open, account, loading, onClose, onConfirm }) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Delete custom account"
      subtitle={account ? `${account.code} · ${account.name}` : ""}
      icon={<Icon icon={Delete01Icon} size={20} strokeWidth={2} />}
      maxWidthClass="max-w-lg"
      footer={
        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          <button
            className={cn(btn, btnGhost)}
            type="button"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>

          <button
            className={cn(btn, btnDanger)}
            type="button"
            onClick={onConfirm}
            disabled={loading}
          >
            <Icon icon={Delete01Icon} size={17} />
            {loading ? "Deleting..." : "Delete account"}
          </button>
        </div>
      }
    >
      <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
        <p className="text-sm font-black text-gray-900">
          This permanently removes the custom account.
        </p>
        <p className="mt-1 text-sm leading-6 text-gray-600">
          Deletion is allowed only when the account has no child accounts,
          ledger history, opening-balance usage, cash or bank connection, or
          accounting settings reference. Otherwise, deactivate it instead.
        </p>
      </div>
    </ModalShell>
  );
}

function AccountActionsMenu({ account, onEdit, onStatusChange, onDelete }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);

  const coreAccount = isCoreAccount(account);
  const systemAccount = Boolean(account?.isSystem);

  const closeMenu = useCallback(() => {
    setOpen(false);
  }, []);

  const runAction = useCallback(
    (action) => {
      closeMenu();
      window.requestAnimationFrame(() => {
        action?.(account);
      });
    },
    [account, closeMenu],
  );

  useEffect(() => {
    if (!open) return undefined;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      const width = 216;
      const height = coreAccount ? 128 : systemAccount ? 170 : 182;
      const gap = 8;
      const viewportPadding = 12;
      const left = Math.min(
        window.innerWidth - width - viewportPadding,
        Math.max(viewportPadding, rect.right - width),
      );
      const openAbove = rect.bottom + height + gap > window.innerHeight;
      const top = openAbove
        ? Math.max(viewportPadding, rect.top - height - gap)
        : Math.min(
            window.innerHeight - height - viewportPadding,
            rect.bottom + gap,
          );

      setPosition({ top, left });
    };

    updatePosition();

    const close = () => closeMenu();
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeMenu();
    };

    window.addEventListener("click", close);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, coreAccount, systemAccount, closeMenu]);

  const itemClass =
    "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30";

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: 216,
              backgroundColor: "#ffffff",
            }}
            className="z-[9999] overflow-hidden rounded-2xl border border-gray-100 bg-white p-2 text-left shadow-[0_18px_50px_-24px_rgba(0,0,0,0.55)]"
            onClick={(event) => event.stopPropagation()}
            role="menu"
            aria-label={`Actions for ${account.name}`}
          >
            <button
              type="button"
              className={itemClass}
              onClick={() => runAction(onEdit)}
              role="menuitem"
            >
              <span className="text-indigo-600">
                <Icon icon={Edit02Icon} size={16} />
              </span>
              Edit account
            </button>

            {coreAccount ? (
              <div className="rounded-xl bg-gray-50 px-3 py-2 text-xs font-semibold leading-5 text-gray-500">
                This fundamental account is protected.
              </div>
            ) : (
              <button
                type="button"
                className={itemClass}
                onClick={() => runAction(onStatusChange)}
                role="menuitem"
              >
                <span
                  className={
                    account.isActive ? "text-amber-600" : "text-emerald-600"
                  }
                >
                  <Icon
                    icon={
                      account.isActive ? UnavailableIcon : CheckmarkCircle02Icon
                    }
                    size={16}
                  />
                </span>
                {account.isActive ? "Deactivate account" : "Activate account"}
              </button>
            )}

            {!systemAccount ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30"
                onClick={() => runAction(onDelete)}
                role="menuitem"
              >
                <Icon icon={Delete01Icon} size={16} />
                Delete account
              </button>
            ) : !coreAccount ? (
              <div className="rounded-xl bg-gray-50 px-3 py-2 text-xs font-semibold leading-5 text-gray-500">
                System accounts cannot be deleted.
              </div>
            ) : null}
          </motion.div>,
          document.body,
        )
      : null;

  return (
    <div
      className="relative flex items-center justify-end"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        ref={buttonRef}
        type="button"
        className={cn(
          iconBtn,
          open && "border-indigo-200 bg-indigo-50 text-indigo-700",
        )}
        title="More actions"
        aria-label={`More actions for ${account.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((previous) => !previous);
        }}
      >
        <Icon icon={MoreVerticalIcon} size={17} strokeWidth={2} />
      </button>

      {menu}
    </div>
  );
}

function AccountRow({
  account,
  depth,
  childrenMap,
  expanded,
  setExpanded,
  calculateBalance,
  isVisible,
  forceOpen,
  onEdit,
  onStatusChange,
  onDelete,
}) {
  if (!isVisible(account)) return null;

  const children = childrenMap.get(account._id) || [];
  const open = Boolean(expanded[account._id]);
  const displayOpen = forceOpen || open;
  const showChildren = displayOpen;
  const coreAccount = isCoreAccount(account);
  const systemAccount = Boolean(account.isSystem);
  const originLabel = coreAccount
    ? "Core"
    : systemAccount
      ? "System"
      : "Custom";

  return (
    <>
      <tr className="group [&>td:not(:last-child)]:bg-white [&>td:not(:last-child)]:transition-colors hover:[&>td:not(:last-child)]:bg-gray-50">
        <td className="whitespace-nowrap px-5 py-4 align-middle">
          <p className="text-sm font-black text-indigo-700">{account.code}</p>
        </td>

        <td className="px-5 py-4 align-middle">
          <div
            className="flex min-w-[260px] items-center gap-2"
            style={{ paddingLeft: `${Math.min(depth, 8) * 20}px` }}
          >
            {account.isGroup ? (
              <button
                type="button"
                onClick={() =>
                  setExpanded((previous) => ({
                    ...previous,
                    [account._id]: !open,
                  }))
                }
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
                aria-label={
                  displayOpen
                    ? "Collapse account group"
                    : "Expand account group"
                }
              >
                <Icon
                  icon={displayOpen ? ArrowDown01Icon : ArrowRight01Icon}
                  size={16}
                />
              </button>
            ) : (
              <span className="h-7 w-7 shrink-0" />
            )}

            {account.isGroup ? (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Icon icon={Folder01Icon} size={17} />
              </span>
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                <span className="h-2 w-2 rounded-full bg-gray-300" />
              </span>
            )}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className={cn(
                    "text-sm text-gray-900",
                    account.isGroup ? "font-black" : "font-bold",
                  )}
                >
                  {account.name}
                </p>

                {account.isControlAccount ? (
                  <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-black text-violet-700 ring-1 ring-violet-100">
                    CONTROL
                  </span>
                ) : null}

                <Badge value={originLabel} variant="origin" />
              </div>

              {account.description &&
              !["X100", "X200"].includes(account.code) ? (
                <p className="mt-0.5 max-w-[420px] truncate text-xs font-medium text-gray-500">
                  {account.description}
                </p>
              ) : null}
            </div>
          </div>
        </td>

        <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-gray-600">
          {account.subType || "—"}
        </td>

        <td className="whitespace-nowrap px-5 py-4">
          <Badge value={account.type} />
        </td>

        <td className="whitespace-nowrap px-5 py-4">
          <Badge
            value={account.isGroup ? "Group" : "Postable"}
            variant="posting"
          />
        </td>

        <td className="whitespace-nowrap px-5 py-4">
          <Badge
            value={account.isActive ? "Active" : "Inactive"}
            variant="status"
          />
        </td>

        <td className="whitespace-nowrap px-5 py-4 text-right">
          <p className="text-sm font-black text-gray-900">
            {formatBalance(calculateBalance(account), account.currency)}
          </p>
        </td>

        <td
          className="sticky right-0 z-10 w-[88px] border-l border-gray-100 !bg-white px-5 py-4 align-middle text-right"
          style={{ backgroundColor: "#ffffff" }}
        >
          <AccountActionsMenu
            account={account}
            onEdit={onEdit}
            onStatusChange={onStatusChange}
            onDelete={onDelete}
          />
        </td>
      </tr>

      {showChildren
        ? children.map((child) => (
            <AccountRow
              key={child._id}
              account={child}
              depth={depth + 1}
              childrenMap={childrenMap}
              expanded={expanded}
              setExpanded={setExpanded}
              calculateBalance={calculateBalance}
              isVisible={isVisible}
              forceOpen={forceOpen}
              onEdit={onEdit}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
            />
          ))
        : null}
    </>
  );
}

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [systemAction, setSystemAction] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [accountModal, setAccountModal] = useState({
    open: false,
    account: null,
  });
  const [statusModal, setStatusModal] = useState({
    open: false,
    account: null,
  });
  const [statusLoading, setStatusLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    account: null,
  });
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadAccounts = async ({ preserveExpansion = false } = {}) => {
    setLoading(true);

    try {
      const data = await api(
        "/accounting/accounts?limit=200&active=all&includeBalances=true",
      );
      const nextAccounts = excludeBankManagedAccounts(data.accounts || []);

      setAccounts(nextAccounts);

      if (!preserveExpansion) {
        setExpanded(
          Object.fromEntries(
            nextAccounts
              .filter((account) => account.isGroup)
              .map((account) => [account._id, true]),
          ),
        );
      }
    } catch (error) {
      toast.error(error.message || "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const tree = useMemo(() => {
    const childrenMap = new Map();

    accounts.forEach((account) => {
      const parentId = account.parent?._id || account.parent || "root";
      const siblings = childrenMap.get(parentId) || [];
      childrenMap.set(parentId, [...siblings, account]);
    });

    const sortAccounts = (items, { root = false } = {}) =>
      [...items].sort((first, second) => {
        if (root) {
          const firstCoreRank = CORE_ACCOUNT_ORDER.has(first.code)
            ? CORE_ACCOUNT_ORDER.get(first.code)
            : Number.MAX_SAFE_INTEGER;
          const secondCoreRank = CORE_ACCOUNT_ORDER.has(second.code)
            ? CORE_ACCOUNT_ORDER.get(second.code)
            : Number.MAX_SAFE_INTEGER;

          if (firstCoreRank !== secondCoreRank)
            return firstCoreRank - secondCoreRank;
          if (Boolean(first.isSystem) !== Boolean(second.isSystem)) {
            return first.isSystem ? -1 : 1;
          }
        }

        return String(first.code || "").localeCompare(
          String(second.code || ""),
          undefined,
          { numeric: true, sensitivity: "base" },
        );
      });

    childrenMap.forEach((items, key) => {
      childrenMap.set(key, sortAccounts(items));
    });

    const roots = sortAccounts(
      accounts.filter((account) => {
        const parentId = account.parent?._id || account.parent;
        return !parentId || !accounts.some((parent) => parent._id === parentId);
      }),
      { root: true },
    );

    const calculateBalance = (account) => {
      if (!account.isGroup) return Number(account.currentBalance || 0);

      return (childrenMap.get(account._id) || []).reduce(
        (total, child) => total + calculateBalance(child),
        0,
      );
    };

    return { childrenMap, roots, calculateBalance };
  }, [accounts]);

  const normalizedQuery = query.trim().toLowerCase();

  const isVisible = (account) => {
    const matchesType = typeFilter === "all" || account.type === typeFilter;
    const searchableText = `${account.code || ""} ${account.name || ""} ${
      account.subType || ""
    } ${account.description || ""}`.toLowerCase();
    const matchesQuery =
      !normalizedQuery || searchableText.includes(normalizedQuery);

    return (
      (matchesType && matchesQuery) ||
      (tree.childrenMap.get(account._id) || []).some(isVisible)
    );
  };

  const visibleCount = accounts.filter((account) => isVisible(account)).length;

  const activeFilterCount =
    Number(Boolean(normalizedQuery)) + Number(typeFilter !== "all");
  const forceOpen = activeFilterCount > 0;

  const openCreateModal = () => {
    setFormError("");
    setForm(EMPTY_FORM);
    setAccountModal({ open: true, account: null });
  };

  const openEditModal = (account) => {
    setFormError("");
    setForm({
      code: account.code || "",
      name: account.name || "",
      type: account.type || "asset",
      subType: account.subType || SUB_TYPES[account.type || "asset"][0],
      parent: account.parent?._id || account.parent || "",
      currency: account.currency || "BDT",
      isGroup: Boolean(account.isGroup),
      isControlAccount: Boolean(account.isControlAccount),
      controlType: account.controlType || "",
      taxApplicability: account.taxApplicability || "none",
      description: account.description || "",
    });
    setAccountModal({ open: true, account });
  };

  const closeAccountModal = () => {
    if (saving) return;

    setFormError("");
    setForm(EMPTY_FORM);
    setAccountModal({ open: false, account: null });
  };

  const saveAccount = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!form.code.trim()) return setFormError("Account code is required.");
    if (!form.name.trim()) return setFormError("Account name is required.");
    if (!form.type) return setFormError("Account type is required.");
    if (!form.subType) return setFormError("Account sub-type is required.");
    if (!form.currency.trim()) return setFormError("Currency is required.");
    if (form.isControlAccount && !form.controlType) {
      return setFormError("Control type is required for a control account.");
    }

    setSaving(true);

    try {
      const editingId = accountModal.account?._id;
      let payload = {
        ...form,
        code: form.code.trim(),
        name: form.name.trim(),
        currency: form.currency.trim().toUpperCase(),
        parent: form.parent || "",
        controlType: form.isControlAccount ? form.controlType : "",
        description: form.description.trim(),
      };

      if (editingId && accountModal.account?.isSystem) {
        const {
          code,
          type,
          parent,
          isGroup,
          isControlAccount,
          controlType,
          ...editableFields
        } = payload;
        payload = isCoreAccount(accountModal.account)
          ? { description: editableFields.description }
          : editableFields;
      }

      await api(
        editingId
          ? `/accounting/accounts/${editingId}`
          : "/accounting/accounts",
        {
          method: editingId ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );

      toast.success(editingId ? "Account updated" : "Account created");
      setForm(EMPTY_FORM);
      setAccountModal({ open: false, account: null });
      await loadAccounts({ preserveExpansion: true });
    } catch (error) {
      setFormError(error.message || "Unable to save account.");
    } finally {
      setSaving(false);
    }
  };

  const openStatusModal = (account) => {
    setStatusModal({ open: true, account });
  };

  const closeStatusModal = () => {
    if (statusLoading) return;
    setStatusModal({ open: false, account: null });
  };

  const updateAccountStatus = async () => {
    const account = statusModal.account;
    if (!account) return;

    setStatusLoading(true);

    try {
      await api(`/accounting/accounts/${account._id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !account.isActive }),
      });

      toast.success(
        account.isActive ? "Account deactivated" : "Account activated",
      );
      setStatusModal({ open: false, account: null });
      await loadAccounts({ preserveExpansion: true });
    } catch (error) {
      toast.error(error.message || "Status update failed");
    } finally {
      setStatusLoading(false);
    }
  };

  const openDeleteModal = (account) => {
    if (account?.isSystem) {
      toast.error("System accounts are protected and cannot be deleted.");
      return;
    }

    setDeleteModal({ open: true, account });
  };

  const closeDeleteModal = () => {
    if (deleteLoading) return;
    setDeleteModal({ open: false, account: null });
  };

  const deleteAccount = async () => {
    const account = deleteModal.account;
    if (!account) return;

    setDeleteLoading(true);

    try {
      await api(`/accounting/accounts/${account._id}`, { method: "DELETE" });
      toast.success("Custom account deleted");
      setDeleteModal({ open: false, account: null });
      await loadAccounts({ preserveExpansion: true });
    } catch (error) {
      toast.error(error.message || "Account deletion failed");
    } finally {
      setDeleteLoading(false);
    }
  };

  const bootstrapAccounts = async () => {
    setSystemAction("bootstrap");

    try {
      await api("/accounting/accounts/bootstrap", {
        method: "POST",
        body: "{}",
      });
      toast.success("Standard account structure prepared");
      await loadAccounts();
    } catch (error) {
      toast.error(error.message || "Unable to prepare the standard structure");
    } finally {
      setSystemAction("");
    }
  };

  const publishAccounts = async () => {
    setSystemAction("publish");

    try {
      await api("/accounting/accounts/publish", {
        method: "POST",
        body: "{}",
      });
      toast.success("Chart of Accounts published");
      await loadAccounts({ preserveExpansion: true });
    } catch (error) {
      toast.error(error.message || "Unable to publish the Chart of Accounts");
    } finally {
      setSystemAction("");
    }
  };

  const resetFilters = () => {
    setQuery("");
    setTypeFilter("all");
  };

  return (
    <div className={cn(shell, "p-4 sm:p-6 lg:p-8")}>
      <Toaster position="top-right" />

      <section className={cn(card, "mb-6 p-4 sm:p-5")}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
              <Icon icon={HierarchySquare01Icon} size={21} strokeWidth={2} />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold tracking-tight text-gray-900">
                Chart of Accounts
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">
                Core system accounts are protected. Bank-managed ledgers are
                maintained in Bank Setup and hidden here.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(btn, btnGhost)}
              onClick={bootstrapAccounts}
              disabled={Boolean(systemAction) || loading}
            >
              <span
                className={systemAction === "bootstrap" ? "animate-spin" : ""}
              >
                <Icon icon={RefreshIcon} size={17} />
              </span>
              Standard Structure
            </button>

            <button
              type="button"
              className={cn(btn, btnSuccess)}
              onClick={publishAccounts}
              disabled={Boolean(systemAction) || loading}
            >
              <Icon icon={CheckmarkCircle02Icon} size={17} />
              {systemAction === "publish" ? "Publishing..." : "Publish COA"}
            </button>

            <button
              type="button"
              className={cn(btn, btnPrimary)}
              onClick={openCreateModal}
            >
              <Icon icon={Add01Icon} size={17} />
              Add Account
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <AccountSearchFilters
            query={query}
            setQuery={setQuery}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            activeFilterCount={activeFilterCount}
            onOpenFilters={() => setFilterModalOpen(true)}
            resetFilters={resetFilters}
          />

          <div className="flex items-center justify-between gap-3 xl:justify-end">
            <p className="text-sm font-bold text-gray-500">
              Showing <span className="text-gray-900">{visibleCount}</span> of{" "}
              <span className="text-gray-900">{accounts.length}</span> accounts
            </p>

            <button
              type="button"
              className={cn(btn, btnGhost, "px-3")}
              onClick={() => loadAccounts({ preserveExpansion: true })}
              disabled={loading}
              aria-label="Refresh accounts"
              title="Refresh accounts"
            >
              <span className={loading ? "animate-spin" : ""}>
                <Icon icon={RefreshIcon} size={17} />
              </span>
            </button>
          </div>
        </div>
      </section>

      <section className={cn(card, "overflow-hidden")}>
        <div className="max-h-[650px] overflow-auto">
          <table className="min-w-[1260px] w-full border-separate border-spacing-0 text-left">
            <thead className="sticky top-0 z-20 bg-gray-50 text-xs font-black uppercase text-gray-500">
              <tr>
                <th className="border-b border-gray-100 px-5 py-3">Code</th>
                <th className="border-b border-gray-100 px-5 py-3">
                  Account hierarchy
                </th>
                <th className="border-b border-gray-100 px-5 py-3">Sub-type</th>
                <th className="border-b border-gray-100 px-5 py-3">Type</th>
                <th className="border-b border-gray-100 px-5 py-3">Posting</th>
                <th className="border-b border-gray-100 px-5 py-3">Status</th>
                <th className="border-b border-gray-100 px-5 py-3 text-right">
                  Balance
                </th>
                <th
                  className="sticky right-0 z-30 w-[88px] border-b border-l border-gray-100 !bg-white px-5 py-3 text-right"
                  style={{ backgroundColor: "#ffffff" }}
                >
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {tree.roots.map((account) => (
                <AccountRow
                  key={account._id}
                  account={account}
                  depth={0}
                  childrenMap={tree.childrenMap}
                  expanded={expanded}
                  setExpanded={setExpanded}
                  calculateBalance={tree.calculateBalance}
                  isVisible={isVisible}
                  forceOpen={forceOpen}
                  onEdit={openEditModal}
                  onStatusChange={openStatusModal}
                  onDelete={openDeleteModal}
                />
              ))}

              {!loading && !visibleCount ? (
                <tr>
                  <td colSpan={8} className="px-5 py-14 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                      <Icon icon={SearchIcon} size={22} />
                    </div>
                    <p className="mt-3 text-sm font-black text-gray-700">
                      No accounts found
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      Change the search or account-type filter and try again.
                    </p>
                  </td>
                </tr>
              ) : null}

              {loading && !accounts.length ? (
                <tr>
                  <td colSpan={8} className="px-5 py-14 text-center">
                    <span className="mx-auto inline-flex animate-spin text-indigo-600">
                      <Icon icon={RefreshIcon} size={24} strokeWidth={2} />
                    </span>
                    <p className="mt-3 text-sm font-bold text-gray-500">
                      Loading accounts...
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <AccountFilterModal
        open={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        query={query}
        setQuery={setQuery}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        resetFilters={resetFilters}
      />

      <AccountFormModal
        open={accountModal.open}
        account={accountModal.account}
        form={form}
        setForm={setForm}
        accounts={accounts}
        error={formError}
        saving={saving}
        onClose={closeAccountModal}
        onSubmit={saveAccount}
      />

      <ConfirmStatusModal
        open={statusModal.open}
        account={statusModal.account}
        loading={statusLoading}
        onClose={closeStatusModal}
        onConfirm={updateAccountStatus}
      />

      <ConfirmDeleteModal
        open={deleteModal.open}
        account={deleteModal.account}
        loading={deleteLoading}
        onClose={closeDeleteModal}
        onConfirm={deleteAccount}
      />
    </div>
  );
}
