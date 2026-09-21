"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  FiAlertCircle,
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiEdit2,
  FiEye,
  FiPercent,
  FiPlus,
  FiPower,
  FiRefreshCcw,
  FiSearch,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { hasPermission, PERMISSIONS } from "../../Auth/permissions";

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;
const card = "rounded-2xl border border-slate-100 bg-white shadow-[0_16px_40px_-30px_rgba(15,23,42,.5)]";
const button = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50";
const input = "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10 disabled:bg-slate-50 disabled:text-slate-400";
const select = "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10";

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

const amountFormat = (val) =>
  Number(val || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const CALC_TYPES = [
  { value: "PERCENTAGE", label: "Percentage (%)" },
  { value: "FIXED_AMOUNT", label: "Fixed Amount (BDT)" },
  { value: "REMAINING_BALANCE", label: "Remaining Balance" },
];

const DUE_RULES = [
  { value: "IMMEDIATE", label: "Due Immediately" },
  { value: "DAYS_AFTER_INVOICE", label: "Days after Invoice" },
  { value: "DAYS_AFTER_BILL", label: "Days after Bill" },
  { value: "DAYS_AFTER_DELIVERY", label: "Days after Delivery" },
  { value: "END_OF_MONTH", label: "End of Month" },
  { value: "FIXED_DAY_NEXT_MONTH", label: "Fixed Day Next Month" },
  { value: "FIXED_DATE", label: "Fixed Calendar Date" },
  { value: "MILESTONE", label: "Milestone-based" },
];

const EMPTY_RULE = {
  sequence: 1,
  calculationType: "PERCENTAGE",
  value: 100,
  dueRule: "DAYS_AFTER_INVOICE",
  days: 30,
  fixedDay: 15,
  fixedDate: "",
  description: "",
};

const EMPTY_TERM = {
  name: "",
  code: "",
  description: "",
  gracePeriodDays: 0,
  discountPercentage: 0,
  discountDays: 0,
  rules: [{ ...EMPTY_RULE }],
};

export default function PaymentTerms() {
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_TERM);
  const [saving, setSaving] = useState(false);

  // Preview / Simulator modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewTerm, setPreviewTerm] = useState(null);
  const [previewAmount, setPreviewAmount] = useState(100000);
  const [previewDate, setPreviewDate] = useState(new Date().toISOString().slice(0, 10));
  const [simulatedSchedule, setSimulatedSchedule] = useState([]);
  const [simulating, setSimulating] = useState(false);

  const canManage = hasPermission(PERMISSIONS.PAYMENT_TERM_MANAGE) || hasPermission(PERMISSIONS.FINANCE_MANAGE);

  const loadTerms = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api("/accounting/payment-terms");
      setTerms(data.terms || []);
    } catch (err) {
      toast.error(err.message || "Failed to load payment terms");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTerms();
  }, [loadTerms]);

  const filteredTerms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return terms.filter((term) => {
      const matchesSearch =
        !q ||
        term.name.toLowerCase().includes(q) ||
        term.code.toLowerCase().includes(q) ||
        (term.description || "").toLowerCase().includes(q);
      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "standard" && term.isPredefined) ||
        (typeFilter === "custom" && !term.isPredefined);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && term.isActive) ||
        (statusFilter === "inactive" && !term.isActive);
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [terms, search, typeFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = terms.length;
    const active = terms.filter((t) => t.isActive).length;
    const standard = terms.filter((t) => t.isPredefined).length;
    const custom = terms.filter((t) => !t.isPredefined).length;
    return { total, active, standard, custom };
  }, [terms]);

  const handleToggleActive = async (term) => {
    if (!canManage) {
      toast.error("You do not have permission to manage payment terms");
      return;
    }
    try {
      await api(`/accounting/payment-terms/${term._id}/toggle-active`, { method: "PATCH" });
      toast.success(`${term.name} is now ${term.isActive ? "inactive" : "active"}`);
      loadTerms();
    } catch (err) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      ...EMPTY_TERM,
      rules: [{ ...EMPTY_RULE, sequence: 1 }],
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (term) => {
    setEditingId(term._id);
    setFormData({
      name: term.name,
      code: term.code,
      description: term.description || "",
      gracePeriodDays: term.gracePeriodDays || 0,
      discountPercentage: term.discountPercentage || 0,
      discountDays: term.discountDays || 0,
      rules: (term.rules || []).map((r, i) => ({
        sequence: r.sequence || i + 1,
        calculationType: r.calculationType || "PERCENTAGE",
        value: r.value ?? 100,
        dueRule: r.dueRule || "DAYS_AFTER_INVOICE",
        days: r.days ?? 30,
        fixedDay: r.fixedDay ?? 15,
        fixedDate: r.fixedDate ? new Date(r.fixedDate).toISOString().slice(0, 10) : "",
        description: r.description || "",
      })),
    });
    setModalOpen(true);
  };

  const handleAddRule = () => {
    setFormData((prev) => ({
      ...prev,
      rules: [
        ...prev.rules,
        {
          ...EMPTY_RULE,
          sequence: prev.rules.length + 1,
          value: 0,
        },
      ],
    }));
  };

  const handleRemoveRule = (index) => {
    setFormData((prev) => {
      const next = prev.rules.filter((_, i) => i !== index);
      return {
        ...prev,
        rules: next.map((r, i) => ({ ...r, sequence: i + 1 })),
      };
    });
  };

  const handleRuleChange = (index, field, value) => {
    setFormData((prev) => {
      const next = [...prev.rules];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, rules: next };
    });
  };

  const rulesSumPercentage = useMemo(() => {
    return formData.rules.reduce((sum, r) => {
      if (r.calculationType === "PERCENTAGE") return sum + (Number(r.value) || 0);
      return sum;
    }, 0);
  }, [formData.rules]);

  const hasRemainingRule = useMemo(() => {
    return formData.rules.some((r) => r.calculationType === "REMAINING_BALANCE");
  }, [formData.rules]);

  const isRulesValid = useMemo(() => {
    if (formData.rules.length === 0) return false;
    if (hasRemainingRule) return true;
    return Math.abs(rulesSumPercentage - 100) < 0.001;
  }, [formData.rules, hasRemainingRule, rulesSumPercentage]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      toast.error("Name and code are required");
      return;
    }
    if (!isRulesValid) {
      toast.error("Installment percentages must sum to 100% or end with a Remaining Balance rule");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await api(`/accounting/payment-terms/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(formData),
        });
        toast.success("Payment term updated successfully");
      } else {
        await api("/accounting/payment-terms", {
          method: "POST",
          body: JSON.stringify(formData),
        });
        toast.success("Payment term created successfully");
      }
      setModalOpen(false);
      loadTerms();
    } catch (err) {
      toast.error(err.message || "Failed to save payment term");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenSimulator = async (term) => {
    setPreviewTerm(term);
    setPreviewAmount(100000);
    setPreviewDate(new Date().toISOString().slice(0, 10));
    setPreviewModalOpen(true);
    runSimulation(term._id, 100000, new Date().toISOString().slice(0, 10));
  };

  const runSimulation = async (termId, amount, date) => {
    setSimulating(true);
    try {
      const res = await api("/accounting/payment-terms/preview-schedule", {
        method: "POST",
        body: JSON.stringify({
          paymentTermId: termId,
          totalAmount: Number(amount),
          baseDate: date,
        }),
      });
      setSimulatedSchedule(res.schedule || []);
    } catch (err) {
      toast.error(err.message || "Failed to simulate schedule");
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8 space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Payment Terms</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Configure standard, customized, and milestone-based payment terms with automatic schedule generation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadTerms}
            disabled={loading}
            className={`${button} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
            title="Refresh"
          >
            <FiRefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {canManage && (
            <button
              onClick={handleOpenCreate}
              className={`${button} bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700`}
            >
              <FiPlus className="h-4 w-4" />
              New Payment Term
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className={`${card} p-4 sm:p-5`}>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Terms</div>
          <div className="mt-2 text-2xl font-black text-slate-900">{stats.total}</div>
        </div>
        <div className={`${card} p-4 sm:p-5`}>
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-600">Active Terms</div>
          <div className="mt-2 text-2xl font-black text-emerald-700">{stats.active}</div>
        </div>
        <div className={`${card} p-4 sm:p-5`}>
          <div className="text-xs font-bold uppercase tracking-wider text-indigo-600">Predefined Standard</div>
          <div className="mt-2 text-2xl font-black text-indigo-700">{stats.standard}</div>
        </div>
        <div className={`${card} p-4 sm:p-5`}>
          <div className="text-xs font-bold uppercase tracking-wider text-purple-600">Custom Terms</div>
          <div className="mt-2 text-2xl font-black text-purple-700">{stats.custom}</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className={`${card} p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by term name, code, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${input} w-full pl-10`}
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={select}
          >
            <option value="all">All Types</option>
            <option value="standard">Standard (Predefined)</option>
            <option value="custom">Custom</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={select}
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Terms Table */}
      <div className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50/75 text-xs font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Term Name & Code</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5">Installments / Rules</th>
                <th className="px-5 py-3.5">Grace / Discount</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <FiRefreshCcw className="mx-auto mb-2 h-6 w-6 animate-spin" />
                    Loading payment terms...
                  </td>
                </tr>
              ) : filteredTerms.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No payment terms found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredTerms.map((term) => (
                  <tr key={term._id} className="hover:bg-slate-50/50 transition">
                    <td className="px-5 py-4">
                      <div className="font-black text-slate-900">{term.name}</div>
                      <div className="text-xs font-bold text-slate-400">{term.code}</div>
                      {term.description && (
                        <div className="mt-0.5 text-xs text-slate-500">{term.description}</div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {term.isPredefined ? (
                        <span className="inline-flex items-center rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700">
                          Predefined
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-lg bg-purple-50 px-2.5 py-1 text-xs font-black text-purple-700">
                          Custom
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        {term.rules?.map((r, i) => (
                          <div key={i} className="text-xs text-slate-700 flex items-center gap-1.5">
                            <span className="font-black text-slate-900">
                              #{r.sequence || i + 1}:
                            </span>
                            <span>
                              {r.calculationType === "PERCENTAGE"
                                ? `${r.value}%`
                                : r.calculationType === "FIXED_AMOUNT"
                                ? `${amountFormat(r.value)} BDT`
                                : "Balance"}
                            </span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-500">
                              {r.dueRule === "IMMEDIATE"
                                ? "Due Immediately"
                                : r.dueRule === "DAYS_AFTER_INVOICE"
                                ? `Net ${r.days}d`
                                : r.dueRule === "END_OF_MONTH"
                                ? "End of Month"
                                : r.dueRule === "FIXED_DAY_NEXT_MONTH"
                                ? `${r.fixedDay || 15}th Next Month`
                                : r.dueRule}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {term.gracePeriodDays > 0 && (
                        <div className="text-slate-600">
                          Grace: <span className="font-bold text-slate-900">{term.gracePeriodDays} days</span>
                        </div>
                      )}
                      {term.discountPercentage > 0 && (
                        <div className="text-emerald-600 font-bold">
                          {term.discountPercentage}% if paid in {term.discountDays}d
                        </div>
                      )}
                      {!term.gracePeriodDays && !term.discountPercentage && (
                        <span className="text-slate-400">None</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {term.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                          <FiCheck className="h-3 w-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenSimulator(term)}
                          className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50 transition"
                          title="Simulate Schedule"
                        >
                          <FiCalendar className="h-4 w-4" />
                        </button>
                        {!term.isPredefined && canManage && (
                          <button
                            onClick={() => handleOpenEdit(term)}
                            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 transition"
                            title="Edit"
                          >
                            <FiEdit2 className="h-4 w-4" />
                          </button>
                        )}
                        {canManage && (
                          <button
                            onClick={() => handleToggleActive(term)}
                            className={`rounded-lg p-2 transition ${
                              term.isActive
                                ? "text-amber-600 hover:bg-amber-50"
                                : "text-emerald-600 hover:bg-emerald-50"
                            }`}
                            title={term.isActive ? "Deactivate" : "Activate"}
                          >
                            <FiPower className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create / Edit Payment Term */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className={`${card} w-full max-w-3xl my-8 max-h-[90vh] flex flex-col`}>
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {editingId ? "Edit Payment Term" : "Create Custom Payment Term"}
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  Define rule installments, calculation methods, and due date offsets
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Basic Fields */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                    Term Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 50% Advance, 50% Net 30"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={`${input} w-full`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                    Term Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 50_ADV_50_NET30"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, "_") })}
                    className={`${input} w-full`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Optional brief description for internal reference"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={`${input} w-full`}
                />
              </div>

              {/* Grace & Discount */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                    Grace Period (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.gracePeriodDays}
                    onChange={(e) => setFormData({ ...formData, gracePeriodDays: Number(e.target.value) })}
                    className={`${input} w-full`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                    Early Discount %
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.discountPercentage}
                    onChange={(e) => setFormData({ ...formData, discountPercentage: Number(e.target.value) })}
                    className={`${input} w-full`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                    Discount Within (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.discountDays}
                    onChange={(e) => setFormData({ ...formData, discountDays: Number(e.target.value) })}
                    className={`${input} w-full`}
                  />
                </div>
              </div>

              {/* Installment Rule Builder */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black text-slate-900">Installment Schedule Rules</h4>
                    <p className="text-xs font-semibold text-slate-500">
                      Installments must total 100% or conclude with a Remaining Balance rule
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddRule}
                    className={`${button} border border-slate-200 bg-white py-1.5 px-3 text-xs text-indigo-600 hover:bg-indigo-50`}
                  >
                    <FiPlus className="h-3.5 w-3.5" /> Add Rule
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.rules.map((rule, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-xs font-black text-slate-900">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[11px] text-indigo-700">
                            {idx + 1}
                          </span>
                          Installment #{idx + 1}
                        </span>
                        {formData.rules.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRule(idx)}
                            className="text-slate-400 hover:text-rose-600 transition"
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">
                            Calculation
                          </label>
                          <select
                            value={rule.calculationType}
                            onChange={(e) => handleRuleChange(idx, "calculationType", e.target.value)}
                            className={`${select} w-full text-xs h-9`}
                          >
                            {CALC_TYPES.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {rule.calculationType !== "REMAINING_BALANCE" && (
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">
                              {rule.calculationType === "PERCENTAGE" ? "Value (%)" : "Amount (BDT)"}
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={rule.calculationType === "PERCENTAGE" ? 100 : undefined}
                              step={rule.calculationType === "PERCENTAGE" ? "0.1" : "1"}
                              value={rule.value}
                              onChange={(e) => handleRuleChange(idx, "value", Number(e.target.value))}
                              className={`${input} w-full text-xs h-9`}
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">
                            Due Rule
                          </label>
                          <select
                            value={rule.dueRule}
                            onChange={(e) => handleRuleChange(idx, "dueRule", e.target.value)}
                            className={`${select} w-full text-xs h-9`}
                          >
                            {DUE_RULES.map((d) => (
                              <option key={d.value} value={d.value}>
                                {d.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {["DAYS_AFTER_INVOICE", "DAYS_AFTER_BILL", "DAYS_AFTER_DELIVERY", "MILESTONE"].includes(
                          rule.dueRule
                        ) && (
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">
                              Days Offset
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={rule.days}
                              onChange={(e) => handleRuleChange(idx, "days", Number(e.target.value))}
                              className={`${input} w-full text-xs h-9`}
                            />
                          </div>
                        )}

                        {rule.dueRule === "FIXED_DAY_NEXT_MONTH" && (
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">
                              Day of Next Month
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="31"
                              value={rule.fixedDay || 15}
                              onChange={(e) => handleRuleChange(idx, "fixedDay", Number(e.target.value))}
                              className={`${input} w-full text-xs h-9`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Validation Status Box */}
                <div
                  className={`p-3 rounded-xl flex items-center justify-between text-xs font-black ${
                    isRulesValid
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-amber-50 text-amber-800 border border-amber-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isRulesValid ? (
                      <FiCheckCircle className="h-4 w-4" />
                    ) : (
                      <FiAlertCircle className="h-4 w-4" />
                    )}
                    <span>
                      {hasRemainingRule
                        ? "Valid schedule: ends with Remaining Balance"
                        : `Total Percentage: ${rulesSumPercentage.toFixed(1)}% ${
                            isRulesValid ? "(Valid 100%)" : "(Must equal 100%)"
                          }`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className={`${button} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !isRulesValid}
                  className={`${button} bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700`}
                >
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Create Term"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Simulator Modal */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className={`${card} w-full max-w-2xl my-8 flex flex-col`}>
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Payment Schedule Simulator: {previewTerm?.name}
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  Simulate deterministic installment dates, amounts, and rounding absorption
                </p>
              </div>
              <button
                onClick={() => setPreviewModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Simulator Parameters */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                    Sample Grand Total (BDT)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={previewAmount}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPreviewAmount(val);
                      runSimulation(previewTerm._id, val, previewDate);
                    }}
                    className={`${input} w-full`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                    Base Invoice / Bill Date
                  </label>
                  <input
                    type="date"
                    value={previewDate}
                    onChange={(e) => {
                      setPreviewDate(e.target.value);
                      runSimulation(previewTerm._id, previewAmount, e.target.value);
                    }}
                    className={`${input} w-full`}
                  />
                </div>
              </div>

              {/* Resulting Schedule Table */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                  Generated Installments ({simulatedSchedule.length})
                </h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs font-semibold text-slate-600">
                    <thead className="border-b border-slate-200 bg-slate-100/75 text-[11px] font-black uppercase tracking-wider text-slate-700">
                      <tr>
                        <th className="px-4 py-2.5">#</th>
                        <th className="px-4 py-2.5">Due Date</th>
                        <th className="px-4 py-2.5">Description</th>
                        <th className="px-4 py-2.5 text-right">Amount (BDT)</th>
                        <th className="px-4 py-2.5 text-right">% Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {simulating ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400">
                            <FiRefreshCcw className="mx-auto mb-1 h-4 w-4 animate-spin" />
                            Calculating schedule...
                          </td>
                        </tr>
                      ) : simulatedSchedule.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400">
                            No schedule generated.
                          </td>
                        </tr>
                      ) : (
                        simulatedSchedule.map((line) => (
                          <tr key={line.sequence} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2.5 font-black text-slate-900">
                              #{line.sequence}
                            </td>
                            <td className="px-4 py-2.5 font-bold text-slate-800">
                              {line.dueDate
                                ? new Date(line.dueDate).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  })
                                : "N/A"}
                            </td>
                            <td className="px-4 py-2.5 text-slate-600">
                              {line.description || "Installment"}
                            </td>
                            <td className="px-4 py-2.5 text-right font-black text-indigo-700">
                              {amountFormat(line.originalAmount || line.amount)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold text-slate-500">
                              {previewAmount > 0
                                ? `${(
                                    ((line.originalAmount || line.amount) / previewAmount) *
                                    100
                                  ).toFixed(1)}%`
                                : "100%"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="border-t border-slate-200 bg-slate-50 font-black text-slate-900">
                      <tr>
                        <td colSpan={3} className="px-4 py-2.5">
                          Total Scheduled
                        </td>
                        <td className="px-4 py-2.5 text-right text-indigo-900">
                          {amountFormat(
                            simulatedSchedule.reduce(
                              (sum, l) => sum + Number(l.originalAmount || l.amount || 0),
                              0
                            )
                          )}{" "}
                          BDT
                        </td>
                        <td className="px-4 py-2.5 text-right text-emerald-700">100.0%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(false)}
                  className={`${button} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
