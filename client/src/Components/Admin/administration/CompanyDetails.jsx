/* eslint-disable react/prop-types, react-refresh/only-export-components -- page view and form contracts are exported for focused tests */
import { useCallback, useEffect, useState } from "react"
import { useSelector } from "react-redux"
import { FiBriefcase, FiImage, FiRefreshCw, FiSave, FiTrash2, FiUpload, FiUser } from "react-icons/fi"
import { toast } from "react-hot-toast"
import { hasPermission, PERMISSIONS } from "../../Auth/permissions"
import { administrationApi } from "./administrationApi"
import {
  AdministrationButton,
  AdministrationCard,
  AdministrationField,
  AdministrationHeader,
  AdministrationPage,
  AdministrationStatus,
  AdministrationTableState,
  administrationStyles,
} from "./AdministrationUI"

const clean = (value) => String(value ?? "").trim()
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const EMPTY_FORM = Object.freeze({
  name: "", legalName: "", code: "", businessType: "", industry: "",
  registrationNo: "", taxId: "", vatNumber: "", tinNumber: "",
  email: "", phone: "", website: "", status: "active",
  address: { line1: "", line2: "", city: "", state: "", postalCode: "", country: "Bangladesh" },
  settings: { currency: "BDT", timezone: "Asia/Dhaka", fiscalYearStart: "01-01", dateFormat: "DD/MM/YYYY" },
  contactPerson: { name: "", designation: "", email: "", phone: "" },
  logo: { url: "", storageProvider: "", storageKey: "", updatedAt: null },
})

export function toCompanyForm(company = {}) {
  return {
    ...EMPTY_FORM,
    ...company,
    address: { ...EMPTY_FORM.address, ...(company.address || {}) },
    settings: { ...EMPTY_FORM.settings, ...(company.settings || {}) },
    contactPerson: { ...EMPTY_FORM.contactPerson, ...(company.contactPerson || {}) },
    logo: { ...EMPTY_FORM.logo, ...(company.logo || {}) },
  }
}

export function validateCompanyForm(form) {
  if (!clean(form?.name)) return "Company name is required."
  if (!clean(form?.address?.country)) return "Country is required."
  if (form?.email && !emailPattern.test(clean(form.email))) return "Enter a valid company email address."
  if (form?.contactPerson?.email && !emailPattern.test(clean(form.contactPerson.email))) return "Enter a valid contact-person email address."
  if (form?.website) {
    try {
      const url = new URL(form.website)
      if (!["http:", "https:"].includes(url.protocol)) return "Enter a valid HTTP or HTTPS website."
    } catch {
      return "Enter a valid HTTP or HTTPS website."
    }
  }
  if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(clean(form?.settings?.fiscalYearStart))) return "Fiscal year start must use MM-DD."
  return ""
}

export function validateCompanyLogoFile(file) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file?.type)) return "Logo must be PNG, JPG, or WEBP."
  if (Number(file?.size || 0) > 5 * 1024 * 1024) return "Logo must not exceed 5 MB."
  return ""
}

export function preserveCompanyDraftOnConflict(draft) {
  return toCompanyForm(draft)
}

export function buildCompanyProfilePayload(form) {
  return {
    name: clean(form.name),
    legalName: clean(form.legalName),
    businessType: clean(form.businessType),
    industry: clean(form.industry),
    registrationNo: clean(form.registrationNo),
    taxId: clean(form.taxId),
    vatNumber: clean(form.vatNumber),
    tinNumber: clean(form.tinNumber),
    email: clean(form.email).toLowerCase(),
    phone: clean(form.phone),
    website: clean(form.website),
    address: Object.fromEntries(Object.entries(form.address || {}).map(([key, value]) => [key, clean(value)])),
    settings: {
      timezone: clean(form.settings?.timezone),
      fiscalYearStart: clean(form.settings?.fiscalYearStart),
    },
    contactPerson: {
      name: clean(form.contactPerson?.name),
      designation: clean(form.contactPerson?.designation),
      email: clean(form.contactPerson?.email).toLowerCase(),
      phone: clean(form.contactPerson?.phone),
    },
  }
}

function Input({ id, value, onChange, disabled, type = "text", placeholder = "", ...props }) {
  return <input id={id} type={type} value={value ?? ""} onChange={onChange} disabled={disabled} placeholder={placeholder} className={administrationStyles.input} {...props} />
}

export function CompanyDetailsView({
  form,
  company,
  canManage,
  loading,
  error,
  saving,
  logoBusy,
  logoPreviewUrl,
  conflict,
  onChange,
  onNestedChange,
  onSave,
  onReset,
  onReload,
  onKeepDraft,
  onLogoSelected,
  onLogoRemove,
}) {
  if (loading) return <AdministrationPage><AdministrationTableState status="loading" /></AdministrationPage>
  if (error && !company) return <AdministrationPage><AdministrationCard><AdministrationTableState status="error" title="Unable to load Company Details" description={error} onRetry={onReload} /></AdministrationCard></AdministrationPage>

  const disabled = !canManage || saving
  const field = (key) => ({ value: form[key] || "", onChange: (event) => onChange(key, event.target.value), disabled })
  const nested = (group, key) => ({ value: form[group]?.[key] || "", onChange: (event) => onNestedChange(group, key, event.target.value), disabled })
  const initials = clean(form.name).split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "CO"
  const logoUrl = logoPreviewUrl || form.logo?.url

  return <AdministrationPage>
    <AdministrationHeader
      icon={FiBriefcase}
      title="Company Details"
      description="Manage the company information shared by every ERP module."
      actions={<>
        <AdministrationButton icon={FiRefreshCw} type="button" onClick={onReload} disabled={loading || saving}>Refresh</AdministrationButton>
        {canManage ? <AdministrationButton icon={FiSave} variant="primary" type="submit" form="company-details-form" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</AdministrationButton> : null}
      </>}
    />

    {error ? <div role="alert" className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
    {!canManage ? <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">You have read-only access to Company Details.</div> : null}
    {conflict ? <div role="alert" className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 sm:flex-row sm:items-center sm:justify-between"><span>Company details changed in another session. Reload the current values or keep your draft while you review it.</span><span className="flex shrink-0 gap-2"><AdministrationButton type="button" onClick={onReload}>Reload</AdministrationButton><AdministrationButton type="button" variant="soft" onClick={onKeepDraft}>Keep Draft</AdministrationButton></span></div> : null}

    <form id="company-details-form" onSubmit={onSave} className="space-y-5">
      <AdministrationCard className="p-5">
        <div className="mb-5 flex flex-col gap-4 border-b border-gray-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-indigo-50 text-xl font-black text-indigo-700">
              {logoUrl ? <img src={logoUrl} alt={`${form.name || "Company"} logo`} className="h-full w-full object-cover" /> : initials}
            </div>
            <div><h2 className="text-lg font-black text-gray-950">Company identity</h2><p className="mt-1 text-sm font-medium text-gray-500">Logo, legal identity, registration and tax details.</p><div className="mt-2"><AdministrationStatus value={form.status} /></div></div>
          </div>
          {canManage ? <div className="flex flex-wrap gap-2">
            <label className={`${administrationStyles.button} cursor-pointer border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 ${logoBusy ? "pointer-events-none opacity-60" : ""}`}><FiUpload className="h-4 w-4" />{logoBusy ? "Uploading..." : "Upload Logo"}<input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={onLogoSelected} disabled={logoBusy} /></label>
            {form.logo?.url ? <AdministrationButton type="button" icon={FiTrash2} variant="danger" onClick={onLogoRemove} disabled={logoBusy}>Remove</AdministrationButton> : null}
          </div> : null}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AdministrationField label="Company Name" htmlFor="company-name" required><Input id="company-name" {...field("name")} /></AdministrationField>
          <AdministrationField label="Legal Name" htmlFor="legal-name"><Input id="legal-name" {...field("legalName")} /></AdministrationField>
          <AdministrationField label="Company Code" htmlFor="company-code" hint="Managed by platform onboarding."><Input id="company-code" value={form.code} disabled /></AdministrationField>
          <AdministrationField label="Business Type" htmlFor="business-type"><Input id="business-type" {...field("businessType")} placeholder="Private Limited" /></AdministrationField>
          <AdministrationField label="Industry" htmlFor="industry"><Input id="industry" {...field("industry")} /></AdministrationField>
          <AdministrationField label="Registration Number" htmlFor="registration-number"><Input id="registration-number" {...field("registrationNo")} /></AdministrationField>
          <AdministrationField label="Tax ID" htmlFor="tax-id"><Input id="tax-id" {...field("taxId")} /></AdministrationField>
          <AdministrationField label="VAT Number" htmlFor="vat-number"><Input id="vat-number" {...field("vatNumber")} /></AdministrationField>
          <AdministrationField label="TIN Number" htmlFor="tin-number"><Input id="tin-number" {...field("tinNumber")} /></AdministrationField>
          <AdministrationField label="Email" htmlFor="company-email"><Input id="company-email" type="email" {...field("email")} /></AdministrationField>
          <AdministrationField label="Phone" htmlFor="company-phone"><Input id="company-phone" {...field("phone")} /></AdministrationField>
          <AdministrationField label="Website" htmlFor="company-website"><Input id="company-website" type="url" {...field("website")} placeholder="https://example.com" /></AdministrationField>
        </div>
      </AdministrationCard>

      <AdministrationCard className="p-5">
        <div className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><FiImage /></span><div><h2 className="font-black text-gray-950">Address and localization</h2><p className="text-sm text-gray-500">Company address, time zone, and fiscal-year start. Currency and display formats are managed in System Defaults.</p></div></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AdministrationField label="Address Line 1" htmlFor="address-line-1"><Input id="address-line-1" {...nested("address", "line1")} /></AdministrationField>
          <AdministrationField label="Address Line 2" htmlFor="address-line-2"><Input id="address-line-2" {...nested("address", "line2")} /></AdministrationField>
          <AdministrationField label="City" htmlFor="city"><Input id="city" {...nested("address", "city")} /></AdministrationField>
          <AdministrationField label="State / Division" htmlFor="state"><Input id="state" {...nested("address", "state")} /></AdministrationField>
          <AdministrationField label="Postal Code" htmlFor="postal-code"><Input id="postal-code" {...nested("address", "postalCode")} /></AdministrationField>
          <AdministrationField label="Country" htmlFor="country"><Input id="country" {...nested("address", "country")} /></AdministrationField>
          <AdministrationField label="Time Zone" htmlFor="timezone"><Input id="timezone" {...nested("settings", "timezone")} placeholder="Asia/Dhaka" /></AdministrationField>
          <AdministrationField label="Fiscal Year Start" htmlFor="fiscal-start" hint="MM-DD"><Input id="fiscal-start" {...nested("settings", "fiscalYearStart")} placeholder="01-01" /></AdministrationField>
        </div>
      </AdministrationCard>

      <AdministrationCard className="p-5">
        <div className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><FiUser /></span><div><h2 className="font-black text-gray-950">Company Contact Person</h2><p className="text-sm text-gray-500">Primary operational contact for the company.</p></div></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdministrationField label="Contact Person" htmlFor="contact-name"><Input id="contact-name" {...nested("contactPerson", "name")} /></AdministrationField>
          <AdministrationField label="Designation" htmlFor="contact-designation"><Input id="contact-designation" {...nested("contactPerson", "designation")} /></AdministrationField>
          <AdministrationField label="Contact Email" htmlFor="contact-email"><Input id="contact-email" type="email" {...nested("contactPerson", "email")} /></AdministrationField>
          <AdministrationField label="Contact Phone" htmlFor="contact-phone"><Input id="contact-phone" {...nested("contactPerson", "phone")} /></AdministrationField>
        </div>
      </AdministrationCard>

      {canManage ? <div className="flex justify-end gap-2"><AdministrationButton type="button" onClick={onReset} disabled={saving}>Cancel Changes</AdministrationButton><AdministrationButton type="submit" variant="primary" icon={FiSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</AdministrationButton></div> : null}
    </form>
  </AdministrationPage>
}

export default function CompanyDetails() {
  const currentUser = useSelector((state) => state.user?.currentUser)
  const canManage = hasPermission(currentUser, PERMISSIONS.COMPANY_MANAGE)
  const [company, setCompany] = useState(null)
  const [form, setForm] = useState(toCompanyForm())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoBusy, setLogoBusy] = useState(false)
  const [error, setError] = useState("")
  const [conflict, setConflict] = useState(false)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("")

  useEffect(() => () => {
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl)
  }, [logoPreviewUrl])

  const loadCompany = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const payload = await administrationApi.get("/company")
      const next = payload.data?.company || {}
      setCompany(next)
      setForm(toCompanyForm(next))
      setConflict(false)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadCompany() }, [loadCompany])

  const updateField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }))
  const updateNested = (group, key, value) => setForm((previous) => ({ ...previous, [group]: { ...previous[group], [key]: value } }))

  const save = async (event) => {
    event.preventDefault()
    if (!canManage) return
    const validation = validateCompanyForm(form)
    if (validation) return toast.error(validation)
    setSaving(true)
    setError("")
    try {
      const payload = await administrationApi.patch("/company", buildCompanyProfilePayload(form))
      const next = payload.data?.company || {}
      setCompany(next)
      setForm(toCompanyForm(next))
      setConflict(false)
      toast.success(payload.message || "Company details updated.")
    } catch (requestError) {
      if (requestError.status === 409) {
        setForm((draft) => preserveCompanyDraftOnConflict(draft))
        setConflict(true)
      } else {
        setError(requestError.message)
      }
      toast.error(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const uploadLogo = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || !canManage) return
    const validation = validateCompanyLogoFile(file)
    if (validation) return toast.error(validation)
    setLogoPreviewUrl(URL.createObjectURL(file))
    const data = new FormData()
    data.append("logo", file)
    setLogoBusy(true)
    try {
      const payload = await administrationApi.upload("/company/logo", data)
      const next = payload.data?.company || {}
      setCompany(next)
      setForm(toCompanyForm(next))
      toast.success(payload.message || "Company logo updated.")
    } catch (requestError) {
      toast.error(requestError.message)
    } finally {
      setLogoBusy(false)
      setLogoPreviewUrl("")
    }
  }

  const removeLogo = async () => {
    if (!canManage || !window.confirm("Remove the company logo?")) return
    setLogoBusy(true)
    try {
      const payload = await administrationApi.remove("/company/logo")
      const next = payload.data?.company || {}
      setCompany(next)
      setForm(toCompanyForm(next))
      toast.success(payload.message || "Company logo removed.")
    } catch (requestError) {
      toast.error(requestError.message)
    } finally {
      setLogoBusy(false)
    }
  }

  return <CompanyDetailsView
    form={form}
    company={company}
    canManage={canManage}
    loading={loading}
    error={error}
    saving={saving}
    logoBusy={logoBusy}
    logoPreviewUrl={logoPreviewUrl}
    conflict={conflict}
    onChange={updateField}
    onNestedChange={updateNested}
    onSave={save}
    onReset={() => { setForm(toCompanyForm(company || {})); setConflict(false) }}
    onReload={loadCompany}
    onKeepDraft={() => setConflict(false)}
    onLogoSelected={uploadLogo}
    onLogoRemove={removeLogo}
  />
}
