"use client"
import { FiGitBranch } from "react-icons/fi"
import ManufacturingResourcePage from "./ManufacturingResourcePage"

const product = { type: "relation", endpoint: "/inventory/products?limit=100&status=active" }
const workCenter = { type: "relation", endpoint: "/manufacturing/work-centers?limit=100&status=active" }
const machine = { type: "relation", endpoint: "/manufacturing/machines?limit=100" }
const supplier = { type: "relation", endpoint: "/suppliers?limit=100&status=approved" }

export default function Routings() {
  return <ManufacturingResourcePage
    title="Production Routings"
    subtitle="Define the ordered work-center and machine operations used to manufacture each product."
    endpoint="/manufacturing/routing"
    icon={<FiGitBranch />}
    viewPermission="manufacturing-routing:view"
    managePermission="manufacturing-routing:manage"
    deletePermission="manufacturing-routing:delete"
    createLabel="New Routing"
    statusOptions={["draft", "active", "obsolete"]}
    columns={[
      { key: "routeNumber", label: "Route No." },
      { key: "product", label: "Product", type: "relation" },
      { key: "version", label: "Version", type: "number" },
      { key: "operations", label: "Operations", render: (row) => `${row.operations?.length || 0} steps` },
      { key: "status", label: "Status", type: "status" },
      { key: "updatedAt", label: "Updated", type: "date" },
    ]}
    formFields={[
      { name: "routeNumber", label: "Route Number", type: "text", hint: "Leave blank only if your backend generates route numbers." },
      { name: "product", label: "Product", ...product },
      { name: "version", label: "Version", type: "number", min: 1, defaultValue: 1 },
      { name: "notes", label: "Notes", type: "textarea", full: true },
      { name: "operations", label: "Operations", type: "array", full: true, itemLabel: "Operation", fields: [
        { name: "sequence", label: "Sequence", type: "number", min: 1, defaultValue: 1 },
        { name: "name", label: "Operation Name", type: "text" },
        { name: "workCenter", label: "Work Center", ...workCenter },
        { name: "machine", label: "Machine", ...machine },
        { name: "setupMinutes", label: "Setup Min", type: "number", min: 0, defaultValue: 0 },
        { name: "runMinutesPerUnit", label: "Run Min / Unit", type: "number", min: 0, defaultValue: 0 },
        { name: "qualityRequired", label: "Quality Check", type: "checkbox" },
        { name: "outsourced", label: "Outsourced", type: "checkbox" },
        { name: "supplier", label: "Supplier", ...supplier },
      ]},
    ]}
  />
}
