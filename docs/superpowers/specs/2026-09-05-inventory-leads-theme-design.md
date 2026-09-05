# Inventory Leads-Theme Unification Design

**Date:** 2026-09-05  
**Status:** Approved design direction; pending implementation plan  
**Canonical reference:** `client/src/Components/Admin/crm/AdminLeadPage.jsx`

## Objective

Make every Inventory page feel native to the rest of BusinessHub CRM by adopting the complete visual language and interaction patterns of the CRM Leads page. The migration covers layout, hierarchy, buttons, search and filters, tables, forms, modals, feedback states, responsive behavior, and accessibility while preserving Inventory business behavior.

This is a presentation and component-architecture migration. It must not alter stock calculations, approval flows, permissions, audit trails, inventory movements, API contracts, or persisted data except where a UI defect cannot be corrected without a separately reviewed functional change.

## Scope

### Routed Inventory pages

- Dashboard
- Inventory Items
- Item Profiles
- Products
- Categories
- Units of Measure
- Warehouses
- Scheduled Warehouse Checks
- Locations / Bins / Shelves
- Stock Requests
- Stock Issues
- Stock Transfers
- Stock Adjustments
- Stock Report
- Quality Inspection
- Stock Inspection
- Batches / Lots
- Serial Numbers
- Expiry Management
- Low Stock Requests
- Consumption History
- Inventory Valuation
- Inventory Loss Analysis
- Inventory Reports

### Legacy Inventory components

All page components under `client/src/Components/Admin/inventory` are included, even if they are not currently reachable from the sidebar. This prevents a legacy route or future reactivation from reintroducing the old theme. Tests in that folder are not visual pages and are excluded from styling changes.

`PurchaseQualityInspections.jsx` is also included because it supplies Inventory's Quality Inspection route, although it lives under the Purchase component directory.

## Recommended architecture

Create a small shared Inventory UI layer modeled on the reusable patterns in `AdminLeadPage.jsx`, then migrate every page to those primitives. This avoids repeating long Tailwind class strings and prevents page-by-page drift.

Expected primitives include:

- `InventoryPageShell`: Leads-style gray-to-white background, centered content width, responsive gutters.
- `InventoryPageHeader`: white rounded header card, indigo icon block, title, optional description, primary and secondary actions.
- `InventoryButton` and `InventoryIconButton`: primary, secondary, subtle, and danger variants with consistent dimensions, focus rings, disabled states, and icons.
- `InventoryStatCard`: consistent metric typography and optional trend/status treatment.
- `InventoryToolbar`: search, removable filter chips, Filters, Columns, Export, Refresh, and other page-specific controls in a responsive layout.
- `InventoryTabs`: horizontally scrollable segmented navigation matching Leads pipeline tabs.
- `InventoryTableCard`: rounded table container, sticky header where appropriate, optional sticky Actions column, row hover treatment, scrolling, footer, and pagination/load-more area.
- `InventoryStatusBadge`: semantic neutral, blue, amber, green, and red states matching Leads badges.
- `InventoryModal`: portal-based modal with blurred overlay, indigo icon header, scroll-safe body, sticky footer, Escape handling, and body-scroll locking.
- `InventoryField`, `InventoryEmptyState`, and loading/error states.

Primitives should remain composable. Pages may omit irrelevant regions rather than rendering artificial controls solely for visual uniformity.

## Visual system

### Page shell

- Use the Leads page's `bg-gradient-to-b from-gray-50 to-white` foundation.
- Center content within `max-w-[1500px]` with responsive `px-4 py-6 sm:px-6 lg:px-8` spacing.
- Avoid nested `min-h-screen` wrappers and excess page padding inside the Admin shell.
- Use gray/white surfaces, indigo primary accents, and semantic colors only for status or risk.

### Header and action placement

- Each page starts with one rounded white header card.
- The left side contains an indigo icon tile, page title, and concise description where helpful.
- The right side contains page actions. The create action is the rightmost indigo primary button; utilities such as Export and Refresh are white secondary buttons.
- On narrow screens, actions wrap below the title without overflow or clipped labels.
- Destructive actions remain visually distinct and never occupy the primary create position.

### Metrics and dashboards

- Existing metrics remain when they communicate meaningful inventory state.
- Metric cards use the Leads border radius, subtle border/shadow, typography, and responsive grid.
- Metric names and values retain their current business meaning; decorative summaries are not introduced.
- Dashboard charts and reports live in consistent rounded cards with aligned headings, legends, empty states, and controls.

### Search, filters, tabs, and utilities

- Search uses the Leads integrated toolbar treatment: search icon, flexible input, optional active filter chips, and a Filters button.
- Filter placement and ordering are consistent: search first, contextual filters next, then Columns, Export, and Refresh utilities.
- Filters that are simple and frequently used may remain inline; larger filter sets open a Leads-style modal.
- Active filters are visible and removable. Clear-all behavior must be discoverable.
- Category, warehouse, status, or report tabs use the Leads segmented tab container and support horizontal scrolling on small screens.
- CSV/Excel behavior remains unchanged unless the page already exposes a different export contract.

### Tables and lists

- Tables are placed in rounded-3xl bordered white cards with subtle Leads-style shadows.
- Headers use uppercase, compact, high-contrast labels on `gray-50` and become sticky for long data sets.
- Rows use readable density and indigo-tinted hover feedback.
- Actions align to the right. The Actions column becomes sticky when horizontal scrolling would otherwise hide it.
- Existing view, edit, delete, approval, issue, pause, resume, and workflow actions retain their permissions and behavior.
- Empty, loading, error, and no-results states use shared components rather than blank rows.
- Pagination remains pagination where server APIs require it; cursor-based pages may retain Load More. Both use the same visual language.

### Forms and modals

- Create, edit, view, confirmation, approval, and workflow dialogs adopt the Leads modal shell.
- Modal header: indigo icon tile, clear title/subtitle, close button.
- Modal body: responsive one/two-column field grid with Leads labels, inputs, focus rings, hints, and validation messages.
- Modal footer: Cancel/secondary on the left of the primary submit action, aligned right; sticky on long forms.
- Large detail views may use wider modal sizes but retain the same shell.
- Dialogs close via explicit close, Cancel, backdrop when safe, and Escape. Unsaved/destructive flows keep their existing safeguards.

### Feedback and accessibility

- Keep semantic status colors consistent: emerald success/active, sky informational/in-progress, amber pending/attention, rose danger/failure, gray neutral.
- All icon-only actions require accessible labels or titles and visible focus states.
- Controls must remain keyboard accessible, and dialogs must expose dialog semantics.
- Loading actions disable repeat submission and show a spinner or progress state.
- Toasts, inline errors, and confirmations use consistent language and placement.

## Responsive behavior

- Header actions and toolbars stack cleanly at mobile widths.
- Metric grids collapse from four or three columns to one.
- Tables scroll horizontally rather than compressing columns into unreadable widths.
- Sticky headers/actions must not cover content.
- Modals fit the viewport, keep headers/footers available, and scroll only their body when practical.
- Charts and dense report controls must not cause page-level horizontal overflow.

## Behavior preservation

The migration must preserve:

- Current endpoints, request payloads, response normalization, and server-side pagination.
- Role and permission checks.
- Opening-stock creation as a real auditable inventory movement.
- Stock request approval, rejection, issuing, and history behavior.
- Warehouse scheduling, pause/resume, and inspection queue behavior.
- Product, category, unit, location, batch, serial, expiry, valuation, loss, and reporting calculations.
- Current exports and printable outputs.
- Existing validation and safety confirmations.

Any functional bug discovered during styling is documented separately and is not silently bundled into the theme migration.

## Migration strategy

1. Establish and test shared primitives against the Leads reference.
2. Migrate foundational setup pages: Products, Categories, Units, Warehouses, Locations, and Item Profiles.
3. Migrate operational workflows: Inventory Items, Stock Requests, Issues, Transfers, Adjustments, inspections, batches, serials, expiry, and low stock.
4. Migrate dashboard, history, valuation, loss, and reporting pages.
5. Migrate remaining legacy Inventory pages.
6. Verify the shared Quality Inspection route.
7. Perform responsive and interaction QA across representative page types, then run the complete client test/build suite.

Small batches reduce regression risk and make it easier to compare each result with the Leads reference.

## Verification criteria

- Every scoped page uses the shared Inventory presentation layer or demonstrably identical shared tokens.
- No old `#f4f7fb` flat page shell, mismatched card radius, or isolated button/input language remains.
- Buttons, search bars, filters, tables, modals, tabs, badges, feedback, and spacing visually align with CRM Leads.
- All existing Inventory tests pass; shared primitives receive focused rendering/behavior tests.
- Client lint/build passes.
- Representative desktop and mobile views are inspected for Dashboard, Inventory Items, Products, Warehouses, Stock Requests, Stock Inspection, Expiry Management, and Inventory Reports.
- Core workflows are smoke-tested, including create/edit, filters, export, pagination, approvals, and auditable opening stock.

## Non-goals

- No sidebar information-architecture changes in this migration.
- No Inventory API redesign, database migration, or calculation rewrite.
- No new business workflow solely to imitate CRM Leads.
- No restyling of unrelated modules, except the shared Quality Inspection page used directly by Inventory.

