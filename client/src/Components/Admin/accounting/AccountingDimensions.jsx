"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import toast, { Toaster } from "react-hot-toast";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Delete01Icon,
  Edit02Icon,
  Layers01Icon,
  RefreshIcon,
  SearchIcon,
  Settings01Icon,
  Folder01Icon,
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
const buttonDanger =
  "border border-rose-200 bg-white text-rose-700 hover:border-rose-300 hover:bg-rose-50";

const ALL_ACCOUNT_TYPES = [
  { key: "expense", label: "Expense Accounts" },
  { key: "revenue", label: "Revenue Accounts" },
  { key: "asset", label: "Asset Accounts" },
  { key: "liability", label: "Liability Accounts" },
  { key: "equity", label: "Equity Accounts" },
];

function headers() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data?.message || data?.error || "Request failed");
    error.statusCode = res.status;
    error.code = data?.code;
    throw error;
  }
  return data;
}

export default function AccountingDimensions() {
  const [dimensions, setDimensions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Edit / Config modal
  const [configModal, setConfigModal] = useState({ open: false, dim: null });
  const [form, setForm] = useState({
    name: "",
    code: "",
    sourceType: "custom_values",
    isRequired: false,
    applicableAccountTypes: [],
    description: "",
    isActive: true,
  });
  const [saving, setSaving] = useState(false);

  // Custom dimension creation
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Values Drawer / Modal for custom/project dimensions
  const [valuesModal, setValuesModal] = useState({ open: false, dim: null, values: [] });
  const [loadingValues, setLoadingValues] = useState(false);
  const [valueForm, setValueForm] = useState({ code: "", name: "", description: "", isActive: true });
  const [savingValue, setSavingValue] = useState(false);

  const loadDimensions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api("/accounting/dimensions");
      setDimensions(data.dimensions || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDimensions();
  }, [loadDimensions]);

  const openConfig = (dim) => {
    setConfigModal({ open: true, dim });
    setForm({
      name: dim.name || "",
      code: dim.code || "",
      sourceType: dim.sourceType || "custom_values",
      isRequired: Boolean(dim.isRequired),
      applicableAccountTypes: dim.applicableAccountTypes || [],
      description: dim.description || "",
      isActive: dim.isActive !== undefined ? Boolean(dim.isActive) : true,
    });
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        isRequired: Boolean(form.isRequired),
        applicableAccountTypes: form.applicableAccountTypes,
        description: form.description.trim(),
        isActive: Boolean(form.isActive),
      };
      if (!configModal.dim.isSystem) {
        payload.code = form.code.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
      }

      await api(`/accounting/dimensions/${configModal.dim._id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      toast.success("Dimension settings updated successfully");
      setConfigModal({ open: false, dim: null });
      loadDimensions();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateDimension = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Dimension name is required.");
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_") || form.name.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        sourceType: "custom_values",
        isRequired: Boolean(form.isRequired),
        applicableAccountTypes: form.applicableAccountTypes,
        description: form.description.trim(),
      };

      await api("/accounting/dimensions", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast.success("Custom dimension created successfully");
      setCreateModalOpen(false);
      loadDimensions();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const openValuesManager = async (dim) => {
    setValuesModal({ open: true, dim, values: [] });
    setValueForm({ code: "", name: "", description: "", isActive: true });
    setLoadingValues(true);
    try {
      const data = await api(`/accounting/dimensions/${dim._id}/values`);
      setValuesModal((prev) => ({ ...prev, values: data.values || [] }));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingValues(false);
    }
  };

  const handleAddValue = async (e) => {
    e.preventDefault();
    if (!valueForm.code.trim() || !valueForm.name.trim()) {
      return toast.error("Code and Name are required.");
    }
    setSavingValue(true);
    try {
      const data = await api(`/accounting/dimensions/${valuesModal.dim._id}/values`, {
        method: "POST",
        body: JSON.stringify({
          code: valueForm.code.trim().toUpperCase(),
          name: valueForm.name.trim(),
          description: valueForm.description.trim(),
          isActive: Boolean(valueForm.isActive),
        }),
      });
      toast.success("Dimension value added");
      setValueForm({ code: "", name: "", description: "", isActive: true });
      setValuesModal((prev) => ({
        ...prev,
        values: [...prev.values, data.value],
      }));
      loadDimensions();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingValue(false);
    }
  };

  const handleDeleteValue = async (valId) => {
    try {
      await api(`/accounting/dimensions/${valuesModal.dim._id}/values/${valId}`, {
        method: "DELETE",
      });
      toast.success("Dimension value deleted");
      setValuesModal((prev) => ({
        ...prev,
        values: prev.values.filter((v) => v._id !== valId),
      }));
      loadDimensions();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const toggleAccountType = (typeKey) => {
    setForm((prev) => {
      const exists = prev.applicableAccountTypes.includes(typeKey);
      const next = exists
        ? prev.applicableAccountTypes.filter((t) => t !== typeKey)
        : [...prev.applicableAccountTypes, typeKey];
      return { ...prev, applicableAccountTypes: next };
    });
  };

  return (
    <div className={`${shell} p-4 sm:p-6 lg:p-8`}>
      <Toaster position="top-right" />

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <HugeiconsIcon icon={Layers01Icon} size={28} className="text-indigo-600" />
            Accounting Dimensions
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure financial tracking dimensions, mandatory assignment rules, and custom reporting axes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadDimensions}
            disabled={loading}
            className={`${button} ${buttonGhost}`}
          >
            <HugeiconsIcon icon={RefreshIcon} size={18} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setForm({
                name: "",
                code: "",
                sourceType: "custom_values",
                isRequired: false,
                applicableAccountTypes: ["expense", "revenue"],
                description: "",
                isActive: true,
              });
              setCreateModalOpen(true);
            }}
            className={`${button} ${buttonPrimary}`}
          >
            <HugeiconsIcon icon={Add01Icon} size={18} />
            New Custom Dimension
          </button>
        </div>
      </div>

      {/* Dimensions Table */}
      <div className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Dimension</th>
                <th className="py-3.5 px-4">Code</th>
                <th className="py-3.5 px-4">Source Master</th>
                <th className="py-3.5 px-4">Posting Requirement</th>
                <th className="py-3.5 px-4">Applicable Accounts</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm font-semibold text-gray-700">
              {dimensions.map((dim) => (
                <tr key={dim._id} className="hover:bg-gray-50/70 transition">
                  <td className="py-3.5 px-4 font-bold text-gray-900">
                    <div className="flex items-center gap-2">
                      <span>{dim.name}</span>
                      {dim.isSystem && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          System
                        </span>
                      )}
                    </div>
                    {dim.description && (
                      <div className="text-xs font-normal text-gray-400 mt-0.5">{dim.description}</div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs font-bold text-indigo-600">
                    {dim.code}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="capitalize text-xs font-bold text-gray-700">
                      {dim.sourceType.replace(/_/g, " ")}
                    </span>
                    {["custom_values", "project"].includes(dim.sourceType) && (
                      <span className="ml-1 text-xs text-gray-400 font-normal">
                        ({dim.valuesCount || 0} values)
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    {dim.isRequired ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
                        Mandatory
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                        Optional
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    {dim.applicableAccountTypes && dim.applicableAccountTypes.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {dim.applicableAccountTypes.map((t) => (
                          <span
                            key={t}
                            className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700 capitalize"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">All Accounts</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        dim.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {dim.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {["custom_values", "project"].includes(dim.sourceType) && (
                        <button
                          type="button"
                          onClick={() => openValuesManager(dim)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition"
                        >
                          <HugeiconsIcon icon={Folder01Icon} size={14} />
                          Values ({dim.valuesCount || 0})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openConfig(dim)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
                      >
                        <HugeiconsIcon icon={Settings01Icon} size={14} />
                        Configure
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configure Modal */}
      {configModal.open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className={`${card} w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-150`}>
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                  <HugeiconsIcon icon={Settings01Icon} size={22} className="text-indigo-600" />
                  Configure Dimension: {configModal.dim.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setConfigModal({ open: false, dim: null })}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveConfig} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={input}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm font-semibold text-gray-800 outline-none focus:border-indigo-300"
                  />
                </div>

                <div className="pt-2 border-t border-gray-100 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isRequired}
                      onChange={(e) => setForm({ ...form, isRequired: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-sm font-bold text-gray-800">
                        Mandatory Dimension for Financial Postings
                      </span>
                      <p className="text-xs text-gray-500">
                        When enabled, posting journal entries or invoices requires this dimension for applicable accounts.
                      </p>
                    </div>
                  </label>

                  {form.isRequired && (
                    <div className="pl-7 pt-2">
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                        Require for Account Types:
                      </label>
                      <div className="space-y-1.5">
                        {ALL_ACCOUNT_TYPES.map((t) => (
                          <label key={t.key} className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                            <input
                              type="checkbox"
                              checked={form.applicableAccountTypes.includes(t.key)}
                              onChange={() => toggleAccountType(t.key)}
                              className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            {t.label}
                          </label>
                        ))}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-2">
                        If none selected, dimension will be required across all journal entry accounts.
                      </p>
                    </div>
                  )}

                  <label className="flex items-center gap-3 cursor-pointer pt-2">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-sm font-bold text-gray-800">Dimension Active</span>
                      <p className="text-xs text-gray-500">
                        Inactive dimensions are hidden from document posting forms.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setConfigModal({ open: false, dim: null })}
                    className={`${button} ${buttonGhost}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className={`${button} ${buttonPrimary}`}
                  >
                    {saving ? "Saving..." : "Save Configuration"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Create Custom Dimension Modal */}
      {createModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className={`${card} w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-150`}>
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                  <HugeiconsIcon icon={Layers01Icon} size={22} className="text-indigo-600" />
                  New Custom Dimension
                </h3>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateDimension} className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Dimension Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Business Unit"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className={input}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      System Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. business_unit"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      className={input}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Reporting context for this dimension..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm font-semibold text-gray-800 outline-none focus:border-indigo-300"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className={`${button} ${buttonGhost}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className={`${button} ${buttonPrimary}`}
                  >
                    {saving ? "Creating..." : "Create Dimension"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Values Manager Modal */}
      {valuesModal.open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className={`${card} w-full max-w-2xl p-6 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150`}>
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 shrink-0">
                <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                  <HugeiconsIcon icon={Folder01Icon} size={22} className="text-indigo-600" />
                  {valuesModal.dim?.name} — Manage Values
                </h3>
                <button
                  type="button"
                  onClick={() => setValuesModal({ open: false, dim: null, values: [] })}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={20} />
                </button>
              </div>

              {/* Add value row */}
              <form onSubmit={handleAddValue} className="mt-4 p-3.5 bg-gray-50/80 rounded-xl border border-gray-200 shrink-0">
                <div className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Add New Value
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <input
                    type="text"
                    required
                    placeholder="Code (e.g. BU-01)"
                    value={valueForm.code}
                    onChange={(e) => setValueForm({ ...valueForm, code: e.target.value.toUpperCase() })}
                    className="h-10 rounded-lg border border-gray-200 px-3 text-xs font-semibold uppercase bg-white focus:border-indigo-300"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Name (e.g. FMCG Division)"
                    value={valueForm.name}
                    onChange={(e) => setValueForm({ ...valueForm, name: e.target.value })}
                    className="h-10 rounded-lg border border-gray-200 px-3 text-xs font-semibold bg-white focus:border-indigo-300 sm:col-span-2"
                  />
                  <button
                    type="submit"
                    disabled={savingValue}
                    className="h-10 inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white hover:bg-indigo-700 transition"
                  >
                    <HugeiconsIcon icon={Add01Icon} size={16} />
                    {savingValue ? "Adding..." : "Add Value"}
                  </button>
                </div>
              </form>

              {/* Values list */}
              <div className="mt-4 flex-1 overflow-y-auto min-h-[200px]">
                {loadingValues ? (
                  <div className="py-12 text-center text-xs font-semibold text-gray-400">Loading values...</div>
                ) : valuesModal.values.length === 0 ? (
                  <div className="py-12 text-center text-xs font-semibold text-gray-400">
                    No values added for this dimension yet.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase">
                        <th className="py-2.5 px-3">Code</th>
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs font-semibold">
                      {valuesModal.values.map((v) => (
                        <tr key={v._id} className="hover:bg-gray-50/60">
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">{v.code}</td>
                          <td className="py-2.5 px-3 text-gray-900">{v.name}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                              Active
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteValue(v._id)}
                              className="p-1 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            >
                              <HugeiconsIcon icon={Delete01Icon} size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setValuesModal({ open: false, dim: null, values: [] })}
                  className={`${button} ${buttonGhost} text-xs h-9`}
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
