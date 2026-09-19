"use client"
import { FiCheckSquare, FiFilePlus } from "react-icons/fi"
import ManufacturingResourcePage from "./ManufacturingResourcePage"

export default function QualityInspections() {
  return <ManufacturingResourcePage title="Quality Inspections" subtitle="Perform incoming, in-process, final, and subcontract inspections with measurable quality checks." endpoint="/manufacturing/quality/inspections" icon={<FiCheckSquare />} viewPermission="manufacturing-quality:view" managePermission="manufacturing-quality:manage" createLabel="New Inspection" statusOptions={["pending", "pass", "fail", "hold"]}
    columns={[{ key: "inspectionNumber", label: "Inspection No." }, { key: "inspectionType", label: "Type" }, { key: "product", label: "Product", type: "relation" }, { key: "quantityInspected", label: "Inspected", type: "number" }, { key: "quantityPassed", label: "Passed", type: "number" }, { key: "quantityFailed", label: "Failed", type: "number" }, { key: "result", label: "Result", type: "status" }, { key: "inspectedAt", label: "Inspected At", type: "date" }]}
    formFields={[
      { name: "inspectionType", label: "Inspection Type", type: "select", options: ["incoming", "in_process", "final", "subcontract"] }, { name: "product", label: "Product", type: "relation", endpoint: "/inventory/products?limit=100&status=active" },
      { name: "manufacturingOrder", label: "Manufacturing Order", type: "relation", endpoint: "/manufacturing/orders?limit=100" }, { name: "workOrder", label: "Work Order", type: "relation", endpoint: "/manufacturing/work-orders?limit=100" },
      { name: "quantityInspected", label: "Quantity Inspected", type: "number", min: 0, defaultValue: 0 }, { name: "quantityPassed", label: "Quantity Passed", type: "number", min: 0, defaultValue: 0 }, { name: "quantityFailed", label: "Quantity Failed", type: "number", min: 0, defaultValue: 0 },
      { name: "batchNumber", label: "Batch Number", type: "text" }, { name: "notes", label: "Notes", type: "textarea", full: true },
      { name: "checks", label: "Inspection Checks", type: "array", full: true, itemLabel: "Check", fields: [
        { name: "parameter", label: "Parameter", type: "text" }, { name: "specification", label: "Specification", type: "text" }, { name: "measuredValue", label: "Measured Value", type: "text" }, { name: "result", label: "Result", type: "select", defaultValue: "na", options: ["pass", "fail", "na"] }, { name: "notes", label: "Notes", type: "text" },
      ]},
    ]}
    actions={[
      { label: "Finalize", permission: "manufacturing-quality:approve", path: "finalize", when: (row) => row.result === "pending", success: "Inspection finalized", fields: [{ name: "result", label: "Final Result", type: "select", options: ["pass", "fail", "hold"] }] },
      { label: "Create NCR", permission: "manufacturing-quality:manage", path: "ncr", when: (row) => ["fail", "hold"].includes(row.result), success: "Non-conformance created", icon: <FiFilePlus />, fields: [{ name: "defectType", label: "Defect Type", type: "text" }, { name: "severity", label: "Severity", type: "select", defaultValue: "minor", options: ["minor", "major", "critical"] }, { name: "quantity", label: "Quantity", type: "number", min: 0.000001, defaultValue: 1 }, { name: "disposition", label: "Disposition", type: "select", defaultValue: "pending", options: ["pending", "rework", "scrap", "use_as_is", "return_to_supplier"] }] },
    ]} />
}
