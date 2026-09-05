import { FiPackage } from "react-icons/fi"
import { InventoryEmptyState, InventoryPageHeader, InventoryPageShell } from "./InventoryUI"

export default function ItemProfiles() {
  return (
    <InventoryPageShell>
      <InventoryPageHeader title="Item Profiles" description="Manage reusable item identity, classification, and tracking profiles." />
      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.45)]">
        <InventoryEmptyState icon={FiPackage} title="No item profiles yet" description="Item profile management is reserved for the approved Inventory workflow." />
      </section>
    </InventoryPageShell>
  )
}
