import { createClient } from '@supabase/supabase-js'

function normalizeSupabaseUrl(input) {
  const raw = String(input || '').trim()
  if (!raw) return ''
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  return `https://${raw}.supabase.co`
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL)
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

const GUEST_SESSION_KEY = 'optom_guest_session'

const guestUser = Object.freeze({
  id: 'guest',
  email: 'guest@optom.local',
})

const GUEST_DB_KEY = 'optom_guest_db_v1'

function getGuestSession() {
  try {
    const raw = localStorage.getItem(GUEST_SESSION_KEY)
    if (!raw) return null
    return { user: guestUser }
  } catch {
    return null
  }
}

function setGuestSession(active) {
  try {
    if (active) localStorage.setItem(GUEST_SESSION_KEY, '1')
    else localStorage.removeItem(GUEST_SESSION_KEY)
  } catch {
    void 0
  }
}

function createMockQueryResult({ data = [], count = 0 } = {}) {
  return { data, error: null, count }
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function getValueByPath(obj, path) {
  if (!obj || !path) return undefined
  const parts = String(path).split('.').filter(Boolean)
  let cur = obj
  for (const p of parts) {
    if (cur == null) return undefined
    cur = cur[p]
  }
  return cur
}

function normalizeLikePattern(pattern) {
  const raw = String(pattern || '')
  return raw.replaceAll('%', '')
}

function matchIlike(value, pattern) {
  const v = String(value ?? '').toLowerCase()
  const p = normalizeLikePattern(pattern).toLowerCase()
  return v.includes(p)
}

function matchLike(value, pattern) {
  const v = String(value ?? '')
  const p = normalizeLikePattern(pattern)
  return v.includes(p)
}

function parseInList(value) {
  const raw = String(value || '')
  const items = []
  const re = /"([^"]+)"/g
  let m = re.exec(raw)
  while (m) {
    items.push(m[1])
    m = re.exec(raw)
  }
  return items
}

function makeId(prefix) {
  const base = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(16).slice(2)
  return prefix ? `${prefix}_${base}` : base
}

function isoDateDaysAgo(daysAgo) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

function seedGuestDb() {
  const customers = [
    {
      id: 'cus_001',
      customer_code: 'CUST-0001',
      name: 'Arjun Mehta',
      entity_type: 'Individual',
      profession_type: 'Business Owner',
      pan_number: 'AQWPM1234K',
      aadhaar_number: '1234-5678-9012',
      primary_mobile: '9876543210',
      email: 'arjun.mehta@example.com',
      city: 'Mumbai',
      state: 'MH',
      residential_address: 'Andheri West, Mumbai',
      office_address: 'BKC, Mumbai',
      industry_category: 'Trading',
      business_name: 'Mehta Trading Co.',
      gst_number: '27AAAPL1234C1Z9',
      monthly_income: 220000,
      net_worth: 7500000,
      cibil_score: 778,
      experian_score: 796,
      equifax_score: 784,
      crif_score: 790,
      credit_card_outstanding: 180000,
      existing_emi_outflow: 62000,
      total_loan_exposure: 1450000,
      dpd_history: '0 DPD last 12M',
      writeoff_settlement_history: '',
      primary_bank: 'HDFC Bank',
      current_account_bank: 'HDFC Bank',
      savings_bank: 'HDFC Bank',
      od_cc_bank: '',
      avg_monthly_balance: 350000,
      monthly_banking_turnover: 1800000,
      cheque_bounce_history: 'None',
      balance_transfer_opportunity: true,
      topup_loan_eligibility: true,
      insurance_opportunity: true,
      credit_card_offer: true,
      relationship_notes: 'Warm relationship, fast doc turnaround.',
      last_interaction_date: isoDateDaysAgo(5),
      next_followup_date: isoDateDaysAgo(-3),
      created_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'cus_002',
      customer_code: 'CUST-0002',
      name: 'Neha Sharma',
      entity_type: 'Individual',
      profession_type: 'Salaried',
      pan_number: 'BCTPS2345L',
      aadhaar_number: '2345-6789-0123',
      primary_mobile: '9811122233',
      email: 'neha.sharma@example.com',
      city: 'Delhi',
      state: 'DL',
      residential_address: 'Dwarka, New Delhi',
      office_address: 'Gurugram, Haryana',
      industry_category: 'IT Services',
      business_name: '',
      gst_number: '',
      monthly_income: 165000,
      net_worth: 3200000,
      cibil_score: 742,
      experian_score: 760,
      equifax_score: 748,
      crif_score: 755,
      credit_card_outstanding: 90000,
      existing_emi_outflow: 38000,
      total_loan_exposure: 980000,
      dpd_history: '1× 3 DPD (6M ago)',
      writeoff_settlement_history: '',
      primary_bank: 'ICICI Bank',
      current_account_bank: '',
      savings_bank: 'ICICI Bank',
      od_cc_bank: '',
      avg_monthly_balance: 140000,
      monthly_banking_turnover: 620000,
      cheque_bounce_history: 'None',
      balance_transfer_opportunity: true,
      topup_loan_eligibility: false,
      insurance_opportunity: true,
      credit_card_offer: true,
      relationship_notes: 'Needs rate negotiation.',
      last_interaction_date: isoDateDaysAgo(2),
      next_followup_date: isoDateDaysAgo(-1),
      created_at: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'cus_003',
      customer_code: 'CUST-0003',
      name: 'Dr. Rakesh Iyer',
      entity_type: 'Individual',
      profession_type: 'Doctor',
      pan_number: 'CDEPI3456M',
      aadhaar_number: '3456-7890-1234',
      primary_mobile: '9898989898',
      email: 'rakesh.iyer@example.com',
      city: 'Bengaluru',
      state: 'KA',
      residential_address: 'Indiranagar, Bengaluru',
      office_address: 'Koramangala, Bengaluru',
      industry_category: 'Healthcare',
      business_name: 'Iyer Clinic',
      gst_number: '29AAAPL9876D1Z2',
      monthly_income: 310000,
      net_worth: 12000000,
      cibil_score: 812,
      experian_score: 820,
      equifax_score: 805,
      crif_score: 818,
      credit_card_outstanding: 65000,
      existing_emi_outflow: 52000,
      total_loan_exposure: 2100000,
      dpd_history: '0 DPD last 24M',
      writeoff_settlement_history: '',
      primary_bank: 'Axis Bank',
      current_account_bank: 'Axis Bank',
      savings_bank: 'Axis Bank',
      od_cc_bank: 'Axis Bank',
      avg_monthly_balance: 520000,
      monthly_banking_turnover: 2600000,
      cheque_bounce_history: 'None',
      balance_transfer_opportunity: false,
      topup_loan_eligibility: true,
      insurance_opportunity: true,
      credit_card_offer: false,
      relationship_notes: 'Strong profile, high net worth.',
      last_interaction_date: isoDateDaysAgo(9),
      next_followup_date: isoDateDaysAgo(-7),
      created_at: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'cus_004',
      customer_code: 'CUST-0004',
      name: 'Saanvi Traders',
      entity_type: 'Proprietorship',
      profession_type: 'Business Owner',
      pan_number: 'DXYPS4567N',
      aadhaar_number: '',
      primary_mobile: '9000011111',
      email: 'accounts@saanvitraders.in',
      city: 'Pune',
      state: 'MH',
      residential_address: 'Kothrud, Pune',
      office_address: 'Shivajinagar, Pune',
      industry_category: 'FMCG Distribution',
      business_name: 'Saanvi Traders',
      gst_number: '27AAAPL1111E1Z5',
      monthly_income: 190000,
      net_worth: 5400000,
      cibil_score: 705,
      experian_score: 720,
      equifax_score: 710,
      crif_score: 715,
      credit_card_outstanding: 240000,
      existing_emi_outflow: 75000,
      total_loan_exposure: 3600000,
      dpd_history: '2× 30+ DPD (12M ago)',
      writeoff_settlement_history: '',
      primary_bank: 'SBI',
      current_account_bank: 'SBI',
      savings_bank: 'SBI',
      od_cc_bank: 'SBI',
      avg_monthly_balance: 220000,
      monthly_banking_turnover: 1400000,
      cheque_bounce_history: '1 bounce (8M ago)',
      balance_transfer_opportunity: true,
      topup_loan_eligibility: true,
      insurance_opportunity: false,
      credit_card_offer: true,
      relationship_notes: 'Needs cleanup on banking docs.',
      last_interaction_date: isoDateDaysAgo(3),
      next_followup_date: isoDateDaysAgo(-2),
      created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'cus_005',
      customer_code: 'CUST-0005',
      name: 'Zenith Manufacturing LLP',
      entity_type: 'LLP',
      profession_type: 'Business Owner',
      pan_number: 'EFGPM5678P',
      aadhaar_number: '',
      primary_mobile: '9123456789',
      email: 'finance@zenithmfg.com',
      city: 'Ahmedabad',
      state: 'GJ',
      residential_address: '',
      office_address: 'Sanand, Ahmedabad',
      industry_category: 'Manufacturing',
      business_name: 'Zenith Manufacturing LLP',
      gst_number: '24AAAPL2222F1Z6',
      monthly_income: 450000,
      net_worth: 28000000,
      cibil_score: 768,
      experian_score: 780,
      equifax_score: 772,
      crif_score: 776,
      credit_card_outstanding: 0,
      existing_emi_outflow: 185000,
      total_loan_exposure: 12500000,
      dpd_history: '0 DPD last 12M',
      writeoff_settlement_history: '',
      primary_bank: 'Kotak Mahindra Bank',
      current_account_bank: 'Kotak Mahindra Bank',
      savings_bank: '',
      od_cc_bank: 'Kotak Mahindra Bank',
      avg_monthly_balance: 1250000,
      monthly_banking_turnover: 9800000,
      cheque_bounce_history: 'None',
      balance_transfer_opportunity: false,
      topup_loan_eligibility: true,
      insurance_opportunity: true,
      credit_card_offer: false,
      relationship_notes: 'Large ticket, fast underwriting needed.',
      last_interaction_date: isoDateDaysAgo(1),
      next_followup_date: isoDateDaysAgo(-4),
      created_at: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]

  const leads = [
    {
      id: 'lead_001',
      lead_code: 'LEAD-0001',
      customer_id: 'cus_001',
      loan_type: 'Business Loan',
      required_amount: 2500000,
      preferred_tenure_months: 36,
      preferred_bank: 'HDFC Bank',
      lead_source: 'Website',
      referral_partner_name: 'Prime DSA',
      sales_manager_name: 'Karan Singh',
      urgency_level: 'High',
      stage: 'Qualification Done',
      lead_creation_date: isoDateDaysAgo(18),
      loan_purpose: 'Working capital for inventory expansion.',
      credit_observations: 'Good bureau, stable turnover.',
      structuring_notes: 'Consider OD/CC line with collateral top-up.',
      risk_flags: '',
      rejection_reason: '',
      case_history: 'Initial call done, docs checklist shared.',
      created_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'lead_002',
      lead_code: 'LEAD-0002',
      customer_id: 'cus_002',
      loan_type: 'Personal Loan',
      required_amount: 800000,
      preferred_tenure_months: 24,
      preferred_bank: 'ICICI Bank',
      lead_source: 'Referral',
      referral_partner_name: 'Urban Leads',
      sales_manager_name: 'Priya Nair',
      urgency_level: 'Medium',
      stage: 'Documents Collected',
      lead_creation_date: isoDateDaysAgo(10),
      loan_purpose: 'Home renovation.',
      credit_observations: 'Minor DPD in past.',
      structuring_notes: 'Try salary account bank first.',
      risk_flags: 'DPD history (minor)',
      rejection_reason: '',
      case_history: 'KYC collected, bank statement pending.',
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'lead_003',
      lead_code: 'LEAD-0003',
      customer_id: 'cus_003',
      loan_type: 'Loan Against Property',
      required_amount: 6000000,
      preferred_tenure_months: 120,
      preferred_bank: 'Axis Bank',
      lead_source: 'Cold Call',
      referral_partner_name: 'Doctor Network',
      sales_manager_name: 'Karan Singh',
      urgency_level: 'High',
      stage: 'Login to Bank',
      lead_creation_date: isoDateDaysAgo(25),
      loan_purpose: 'Clinic expansion and equipment.',
      credit_observations: 'Strong profile.',
      structuring_notes: 'LAP with 60% LTV.',
      risk_flags: '',
      rejection_reason: '',
      case_history: 'Valuation initiated.',
      created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'lead_004',
      lead_code: 'LEAD-0004',
      customer_id: 'cus_004',
      loan_type: 'Working Capital',
      required_amount: 4000000,
      preferred_tenure_months: 48,
      preferred_bank: 'SBI',
      lead_source: 'Partner',
      referral_partner_name: 'Prime DSA',
      sales_manager_name: 'Priya Nair',
      urgency_level: 'Medium',
      stage: 'Underwriting',
      lead_creation_date: isoDateDaysAgo(32),
      loan_purpose: 'Seasonal stocking.',
      credit_observations: 'Needs GST reconciliation.',
      structuring_notes: 'Split between term loan + CC.',
      risk_flags: 'Cheque bounce history',
      rejection_reason: '',
      case_history: 'Bank query received on turnover.',
      created_at: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'lead_005',
      lead_code: 'LEAD-0005',
      customer_id: 'cus_005',
      loan_type: 'Equipment Finance',
      required_amount: 12000000,
      preferred_tenure_months: 60,
      preferred_bank: 'Kotak Mahindra Bank',
      lead_source: 'Website',
      referral_partner_name: 'Industrial Leads',
      sales_manager_name: 'Aman Verma',
      urgency_level: 'High',
      stage: 'Sanction Approved',
      lead_creation_date: isoDateDaysAgo(40),
      loan_purpose: 'New CNC machine purchase.',
      credit_observations: 'Good banking, stable GST.',
      structuring_notes: 'Disburse in 2 tranches.',
      risk_flags: '',
      rejection_reason: '',
      case_history: 'Sanction received, pending docs.',
      created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'lead_006',
      lead_code: 'LEAD-0006',
      customer_id: 'cus_001',
      loan_type: 'Business Loan',
      required_amount: 3500000,
      preferred_tenure_months: 48,
      preferred_bank: 'HDFC Bank',
      lead_source: 'Referral',
      referral_partner_name: 'Prime DSA',
      sales_manager_name: 'Aman Verma',
      urgency_level: 'High',
      stage: 'Disbursement Processing',
      lead_creation_date: isoDateDaysAgo(55),
      loan_purpose: 'Warehouse lease + inventory.',
      credit_observations: 'Sanction ok.',
      structuring_notes: 'Verify invoice and payout terms.',
      risk_flags: '',
      rejection_reason: '',
      case_history: 'Disbursement checklist in progress.',
      created_at: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'lead_007',
      lead_code: 'LEAD-0007',
      customer_id: 'cus_002',
      loan_type: 'Loan Against Property',
      required_amount: 9000000,
      preferred_tenure_months: 180,
      preferred_bank: 'SBI',
      lead_source: 'Partner',
      referral_partner_name: 'Urban Leads',
      sales_manager_name: 'Karan Singh',
      urgency_level: 'Medium',
      stage: 'Disbursed',
      lead_creation_date: isoDateDaysAgo(75),
      loan_purpose: 'Debt consolidation.',
      credit_observations: 'Approved after rate negotiation.',
      structuring_notes: 'Long tenure, low EMI.',
      risk_flags: '',
      rejection_reason: '',
      case_history: 'Disbursed successfully.',
      created_at: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'lead_008',
      lead_code: 'LEAD-0008',
      customer_id: 'cus_003',
      loan_type: 'Business Loan',
      required_amount: 1500000,
      preferred_tenure_months: 24,
      preferred_bank: 'Axis Bank',
      lead_source: 'Referral',
      referral_partner_name: 'Doctor Network',
      sales_manager_name: 'Priya Nair',
      urgency_level: 'Low',
      stage: 'Declined',
      lead_creation_date: isoDateDaysAgo(12),
      loan_purpose: 'Short-term cash flow.',
      credit_observations: 'Declined due to policy mismatch.',
      structuring_notes: 'Try alternate NBFC.',
      risk_flags: '',
      rejection_reason: 'Policy: insufficient vintage for requested product.',
      case_history: 'Re-route to alternate lender.',
      created_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'lead_009',
      lead_code: 'LEAD-0009',
      customer_id: 'cus_005',
      loan_type: 'Overdraft / CC',
      required_amount: 5000000,
      preferred_tenure_months: 36,
      preferred_bank: 'Kotak Mahindra Bank',
      lead_source: 'Website',
      referral_partner_name: 'Industrial Leads',
      sales_manager_name: 'Aman Verma',
      urgency_level: 'Medium',
      stage: 'Lead Generated',
      lead_creation_date: isoDateDaysAgo(3),
      loan_purpose: 'Working capital buffer.',
      credit_observations: '',
      structuring_notes: '',
      risk_flags: '',
      rejection_reason: '',
      case_history: 'New lead captured.',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'lead_010',
      lead_code: 'LEAD-0010',
      customer_id: 'cus_004',
      loan_type: 'Personal Loan',
      required_amount: 600000,
      preferred_tenure_months: 18,
      preferred_bank: 'ICICI Bank',
      lead_source: 'Referral',
      referral_partner_name: 'Prime DSA',
      sales_manager_name: 'Priya Nair',
      urgency_level: 'High',
      stage: 'Qualification Done',
      lead_creation_date: isoDateDaysAgo(6),
      loan_purpose: 'Business travel and expenses.',
      credit_observations: 'Borderline profile, verify bureau.',
      structuring_notes: 'Consider smaller ticket if needed.',
      risk_flags: '',
      rejection_reason: '',
      case_history: 'KYC scheduled.',
      created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]

  const collateral = [
    {
      id: 'col_001',
      lead_id: 'lead_003',
      property_type: 'Residential',
      property_address: 'Indiranagar, Bengaluru',
      market_value: 10500000,
      distress_value: 8500000,
      ltv_percentage: 60,
      property_ownership: 'Self',
      property_age_years: 8,
      created_at: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'col_002',
      lead_id: 'lead_007',
      property_type: 'Residential',
      property_address: 'Dwarka, New Delhi',
      market_value: 15500000,
      distress_value: 12200000,
      ltv_percentage: 58,
      property_ownership: 'Joint',
      property_age_years: 11,
      created_at: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]

  const bank_applications = [
    {
      id: 'ba_001',
      lead_id: 'lead_003',
      bank_name: 'Axis Bank',
      bank_rm_name: 'Rohit Khanna',
      rm_contact: '9999911111',
      login_date: isoDateDaysAgo(22),
      case_id: 'AXIS/BLR/2026/001',
      underwriting_status: 'In Review',
      credit_queries: 'Need updated ITR and clinic financials.',
      sanction_amount: null,
      interest_rate: 10.75,
      loan_tenure_months: 120,
      emi_amount: null,
      created_at: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'ba_002',
      lead_id: 'lead_004',
      bank_name: 'SBI',
      bank_rm_name: 'Anita Joshi',
      rm_contact: '9000099999',
      login_date: isoDateDaysAgo(28),
      case_id: 'SBI/PUN/2026/014',
      underwriting_status: 'Query Raised',
      credit_queries: 'GST mismatch for 2 months; submit clarifications.',
      sanction_amount: null,
      interest_rate: 12.25,
      loan_tenure_months: 48,
      emi_amount: null,
      created_at: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'ba_003',
      lead_id: 'lead_005',
      bank_name: 'Kotak Mahindra Bank',
      bank_rm_name: 'Vikas Jain',
      rm_contact: '9888800000',
      login_date: isoDateDaysAgo(36),
      case_id: 'KMB/AHD/2026/101',
      underwriting_status: 'Approved',
      credit_queries: 'Final invoice and machine quotation.',
      sanction_amount: 11800000,
      interest_rate: 11.5,
      loan_tenure_months: 60,
      emi_amount: 260000,
      created_at: new Date(Date.now() - 36 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'ba_004',
      lead_id: 'lead_006',
      bank_name: 'HDFC Bank',
      bank_rm_name: 'Sneha Kapoor',
      rm_contact: '9111100000',
      login_date: isoDateDaysAgo(50),
      case_id: 'HDFC/MUM/2026/212',
      underwriting_status: 'Approved',
      credit_queries: '',
      sanction_amount: 3400000,
      interest_rate: 12.0,
      loan_tenure_months: 48,
      emi_amount: 90000,
      created_at: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'ba_005',
      lead_id: 'lead_007',
      bank_name: 'SBI',
      bank_rm_name: 'Anita Joshi',
      rm_contact: '9000099999',
      login_date: isoDateDaysAgo(72),
      case_id: 'SBI/DLH/2026/088',
      underwriting_status: 'Approved',
      credit_queries: '',
      sanction_amount: 8800000,
      interest_rate: 10.25,
      loan_tenure_months: 180,
      emi_amount: 95000,
      created_at: new Date(Date.now() - 72 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'ba_006',
      lead_id: 'lead_008',
      bank_name: 'Axis Bank',
      bank_rm_name: 'Rohit Khanna',
      rm_contact: '9999911111',
      login_date: isoDateDaysAgo(9),
      case_id: 'AXIS/BLR/2026/044',
      underwriting_status: 'Declined',
      credit_queries: 'Policy mismatch.',
      sanction_amount: null,
      interest_rate: null,
      loan_tenure_months: null,
      emi_amount: null,
      created_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]

  const disbursements = [
    {
      id: 'disb_001',
      lead_id: 'lead_007',
      bank_application_id: 'ba_005',
      sanction_amount: 8800000,
      final_disbursed_amount: 8650000,
      disbursement_date: isoDateDaysAgo(20),
      bank_payout_percentage: 1.0,
      gross_revenue: 86500,
      partner_share: 25950,
      net_revenue: 60550,
      invoice_raised: true,
      payout_received: false,
      payment_pending: true,
      created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]

  const documents = [
    {
      id: 'doc_001',
      customer_id: 'cus_001',
      lead_id: 'lead_001',
      document_type: 'PAN',
      status: 'Verified',
      file_name: 'PAN_ArjunMehta.pdf',
      file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      r2_key: 'guest/kyc/pan_arjun.pdf',
      uploaded_at: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'doc_002',
      customer_id: 'cus_002',
      lead_id: 'lead_002',
      document_type: 'Aadhaar',
      status: 'Received',
      file_name: 'Aadhaar_NehaSharma.pdf',
      file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      r2_key: 'guest/kyc/aadhaar_neha.pdf',
      uploaded_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'doc_003',
      customer_id: 'cus_003',
      lead_id: 'lead_003',
      document_type: 'Valuation Report',
      status: 'Received',
      file_name: 'Valuation_Indiranagar.pdf',
      file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      r2_key: 'guest/property/valuation_iyer.pdf',
      uploaded_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'doc_004',
      customer_id: 'cus_005',
      lead_id: 'lead_005',
      document_type: 'Balance Sheet',
      status: 'Verified',
      file_name: 'Zenith_BalanceSheet.pdf',
      file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      r2_key: 'guest/financial/zenith_bs.pdf',
      uploaded_at: new Date(Date.now() - 34 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'doc_005',
      customer_id: 'cus_002',
      lead_id: 'lead_007',
      document_type: 'Title Deed',
      status: 'Verified',
      file_name: 'TitleDeed_Dwarka.pdf',
      file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      r2_key: 'guest/property/title_dwarka.pdf',
      uploaded_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]

  const bank_relationships = [
    {
      id: 'br_001',
      bank_name: 'HDFC Bank',
      rm_name: 'Rohit Kulkarni',
      designation: 'Relationship Manager',
      location: 'Mumbai',
      rm_contact: '9876501234',
      rm_email: 'rohit.kulkarni@hdfcbank.com',
      product_handled: 'BL',
      notes: 'Fast TAT on SME cases.',
      created_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'br_002',
      bank_name: 'ICICI Bank',
      rm_name: 'Sneha Nair',
      designation: 'Senior RM',
      location: 'Delhi',
      rm_contact: '9810012345',
      rm_email: 'sneha.nair@icicibank.com',
      product_handled: 'HL',
      notes: '',
      created_at: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]

  return {
    customers,
    leads,
    collateral,
    bank_relationships,
    bank_applications,
    disbursements,
    documents,
  }
}

function getGuestDb() {
  try {
    const raw = localStorage.getItem(GUEST_DB_KEY)
    const parsed = raw ? safeJsonParse(raw) : null
    if (parsed && typeof parsed === 'object') return parsed
    const seeded = seedGuestDb()
    localStorage.setItem(GUEST_DB_KEY, JSON.stringify(seeded))
    return seeded
  } catch {
    return seedGuestDb()
  }
}

function setGuestDb(nextDb) {
  try {
    localStorage.setItem(GUEST_DB_KEY, JSON.stringify(nextDb))
  } catch {
    void 0
  }
}

function withJoins(table, rows, db) {
  const customersById = new Map((db.customers || []).map((c) => [c.id, c]))
  const leadsById = new Map((db.leads || []).map((l) => [l.id, l]))
  const bankById = new Map((db.bank_applications || []).map((b) => [b.id, b]))

  if (table === 'leads') {
    return rows.map((l) => ({ ...l, customer: customersById.get(l.customer_id) || null }))
  }
  if (table === 'bank_applications') {
    return rows.map((b) => {
      const lead = leadsById.get(b.lead_id) || null
      const customer = lead ? customersById.get(lead.customer_id) || null : null
      return { ...b, lead: lead ? { ...lead, customer } : null }
    })
  }
  if (table === 'documents') {
    return rows.map((d) => ({
      ...d,
      customer: customersById.get(d.customer_id) || null,
      lead: d.lead_id ? leadsById.get(d.lead_id) || null : null,
    }))
  }
  if (table === 'disbursements') {
    return rows.map((r) => ({
      ...r,
      lead: r.lead_id ? leadsById.get(r.lead_id) || null : null,
      bank_application: r.bank_application_id ? bankById.get(r.bank_application_id) || null : null,
    }))
  }
  return rows
}

function applyFilters(rows, filters) {
  if (!filters.length) return rows
  return rows.filter((row) => {
    for (const f of filters) {
      if (f.type === 'eq') {
        if (getValueByPath(row, f.field) !== f.value) return false
      }
      if (f.type === 'in') {
        const v = getValueByPath(row, f.field)
        if (!f.values.includes(v)) return false
      }
      if (f.type === 'ilike') {
        if (!matchIlike(getValueByPath(row, f.field), f.pattern)) return false
      }
      if (f.type === 'like') {
        if (!matchLike(getValueByPath(row, f.field), f.pattern)) return false
      }
      if (f.type === 'gte') {
        if (String(getValueByPath(row, f.field) ?? '') < String(f.value ?? '')) return false
      }
      if (f.type === 'lte') {
        if (String(getValueByPath(row, f.field) ?? '') > String(f.value ?? '')) return false
      }
      if (f.type === 'not_in') {
        const v = getValueByPath(row, f.field)
        if (f.values.includes(v)) return false
      }
      if (f.type === 'or') {
        const ok = f.terms.some((t) => {
          const v = getValueByPath(row, t.field)
          if (t.op === 'ilike') return matchIlike(v, t.value)
          if (t.op === 'like') return matchLike(v, t.value)
          return false
        })
        if (!ok) return false
      }
    }
    return true
  })
}

function parseOrExpression(expr) {
  const raw = String(expr || '')
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean)
  const terms = parts
    .map((p) => {
      const segs = p.split('.')
      const opIndex = segs.findIndex((s) => s === 'ilike' || s === 'like' || s === 'eq')
      if (opIndex < 1 || opIndex >= segs.length - 1) return null
      const op = segs[opIndex]
      const field = segs.slice(0, opIndex).join('.')
      const value = segs.slice(opIndex + 1).join('.')
      return { field, op, value }
    })
    .filter(Boolean)
  return terms
}

function createMockQueryBuilder(table) {
  const state = {
    table,
    action: 'select',
    selectOptions: null,
    payload: null,
    filters: [],
    orderBy: null,
    limit: null,
    range: null,
    mode: 'many',
  }

  const builder = {
    select(_columns, options) {
      state.action = 'select'
      state.selectOptions = options || null
      return builder
    },
    insert(rows) {
      state.action = 'insert'
      state.payload = rows
      return builder
    },
    update(values) {
      state.action = 'update'
      state.payload = values
      return builder
    },
    delete() {
      state.action = 'delete'
      return builder
    },
    upsert(rows) {
      state.action = 'upsert'
      state.payload = rows
      return builder
    },
    eq(field, value) {
      state.filters.push({ type: 'eq', field, value })
      return builder
    },
    in(field, values) {
      const list = Array.isArray(values) ? values : []
      state.filters.push({ type: 'in', field, values: list })
      return builder
    },
    ilike(field, pattern) {
      state.filters.push({ type: 'ilike', field, pattern })
      return builder
    },
    like(field, pattern) {
      state.filters.push({ type: 'like', field, pattern })
      return builder
    },
    gte(field, value) {
      state.filters.push({ type: 'gte', field, value })
      return builder
    },
    lte(field, value) {
      state.filters.push({ type: 'lte', field, value })
      return builder
    },
    not(field, op, value) {
      if (op === 'in') {
        state.filters.push({ type: 'not_in', field, values: parseInList(value) })
      }
      return builder
    },
    or(expr) {
      const terms = parseOrExpression(expr).map((t) => {
        if (t.field.includes(':')) {
          const [left] = t.field.split(':')
          return { ...t, field: left }
        }
        return t
      })
      state.filters.push({ type: 'or', terms })
      return builder
    },
    order(field, opts) {
      state.orderBy = { field, ascending: opts?.ascending !== false }
      return builder
    },
    range(from, to) {
      state.range = { from: Number(from) || 0, to: Number(to) || 0 }
      return builder
    },
    limit(n) {
      state.limit = n
      return builder
    },
    maybeSingle() {
      state.mode = 'maybeSingle'
      return builder
    },
    single() {
      state.mode = 'single'
      return builder
    },
    then(onFulfilled, onRejected) {
      const run = async () => {
        const db = getGuestDb()
        const tableName = state.table
        const tableRows = Array.isArray(db[tableName]) ? db[tableName] : []

        if (state.action === 'insert') {
          const rows = Array.isArray(state.payload) ? state.payload : []
          const now = new Date().toISOString()
          const inserted = rows.map((r) => {
            const base = { ...(r || {}) }
            if (!base.id) base.id = makeId(tableName.slice(0, 2))
            if (!base.created_at) base.created_at = now
            if (tableName === 'customers' && !base.customer_code) {
              const num = String((db.customers || []).length + 1).padStart(4, '0')
              base.customer_code = `CUST-${num}`
            }
            if (tableName === 'leads' && !base.lead_code) {
              const num = String((db.leads || []).length + 1).padStart(4, '0')
              base.lead_code = `LEAD-${num}`
            }
            if (tableName === 'documents') {
              if (!base.uploaded_at) base.uploaded_at = now
            }
            if (tableName === 'disbursements') {
              if (!base.disbursement_date) base.disbursement_date = now.slice(0, 10)
            }
            return base
          })
          const next = { ...db, [tableName]: [...tableRows, ...inserted] }
          setGuestDb(next)
          return createMockQueryResult({ data: withJoins(tableName, inserted, next), count: inserted.length })
        }

        if (state.action === 'update') {
          const joined = withJoins(tableName, tableRows, db)
          const matching = applyFilters(joined, state.filters)
          const ids = new Set(matching.map((r) => r.id))
          const updatedRows = tableRows.map((r) => (ids.has(r.id) ? { ...r, ...(state.payload || {}) } : r))
          const next = { ...db, [tableName]: updatedRows }
          setGuestDb(next)
          return createMockQueryResult({ data: withJoins(tableName, updatedRows.filter((r) => ids.has(r.id)), next), count: ids.size })
        }

        if (state.action === 'delete') {
          const joined = withJoins(tableName, tableRows, db)
          const matching = applyFilters(joined, state.filters)
          const ids = new Set(matching.map((r) => r.id))
          const remaining = tableRows.filter((r) => !ids.has(r.id))
          const next = { ...db, [tableName]: remaining }
          setGuestDb(next)
          return createMockQueryResult({ data: [], count: ids.size })
        }

        let joined = withJoins(tableName, tableRows, db)
        joined = applyFilters(joined, state.filters)

        const count = joined.length

        if (state.orderBy?.field) {
          const { field, ascending } = state.orderBy
          joined = [...joined].sort((a, b) => {
            const av = getValueByPath(a, field)
            const bv = getValueByPath(b, field)
            if (av == null && bv == null) return 0
            if (av == null) return ascending ? 1 : -1
            if (bv == null) return ascending ? -1 : 1
            if (av < bv) return ascending ? -1 : 1
            if (av > bv) return ascending ? 1 : -1
            return 0
          })
        }

        if (state.range) joined = joined.slice(state.range.from, state.range.to + 1)
        else if (typeof state.limit === 'number') joined = joined.slice(0, state.limit)

        if (state.selectOptions?.head) {
          return createMockQueryResult({ data: [], count })
        }

        if (state.mode === 'single') {
          if (joined.length !== 1) {
            return { data: null, error: { message: joined.length === 0 ? 'No rows' : 'Multiple rows' } }
          }
          return { data: joined[0], error: null }
        }
        if (state.mode === 'maybeSingle') {
          if (joined.length > 1) return { data: null, error: { message: 'Multiple rows' } }
          return { data: joined[0] || null, error: null }
        }

        return createMockQueryResult({ data: joined, count })
      }

      return run().then(onFulfilled, onRejected)
    },
  }

  return builder
}

function createMockSupabase() {
  return {
    from(table) {
      return createMockQueryBuilder(table)
    },
    auth: {
      async signInWithPassword({ email }) {
        setGuestSession(true)
        return { data: { session: { user: { ...guestUser, email: email || guestUser.email } }, user: { ...guestUser, email: email || guestUser.email } }, error: null }
      },
      async signOut() {
        setGuestSession(false)
        try {
          localStorage.removeItem(GUEST_DB_KEY)
        } catch {
          void 0
        }
        return { error: null }
      },
      async getUser() {
        const session = getGuestSession()
        return { data: { user: session?.user ?? null }, error: null }
      },
      onAuthStateChange() {
        return { data: { subscription: { unsubscribe() {} } } }
      },
    },
  }
}

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createMockSupabase()

function chunkArray(items, size) {
  const arr = Array.isArray(items) ? items : []
  const n = Math.max(1, Number(size) || 1)
  const chunks = []
  for (let i = 0; i < arr.length; i += n) chunks.push(arr.slice(i, i + n))
  return chunks
}

async function deleteWhereIn(table, field, ids) {
  const chunks = chunkArray(ids, 500)
  for (const group of chunks) {
    const { error } = await supabase.from(table).delete().in(field, group)
    if (error) throw error
  }
}

export async function deleteBankApplicationCascade(bankApplicationId) {
  if (!bankApplicationId) throw new Error('Missing bank application id')
  const { error: disbErr } = await supabase.from('disbursements').delete().eq('bank_application_id', bankApplicationId)
  if (disbErr) throw disbErr
  const { error } = await supabase.from('bank_applications').delete().eq('id', bankApplicationId)
  if (error) throw error
}

export async function deleteBankApplicationsCascade(bankApplicationIds) {
  const ids = (bankApplicationIds || []).filter(Boolean)
  if (!ids.length) return
  await deleteWhereIn('disbursements', 'bank_application_id', ids)
  await deleteWhereIn('bank_applications', 'id', ids)
}

export async function deleteLeadCascade(leadId) {
  if (!leadId) throw new Error('Missing lead id')
  const { error: docErr } = await supabase.from('documents').delete().eq('lead_id', leadId)
  if (docErr) throw docErr
  const { error: disbErr } = await supabase.from('disbursements').delete().eq('lead_id', leadId)
  if (disbErr) throw disbErr
  const { error: bankErr } = await supabase.from('bank_applications').delete().eq('lead_id', leadId)
  if (bankErr) throw bankErr
  const { error: colErr } = await supabase.from('collateral').delete().eq('lead_id', leadId)
  if (colErr) throw colErr
  const { error } = await supabase.from('leads').delete().eq('id', leadId)
  if (error) throw error
}

export async function deleteCustomerCascade(customerId) {
  if (!customerId) throw new Error('Missing customer id')

  const { error: docErr } = await supabase.from('documents').delete().eq('customer_id', customerId)
  if (docErr) throw docErr

  const countRes = await supabase.from('leads').select('id', { count: 'exact', head: true }).eq('customer_id', customerId)
  if (countRes.error) throw countRes.error
  const total = countRes.count || 0

  if (total) {
    const pageSize = 1000
    const leadIds = []
    for (let from = 0; from < total; from += pageSize) {
      const to = Math.min(from + pageSize - 1, total - 1)
      const pageRes = await supabase.from('leads').select('id').eq('customer_id', customerId).range(from, to)
      if (pageRes.error) throw pageRes.error
      leadIds.push(...(pageRes.data || []).map((r) => r.id).filter(Boolean))
    }

    if (leadIds.length) {
      await deleteWhereIn('documents', 'lead_id', leadIds)
      await deleteWhereIn('disbursements', 'lead_id', leadIds)
      await deleteWhereIn('bank_applications', 'lead_id', leadIds)
      await deleteWhereIn('collateral', 'lead_id', leadIds)
      await deleteWhereIn('leads', 'id', leadIds)
    }
  }

  const { error } = await supabase.from('customers').delete().eq('id', customerId)
  if (error) throw error
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data.user
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session))
}

// --- Two-Factor Auth (TOTP via Supabase Auth MFA) ---
// Even with dashboard/DB access to auth.users, a hashed password alone cannot
// sign a session in past aal2 without the user's enrolled authenticator code.
export async function getMfaAssuranceLevel() {
  if (!supabaseConfigured) return { currentLevel: 'aal1', nextLevel: 'aal1' }
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) throw error
  return data
}

export async function listMfaFactors() {
  if (!supabaseConfigured) return []
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw error
  return data?.totp || []
}

export async function enrollMfaFactor() {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
  if (error) throw error
  return data
}

export async function challengeAndVerifyMfaFactor(factorId, code) {
  if (!factorId) throw new Error('Missing MFA factor')
  const challenge = await supabase.auth.mfa.challenge({ factorId })
  if (challenge.error) throw challenge.error
  const verify = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code })
  if (verify.error) throw verify.error
  return verify.data
}

export async function unenrollMfaFactor(factorId) {
  if (!factorId) throw new Error('Missing MFA factor')
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) throw error
}
