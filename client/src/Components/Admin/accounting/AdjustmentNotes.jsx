"use client";
/* eslint-disable react/prop-types -- internal helper components receive server-defined document shapes */

import { useCallback, useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  FiAlertCircle,
  FiArrowDownRight,
  FiArrowUpRight,
  FiCheckCircle,
  FiDownload,
  FiFileText,
  FiPlus,
  FiRefreshCcw,
  FiSearch,
  FiX,
} from "react-icons/fi";
import { hasPermission, PERMISSIONS } from "../../Auth/permissions";

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;
const card = "rounded-2xl border border-slate-100 bg-white shadow-[0_16px_40px_-30px_rgba(15,23,42,.5)]";
const button = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50";
const input = "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10";
const today = () => new Date().toISOString().slice(0, 10);
const headers = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};
const api = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || "Request failed");
  return data;
};
const amount = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const dateText = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      })
    : "-";
const userFromStorage = () => {
  try {
    const stored = JSON.parse(localStorage.getItem("user") || "null");
    return stored?.user || stored;
  } catch {
    return null;
  }
};
const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

function Metric({ label, value, detail, icon, tone = "indigo" }) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-700",
    rose: "bg-rose-50 text-rose-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <article className={`${card} p-5`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
        </div>
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tones[tone]}`}>{icon}</span>
      </div>
      <p className="mt-2 text-xs font-bold text-slate-500">{detail}</p>
    </article>
  );
}

function Modal({ title, subtitle, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section className={`${card} max-h-[92vh] w-full max-w-4xl overflow-auto p-5 sm:p-6`}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-950">{title}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p>
          </div>
          <button className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" onClick={onClose}>
            <FiX />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="text-sm font-black text-slate-800">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

const blankNote = () => ({
  noteType: "credit_note",
  sourceSide: "sales",
  originalDocumentType: "SalesInvoice",
  originalDocumentId: "",
  postingDate: today(),
  reasonCode: "sales_return",
  reason: "",
  subtotal: "",
  taxAmount: "0",
  post: true,
});

export default function AdjustmentNotes() {
  const user = useMemo(userFromStorage, []);
  const canManage =
    hasPermission(user, PERMISSIONS.FINANCE_MANAGE) ||
    hasPermission(user, PERMISSIONS.CREDIT_NOTE_MANAGE);

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedNote, setSelectedNote] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [formData, setFormData] = useState(blankNote);
  const [availableDocuments, setAvailableDocuments] = useState([]);
  const [selectedDocEligibility, setSelectedDocEligibility] = useState(null);
  const [cancelModalNote, setCancelModalNote] = useState(null);
  const [cancelReason, setCancelReason] = useState("");

  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search.trim()) params.set("q", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (tab === "sales_credit") {
        params.set("sourceSide", "sales");
        params.set("noteType", "credit_note");
      } else if (tab === "sales_debit") {
        params.set("sourceSide", "sales");
        params.set("noteType", "debit_note");
      } else if (tab === "purchase_credit") {
        params.set("sourceSide", "purchase");
        params.set("noteType", "credit_note");
      } else if (tab === "purchase_debit") {
        params.set("sourceSide", "purchase");
        params.set("noteType", "debit_note");
      }

      const res = await api(`/accounting/adjustment-notes?${params}`);
      setNotes(res.notes || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, tab]);

  useEffect(() => {
    const timer = setTimeout(loadNotes, 200);
    return () => clearTimeout(timer);
  }, [loadNotes]);

  const loadDocumentsForSide = async (docType) => {
    try {
      if (docType === "SalesInvoice") {
        const res = await api("/sales/invoices?limit=50");
        setAvailableDocuments(res.invoices || res.data || []);
      } else {
        const res = await api("/accounting/vendor-bills?limit=50");
        setAvailableDocuments(res.vendorBills || []);
      }
    } catch (e) {
      setAvailableDocuments([]);
    }
  };

  const handleDocChange = async (docId) => {
    setFormData((prev) => ({ ...prev, originalDocumentId: docId }));
    if (!docId) {
      setSelectedDocEligibility(null);
      return;
    }
    try {
      const res = await api(
        `/accounting/adjustment-notes/eligible?documentType=${formData.originalDocumentType}&documentId=${docId}`
      );
      setSelectedDocEligibility(res.eligibility);
      if (res.eligibility) {
        setFormData((prev) => ({
          ...prev,
          subtotal: String(res.eligibility.remainingCreditEligible || res.eligibility.dueAmount || ""),
        }));
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleCreate = async () => {
    if (!formData.originalDocumentId) {
      return toast.error("Please select an original document.");
    }
    const subtotal = Number(formData.subtotal || 0);
    if (subtotal <= 0) {
      return toast.error("Adjustment subtotal must be greater than zero.");
    }
    try {
      await api("/accounting/adjustment-notes", {
        method: "POST",
        body: JSON.stringify({
          ...formData,
          subtotal,
          taxAmount: Number(formData.taxAmount || 0),
        }),
      });
      toast.success(formData.post ? "Adjustment note posted" : "Draft adjustment note created");
      setEditorOpen(false);
      setFormData(blankNote());
      loadNotes();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handlePost = async (id) => {
    try {
      await api(`/accounting/adjustment-notes/${id}/post`, {
        method: "POST",
        body: JSON.stringify({ date: today() }),
      });
      toast.success("Adjustment note posted to ledger");
      loadNotes();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleCancel = async () => {
    if (!cancelModalNote) return;
    try {
      await api(`/accounting/adjustment-notes/${cancelModalNote._id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: cancelReason }),
      });
      toast.success("Adjustment note cancelled & reversed");
      setCancelModalNote(null);
      setCancelReason("");
      loadNotes();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const exportCsv = () => {
    const rows = [
      ["Date", "Note Number", "Type", "Side", "Direction", "Doc Ref", "Party", "Subtotal", "Tax", "Total", "Status"],
      ...notes.map((n) => [
        dateText(n.postingDate),
        n.noteNumber,
        n.noteType,
        n.sourceSide,
        n.financialDirection,
        n.originalDocumentNumber,
        n.partyName || "",
        n.totals?.subtotal || 0,
        n.totals?.taxTotal || 0,
        n.totals?.grandTotal || 0,
        n.status,
      ]),
    ];
    const blob = new Blob([rows.map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `adjustment-notes-${today()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Metrics summary
  const summary = useMemo(() => {
    let salesCredit = 0;
    let salesDebit = 0;
    let purchaseCredit = 0;
    let purchaseDebit = 0;
    for (const n of notes) {
      if (n.status !== "posted") continue;
      const tot = Number(n.totals?.grandTotal || 0);
      if (n.sourceSide === "sales") {
        if (n.noteType === "credit_note") salesCredit += tot;
        else salesDebit += tot;
      } else {
        if (n.noteType === "credit_note") purchaseCredit += tot;
        else purchaseDebit += tot;
      }
    }
    return { salesCredit, salesDebit, purchaseCredit, purchaseDebit };
  }, [notes]);

  const tabs = [
    { key: "all", label: "All Notes" },
    { key: "sales_credit", label: "Sales Credit Notes" },
    { key: "sales_debit", label: "Sales Debit Notes" },
    { key: "purchase_credit", label: "Purchase Credit Notes" },
    { key: "purchase_debit", label: "Purchase Debit Notes" },
  ];

  return (
    <div className="min-h-screen bg-[#f6f7fb] p-4 sm:p-6 lg:p-8">
      <Toaster position="top-right" />
      <header className={`${card} mb-6 p-5 sm:p-6`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-indigo-600">Accounting Sub-Ledger</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">Credit &amp; Debit Notes</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Audit-safe adjustments, AR/AP corrections, returns, and journal reversals.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage && (
              <button
                className={`${button} bg-indigo-600 text-white`}
                onClick={() => {
                  setFormData(blankNote());
                  loadDocumentsForSide("SalesInvoice");
                  setEditorOpen(true);
                }}
              >
                <FiPlus /> New Adjustment Note
              </button>
            )}
            <button className={`${button} border border-slate-200 bg-white`} onClick={loadNotes}>
              <FiRefreshCcw className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <button className={`${button} border border-slate-200 bg-white`} onClick={exportCsv}>
              <FiDownload /> Export CSV
            </button>
          </div>
        </div>

        {/* Tab & Filters */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${
                  tab === t.key ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              className={`${input} h-9 text-xs`}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="posted">Posted</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <label className="relative">
              <FiSearch className="absolute left-3 top-2.5 text-slate-400" />
              <input
                className={`${input} h-9 pl-9 text-xs`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes, doc #, party"
              />
            </label>
          </div>
        </div>
      </header>

      {/* Metrics */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Sales Credit Total"
          value={amount(summary.salesCredit)}
          detail="Total posted AR reductions"
          icon={<FiArrowDownRight />}
          tone="rose"
        />
        <Metric
          label="Sales Debit Total"
          value={amount(summary.salesDebit)}
          detail="Total posted AR additions"
          icon={<FiArrowUpRight />}
          tone="emerald"
        />
        <Metric
          label="Purchase Credit Total"
          value={amount(summary.purchaseCredit)}
          detail="Total posted AP reductions"
          icon={<FiArrowDownRight />}
          tone="indigo"
        />
        <Metric
          label="Purchase Debit Total"
          value={amount(summary.purchaseDebit)}
          detail="Total posted AP additions"
          icon={<FiArrowUpRight />}
          tone="amber"
        />
      </div>

      {/* Adjustment Notes Table */}
      <section className={`${card} overflow-hidden`}>
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-black text-slate-950">Adjustment Register</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4 text-left">Date</th>
                <th className="px-5 py-4 text-left">Note Number</th>
                <th className="px-5 py-4 text-left">Type</th>
                <th className="px-5 py-4 text-left">Source Document</th>
                <th className="px-5 py-4 text-left">Party</th>
                <th className="px-4 py-4 text-right">Subtotal</th>
                <th className="px-4 py-4 text-right">Tax</th>
                <th className="px-4 py-4 text-right">Grand Total</th>
                <th className="px-4 py-4 text-center">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {notes.map((note) => {
                const isCredit = note.noteType === "credit_note";
                const isSales = note.sourceSide === "sales";
                return (
                  <tr key={note._id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4 text-slate-600">{dateText(note.postingDate)}</td>
                    <td className="px-5 py-4 font-black text-slate-950">{note.noteNumber}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${
                          isCredit ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {isCredit ? <FiArrowDownRight /> : <FiArrowUpRight />}
                        {isSales ? (isCredit ? "Sales Credit" : "Sales Debit") : isCredit ? "Purchase Credit" : "Purchase Debit"}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-700">
                      {note.originalDocumentNumber}
                      <span className="ml-1 text-xs text-slate-400">({note.originalDocumentType})</span>
                    </td>
                    <td className="px-5 py-4 text-slate-700">{note.partyName || "-"}</td>
                    <td className="px-4 py-4 text-right text-slate-700">{amount(note.totals?.subtotal)}</td>
                    <td className="px-4 py-4 text-right text-slate-700">{amount(note.totals?.taxTotal)}</td>
                    <td className="px-4 py-4 text-right font-black text-slate-950">{amount(note.totals?.grandTotal)}</td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-black ${
                          note.status === "posted"
                            ? "bg-emerald-50 text-emerald-700"
                            : note.status === "approved"
                            ? "bg-indigo-50 text-indigo-700"
                            : note.status === "cancelled"
                            ? "bg-slate-100 text-slate-500 line-through"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {note.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          className="font-black text-indigo-700 hover:underline"
                          onClick={() => setSelectedNote(note)}
                        >
                          Details
                        </button>
                        {canManage && note.status === "approved" && (
                          <button
                            className="font-black text-emerald-700 hover:underline"
                            onClick={() => handlePost(note._id)}
                          >
                            Post
                          </button>
                        )}
                        {canManage && note.status === "posted" && (
                          <button
                            className="font-black text-rose-600 hover:underline"
                            onClick={() => {
                              setCancelModalNote(note);
                              setCancelReason("");
                            }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!notes.length && (
                <tr>
                  <td colSpan="10" className="py-12 text-center font-bold text-slate-400">
                    No adjustment notes found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Note Details Modal */}
      {selectedNote && (
        <Modal
          title={`${selectedNote.noteType === "credit_note" ? "Credit Note" : "Debit Note"} - ${selectedNote.noteNumber}`}
          subtitle={`Financial Direction: ${selectedNote.financialDirection}`}
          onClose={() => setSelectedNote(null)}
        >
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-400">Original Document</p>
                <p className="mt-1 font-black text-slate-900">{selectedNote.originalDocumentNumber}</p>
                <p className="text-xs text-slate-500">{selectedNote.originalDocumentType}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-400">Party ({selectedNote.partyType})</p>
                <p className="mt-1 font-black text-slate-900">{selectedNote.partyName || "-"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-400">Posting Date</p>
                <p className="mt-1 font-black text-slate-900">{dateText(selectedNote.postingDate)}</p>
                <p className="text-xs text-slate-500">Status: {selectedNote.status}</p>
              </div>
            </div>

            {selectedNote.journalEntryId && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-indigo-700">GL Journal Entry</p>
                    <p className="mt-1 font-black text-slate-900">
                      Voucher #{selectedNote.journalEntryId.entryNo}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
                    Balanced: {amount(selectedNote.journalEntryId.totalDebit)} BDT
                  </span>
                </div>
              </div>
            )}

            {selectedNote.reversalJournalEntryId && (
              <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-rose-700">Reversal Voucher</p>
                <p className="mt-1 font-black text-slate-900">
                  Reversal #{selectedNote.reversalJournalEntryId.entryNo}
                </p>
                <p className="text-xs text-rose-600">Reason: {selectedNote.cancellationReason}</p>
              </div>
            )}

            {/* Line items if any */}
            {selectedNote.lines?.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-xs font-black text-slate-500">
                    <tr>
                      <th className="p-3 text-left">Item / Description</th>
                      <th className="p-3 text-right">Qty</th>
                      <th className="p-3 text-right">Adjustment Amount</th>
                      <th className="p-3 text-right">Tax Rate</th>
                      <th className="p-3 text-right">Tax Amount</th>
                      <th className="p-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedNote.lines.map((l, i) => (
                      <tr key={i}>
                        <td className="p-3 font-bold text-slate-900">
                          {l.productName || l.description || "Line Item"}
                        </td>
                        <td className="p-3 text-right">{l.quantity}</td>
                        <td className="p-3 text-right">{amount(l.adjustmentAmount)}</td>
                        <td className="p-3 text-right">{l.taxRate}%</td>
                        <td className="p-3 text-right">{amount(l.taxAmount)}</td>
                        <td className="p-3 text-right font-black">{amount(l.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-6 text-sm font-black">
              <div>Subtotal: {amount(selectedNote.totals?.subtotal)}</div>
              <div>Tax: {amount(selectedNote.totals?.taxTotal)}</div>
              <div className="text-indigo-700">Grand Total: {amount(selectedNote.totals?.grandTotal)} BDT</div>
            </div>
          </div>
        </Modal>
      )}

      {/* New Adjustment Note Modal */}
      {editorOpen && (
        <Modal
          title="Create Adjustment Note"
          subtitle="Reference a posted invoice or vendor bill to issue an auditable credit or debit adjustment."
          onClose={() => setEditorOpen(false)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Note Type">
              <select
                className={`${input} w-full`}
                value={formData.noteType}
                onChange={(e) => setFormData({ ...formData, noteType: e.target.value })}
              >
                <option value="credit_note">Credit Note (Reduces Due)</option>
                <option value="debit_note">Debit Note (Additional Charge)</option>
              </select>
            </Field>

            <Field label="Source Side">
              <select
                className={`${input} w-full`}
                value={formData.originalDocumentType}
                onChange={(e) => {
                  const docType = e.target.value;
                  const side = docType === "SalesInvoice" ? "sales" : "purchase";
                  setFormData({
                    ...formData,
                    originalDocumentType: docType,
                    sourceSide: side,
                    originalDocumentId: "",
                  });
                  loadDocumentsForSide(docType);
                }}
              >
                <option value="SalesInvoice">Sales (Sales Invoice)</option>
                <option value="VendorBill">Purchase (Vendor Bill)</option>
              </select>
            </Field>

            <Field label="Original Document">
              <select
                className={`${input} w-full`}
                value={formData.originalDocumentId}
                onChange={(e) => handleDocChange(e.target.value)}
              >
                <option value="">Select Document</option>
                {availableDocuments.map((doc) => (
                  <option key={doc._id} value={doc._id}>
                    {doc.invoiceNumber || doc.billNo} - {doc.customerName || doc.vendorName} (Total: {amount(doc.totals?.grandTotal || doc.total)})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Posting Date">
              <input
                className={`${input} w-full`}
                type="date"
                value={formData.postingDate}
                onChange={(e) => setFormData({ ...formData, postingDate: e.target.value })}
              />
            </Field>

            {selectedDocEligibility && (
              <div className="sm:col-span-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs font-bold text-indigo-900">
                <p>Original Total: {amount(selectedDocEligibility.originalTotal)} BDT</p>
                <p>Remaining Eligible Credit: {amount(selectedDocEligibility.remainingCreditEligible)} BDT</p>
                <p>Current Outstanding Due: {amount(selectedDocEligibility.dueAmount)} BDT</p>
              </div>
            )}

            <Field label="Adjustment Reason Code">
              <select
                className={`${input} w-full`}
                value={formData.reasonCode}
                onChange={(e) => setFormData({ ...formData, reasonCode: e.target.value })}
              >
                <option value="sales_return">Sales Return</option>
                <option value="purchase_return">Purchase Return</option>
                <option value="price_correction">Price Correction</option>
                <option value="overbilling">Overbilling</option>
                <option value="underbilling">Underbilling</option>
                <option value="discount">Commercial Discount</option>
                <option value="damaged_goods">Damaged Goods</option>
                <option value="service_adjustment">Service Adjustment</option>
                <option value="tax_correction">Tax Correction</option>
                <option value="other">Other</option>
              </select>
            </Field>

            <Field label="Adjustment Subtotal (Net)">
              <input
                className={`${input} w-full`}
                type="number"
                min="0.01"
                step="0.01"
                value={formData.subtotal}
                onChange={(e) => setFormData({ ...formData, subtotal: e.target.value })}
              />
            </Field>

            <Field label="Tax Amount">
              <input
                className={`${input} w-full`}
                type="number"
                min="0"
                step="0.01"
                value={formData.taxAmount}
                onChange={(e) => setFormData({ ...formData, taxAmount: e.target.value })}
              />
            </Field>

            <Field label="Total Amount">
              <input
                className={`${input} w-full bg-slate-50`}
                readOnly
                value={amount(Number(formData.subtotal || 0) + Number(formData.taxAmount || 0))}
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Explanation / Notes">
                <input
                  className={`${input} w-full`}
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Explain the commercial reason for this adjustment..."
                />
              </Field>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
            <label className="flex items-center gap-2 text-sm font-black text-slate-800">
              <input
                type="checkbox"
                checked={formData.post}
                onChange={(e) => setFormData({ ...formData, post: e.target.checked })}
              />
              Post immediately to ledger
            </label>
            <button className={`${button} bg-indigo-600 text-white`} onClick={handleCreate}>
              Save Adjustment Note
            </button>
          </div>
        </Modal>
      )}

      {/* Cancellation / Reversal Modal */}
      {cancelModalNote && (
        <Modal
          title={`Cancel Note - ${cancelModalNote.noteNumber}`}
          subtitle="This will post an accounting reversal voucher to restore the source invoice/bill balance."
          onClose={() => setCancelModalNote(null)}
        >
          <div className="space-y-4">
            <Field label="Cancellation Reason (Required)">
              <input
                className={`${input} w-full`}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancelling this posted adjustment..."
              />
            </Field>
            <div className="flex justify-end gap-2">
              <button
                className={`${button} border border-slate-200 bg-white`}
                onClick={() => setCancelModalNote(null)}
              >
                Dismiss
              </button>
              <button
                className={`${button} bg-rose-600 text-white`}
                disabled={!cancelReason.trim()}
                onClick={handleCancel}
              >
                Confirm Reversal &amp; Cancellation
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
