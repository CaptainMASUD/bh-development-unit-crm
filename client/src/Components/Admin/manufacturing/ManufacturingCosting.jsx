"use client"
import { FiDollarSign, FiRefreshCcw } from "react-icons/fi"
import ManufacturingResourcePage from "./ManufacturingResourcePage"

export default function ManufacturingCosting() {
  return <ManufacturingResourcePage title="Manufacturing Costing" subtitle="Review material, labor, machine, overhead, subcontract, scrap, rework, unit cost, and variance by manufacturing order." endpoint="/manufacturing/costing" icon={<FiDollarSign />} viewPermission="manufacturing-cost:view" managePermission="manufacturing-cost:manage" readOnly statusOptions={["estimated", "provisional", "final"]}
    columns={[{ key: "costNumber", label: "Cost No." }, { key: "manufacturingOrder", label: "Manufacturing Order", type: "relation" }, { key: "materialCost", label: "Material", type: "money" }, { key: "laborCost", label: "Labor", type: "money" }, { key: "machineCost", label: "Machine", type: "money" }, { key: "totalCost", label: "Total Cost", type: "money" }, { key: "unitCost", label: "Unit Cost", type: "money" }, { key: "variance", label: "Variance", type: "money" }, { key: "status", label: "Status", type: "status" }]}
    actions={[{ label: "Recalculate", permission: "manufacturing-cost:manage", path: (row) => `/manufacturing/costing/order/${row.manufacturingOrder?._id || row.manufacturingOrder}/recalculate`, success: "Manufacturing cost recalculated", icon: <FiRefreshCcw /> }]} />
}
