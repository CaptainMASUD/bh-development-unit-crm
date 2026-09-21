# Administration Module Design

Date: 2026-09-21

## Purpose

Build a production-ready, tenant-scoped Administration module that gives authorized company administrators one place to manage company information, defaults, document numbering, administrative work, audit evidence, roles, departments, employee access, employee accounts, and compatible security policy.

The module must extend the existing application rather than create parallel identity, company, department, task, permission, or audit systems. Platform Super Admin company onboarding, subscription, and module-entitlement controls remain platform responsibilities. Tenant administrators manage the operational settings and users of their own company.

## Existing Architecture and Constraints

The application is a React 18/Vite/Tailwind frontend backed by an Express 4 and Mongoose API. Authentication uses JWT bearer tokens. `protect` resolves the user, company membership, active subscription, tenant context, and enabled ERP modules. Tenant scoping is enforced by the Mongoose tenant plugin and request context. Authorization currently combines protected system roles with permission-group permission keys.

Existing records and flows to preserve include:

- `Company`, `CompanyMembership`, `User`, `Department`, `Position`, `AccessRole`, `PermissionGroup`, and `AuditLog`.
- Existing company onboarding and branch management.
- Existing employee CRUD and its links to payroll, leave, salary, roster, CRM assignment, department, position, role, and permission group.
- Existing permission keys and module-entitlement filtering.
- Existing audit-writing calls across CRM, accounting, inventory, sales, purchase, payroll, and administration.
- Existing CRM visual language: rounded white surfaces, compact page headers, embedded search and filter controls, responsive tables, modals, badges, and explicit loading/empty/error states.
- Existing atomic numbering implementations in accounting, sales, manufacturing, and import purchasing.

Compatibility aliases and existing endpoints may remain during migration, but new Administration screens use one canonical service per domain.

## Information Architecture

Administration navigation is ordered as follows:

1. Dashboard, including Nearby Tasks
2. Company Details
3. System Defaults
4. Document Numbering
5. Audit Trail
6. Role Management
7. Departments
8. Employee Access Control
9. Add Employee
10. Employee Account Control
11. System Security Settings

Super Admin sees the existing platform-level Company Setup separately. Tenant Admin sees the operational Company Details screen for the active tenant. Employees only see Administration pages explicitly granted by backend permissions.

## Authorization Model

### Principals

- **Super Admin:** platform authority. It can onboard/suspend companies and administer platform configuration, but normal tenant operations must use an explicit tenant context.
- **Tenant Admin:** protected tenant role with complete tenant Administration authority except platform subscription/module-entitlement changes.
- **Employee:** receives effective permissions from assigned role, department policy, and individual overrides.
- **Protected roles:** Super Admin, Admin, and the base Employee role cannot be destructively edited or deleted.

### Effective permissions

The canonical calculation is:

`effective = ((role grants ∪ department grants ∪ individual grants) − individual restrictions) ∩ enabled-module permissions`

Rules:

- A denied `view` action removes dependent create, edit/manage, delete, approve, post, reverse, and export actions in the same permission family.
- Explicit individual restrictions take precedence over grants.
- Tenant Admin receives the tenant-administration permission set explicitly; this is not inferred from frontend visibility.
- Super Admin bypass remains limited to platform operations unless an explicit tenant context is selected.
- Users cannot remove their own critical administrative access, deactivate their own account, revoke their own current session, or demote their own protected role.
- An administrator cannot modify a target with a higher privilege level.
- Every permission, role, department-policy, and account-authority change is audited.

The existing `PermissionGroup` remains a compatibility representation while `AccessRole` becomes the role-facing aggregate. A new tenant-scoped `AccessPolicy` stores department grants and individual grants/restrictions without duplicating `User` or changing historical role assignments. One authorization service resolves and caches effective permissions; middleware and `/users/me` both call this service so frontend and backend see the same result.

## Domain Design

### 1. Company Details

Extend the existing `Company` record with:

- business type
- VAT/TIN fields with explicit labels
- contact person
- company status metadata
- logo storage key/public identifier so replacement and removal can clean up safely

Existing name, legal name, registration number, email, phone, website, address, city, state/division, postal code, country, currency, time zone, fiscal year start, and status fields remain canonical.

A tenant-aware company service owns validation, reads, updates, logo replacement/removal, and audit snapshots. Other ERP modules read a sanitized company profile from the same service/API. Only authorized tenant administrators may modify it. Platform-only subscription and enabled-module fields are never accepted from this tenant endpoint.

### 2. System Defaults

Create one tenant-scoped `SystemSettings` document with an explicit schema and version. Initial settings are:

- `tablePageSize`, constrained to a safe range of 10–200.
- `auditStorageLimit`, expressed as the maximum live audit-record count and constrained to a safe operational range.
- `auditRetentionMode`: `warn_only` by default or `archive_then_purge` when durable archive storage is available.

The settings service supplies defaults when no record exists and exposes a typed registry so new settings can be added without scattered constants. List endpoints use `tablePageSize` only when the request does not supply a smaller valid limit; server maximums still win.

Audit cleanup never silently deletes records. At the limit, `warn_only` creates an administrative task. `archive_then_purge` first writes an immutable archive through the existing document-storage abstraction, records its checksum/range/count, verifies the archive, and only then removes the archived live rows in bounded batches. A cleanup summary is itself audited. If durable archive storage is unavailable, enforcement fails safely and creates an administrative task.

### 3. Document Numbering

Create tenant-scoped `DocumentNumberRule` and `DocumentNumberSequence` models and a reusable numbering service. A rule includes document type, prefix, suffix, starting/current number, padding length, separator, reset policy, preview, and active status.

Supported reset buckets are never, calendar year, calendar month, and financial year. The service formats date tokens such as `{YYYY}` without mutating prior documents. Sequence allocation uses a single atomic `findOneAndUpdate` with `$inc`, scoped by tenant, rule, and reset bucket. A unique compound index on tenant/rule/bucket prevents duplicate counters. Business-document models retain their own unique tenant/document-number indexes.

Legacy module numbering services remain callable during migration and delegate to the shared service when a matching active rule exists. Existing document numbers are never rewritten. The rule API offers a pure preview that does not consume a sequence.

### 4. Nearby Tasks

Provide an Administration dashboard projection, not a second task database. An `administrativeTaskService` aggregates:

- existing pending approvals and workflow tasks
- locked/inactive/problem employee accounts
- incomplete company/default/numbering/security configuration
- audit-retention warnings
- review or expiry dates available in existing ERP records
- security actions requiring attention

Every item has a stable source key, title, type, due date, priority, module/entity reference, responsible person, status, and safe internal navigation target. Derived configuration tasks disappear when resolved. Existing persisted task/workflow records keep their original lifecycle.

### 5. Audit Trail

Expand the existing tenant-scoped `AuditLog` rather than create a parallel log. It supports login/logout where the current authentication flow can reliably emit the event, CRUD, approval/rejection, roles, permissions, account operations, security settings, company settings, and system settings.

The audit service stores timestamp, actor, employee ID snapshot, action, module, entity type/id, description, redacted before/after values, reliable IP, and user agent. A recursive redaction policy removes password, password hash, token, secret, OTP, authorization, cookie, credential, and reset-token values before persistence. Critical Administration operations use a strict audit mode inside their transaction and fail if required audit evidence cannot be written. Existing lower-risk integrations may continue best-effort writes until migrated.

Audit records have no update/delete API for normal users. The read API provides server-side search, date range, module, user, action, cursor/page pagination, and detail view. Export and retention operations require separate permissions.

### 6. Roles and Departments

Role Management supports create, edit, activate/deactivate, duplicate, assigned-employee count/list, and safe deletion of unused custom roles. A role owns its module/action permission grants directly through the compatibility permission group. Protected roles are read-only.

Department Management extends the existing department with code, department head, parent department, and status while preserving description, creator, dates, and payroll/accounting links. It provides search, filters, employee count, and hierarchy. Unique tenant indexes cover normalized name and code. Cycles in the hierarchy are rejected. Departments with active employees or child departments cannot be deleted; deactivation or an explicit reassignment workflow is required.

### 7. Employee Access Control

This screen is the main authorization workbench. It can select an employee and display inherited role permissions, department permissions, individual grants/restrictions, and final effective permissions grouped by ERP module/submodule. Select All operates within visible groups and respects module entitlements and view dependencies.

Saving access changes is concurrency-safe through a revision field. Stale edits return `409 Conflict` with the latest policy. The service validates privilege boundaries, protects self-access, persists changes transactionally, invalidates the effective-permission cache, and writes a strict audit event.

### 8. Add Employee

Reuse `User` as the employee/system-account entity. The Administration flow captures only access-relevant identity and employment fields: name, employee ID, email, phone, department, designation/position, role, reporting manager, employment type, joining date, existing branch/location, status, login identifier, and account-access status. Detailed HR/payroll data remains in the HR Payroll module.

Creation uses the existing employee controller/service after it is extracted into a transaction-capable employee service. Employee ID and email remain unique. Employee IDs use a configured employee numbering rule when available, with a safe compatibility fallback. Employee, membership, access assignments, and initial account state are created consistently. No duplicate Employee model is introduced.

### 9. Employee Account Control

Add account-security state to `User` or a one-to-one tenant-scoped `UserSecurityState` where security-only fields should remain isolated. It tracks lock state/reason, failed-login count, lock expiry, force-password-change flag, password-changed timestamp, and session revision.

Authorized administrators can view, activate/deactivate, lock/unlock, issue a secure password reset, force password change, change role/department, inspect effective permissions, revoke sessions, and view basic security activity. Existing passwords are never shown. Password reset uses a short-lived, hashed, single-use reset token or the existing secure reset mechanism; it never returns stored credentials. Raising `sessionRevision` invalidates issued sessions once JWT verification includes the revision.

### 10. System Security Settings

Create a tenant-scoped, versioned `SecuritySettings` record with validated limits for password length/complexity, failed-attempt threshold, lockout duration, session expiration, optional password expiry, force-change-after-admin-reset, supported concurrent-session policy, and inactivity timeout.

Policy changes apply safely:

- Existing password hashes are never reprocessed.
- New password rules apply on creation/reset/change, not retroactively to stored hashes.
- Session-lifetime reductions do not corrupt current requests; compatibility is handled through token/session revision and explicit effective dates where needed.
- Unsupported concurrent-session behavior is shown as unavailable rather than simulated in the frontend.
- Safe server minimums/maximums cannot be bypassed by API calls.

## API Shape

All new endpoints are under `/api/administration` and use `protect`, tenant context, module entitlement, and granular permissions. Existing endpoints remain as compatibility adapters while clients migrate.

Primary resources:

- `/company` and `/company/logo`
- `/settings`
- `/numbering-rules` and `/numbering-rules/:id/preview`
- `/tasks`
- `/audit-logs`
- `/roles`
- `/departments`
- `/employees`
- `/employees/:id/access`
- `/employees/:id/account-actions`
- `/security-settings`

Responses follow the existing JSON style while adding a consistent `{ success, message, data, pagination }` envelope for new Administration endpoints. Validation errors return `400`, authentication failures `401`, authorization failures `403`, missing resources `404`, stale revisions/uniqueness conflicts `409`, and unexpected failures `500` without sensitive details.

## Frontend Design

Administration pages use the CRM Leads page as the visual and interaction reference:

- responsive max-width content shell
- compact header with page title, description, primary action, and utilities
- full-width embedded search/filter bar with filter chips
- server-driven tables with sticky headings where appropriate
- consistent status badges, action menus, pagination/load-more behavior, modals, confirmations, and toasts
- explicit skeleton/loading, empty, filtered-empty, error, and retry states
- keyboard-accessible dialogs and controls, visible focus, labels, and touch-safe targets

Shared Administration UI primitives will be extracted for page shells, toolbars, filters, tables, pagination, field layouts, audit detail rendering, permission matrices, destructive confirmations, and status badges. They reuse the existing design tokens and do not add a competing CSS theme.

## Validation, Transactions, and Error Handling

- Validate and normalize every write on the server; client validation is assistive only.
- Use Mongoose unique indexes for identity, department codes/names, numbering sequences, and document references.
- Use `runMongoTransaction` for employee/account/access changes and other multi-document operations.
- Reject unknown request fields on security-sensitive endpoints.
- Use optimistic revisions for settings and access-policy edits.
- Do not expose stack traces, secrets, hashes, reset tokens, or raw authorization material.
- Cache company/settings/effective-permission reads only with tenant-qualified keys and explicit invalidation after writes.

## Migration and Compatibility

1. Add schemas, indexes, services, and read-compatible defaults without changing current behavior.
2. Add Administration APIs and strict audit redaction.
3. Migrate the frontend navigation and screens.
4. Delegate old company/access/employee endpoints to the new services.
5. Adopt shared numbering module by module; preserve existing assigned numbers.
6. Enable security enforcement incrementally after compatible defaults are stored.
7. Remove compatibility adapters only after route and data-usage tests prove no consumers remain.

No destructive bulk migration is allowed. Index creation must detect and report conflicting legacy data before enforcing uniqueness.

## Delivery Phases

### Phase 1: Administration foundation

Navigation, Administration dashboard, Company Details, System Defaults, shared Administration UI, settings/company services, granular permissions, and required audit events.

### Phase 2: Shared document numbering

Rule/sequence models, atomic service, configuration UI, preview, compatibility adapters, and concurrency tests.

### Phase 3: Audit and nearby tasks

Audit redaction/query/detail UI, strict Administration audit mode, retention workflow, and aggregated administrative task dashboard.

### Phase 4: Organization and authorization

Role Management, Department Management, access-policy model, effective-permission service/middleware, permission workbench, self-protection, and cache invalidation.

### Phase 5: Employee and account administration

Focused Add Employee, employee service extraction, account actions, password reset, lockout state, session revision, and security activity.

### Phase 6: Security policy and hardening

Security Settings, authentication enforcement, compatibility rollout, full regression/security testing, and removal of proven-unused adapters.

Each phase is independently deployable and must leave existing modules operational.

## Testing Strategy

- Model tests for tenant indexes, validation, hierarchy cycles, settings bounds, and redaction.
- Service tests for effective-permission precedence, view dependencies, privilege boundaries, numbering reset buckets, and retention safety.
- High-contention integration tests proving numbering uniqueness.
- API tests for tenant isolation, permissions, self-lockout prevention, higher-privilege protection, validation, pagination, filters, and error envelopes.
- Authentication tests for failed attempts, timed lockout, password reset, forced change, session revision, and compatibility defaults.
- Frontend tests for navigation order, search/filter behavior, permission matrix rules, form validation, modal safety, pagination, and responsive rendering contracts.
- Regression tests for existing company setup, employees, payroll links, permissions, module entitlements, and document numbering.
- Build and lint verification for client and full server test execution before each phase is considered complete.

## Completion Criteria

The module is complete when all eleven Administration areas are reachable through the intended permissions, tenant boundaries are enforced server-side, company/default settings are centrally reusable, numbering is concurrency-safe, audit records are immutable and redacted, roles/departments/access changes are safe and audited, employee/account operations preserve existing HR integrations, security settings are actually enforced where supported, and all new plus existing critical tests pass.
