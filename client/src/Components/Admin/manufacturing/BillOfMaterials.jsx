"use client"
import { FiLayers } from "react-icons/fi"
import ManufacturingResourcePage from "./ManufacturingResourcePage"
import { displayName, formatNumber } from "./ManufacturingPageLayout"

const product = { type: "relation", endpoint: "/inventory/products?limit=100&status=active", labelKey: (item) => `${item.name || item.productName || "Product"}${item.sku ? ` · ${item.sku}` : ""}` }
const warehouse = { type: "relation", endpoint: "/inventory/warehouses?limit=100&status=active", labelKey: (item) => `${item.code || ""}${item.code ? " · " : ""}${item.name || "Warehouse"}` }

export default function BillOfMaterials() {
  return <ManufacturingResourcePage
    title="Bill of Materials"
    subtitle="Define product recipes, component quantities, scrap allowances, alternatives, and BOM revisions."
    endpoint="/manufacturing/bom"
    icon={<FiLayers />}
    viewPermission="manufacturing-bom:view"
    managePermission="manufacturing-bom:manage"
    deletePermission="manufacturing-bom:delete"
    createLabel="New BOM"
    statusOptions={["draft", "active", "obsolete"]}
    columns={[
      { key: "bomNumber", label: "BOM No." },
      { key: "product", label: "Product", type: "relation" },
      { key: "version", label: "Version", type: "number" },
      { key: "outputQuantity", label: "Output Qty", type: "number" },
      { key: "lines", label: "Components", render: (row) => `${row.lines?.length || 0} item${row.lines?.length === 1 ? "" : "s"}` },
      { key: "status", label: "Status", type: "status" },
      { key: "effectiveFrom", label: "Effective", type: "date" },
    ]}
    formFields={[
      { name: "product", label: "Finished Product", ...product },
      { name: "version", label: "Version", type: "number", min: 1, defaultValue: 1 },
      { name: "outputQuantity", label: "Output Quantity", type: "number", min: 0.000001, defaultValue: 1 },
      { name: "effectiveFrom", label: "Effective From", type: "date" },
      { name: "effectiveTo", label: "Effective To", type: "date" },
      { name: "revisionNotes", label: "Revision Notes", type: "textarea", full: true },
      { name: "lines", label: "Components", type: "array", full: true, itemLabel: "Component", addLabel: "Add component", fields: [
        { name: "product", label: "Component", ...product },
        { name: "quantity", label: "Quantity", type: "number", min: 0.000001, defaultValue: 1 },
        { name: "scrapPercent", label: "Scrap %", type: "number", min: 0, max: 100, defaultValue: 0 },
        { name: "issueWarehouse", label: "Issue Warehouse", ...warehouse },
        { name: "isAlternative", label: "Alternative", type: "checkbox", defaultValue: false },
        { name: "alternativeGroup", label: "Alt. Group", type: "text" },
      ]},
    ]}
    actions={[{
      label: "Activate BOM",
      permission: "manufacturing-bom:approve",
      path: "activate",
      when: (row) => row.status === "draft",
      success: "BOM activated",
      icon: <FiLayers />,
    }]}
    detailsFields={[
      { key: "bomNumber", label: "BOM Number" },
      { key: "product", label: "Product", render: (row) => displayName(row.product) },
      { key: "version", label: "Version", render: (row) => formatNumber(row.version) },
      { key: "outputQuantity", label: "Output Quantity", render: (row) => formatNumber(row.outputQuantity) },
      { key: "status", label: "Status", type: "status" },
      { key: "lines", label: "Components", render: (row) => `${row.lines?.length || 0} components` },
      { key: "revisionNotes", label: "Revision Notes" },
    ]}
  />
}
