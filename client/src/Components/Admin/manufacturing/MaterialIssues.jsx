"use client"
import { FiArrowUpRight, FiPackage } from "react-icons/fi"
import ManufacturingResourcePage from "./ManufacturingResourcePage"

export default function MaterialIssues() {
  return <ManufacturingResourcePage title="Material Issues" subtitle="Issue raw materials from inventory to manufacturing orders and post the stock/accounting movement." endpoint="/manufacturing/material-issues" icon={<FiPackage />} viewPermission="manufacturing-material:view" managePermission="manufacturing-material:manage" createLabel="New Material Issue" statusOptions={["draft", "posted", "reversed", "cancelled"]}
    columns={[{ key: "issueNumber", label: "Issue No." }, { key: "manufacturingOrder", label: "Manufacturing Order", type: "relation" }, { key: "issueDate", label: "Issue Date", type: "date" }, { key: "lines", label: "Materials", render: (row) => `${row.lines?.length || 0} items` }, { key: "status", label: "Status", type: "status" }, { key: "createdAt", label: "Created", type: "date" }]}
    formFields={[
      { name: "manufacturingOrder", label: "Manufacturing Order", type: "relation", endpoint: "/manufacturing/orders?limit=100" }, { name: "issueDate", label: "Issue Date", type: "date" }, { name: "notes", label: "Notes", type: "textarea", full: true },
      { name: "lines", label: "Materials", type: "array", full: true, itemLabel: "Material", fields: [
        { name: "product", label: "Product", type: "relation", endpoint: "/inventory/products?limit=100&status=active" }, { name: "quantity", label: "Quantity", type: "number", min: 0.000001, defaultValue: 1 }, { name: "warehouse", label: "Warehouse", type: "relation", endpoint: "/inventory/warehouses?limit=100&status=active" }, { name: "lotNumber", label: "Lot Number", type: "text" }, { name: "serialNumbers", label: "Serial Numbers", type: "tags" },
      ]},
    ]}
    actions={[{ label: "Post Issue", permission: "manufacturing-material:post", path: "post", when: (row) => row.status === "draft", success: "Material issue posted", icon: <FiArrowUpRight /> }]} />
}
