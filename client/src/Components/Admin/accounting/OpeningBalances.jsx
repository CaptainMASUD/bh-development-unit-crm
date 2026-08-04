"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import toast, { Toaster } from "react-hot-toast";
import {
  FiAlertTriangle,
  FiArchive,
  FiCheckCircle,
  FiChevronDown,
  FiChevronRight,
  FiPlus,
  FiRefreshCcw,
  FiSave,
  FiSend,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { getOpeningBalanceAccounts } from "./accountVisibility";

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]";
const input =
  "h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500";
const button =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-40";

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
    throw new Error(data.message || "Request failed");
  }

  return data;
}

const money = (value) => Math.round(Number(value || 0) * 100) / 100;

const dateValue = (value) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";

function formatDisplayDate(value) {
  if (!value) return "Not selected";

  const parsedDate = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) return value;

  return parsedDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ReviewItem({ label, value, highlight = false }) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight
          ? "border-indigo-100 bg-indigo-50/60"
          : "border-gray-100 bg-gray-50/70"
      }`}
    >
      <p className="text-xs font-black uppercase tracking-[0.14em] text-gray-400">
        {label}
      </p>
      <p
        className={`mt-1.5 break-words text-sm font-black ${
          highlight ? "text-indigo-700" : "text-gray-900"
        }`}
      >
        {value || "—"}
      </p>
    </div>
  );
}

function ConfirmPostModal({
  open,
  busy,
  fiscalYearName,
  date,
  reference,
  memo,
  lineCount,
  totals,
  onClose,
  onConfirm,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !busy) onClose?.();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, busy, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-opening-balance-title"
    >
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6">
        <button
          type="button"
          className="fixed inset-0 cursor-default bg-slate-950/45 backdrop-blur-md"
          onClick={() => {
            if (!busy) onClose?.();
          }}
          aria-label="Close review modal"
        />

        <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_32px_90px_-32px_rgba(15,23,42,0.7)]">
          <div className="flex items-start justify-between border-b border-gray-100 bg-gray-50/80 p-5 sm:p-6">
            <div className="flex min-w-0 items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
                <FiSend className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-600">
                  Final Review
                </p>
                <h2
                  id="review-opening-balance-title"
                  className="mt-1 text-xl font-black text-gray-950"
                >
                  Post Opening Balance?
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-gray-500">
                  Review the summary before posting it to the General Ledger.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Close review modal"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[calc(100vh-13rem)] overflow-y-auto p-5 sm:p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <ReviewItem
                label="Fiscal Year"
                value={fiscalYearName || "Not selected"}
                highlight
              />
              <ReviewItem label="Opening Date" value={formatDisplayDate(date)} />
              <ReviewItem
                label="Debit Total"
                value={totals.debit.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              />
              <ReviewItem
                label="Credit Total"
                value={totals.credit.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              />
              <ReviewItem
                label="Entered Lines"
                value={`${lineCount} account line${lineCount === 1 ? "" : "s"}`}
              />
              <ReviewItem label="Reference" value={reference || "Not provided"} />
            </div>

            <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-gray-400">
                Memo
              </p>
              <p className="mt-1.5 text-sm font-semibold leading-6 text-gray-700">
                {memo || "No memo provided"}
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <FiAlertTriangle className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="text-sm font-black text-gray-950">
                    Posting is a final accounting action
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-gray-600">
                    The latest values will be saved, posted balances will become
                    locked, and the amounts will feed the General Ledger.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm font-black text-emerald-700">
              <FiCheckCircle className="h-[18px] w-[18px] shrink-0" />
              Debit and credit totals are balanced.
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-white p-5 sm:flex-row sm:justify-end sm:p-6">
            <button
              type="button"
              className={`${button} border border-gray-200 bg-white text-gray-800 hover:bg-gray-50`}
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>

            <button
              type="button"
              className={`${button} bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700`}
              onClick={onConfirm}
              disabled={busy}
            >
              <FiSend className={busy ? "animate-pulse" : ""} />
              {busy ? "Posting..." : "Confirm & Post"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function OpeningBalances() {
  const [accounts, setAccounts] = useState([]);
  const [years, setYears] = useState([]);
  const [fiscalYear, setFiscalYear] = useState("");
  const [date, setDate] = useState("");
  const [memo, setMemo] = useState("Company opening balances");
  const [reference, setReference] = useState("");
  const [rows, setRows] = useState([]);
  const [record, setRecord] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [busy, setBusy] = useState(false);
  const [postModalOpen, setPostModalOpen] = useState(false);

  const makeRows = (accountRows, existing = null) => {
    const byAccount = new Map(
      (existing?.lines || []).map((line) => [
        String(line.account?._id || line.account),
        line,
      ]),
    );

    return accountRows
      .filter((account) => !account.isGroup && account.isActive !== false)
      .map((account) => {
        const line = byAccount.get(String(account._id));

        return {
          account,
          debit: line?.debit || "",
          credit: line?.credit || "",
          description: line?.description || "Opening balance",
          partySplits: line?.partySplits || [],
        };
      });
  };

  const loadOpening = async (
    id,
    accountRows = accounts,
    yearItem = years.find((fiscalYearItem) => fiscalYearItem._id === id),
  ) => {
    if (!id) {
      setRecord(null);
      setRows(makeRows(accountRows));
      setDate("");
      setMemo("Company opening balances");
      setReference("");
      return;
    }

    setBusy(true);

    try {
      const data = await api(
        `/accounting/opening-balances?fiscalYear=${id}`,
      );
      const existing = data.openingBalances?.[0] || null;

      setRecord(existing);
      setRows(makeRows(accountRows, existing));
      setDate(dateValue(existing?.date || yearItem?.startDate));
      setMemo(existing?.memo || "Company opening balances");
      setReference(existing?.reference || "");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const loadBase = async () => {
    try {
      const [accountData, fiscalData] = await Promise.all([
        api("/accounting/accounts?limit=200"),
        api("/accounting/fiscal-years"),
      ]);

      const accountRows = getOpeningBalanceAccounts(
        accountData.accounts || [],
      );
      const fiscalRows = fiscalData.fiscalYears || [];

      setAccounts(accountRows);
      setYears(fiscalRows);

      const current =
        fiscalRows.find((fiscalYearItem) => fiscalYearItem.isCurrentYear) ||
        fiscalRows.find((fiscalYearItem) => fiscalYearItem.status === "open") ||
        fiscalRows[0];

      if (current) {
        setFiscalYear(current._id);
        setDate(dateValue(current.startDate));
        await loadOpening(current._id, accountRows, current);
      } else {
        setRows(makeRows(accountRows));
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  useEffect(() => {
    loadBase();
  }, []);

  const totals = useMemo(() => {
    const debit = money(
      rows.reduce((sum, row) => sum + Number(row.debit || 0), 0),
    );
    const credit = money(
      rows.reduce((sum, row) => sum + Number(row.credit || 0), 0),
    );

    return {
      debit,
      credit,
      difference: money(debit - credit),
    };
  }, [rows]);

  const enteredLineCount = useMemo(
    () =>
      rows.filter(
        (row) =>
          Number(row.debit || 0) > 0 || Number(row.credit || 0) > 0,
      ).length,
    [rows],
  );

  const selectedFiscalYear = useMemo(
    () => years.find((item) => item._id === fiscalYear),
    [years, fiscalYear],
  );

  const update = (index, key, value) => {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [key]: value,
              ...(key === "debit" && Number(value) > 0
                ? { credit: "" }
                : {}),
              ...(key === "credit" && Number(value) > 0
                ? { debit: "" }
                : {}),
            }
          : row,
      ),
    );
  };

  const updateParty = (rowIndex, partyIndex, key, value) => {
    setRows((current) =>
      current.map((row, currentRowIndex) =>
        currentRowIndex === rowIndex
          ? {
              ...row,
              partySplits: row.partySplits.map((party, currentPartyIndex) =>
                currentPartyIndex === partyIndex
                  ? {
                      ...party,
                      [key]: value,
                      ...(key === "debit" && Number(value) > 0
                        ? { credit: "" }
                        : {}),
                      ...(key === "credit" && Number(value) > 0
                        ? { debit: "" }
                        : {}),
                    }
                  : party,
              ),
            }
          : row,
      ),
    );
  };

  const addParty = (index) => {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              partySplits: [
                ...row.partySplits,
                {
                  partyType:
                    row.account.controlType === "payable"
                      ? "supplier"
                      : "customer",
                  partyName: "",
                  debit: "",
                  credit: "",
                },
              ],
            }
          : row,
      ),
    );
  };

  const removeParty = (rowIndex, partyIndex) => {
    setRows((current) =>
      current.map((row, currentRowIndex) =>
        currentRowIndex === rowIndex
          ? {
              ...row,
              partySplits: row.partySplits.filter(
                (_, currentPartyIndex) => currentPartyIndex !== partyIndex,
              ),
            }
          : row,
      ),
    );
  };

  const payloadLines = () =>
    rows
      .filter(
        (row) =>
          Number(row.debit || 0) > 0 || Number(row.credit || 0) > 0,
      )
      .map((row) => ({
        account: row.account._id,
        debit: Number(row.debit || 0),
        credit: Number(row.credit || 0),
        description: row.description,
        partySplits: row.partySplits.map((party) => ({
          ...party,
          debit: Number(party.debit || 0),
          credit: Number(party.credit || 0),
        })),
      }));

  const validateDraft = () => {
    if (!fiscalYear) {
      toast.error("Create and select a fiscal year first");
      return false;
    }

    if (!date) {
      toast.error("Select an opening date first");
      return false;
    }

    if (!payloadLines().length) {
      toast.error("Enter at least one opening balance");
      return false;
    }

    return true;
  };

  const saveDraft = async ({ notify = true, reload = true } = {}) => {
    if (!validateDraft()) return null;

    const lines = payloadLines();
    setBusy(true);

    try {
      const data = await api("/accounting/opening-balances", {
        method: "POST",
        body: JSON.stringify({
          fiscalYear,
          date,
          memo,
          reference,
          referenceType: record?.referenceType || "manual",
          lines,
        }),
      });

      const savedRecord = data.openingBalance || null;

      if (savedRecord) setRecord(savedRecord);
      if (notify) toast.success("Opening balance saved as draft");
      if (reload) await loadOpening(fiscalYear);

      return savedRecord;
    } catch (error) {
      toast.error(error.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const openPostModal = () => {
    if (!validateDraft()) return;

    if (totals.debit <= 0 || totals.difference !== 0) {
      toast.error("Debit and credit totals must match before posting");
      return;
    }

    setPostModalOpen(true);
  };

  const confirmPost = async () => {
    if (busy) return;

    if (totals.debit <= 0 || totals.difference !== 0) {
      setPostModalOpen(false);
      toast.error("Debit and credit totals must match before posting");
      return;
    }

    const current = await saveDraft({ notify: false, reload: false });

    if (!current?._id) return;

    setBusy(true);

    try {
      await api(`/accounting/opening-balances/${current._id}/post`, {
        method: "PATCH",
        body: "{}",
      });

      setPostModalOpen(false);
      toast.success("Opening balance posted to the General Ledger");
      await loadOpening(fiscalYear);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const carryForward = async () => {
    if (!fiscalYear) {
      toast.error("Select a fiscal year first");
      return;
    }

    setBusy(true);

    try {
      await api(`/accounting/opening-balances/carry-forward/${fiscalYear}`, {
        method: "POST",
        body: "{}",
      });

      toast.success("Prior-year Balance Sheet accounts carried forward");
      await loadOpening(fiscalYear);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const locked = record?.status === "posted";
  const balanced = totals.debit > 0 && totals.difference === 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white px-4 py-6 sm:px-6 lg:px-8">
      <Toaster position="top-right" />

      <div className={`${card} mb-5 p-5`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
              <FiArchive className="h-6 w-6" />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">
                Step 4 · Accounting Setup
              </p>
              <h1 className="text-2xl font-black text-gray-950">
                Opening Balance
              </h1>
              <p className="mt-1 text-sm font-semibold text-gray-500">
                Draft, review, then post starting balances for one fiscal year.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-black uppercase ${
                locked
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {record?.status || "NEW DRAFT"}
            </span>

            <button
              type="button"
              className={`${button} border border-gray-200 bg-white text-gray-800 hover:bg-gray-50`}
              onClick={carryForward}
              disabled={locked || busy}
            >
              <FiRefreshCcw className={busy ? "animate-spin" : ""} />
              Carry Forward
            </button>
          </div>
        </div>
      </div>

      <div
        className={`${card} mb-5 grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-4`}
      >
        <label>
          <span className="mb-1.5 block text-sm font-extrabold text-gray-800">
            Fiscal Year
          </span>
          <select
            className={input}
            value={fiscalYear}
            disabled={busy}
            onChange={(event) => {
              const id = event.target.value;
              setFiscalYear(id);
              loadOpening(
                id,
                accounts,
                years.find((fiscalYearItem) => fiscalYearItem._id === id),
              );
            }}
          >
            <option value="">Select fiscal year</option>
            {years.map((fiscalYearItem) => (
              <option key={fiscalYearItem._id} value={fiscalYearItem._id}>
                {fiscalYearItem.name} · {fiscalYearItem.status}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1.5 block text-sm font-extrabold text-gray-800">
            Opening Date
          </span>
          <input
            className={input}
            type="date"
            value={date}
            disabled={locked || busy}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>

        <label>
          <span className="mb-1.5 block text-sm font-extrabold text-gray-800">
            Reference
          </span>
          <input
            className={input}
            value={reference}
            disabled={locked || busy}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Previous trial balance"
          />
        </label>

        <label>
          <span className="mb-1.5 block text-sm font-extrabold text-gray-800">
            Memo
          </span>
          <input
            className={input}
            value={memo}
            disabled={locked || busy}
            onChange={(event) => setMemo(event.target.value)}
          />
        </label>
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="border-b border-gray-100 p-5">
          <h2 className="font-black text-gray-950">Leaf Account Balances</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-gray-500">
            AR/AP control accounts require customer or supplier breakdowns
            matching the account total. Use Bank Account for the summarized
            opening figure; individual operational bank accounts remain managed
            in Bank Setup.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] divide-y divide-gray-100 text-left">
            <thead className="bg-gray-50 text-xs font-black uppercase tracking-wider text-gray-400">
              <tr>
                <th className="w-12 px-3 py-3" />
                <th className="px-3 py-3">Code</th>
                <th className="px-3 py-3">Account</th>
                <th className="px-3 py-3">Type</th>
                <th className="w-40 px-3 py-3 text-right">Debit</th>
                <th className="w-40 px-3 py-3 text-right">Credit</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {rows.map((row, index) => (
                <Fragment key={row.account._id}>
                  <tr
                    className={
                      Number(row.debit || row.credit)
                        ? "bg-indigo-50/20"
                        : "bg-white"
                    }
                  >
                    <td className="px-3 py-3">
                      {row.account.isControlAccount &&
                      ["receivable", "payable"].includes(
                        row.account.controlType,
                      ) ? (
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((previous) => ({
                              ...previous,
                              [row.account._id]: !previous[row.account._id],
                            }))
                          }
                          className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
                          aria-label={
                            expanded[row.account._id]
                              ? "Collapse party breakdown"
                              : "Expand party breakdown"
                          }
                        >
                          {expanded[row.account._id] ? (
                            <FiChevronDown />
                          ) : (
                            <FiChevronRight />
                          )}
                        </button>
                      ) : null}
                    </td>

                    <td className="px-3 py-3 text-sm font-black text-gray-900">
                      {row.account.code}
                    </td>

                    <td className="px-3 py-3">
                      <span className="text-sm font-bold text-gray-900">
                        {row.account.name}
                      </span>

                      {row.account.isControlAccount ? (
                        <span className="ml-2 rounded bg-violet-50 px-2 py-0.5 text-[10px] font-black uppercase text-violet-700">
                          {row.account.controlType}
                        </span>
                      ) : null}
                    </td>

                    <td className="px-3 py-3 text-sm font-semibold capitalize text-gray-600">
                      {row.account.type === "revenue"
                        ? "Income"
                        : row.account.type}
                    </td>

                    <td className="px-3 py-3">
                      <input
                        className={`${input} text-right`}
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={locked || busy}
                        value={row.debit}
                        onChange={(event) =>
                          update(index, "debit", event.target.value)
                        }
                      />
                    </td>

                    <td className="px-3 py-3">
                      <input
                        className={`${input} text-right`}
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={locked || busy}
                        value={row.credit}
                        onChange={(event) =>
                          update(index, "credit", event.target.value)
                        }
                      />
                    </td>
                  </tr>

                  {expanded[row.account._id] ? (
                    <tr>
                      <td colSpan="6" className="bg-gray-50 px-5 py-4 sm:px-12">
                        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-black text-gray-900">
                              {row.account.controlType === "payable"
                                ? "Supplier"
                                : "Customer"}{" "}
                              breakdown
                            </p>
                            <p className="text-xs font-semibold text-gray-500">
                              The split totals must equal this control account.
                            </p>
                          </div>

                          <button
                            type="button"
                            className={`${button} border border-gray-200 bg-white text-gray-800 hover:bg-gray-50`}
                            disabled={locked || busy}
                            onClick={() => addParty(index)}
                          >
                            <FiPlus />
                            Add Party
                          </button>
                        </div>

                        <div className="space-y-2">
                          {row.partySplits.map((party, partyIndex) => (
                            <div
                              key={partyIndex}
                              className="grid gap-2 lg:grid-cols-[160px_minmax(220px,1fr)_150px_150px_44px]"
                            >
                              <select
                                className={input}
                                disabled={locked || busy}
                                value={party.partyType}
                                onChange={(event) =>
                                  updateParty(
                                    index,
                                    partyIndex,
                                    "partyType",
                                    event.target.value,
                                  )
                                }
                              >
                                <option value="customer">Customer</option>
                                <option value="supplier">Supplier</option>
                                <option value="other">Other</option>
                              </select>

                              <input
                                className={input}
                                disabled={locked || busy}
                                value={party.partyName}
                                onChange={(event) =>
                                  updateParty(
                                    index,
                                    partyIndex,
                                    "partyName",
                                    event.target.value,
                                  )
                                }
                                placeholder="Party name"
                              />

                              <input
                                className={`${input} text-right`}
                                disabled={locked || busy}
                                type="number"
                                min="0"
                                step="0.01"
                                value={party.debit}
                                onChange={(event) =>
                                  updateParty(
                                    index,
                                    partyIndex,
                                    "debit",
                                    event.target.value,
                                  )
                                }
                                placeholder="Debit"
                              />

                              <input
                                className={`${input} text-right`}
                                disabled={locked || busy}
                                type="number"
                                min="0"
                                step="0.01"
                                value={party.credit}
                                onChange={(event) =>
                                  updateParty(
                                    index,
                                    partyIndex,
                                    "credit",
                                    event.target.value,
                                  )
                                }
                                placeholder="Credit"
                              />

                              <button
                                type="button"
                                disabled={locked || busy}
                                onClick={() => removeParty(index, partyIndex)}
                                className="flex h-10 w-10 items-center justify-center rounded-xl text-rose-600 transition hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Remove party"
                              >
                                <FiTrash2 />
                              </button>
                            </div>
                          ))}

                          {!row.partySplits.length ? (
                            <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
                              No party breakdown added yet.
                            </p>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>

            <tfoot className="bg-gray-50">
              <tr>
                <td
                  colSpan="4"
                  className="px-5 py-4 text-right text-sm font-black text-gray-700"
                >
                  TOTAL
                </td>
                <td className="px-3 py-4 text-right text-base font-black text-gray-950">
                  {totals.debit.toLocaleString()}
                </td>
                <td className="px-3 py-4 text-right text-base font-black text-gray-950">
                  {totals.credit.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div
            className={`rounded-xl px-4 py-2 text-sm font-black ${
              balanced
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            }`}
          >
            {balanced
              ? "Balanced and ready for review/posting"
              : `Difference: ${Math.abs(totals.difference).toLocaleString()} ${
                  totals.difference > 0 ? "credit required" : "debit required"
                }`}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className={`${button} border border-gray-200 bg-white text-gray-800 hover:bg-gray-50`}
              disabled={locked || busy}
              onClick={() => saveDraft()}
            >
              <FiSave />
              Save Draft
            </button>

            <button
              type="button"
              className={`${button} bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700`}
              disabled={locked || busy || !balanced}
              onClick={openPostModal}
            >
              <FiSend />
              Review & Post
            </button>
          </div>
        </div>
      </div>

      <ConfirmPostModal
        open={postModalOpen}
        busy={busy}
        fiscalYearName={selectedFiscalYear?.name}
        date={date}
        reference={reference}
        memo={memo}
        lineCount={enteredLineCount}
        totals={totals}
        onClose={() => {
          if (!busy) setPostModalOpen(false);
        }}
        onConfirm={confirmPost}
      />
    </div>
  );
}
