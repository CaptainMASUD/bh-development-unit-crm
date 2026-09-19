"use client"
import { FiClock } from "react-icons/fi"
import ManufacturingResourcePage from "./ManufacturingResourcePage"

export default function WorkInProgress() {
  return <ManufacturingResourcePage title="Work in Progress" subtitle="Monitor current WIP quantities, value, stage, work center, and order status." endpoint="/manufacturing/wip" icon={<FiClock />} viewPermission="manufacturing-wip:view" readOnly statusOptions={["active", "hold", "completed"]}
    columns={[{ key: "manufacturingOrder", label: "Manufacturing Order", type: "relation" }, { key: "product", label: "Product", type: "relation" }, { key: "stage", label: "Stage" }, { key: "workCenter", label: "Work Center", type: "relation" }, { key: "quantity", label: "Quantity", type: "number" }, { key: "value", label: "WIP Value", type: "money" }, { key: "status", label: "Status", type: "status" }, { key: "enteredAt", label: "Entered", type: "date" }]} />
}
