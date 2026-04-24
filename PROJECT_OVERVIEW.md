# Optom Capital — Loan CRM (Project Overview)

## What We’re Building
An internal Loan CRM for Optom Capital to manage the end-to-end DSA/lending intermediary workflow:
- Customer onboarding + borrower profiling
- Lead capture, qualification, and stage movement
- Bank application tracking (login → underwriting → sanction)
- Collateral capture (LAP/property)
- Disbursement + revenue tracking
- Centralized document repository
- Reporting (funnel + revenue + performance)

UI is **light-mode only** (Notion/Retool-like density).

## Tech Stack
- Frontend: React (Vite), Tailwind CSS
- Auth + DB: Supabase (email/password)
- Storage: Cloudflare R2 via Supabase Edge Functions (presigned URLs)
- Tables: TanStack Table
- Charts: Recharts

## Environments / Auth Modes
### Supabase Mode (Production/Real Data)
Requires these Vite env vars:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Guest Mode (No Supabase Config)
If Supabase env vars are missing, the app runs in guest mode:
- “Continue as Guest” logs you in locally
- Sample data is seeded in browser storage
- CRUD operations update the local guest dataset

Key files:
- `src/lib/supabase.js` (guest DB + mock query engine)
- `src/lib/r2.js` (guest upload fallback using `URL.createObjectURL`)

## App Navigation / Routes
- `/login` — Sign in / Guest login
- `/dashboard` — KPIs + charts + recent leads
- `/customers` — Customer list + filters + create/edit/delete
- `/customers/:id` — Customer detail + tabs + lead creation from customer
- `/leads` — Lead list + filters + create/edit/delete
- `/leads/:id` — Lead detail: stage, loan details, collateral, bank apps, disbursement, docs, notes
- `/pipeline` — Kanban pipeline (drag/drop stage updates)
- `/bank-applications` — Applications list + create/edit/delete
- `/documents` — Global docs list + upload + delete
- `/disbursements` — Disbursement list + edit + summary cards
- `/reports` — Revenue + funnel + bank/partner performance + CSV exports

## Data Model (Tables + Key Relationships)
### customers
Purpose: Borrower profile.
Primary relationship:
- `customers.id` → referenced by `leads.customer_id`, `documents.customer_id`

Representative fields used by UI:
- Identity: `id`, `customer_code`, `name`, `entity_type`, `profession_type`
- KYC/contact: `pan_number`, `aadhaar_number`, `primary_mobile`, `email`
- Location: `city`, `state`, `residential_address`, `office_address`
- Business: `industry_category`, `business_name`, `gst_number`, `monthly_income`, `net_worth`
- Credit: `cibil_score`, `experian_score`, `equifax_score`, `crif_score`, `dpd_history`, `writeoff_settlement_history`
- Banking: `primary_bank`, `current_account_bank`, `savings_bank`, `od_cc_bank`, `avg_monthly_balance`, `monthly_banking_turnover`, `cheque_bounce_history`
- Cross-sell: `balance_transfer_opportunity`, `topup_loan_eligibility`, `insurance_opportunity`, `credit_card_offer`
- Relationship mgmt: `relationship_notes`, `last_interaction_date`, `next_followup_date`

### leads
Purpose: A loan opportunity tied to a customer.
Primary relationship:
- `leads.customer_id` → `customers.id`
Secondary relationships:
- `bank_applications.lead_id` → `leads.id`
- `collateral.lead_id` → `leads.id`
- `disbursements.lead_id` → `leads.id`
- `documents.lead_id` → `leads.id`

Representative fields used by UI:
- Identifiers: `id`, `lead_code`
- Loan: `loan_type`, `required_amount`, `preferred_tenure_months`, `preferred_bank`, `loan_purpose`
- Tracking: `lead_source`, `referral_partner_name`, `sales_manager_name`, `lead_creation_date`
- Pipeline: `stage`, `urgency_level`
- Notes: `credit_observations`, `structuring_notes`, `risk_flags`, `rejection_reason`, `case_history`

### collateral
Purpose: Collateral details for LAP/property-backed cases.
Relationship:
- `collateral.lead_id` → `leads.id`

Representative fields used by UI:
- `property_type`, `property_address`, `market_value`, `distress_value`, `ltv_percentage`, `property_ownership`, `property_age_years`

### bank_applications
Purpose: Track each bank login and underwriting journey for a lead.
Relationship:
- `bank_applications.lead_id` → `leads.id`

Representative fields used by UI:
- `bank_name`, `bank_rm_name`, `rm_contact`, `login_date`, `case_id`
- `underwriting_status`, `credit_queries`
- `sanction_amount`, `interest_rate`, `loan_tenure_months`, `emi_amount`

### disbursements
Purpose: Track disbursement details and revenue.
Relationships:
- `disbursements.lead_id` → `leads.id`
- `disbursements.bank_application_id` → `bank_applications.id`

Representative fields used by UI:
- `sanction_amount`, `final_disbursed_amount`, `disbursement_date`
- `bank_payout_percentage`, `gross_revenue`, `partner_share`, `net_revenue`
- `invoice_raised`, `payout_received`, `payment_pending`

### documents
Purpose: Documents linked to a customer and optionally a lead.
Relationships:
- `documents.customer_id` → `customers.id`
- `documents.lead_id` → `leads.id` (optional)

Representative fields used by UI:
- `document_type`, `status`, `file_name`, `file_url`, `uploaded_at`, `r2_key`

## Search / Filters Implemented
### Customers
- Search: `name`, `pan_number`, `primary_mobile`, `email`
- Filters: `entity_type`, `profession_type`, `city`

### Leads
- Search: `lead_code`, `referral_partner_name`
- Filters: `loan_type`, `stage`, `urgency_level`, `sales_manager_name`, date range (`lead_creation_date`)

### Pipeline
- Filters: `loan_type`, `urgency_level`, `sales_manager_name`
- Drag/drop updates `leads.stage`

### Bank Applications
- Search: `bank_name`, `case_id`
- Filters: `bank_name`, `underwriting_status`, date range (`login_date`)

### Documents
- Search: `file_name`, `customer.name`
- Filters: `document_type`, `status`, `customer`

### Disbursements
- Filters: date range (`disbursement_date`), bank name (via linked application), payout received flag

### Reports
- Date preset: This Month / This Quarter / Custom range
- Exports: Revenue report CSV, Funnel CSV, Partners CSV, Banks CSV

## Local Dev
- `npm install`
- `npm run dev`

## Commit + Push Policy (MANDATORY)
### No Automatic Commits / Pushes
Commits and pushes must ONLY happen when explicitly requested by you.

### Full Commit Message Requirements
For every commit request, I will provide:
- Branch name to be created
- Commit title (short, imperative)
- Commit body including:
  - Added / Changed / Removed (explicit file list + key behavior changes)
  - Why (decision-making rationale)
  - Any risks/notes
- Push outcome summary (what happened, why)

### Branch Per Commit
For every new commit, a new branch will be created (no direct commits to main unless you explicitly ask).
Suggested convention:
- `feat/<topic>-<yyyymmdd>`
- `fix/<topic>-<yyyymmdd>`
- `chore/<topic>-<yyyymmdd>`

## Commit Log (Project)
### d8ca904 — Initial commit
High level:
- Vite React app scaffold + Tailwind light-mode UI system
- Auth + routes + core CRM modules (Dashboard, Customers, Leads, Pipeline, Bank Apps, Documents, Disbursements, Reports)
- Guest mode + seeded sample dataset (for viewing without Supabase)

