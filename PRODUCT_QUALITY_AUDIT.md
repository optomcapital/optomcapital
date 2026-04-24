# Product Quality Audit (P0–P3)

Date: 2026-04-08  
Scope: Frontend UX, accessibility, performance/scalability, reliability, and user ease across current Optom Capital CRM repository.

## Severity Legend

- P0: Must fix (data corruption, broken flows, severe scalability, major security risk)
- P1: High (blocks accessibility, major usability friction, frequent user confusion)
- P2: Medium (polish, consistency, efficiency, smaller a11y gaps)
- P3: Low (nice-to-have improvements)

## Recently Resolved (Included for completeness)

- SPA deep-link 404 on Vercel fixed via rewrite: [vercel.json](file:///Users/feniljikadara/Documents/optom-capital/vercel.json)
- Bank Applications local load crash fixed (ReferenceError): [BankApplicationList.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/BankApplications/BankApplicationList.jsx)
- Table pagination PropTypes added: [ui/index.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/components/ui/index.jsx#L398-L406)
- Disbursements bank filter summary optimized (avoids collecting all IDs): [DisbursementList.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Disbursements/DisbursementList.jsx)
- Kanban card click navigates to lead detail (whole card): [LeadPipeline.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Leads/LeadPipeline.jsx#L164-L213)

## Cross-Cutting Issues (Affect Multiple Screens)

### Accessibility foundations

- P1: Dialogs (Modal/Drawer/ConfirmDialog) lack proper accessibility semantics and focus management  
  Evidence: [Modal](file:///Users/feniljikadara/Documents/optom-capital/src/components/ui/index.jsx#L192-L219), [Drawer](file:///Users/feniljikadara/Documents/optom-capital/src/components/ui/index.jsx#L221-L251)  
  Issues:
  - Missing `role="dialog"`, `aria-modal="true"`, and a reliable label association (`aria-labelledby`)
  - No focus trap, no initial focus, no focus restore to the triggering element
  - Escape key works, but background remains focusable; overlay click closes without guarding against accidental dismiss
  Suggested fix:
  - Add accessible dialog roles/labels, implement focus trap + focus restore, lock background scroll, and support “confirm before close” for dirty forms.

- P1: Table row click is mouse-only (keyboard users can’t activate row navigation)  
  Evidence: [Table row onClick](file:///Users/feniljikadara/Documents/optom-capital/src/components/ui/index.jsx#L371-L386)  
  Suggested fix:
  - Prefer explicit “View” link/button in the first column, or add `tabIndex={0}`, `role="button"`, and Enter/Space handlers with focus styling.

- P1: Inputs/labels aren’t programmatically associated in core UI components  
  Evidence: [Input component](file:///Users/feniljikadara/Documents/optom-capital/src/components/ui/index.jsx#L32-L90) (label rendered as text, not `<label htmlFor>`)  
  Impact: screen readers may not announce labels; error text may not be connected.  
  Suggested fix:
  - Add stable `id` support and `<label htmlFor>`, plus `aria-invalid` and `aria-describedby` for errors/help text.

- P1: Icon-only buttons have no accessible name  
  Evidence examples:
  - Login password visibility toggle: [Login.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Login.jsx#L50-L69)
  - Modal/Drawer close buttons: [ui/index.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/components/ui/index.jsx#L204-L215)
  - Documents actions (download/trash): [DocumentsPage.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Documents/DocumentsPage.jsx#L184-L223)
  Suggested fix:
  - Add `aria-label` (and optionally `title`) for any icon-only interactive control.

- P2: Toggle control missing `aria-pressed` and state semantics  
  Evidence: [Toggle](file:///Users/feniljikadara/Documents/optom-capital/src/components/ui/index.jsx#L417-L438)  
  Suggested fix:
  - Add `aria-pressed={checked}` or switch to an actual checkbox input styled as a switch.

- P2: Sorting controls in table headers lack `aria-sort` and clear state announcements  
  Evidence: [Table header sort button](file:///Users/feniljikadara/Documents/optom-capital/src/components/ui/index.jsx#L330-L347)  
  Suggested fix:
  - Apply `aria-sort` to `<th>` and add an accessible label to the sort toggle.

- P2: Search fields are often placeholder-only (no label/aria-label)  
  Evidence examples:
  - Customers search: [CustomerList.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Customers/CustomerList.jsx#L325-L336)
  - Documents search: [DocumentsPage.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Documents/DocumentsPage.jsx#L269-L288)
  Suggested fix:
  - Add visible labels or at least `aria-label`.

- P3: Toast notifications may not be reliably announced to assistive tech  
  Evidence: toast provider: [main.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/main.jsx#L9-L21)  
  Suggested fix:
  - Ensure a live region is present/compatible; provide inline error summaries for critical form errors.

### UX consistency & navigation

- P1: Breadcrumb is rendered as a plain `div` instead of landmark navigation  
  Evidence: [Breadcrumb](file:///Users/feniljikadara/Documents/optom-capital/src/components/ui/index.jsx#L150-L168), used in [Layout.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/components/layout/Layout.jsx#L86-L113)  
  Suggested fix:
  - Wrap breadcrumb in `<nav aria-label="Breadcrumb">`.

- P1: No “Skip to content” link and limited landmark semantics  
  Evidence: [Layout.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/components/layout/Layout.jsx)  
  Suggested fix:
  - Add skip link, ensure `<nav aria-label="Primary">`, and clear main landmark.

- P2: Tabs are implemented as generic buttons without tablist semantics  
  Evidence:
  - Customer tabs: [CustomerDetail.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Customers/CustomerDetail.jsx#L160-L189)
  - Lead tabs: [LeadDetail.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Leads/LeadDetail.jsx#L335-L349)
  Suggested fix:
  - Add `role="tablist"`, `role="tab"`, `aria-selected`, keyboard arrow navigation, and `role="tabpanel"`.

- P2: Several pages return `null` while loading or when record is missing (blank screen)  
  Evidence:
  - LeadDetail: [LeadDetail.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Leads/LeadDetail.jsx#L299-L301)
  - CustomerDetail: [CustomerDetail.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Customers/CustomerDetail.jsx#L152-L153)
  Suggested fix:
  - Render a loading skeleton/placeholder and a proper not-found state with navigation actions.

### Performance/scalability patterns

- P0: “Fetch all rows using count + loop + range(1000)” exists in multiple screens and will not scale  
  Evidence:
  - Dashboard aggregates via loops: [Dashboard.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Dashboard.jsx#L76-L210)
  - Reports loads full datasets per date range: [ReportsPage.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Reports/ReportsPage.jsx#L68-L120)
  - Documents loads all customers/leads for dropdowns: [DocumentsPage.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Documents/DocumentsPage.jsx#L58-L100)
  Suggested fix:
  - Use server-side aggregation (views/RPC), search endpoints for lookups, and paginated or lazy-loaded UI data.

## Functionality-by-Functionality Audit

### Authentication / Login

- P1: Password visibility toggle lacks accessible label  
  Evidence: [Login.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Login.jsx#L62-L68)  
  Suggested fix: add `aria-label={showPassword ? 'Hide password' : 'Show password'}`.

- P2: No “Forgot password” flow / recovery UX (user ease)  
  Evidence: [Login.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Login.jsx)  
  Suggested fix: add reset flow if supported by auth backend; at minimum add guidance.

- P3: No explicit error summary region for form submission failures (screen reader UX)  
  Suggested fix: show inline form-level error message tied to the form.

### Layout / Navigation

- P1: Missing skip link and nav labeling  
  Evidence: [Layout.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/components/layout/Layout.jsx)  
  Suggested fix: add skip link, `aria-label` on nav, breadcrumb as nav.

- P2: Sidebar active state is visual-only; ensure it’s exposed via `aria-current`  
  Evidence: [Layout.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/components/layout/Layout.jsx#L62-L83)  
  Suggested fix: ensure `NavLink` renders appropriate `aria-current` (React Router typically does; confirm).

### Dashboard

- P0: Multiple expensive “count + fetch all + aggregate in JS” loops (will become very slow)  
  Evidence: [Dashboard.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Dashboard.jsx#L76-L210)  
  Suggested fix: replace with DB-side aggregation and fetch pre-aggregated time series and distributions.

- P2: Charts aren’t accessible by default (no table alternative / summary)  
  Evidence: [Dashboard.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Dashboard.jsx)  
  Suggested fix: add textual summaries and/or accessible tables for key figures.

### Customers — List

- P1: Search input has placeholder-only label  
  Evidence: [CustomerList.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Customers/CustomerList.jsx#L325-L336)

- P1: Row click navigation not keyboard-accessible (Table-level issue)  
  Evidence: [CustomerList.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Customers/CustomerList.jsx#L342-L359), [Table row onClick](file:///Users/feniljikadara/Documents/optom-capital/src/components/ui/index.jsx#L371-L386)

- P2: Filters are not persisted in URL (refresh loses state; hard to share)  
  Suggested fix: sync search/filters/page to query params.

### Customers — Detail

- P0: Cross-sell boolean fields can be saved incorrectly due to Select value stringification  
  Evidence: boolean options passed to Select: [CustomerDetail.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Customers/CustomerDetail.jsx#L333-L359)  
  Risk: `react-hook-form` will receive `"true"`/`"false"` and store incorrect types in DB unless converted.  
  Suggested fix:
  - Replace these with `Toggle`, or convert in submit handler (`value === 'true'`) before insert/update.

- P2: Blank screen on loading / missing record  
  Evidence: [CustomerDetail.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Customers/CustomerDetail.jsx#L152-L153)

- P2: Tabs lack tablist semantics and keyboard support  
  Evidence: [CustomerDetail.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Customers/CustomerDetail.jsx#L160-L189)

- P3: Many dense forms would benefit from progressive disclosure and per-section save (user ease)  
  Suggested fix: section-based edit or autosave drafts with clear save state.

### Leads — List

- P1: Table row click navigation not keyboard-accessible  
  Evidence: [LeadList.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Leads/LeadList.jsx)

- P2: Actions are separated (“View/Edit/Delete”) but row click also navigates; can cause accidental navigation when trying to select text  
  Suggested fix: reduce row-click navigation or make explicit “View” link the primary affordance.

### Leads — Pipeline (Kanban)

- P0: Fetches all leads using pagination loops (1000 rows per page)  
  Evidence: [LeadPipeline.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Leads/LeadPipeline.jsx#L39-L77)  
  Suggested fix: per-column pagination/lazy load, or server-side stage grouping.

- P1: Drag-and-drop accessibility needs verification (keyboard/screen reader)  
  Evidence: [LeadPipeline.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Leads/LeadPipeline.jsx) using `@hello-pangea/dnd`  
  Suggested fix: ensure keyboard drag support works; add instructions text and focus management after drop.

### Leads — Detail

- P2: Blank screen on loading / missing record  
  Evidence: [LeadDetail.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Leads/LeadDetail.jsx#L299-L301)

- P2: Tabs lack tablist semantics and keyboard support  
  Evidence: [LeadDetail.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Leads/LeadDetail.jsx#L335-L349)

- P2: Stage selector is a Select without explicit label in context (screen reader UX)  
  Evidence: stage Select: [LeadDetail.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Leads/LeadDetail.jsx#L328-L331)  
  Suggested fix: provide `label` prop or `aria-label`.

### Bank Applications — List

- P1: Search input uses placeholder-only label  
  Evidence: lead search in drawer: [BankApplicationList.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/BankApplications/BankApplicationList.jsx#L368-L390)

- P2: Prev/Next lead paging controls could use disabled explanation and `aria-live` for page status  
  Evidence: [BankApplicationList.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/BankApplications/BankApplicationList.jsx#L368-L390)

### Disbursements — List

- P1: Table row click navigation not keyboard-accessible  
  Evidence: uses shared Table behavior: [ui/index.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/components/ui/index.jsx#L371-L386)

- P2: Numeric parsing/formatting consistency (ensure all numeric inputs normalize to number/null)  
  Suggested fix: centralize number normalization helper and reuse across forms.

### Documents — Global Repository

- P0: Loads all customers and all leads for dropdown options (scales poorly)  
  Evidence: [DocumentsPage.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Documents/DocumentsPage.jsx#L58-L100)  
  Suggested fix: async search dropdowns (server-paginated), and filter leads by selected customer.

- P1: Search input has placeholder-only label  
  Evidence: [DocumentsPage.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Documents/DocumentsPage.jsx#L269-L288)

- P1: Icon-only actions need accessible names (download/trash)  
  Evidence: [DocumentsPage.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Documents/DocumentsPage.jsx#L195-L221)

- P2: File download uses programmatic anchor click; consider user feedback and error handling for blocked popups  
  Evidence: [DocumentsPage.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Documents/DocumentsPage.jsx#L195-L208)

- P2: PII/security posture needs confirmation (public file URLs vs signed URLs, RLS policies, audit logs)  
  Suggested fix: use signed URLs for sensitive docs and enforce strict access control.

### Reports

- P0: Pulls full datasets for date range and computes aggregates client-side  
  Evidence: [ReportsPage.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Reports/ReportsPage.jsx#L68-L120)  
  Suggested fix: DB-side aggregation (views/RPC) + return only the computed series and top-N lists.

- P2: Charts accessibility needs a textual/table alternative  
  Evidence: [ReportsPage.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Reports/ReportsPage.jsx)

## Platform / Security / Reliability (Repo-level)

- P0: Guest mode stores business data locally (privacy + data loss risk on device change)  
  Evidence: guest logic: [supabase.js](file:///Users/feniljikadara/Documents/optom-capital/src/lib/supabase.js) (guest fallback)  
  Suggested fix: ensure guest mode is clearly marked, avoid storing PII, and consider encrypted storage or a sandbox tenant.

- P1: No error boundary for React runtime errors (one crash can blank the app)  
  Evidence: [main.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/main.jsx) renders app directly  
  Suggested fix: add an error boundary around the app with a recovery action.

- P2: No explicit not-found page / route-level fallback UX (user ease)  
  Suggested fix: add a 404 route and consistent empty states.

- P2: No obvious automated test coverage (regression risk)  
  Suggested fix: add basic smoke tests for critical flows (login, list pages render, navigation).

- P3: Consistency improvements (URL-driven filters, consistent empty/loading states, consistent button labels)  
  Suggested fix: create a shared pattern for list pages (filters + table + drawer + confirm).

## Quick Wins (High Impact, Low Scope)

- Make dialogs accessible (role/labels + focus trap + focus restore): [ui/index.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/components/ui/index.jsx#L170-L251)
- Fix CustomerDetail boolean Select data corruption risk: [CustomerDetail.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Customers/CustomerDetail.jsx#L333-L359)
- Make Table row navigation keyboard-accessible or remove row-click in favor of explicit links: [ui/index.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/components/ui/index.jsx#L371-L386)
- Replace “fetch-all loops” with DB-side aggregates/search dropdowns (Dashboard/Reports/Documents): [Dashboard.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Dashboard.jsx), [ReportsPage.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Reports/ReportsPage.jsx), [DocumentsPage.jsx](file:///Users/feniljikadara/Documents/optom-capital/src/pages/Documents/DocumentsPage.jsx)

