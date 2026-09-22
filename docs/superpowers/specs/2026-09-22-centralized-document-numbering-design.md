# Centralized ERP Document Numbering Design

## Intent and scope

Every company-visible business identifier created by this ERP must be governed from Administration > Document Numbering. This includes transaction/document references and master-data codes, not MongoDB `_id` values, external references supplied by a bank/supplier/manufacturer, or historical records. The settings screen must affect creation behavior throughout all existing modules; a settings-only implementation is not acceptable. Existing values are never renumbered.

The user can choose Auto or Manual independently for each identifier type and configure an automatic prefix and pattern. The screenshot is a layout and initial identifier-list reference, not an instruction to overwrite existing values or seed example data.

## Approaches considered

1. **Central rule and allocation service (selected):** one tenant-scoped registry, pattern compiler, counter/claim ledger, and audited settings API; creation flows call this service. It costs a broad integration pass but gives one enforceable policy and concurrency model.
2. **Adapt each existing generator independently:** smaller first diff, but leaves inconsistent rules, collision behavior, token grammar, and audit coverage.
3. **Client-side form formatting:** cannot guarantee uniqueness, cannot cover background/system-created records, and is unsafe under concurrency.

## Identifier inventory and migration boundary

Implementation begins with a source-to-field inventory of every persisted user-facing identifier and every creation/posting path that assigns it. The registry is a code-owned manifest with a stable key, UI label, owning module, model/field, supported context tokens, default mode/prefix/pattern, uniqueness scope, and allocation point. It is not assembled from arbitrary client input. Known existing generator families include Inventory SKU, stock request/issue/transfer/adjustment/movement, inspection and batch/tracking references; Purchase request/analysis/issue/order/receipt/return/payment/due/quality/import references; Sales quotation/order/delivery/invoice/return; Accounting journal/voucher/bill/invoice; Manufacturing BOM, routing, plan, MRP, orders, work orders, issues, entries, inspections, NCR, scrap, rework, schedules, maintenance, subcontracting and costing. CRM, Payroll, Administration, Supplier, and other models with user-facing business codes/references must be enumerated and connected in the same rollout. A field is in scope only if this application owns its identifier; supplier invoice, bank cheque, manufacturer serial, and other external-party identifiers remain user-supplied but can be displayed as manual-only where useful.

The manifest and a source inventory document must list the precise existing field and all producers for each key. Coverage tests fail if a registered creation flow continues to call a legacy generator or accepts a caller-supplied auto number. Specialized module services may remain as thin compatibility adapters, but all new allocations and mode decisions pass through the central service. Existing Accounting/Sales/Manufacturing reset semantics become explicit defaults in registry metadata so migration does not silently change established output.

## Rule model and authorization

Store one rule per `{ tenantId, typeKey }` with `mode` (`auto` or `manual`), `prefix`, `pattern`, `resetPolicy`, serial width, revision, timestamps, and updating actor. The manifest supplies defaults; a tenant override contains only validated configurable fields. `system-settings:view` may read rules and preview numbers. `system-settings:manage` may change them. Tenant isolation is enforced server-side on every read, write, preview, and allocation. Optimistic revision checks reject stale edits with 409. Rule changes create audit entries containing before/after, actor, tenant and request metadata.

The administration screen uses the existing Administration visual components: a searchable table grouped by module with Number Type, Mode, Prefix, Automatic Pattern, Example/Preview, and status or explanation; a Save action with validation and conflict recovery. Manual mode disables pattern fields but retains the saved pattern for a later switch back. All inputs have accessible labels and error text. The screen must not present a successful save until the API confirms persistence.

## Pattern contract

Patterns are literal text plus a restricted set of uppercase tokens: `{PREFIX}`, `{DATE}`, `{ITEM}`, `{CATEGORY}`, `{SERIAL}`. `{SERIAL}` is required for Auto mode. `{DATE}` uses the company timezone and a documented fixed `YYYYMMDD` rendering; separate reset policy determines the counter bucket, so merely adding `{DATE}` does not reset it. `{ITEM}` and `{CATEGORY}` are permitted only for types whose registered creation context supplies a stable code. No arbitrary expression language, JavaScript, nested tokens, or unknown tokens. Prefix and rendered identifier lengths must respect the target model's constraints; unsafe/control characters are rejected. A server-rendered preview uses representative context and does not consume a number. Changing a rule affects future allocations only.

## Allocation and creation flow

The server resolves the tenant and registered type, loads its effective rule, then applies the mode:

- Auto: reject a client-provided business number; atomically increment a counter scoped by tenant, type, reset bucket, and any manifest-defined partition (for example category for product SKU). Render from server-trusted context, then claim the normalized final string in a unique `{tenantId,typeKey,value}` ledger before persisting the business record.
- Manual: require a nonempty client value; normalize and validate it against the field contract; claim the same unique ledger entry before persisting. No counter increment occurs.

The allocation/claim and business write share an existing MongoDB transaction where the flow already supports one; integration must preserve idempotency keys and existing transaction boundaries. A unique ledger index and the record's existing unique index are both retained. On collision, return a clear 409 for manual entries; an auto collision caused by pre-existing data must be retried with a fresh serial within a bounded limit, then reported rather than silently falling back to a legacy generator. Counter gaps can occur after failed work; gaps are acceptable, reuse is not. Retries of idempotent operations must return the original identifier, not allocate another. Background jobs and derived records use the same service and cannot bypass mode rules.

At rollout, historical identifiers are backfilled into the claim ledger by tenant/type without modifying their records. Existing duplicates are reported and require an explicit remediation decision; the migration does not overwrite or renumber them. The initial counter position is seeded above the maximum recognized legacy serial within each bucket, with collision retry as a safety net for irregular historical formats.

## Failure and security behavior

Unknown type keys, unsupported context tokens, missing `{ITEM}`/`{CATEGORY}` context, invalid patterns, disabled tenant access, stale revisions, and number collisions fail closed with actionable errors. No numbering configuration is trusted from request bodies during creation. Manual override of an Auto rule is not allowed except through changing the rule with manage permission; any exception would require a separate audited workflow. Sensitive or externally supplied references are not transformed or silently generated.

## Verification and acceptance

Tests cover rule validation, token rendering/escaping, timezone date behavior, reset buckets, counter concurrency, tenant isolation, manual uniqueness, legacy collision retry, idempotency, failed creates, rule revision conflict, audit write, and permission enforcement. Each registered identifier type has a creation-path integration test asserting that changing Auto/Manual mode changes real persisted behavior. A repository-level coverage check compares the manifest with the source inventory and blocks any remaining direct call to a legacy generator from production creation paths. UI tests cover loading, search/grouping, edit/preview/save, read-only mode, and error/conflict states. The complete client and server suites plus a production client build are required before declaring the rollout complete.
