"use client"
import { FiCheckCircle, FiPackage } from "react-icons/fi"
import ManufacturingResourcePage from "./ManufacturingResourcePage"

export default function ProductionEntries() {
  return <ManufacturingResourcePage title="Production Entries" subtitle="Record finished output, rejects, scrap, rework, batch details, labor time, machine time, and finished-goods receipt." endpoint="/manufacturing/production-entries" icon={<FiPackage />} viewPermission="manufacturing-production:view" managePermission="manufacturing-production:manage" createLabel="New Production Entry" statusOptions={["draft", "posted", "cancelled"]}
    columns={[{ key: "entryNumber", label: "Entry No." }, { key: "manufacturingOrder", label: "Manufacturing Order", type: "relation" }, { key: "entryDate", label: "Entry Date", type: "date" }, { key: "goodQuantity", label: "Good Qty", type: "number" }, { key: "rejectedQuantity", label: "Rejected", type: "number" }, { key: "batchNumber", label: "Batch" }, { key: "status", label: "Status", type: "status" }]}
    formFields={[
      { name: "manufacturingOrder", label: "Manufacturing Order", type: "relation", endpoint: "/manufacturing/orders?limit=100" }, { name: "workOrder", label: "Work Order", type: "relation", endpoint: "/manufacturing/work-orders?limit=100" }, { name: "entryDate", label: "Entry Date", type: "date" },
      { name: "goodQuantity", label: "Good Quantity", type: "number", min: 0, defaultValue: 0 }, { name: "rejectedQuantity", label: "Rejected Quantity", type: "number", min: 0, defaultValue: 0 }, { name: "scrapQuantity", label: "Scrap Quantity", type: "number", min: 0, defaultValue: 0 }, { name: "reworkQuantity", label: "Rework Quantity", type: "number", min: 0, defaultValue: 0 },
      { name: "laborMinutes", label: "Labor Minutes", type: "number", min: 0, defaultValue: 0 }, { name: "machineMinutes", label: "Machine Minutes", type: "number", min: 0, defaultValue: 0 }, { name: "downtimeMinutes", label: "Downtime Minutes", type: "number", min: 0, defaultValue: 0 },
      { name: "batchNumber", label: "Batch Number", type: "text" }, { name: "manufactureDate", label: "Manufacture Date", type: "date" }, { name: "expiryDate", label: "Expiry Date", type: "date" }, { name: "notes", label: "Notes", type: "textarea", full: true },
    ]}
    actions={[{ label: "Post Production", permission: "manufacturing-production:post", path: "post", when: (row) => row.status === "draft", success: "Production entry posted", icon: <FiCheckCircle /> }]} />
}
