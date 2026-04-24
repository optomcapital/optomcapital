import { Building2, FilePlus2, FileText, IndianRupee } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router-dom'
import { Badge, Button, Card, Divider, Drawer, Input, Select, Textarea } from '../../components/ui/index.jsx'
import { supabase } from '../../lib/supabase.js'
import { formatDate, formatINR, getStageColor } from '../../lib/utils.js'

const tabs = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'business', label: 'Business Profile' },
  { id: 'credit', label: 'Credit Profile' },
  { id: 'banking', label: 'Banking Info' },
  { id: 'cross', label: 'Cross-Sell' },
]

export default function CustomerDetail() {
  const { id } = useParams()
  const CUSTOMER_SCHEMA_UNSUPPORTED_KEY = 'optom_customers_schema_unsupported_v1'
  const [loading, setLoading] = useState(true)
  const [customer, setCustomer] = useState(null)
  const [activeTab, setActiveTab] = useState('basic')
  const [editMode, setEditMode] = useState(false)
  const [leads, setLeads] = useState([])
  const [docs, setDocs] = useState([])
  const [bankApps, setBankApps] = useState([])
  const [disbursements, setDisbursements] = useState([])
  const [leadDrawerOpen, setLeadDrawerOpen] = useState(false)
  const [checklistDrawerOpen, setChecklistDrawerOpen] = useState(false)
  const [unsupportedCols, setUnsupportedCols] = useState(() => new Set())

  const isPermissionOrSchemaError = useCallback((err) => {
    const code = String(err?.code || '')
    const msg = String(err?.message || '').toLowerCase()
    return (
      code === '42501' ||
      code === 'PGRST301' ||
      msg.includes('permission denied') ||
      msg.includes('row-level security') ||
      msg.includes('does not exist')
    )
  }, [])

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm()

  const leadForm = useForm({
    defaultValues: {
      loan_type: 'Business Loan',
      loan_purpose: '',
      lead_creation_date: '',
      required_amount: '',
      preferred_tenure_months: '',
      preferred_bank: '',
      urgency_level: 'Medium',
      lead_source: '',
      referral_partner_name: '',
      sales_manager_name: '',
      sales_manager_contact: '',
      branch_location: '',
      stage: 'Lead Generated',
      lead_status_category: '',
      lead_status_stage: '',
    },
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cRes, lRes, dRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', id).single(),
        supabase
          .from('leads')
          .select('id, lead_code, loan_type, required_amount, stage, lead_creation_date')
          .eq('customer_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('documents')
          .select('id, lead_id, document_type, file_name, file_url, status, uploaded_at')
          .eq('customer_id', id)
          .order('uploaded_at', { ascending: false }),
      ])
      if (cRes.error) throw cRes.error
      if (lRes.error) throw lRes.error
      if (dRes.error) throw dRes.error

      const leadRows = lRes.data || []
      const leadIds = leadRows.map((l) => l.id).filter(Boolean)
      if (leadIds.length) {
        const [baRes, disbRes] = await Promise.all([
          supabase
            .from('bank_applications')
            .select('id, lead_id, bank_name, underwriting_status, login_date, sanction_amount')
            .in('lead_id', leadIds)
            .order('created_at', { ascending: false }),
          supabase
            .from('disbursements')
            .select('id, lead_id, final_disbursed_amount, disbursement_date, net_revenue')
            .in('lead_id', leadIds)
            .order('created_at', { ascending: false }),
        ])

        if (baRes.error) {
          if (isPermissionOrSchemaError(baRes.error)) {
            setBankApps([])
            toast.error(`Bank applications not accessible: ${baRes.error?.message || 'Check RLS/policies'}`)
          } else {
            throw baRes.error
          }
        } else {
          setBankApps(baRes.data || [])
        }

        if (disbRes.error) {
          if (isPermissionOrSchemaError(disbRes.error)) {
            setDisbursements([])
            toast.error(`Disbursements not accessible: ${disbRes.error?.message || 'Check RLS/policies'}`)
          } else {
            throw disbRes.error
          }
        } else {
          setDisbursements(disbRes.data || [])
        }
      } else {
        setBankApps([])
        setDisbursements([])
      }

      setCustomer(cRes.data)
      setLeads(leadRows)
      setDocs(dRes.data || [])
      reset(cRes.data)
    } catch (e) {
      toast.error(e?.message || 'Failed to load customer')
    } finally {
      setLoading(false)
    }
  }, [id, isPermissionOrSchemaError, reset])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CUSTOMER_SCHEMA_UNSUPPORTED_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) setUnsupportedCols(new Set(parsed.filter(Boolean).map((c) => String(c))))
    } catch (e) {
      void e
    }
  }, [CUSTOMER_SCHEMA_UNSUPPORTED_KEY])

  const persistUnsupportedCols = useCallback(
    (nextSet) => {
      try {
        window.localStorage.setItem(CUSTOMER_SCHEMA_UNSUPPORTED_KEY, JSON.stringify(Array.from(nextSet)))
      } catch (e) {
        void e
      }
    },
    [CUSTOMER_SCHEMA_UNSUPPORTED_KEY],
  )

  const extractMissingColumn = useCallback((err) => {
    const msg = String(err?.message || '')
    const m1 = msg.match(/Could not find the '([^']+)' column/i)
    if (m1?.[1]) return m1[1]
    const m2 = msg.match(/column ([a-zA-Z0-9_]+) does not exist/i)
    if (m2?.[1]) return m2[1]
    return null
  }, [])

  const markUnsupported = useCallback(
    (col) => {
      const c = String(col || '').trim()
      if (!c) return
      setUnsupportedCols((prev) => {
        if (prev.has(c)) return prev
        const next = new Set(prev)
        next.add(c)
        persistUnsupportedCols(next)
        return next
      })
    },
    [persistUnsupportedCols],
  )

  const refreshCustomerSchema = useCallback(async () => {
    const known = ['customer_type', 'employment_type', 'nature_of_business', 'product_offering']
    try {
      const { error } = await supabase.from('customers').select(known.join(',')).limit(1)
      if (!error) {
        setUnsupportedCols((prev) => {
          const next = new Set(prev)
          let changed = false
          known.forEach((c) => {
            if (next.delete(c)) changed = true
          })
          if (changed) persistUnsupportedCols(next)
          return next
        })
        return
      }
      const missing = extractMissingColumn(error)
      if (missing) markUnsupported(missing)
    } catch (e) {
      void e
    }
  }, [extractMissingColumn, markUnsupported, persistUnsupportedCols])

  const stripUnsupported = useCallback(
    (payload) => {
      const out = { ...(payload || {}) }
      unsupportedCols.forEach((c) => {
        if (c in out) delete out[c]
      })
      return out
    },
    [unsupportedCols],
  )

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    refreshCustomerSchema()
  }, [refreshCustomerSchema])

  const leadStats = useMemo(() => {
    const total = leads.length
    const active = leads.filter((l) => l.stage !== 'Disbursed' && l.stage !== 'Declined').length
    const disbursed = leads.filter((l) => l.stage === 'Disbursed').length
    return { total, active, disbursed }
  }, [leads])

  const findLeadCode = useCallback(
    (leadId) => {
      const match = (leads || []).find((l) => String(l?.id || '') === String(leadId || ''))
      return match?.lead_code || null
    },
    [leads],
  )

  const requiredDocsForProfessionType = useCallback((professionType) => {
    const p = String(professionType || '').trim().toLowerCase()
    if (p === 'doctor' || p === 'dr') {
      return [
        'PAN',
        'Aadhaar',
        'EMI Clearing Bank Statement for the last 12 months',
        'Latest 2 years full ITR',
        'KMC certificate',
        'Degree certificate',
        'One photo of customer',
        "Mother's name",
        'Spouse name',
        'Email id',
        'Phone Number',
        '2 references (name and number)',
      ]
    }
    if (p === 'ca') {
      return [
        'PAN & Aadhar Card',
        'COA & COP',
        'GST Cft',
        'Letterhead – Office address Proof',
        'Latest Own House proof -  Electricity Bill',
        'All Existing Loan Details Sheet',
        'Latest 12 Months GSTR',
        'Last 12 Month Bank Statement',
        'Latest Financial – BS/ P&L/ Computation Of Income',
        'AY 24-25',
        'AY 25-25',
        'Email Id',
        'Mothers Name:',
        'Spouse Name:',
      ]
    }
    if (p === 'business owner' || p === 'self employed') {
      return [
        'PAN & Aadhar Card',
        'GST Cft',
        'Latest Own House proof -  Electricity Bill',
        'All Existing Loan Details Sheet',
        'Latest 12 Months GSTR',
        'Last 12 Month Bank Statement',
        'Latest Financial – BS/ P&L/ Computation Of Income',
        'AY 23-24',
        'AY 24-25',
        'AY 25-25',
        'All   Partners - Individual  Financial – BS/ P&L/ Computation Of Income (AY 23-24)',
        'All   Partners - Individual  Financial – BS/ P&L/ Computation Of Income (AY 24-25)',
      ]
    }
    if (p === 'salaried' || p === 'other') {
      return ['PAN', 'Bank Statement 12M', 'Other']
    }
    return null
  }, [])

  const customerChecklist = useMemo(() => {
    const byProfession = requiredDocsForProfessionType(customer?.profession_type)
    return { type: `Profession (${customer?.profession_type || '—'})`, items: byProfession || [] }
  }, [customer?.profession_type, requiredDocsForProfessionType])

  const customerChecklistAgg = useMemo(() => {
    const map = new Map()
    ;(docs || []).forEach((d) => {
      const t = d?.document_type
      if (!t) return
      const prev = map.get(t) || { bestStatus: 'Pending', latestAt: null }
      const s = d.status || 'Pending'
      const rank = s === 'Verified' ? 2 : s === 'Received' ? 1 : 0
      const prevRank = prev.bestStatus === 'Verified' ? 2 : prev.bestStatus === 'Received' ? 1 : 0
      const nextStatus = rank > prevRank ? s : prev.bestStatus
      const nextAt = d.uploaded_at && (!prev.latestAt || new Date(d.uploaded_at) > new Date(prev.latestAt)) ? d.uploaded_at : prev.latestAt
      map.set(t, { bestStatus: nextStatus, latestAt: nextAt })
    })
    return map
  }, [docs])

  const customerChecklistProgress = useMemo(() => {
    const required = customerChecklist.items || []
    let received = 0
    let verified = 0
    required.forEach((t) => {
      const s = customerChecklistAgg.get(t)?.bestStatus || 'Pending'
      if (s === 'Received' || s === 'Verified') received += 1
      if (s === 'Verified') verified += 1
    })
    const pending = Math.max(0, required.length - received)
    return { requiredCount: required.length, receivedCount: received, verifiedCount: verified, pendingCount: pending }
  }, [customerChecklist.items, customerChecklistAgg])

  async function saveCustomer(values) {
    const toNumberOrNull = (v) => {
      if (v === '' || v == null) return null
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }
    const toIntOrNull = (v) => {
      if (v === '' || v == null) return null
      const n = parseInt(String(v), 10)
      return Number.isFinite(n) ? n : null
    }
    const toBoolOrNull = (v) => {
      if (v === '' || v == null) return null
      if (typeof v === 'boolean') return v
      const raw = String(v).toLowerCase().trim()
      if (raw === 'true') return true
      if (raw === 'false') return false
      return null
    }
    const nextValues = { ...values }
    if (nextValues.entity_type && nextValues.entity_type !== 'Individual' && !nextValues.business_name && nextValues.name) {
      nextValues.business_name = nextValues.name
    }
    const payload = {
      ...nextValues,
      business_vintage_years: toIntOrNull(nextValues.business_vintage_years),
      number_of_employees: toIntOrNull(nextValues.number_of_employees),
      banking_vintage_years: toIntOrNull(nextValues.banking_vintage_years),
      annual_turnover: toNumberOrNull(nextValues.annual_turnover),
      net_profit: toNumberOrNull(nextValues.net_profit),
      monthly_income: toNumberOrNull(nextValues.monthly_income),
      net_worth: toNumberOrNull(nextValues.net_worth),
      cibil_score: toIntOrNull(nextValues.cibil_score),
      experian_score: toIntOrNull(nextValues.experian_score),
      equifax_score: toIntOrNull(nextValues.equifax_score),
      crif_score: toIntOrNull(nextValues.crif_score),
      credit_card_outstanding: toNumberOrNull(nextValues.credit_card_outstanding),
      existing_emi_outflow: toNumberOrNull(nextValues.existing_emi_outflow),
      total_loan_exposure: toNumberOrNull(nextValues.total_loan_exposure),
      avg_monthly_balance: toNumberOrNull(nextValues.avg_monthly_balance),
      monthly_banking_turnover: toNumberOrNull(nextValues.monthly_banking_turnover),
      balance_transfer_opportunity: toBoolOrNull(nextValues.balance_transfer_opportunity),
      topup_loan_eligibility: toBoolOrNull(nextValues.topup_loan_eligibility),
      insurance_opportunity: toBoolOrNull(nextValues.insurance_opportunity),
      credit_card_offer: toBoolOrNull(nextValues.credit_card_offer),
    }
    Object.keys(payload).forEach((k) => {
      if (payload[k] === '') payload[k] = null
    })

    let attempt = stripUnsupported(payload)
    for (let i = 0; i < 2; i += 1) {
      const { error } = await supabase.from('customers').update(attempt).eq('id', id)
      if (!error) return
      const missing = extractMissingColumn(error)
      if (!missing || !(missing in attempt)) throw error
      markUnsupported(missing)
      const next = { ...attempt }
      delete next[missing]
      attempt = next
    }
  }

  function exportOnePager() {
    const esc = (v) =>
      String(v == null ? '' : v)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;')
    const row = (k, v) => `<tr><td style="padding:8px 10px;border:1px solid #e5e7eb;width:220px;color:#475569;font-weight:600;">${esc(k)}</td><td style="padding:8px 10px;border:1px solid #e5e7eb;">${esc(v || '—')}</td></tr>`
    const section = (title, rows) =>
      `<div style="margin-top:16px;"><div style="font-size:14px;font-weight:700;margin-bottom:8px;">${esc(title)}</div><table style="border-collapse:collapse;width:100%;font-size:12px;">${rows.join('')}</table></div>`

    const basicRows = [
      row('Customer ID', customer.customer_code),
      row('Customer Name', customer.name),
      row('Entity Type', customer.entity_type),
      row('Profession Type', customer.profession_type),
      row('Mobile', customer.primary_mobile),
      row('Email', customer.email),
      row('City', customer.city),
      row('State', customer.state),
      row('PAN', customer.pan_number),
      row('Aadhaar', customer.aadhaar_number),
    ]

    const businessRows = [
      row('Company Name', customer.business_name),
      row('Industry Category', customer.industry_category),
      row('Employment Type', customer.employment_type),
      row('Customer Type', customer.customer_type),
      row('Product Offering', customer.product_offering),
      row('Nature of Business', customer.nature_of_business),
      row('Business Vintage (years)', customer.business_vintage_years),
      row('GST Number', customer.gst_number),
      row('Annual Turnover', customer.annual_turnover),
      row('Net Profit', customer.net_profit),
      row('Monthly Income', customer.monthly_income),
      row('Net Worth', customer.net_worth),
    ]

    const creditRows = [
      row('CIBIL Score', customer.cibil_score),
      row('Experian Score', customer.experian_score),
      row('Equifax Score', customer.equifax_score),
      row('CRIF Score', customer.crif_score),
      row('Credit Card Outstanding', customer.credit_card_outstanding),
      row('Existing EMI Outflow', customer.existing_emi_outflow),
      row('Total Loan Exposure', customer.total_loan_exposure),
      row('DPD History', customer.dpd_history),
      row('Writeoff/Settlement History', customer.writeoff_settlement_history),
    ]

    const bankingRows = [
      row('Primary Bank', customer.primary_bank),
      row('Current Account Bank', customer.current_account_bank),
      row('Savings Bank', customer.savings_bank),
      row('OD/CC Bank', customer.od_cc_bank),
      row('Banking Vintage (years)', customer.banking_vintage_years),
      row('Avg Monthly Balance', customer.avg_monthly_balance),
      row('Monthly Banking Turnover', customer.monthly_banking_turnover),
      row('Cheque Bounce History', customer.cheque_bounce_history),
    ]

    const crossRows = [
      row('Balance Transfer Opportunity', customer.balance_transfer_opportunity ? 'Yes' : 'No'),
      row('Topup Loan Eligibility', customer.topup_loan_eligibility ? 'Yes' : 'No'),
      row('Insurance Opportunity', customer.insurance_opportunity ? 'Yes' : 'No'),
      row('Credit Card Offer', customer.credit_card_offer ? 'Yes' : 'No'),
    ]

    const leadsRows = (leads || []).length
      ? [
          `<tr><td style="padding:8px 10px;border:1px solid #e5e7eb;color:#475569;font-weight:600;">Lead ID</td><td style="padding:8px 10px;border:1px solid #e5e7eb;color:#475569;font-weight:600;">Loan Type</td><td style="padding:8px 10px;border:1px solid #e5e7eb;color:#475569;font-weight:600;">Required Amount</td><td style="padding:8px 10px;border:1px solid #e5e7eb;color:#475569;font-weight:600;">Stage</td><td style="padding:8px 10px;border:1px solid #e5e7eb;color:#475569;font-weight:600;">Lead Date</td></tr>`,
          ...(leads || []).map(
            (l) =>
              `<tr><td style="padding:8px 10px;border:1px solid #e5e7eb;">${esc(l.lead_code || '—')}</td><td style="padding:8px 10px;border:1px solid #e5e7eb;">${esc(l.loan_type || '—')}</td><td style="padding:8px 10px;border:1px solid #e5e7eb;">${esc(formatINR(l.required_amount))}</td><td style="padding:8px 10px;border:1px solid #e5e7eb;">${esc(l.stage || '—')}</td><td style="padding:8px 10px;border:1px solid #e5e7eb;">${esc(formatDate(l.lead_creation_date))}</td></tr>`,
          ),
        ]
      : [`<tr><td style="padding:8px 10px;border:1px solid #e5e7eb;">No linked leads</td></tr>`]

    const html = `<!doctype html><html><head><meta charset="utf-8" /><title>Customer One Pager</title>
      <style>
        @page { size: A4; margin: 12mm; }
        html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      </style>
      </head><body style="font-family: ui-sans-serif, system-ui, -apple-system; padding:0; color:#0f172a;">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px;">
        <div>
          <div style="font-size:18px;font-weight:800;">${esc(customer.name)}</div>
          <div style="margin-top:4px;color:#64748b;font-size:12px;">${esc(customer.customer_code || '')}</div>
        </div>
        <div style="color:#64748b;font-size:12px;">Generated on ${esc(new Date().toLocaleString('en-IN'))}</div>
      </div>
      ${section('Basic Info', basicRows)}
      ${section('Business Profile', businessRows)}
      ${section('Credit Profile', creditRows)}
      ${section('Banking Info', bankingRows)}
      ${section('Cross-Sell', crossRows)}
      <div style="margin-top:16px;">
        <div style="font-size:14px;font-weight:700;margin-bottom:8px;">Linked Leads</div>
        <table style="border-collapse:collapse;width:100%;font-size:12px;">${leadsRows.join('')}</table>
      </div>
    </body></html>`

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.style.opacity = '0'
    iframe.setAttribute('aria-hidden', 'true')
    document.body.appendChild(iframe)

    const cleanup = () => {
      try {
        document.body.removeChild(iframe)
      } catch {
        void 0
      }
    }

    const w = iframe.contentWindow
    if (!w) {
      cleanup()
      toast.error('Failed to export')
      return
    }

    w.document.open()
    w.document.write(html)
    w.document.close()

    const onAfterPrint = () => cleanup()
    w.addEventListener('afterprint', onAfterPrint, { once: true })

    const tryPrint = () => {
      try {
        w.focus()
        w.print()
        setTimeout(() => cleanup(), 2500)
      } catch (e) {
        cleanup()
        toast.error(e?.message || 'Failed to export')
      }
    }

    setTimeout(tryPrint, 50)
  }

  if (loading) return null
  if (!customer) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[18px] font-semibold">{customer.name}</div>
          <div className="text-[13px] text-text-secondary">{customer.customer_code || '—'}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setLeadDrawerOpen(true)}>
            <FilePlus2 size={16} />
            <span>Add Lead</span>
          </Button>
          <Button variant="secondary" onClick={exportOnePager}>
            <FileText size={16} />
            <span>Export PDF</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-7 space-y-4">
          <div className="flex items-center gap-2 border-b border-border-divider">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={[
                  'px-3 py-2 text-[13px] font-medium',
                  activeTab === t.id ? 'text-accent border-b-2 border-accent' : 'text-text-secondary hover:text-text-primary',
                ].join(' ')}
                onClick={() => {
                  setActiveTab(t.id)
                  setEditMode(false)
                  reset(customer)
                }}
              >
                {t.label}
              </button>
            ))}
            <div className="flex-1" />
            <Button variant="secondary" size="sm" onClick={() => setEditMode((v) => !v)}>
              {editMode ? 'Cancel' : 'Edit'}
            </Button>
            {editMode ? (
              <Button
                size="sm"
                onClick={handleSubmit(async (values) => {
                  try {
                    await saveCustomer(values)
                    toast.success('Customer updated')
                    setEditMode(false)
                    await load()
                  } catch (e) {
                    toast.error(e?.message || 'Failed to save')
                  }
                })}
                disabled={isSubmitting}
              >
                Save
              </Button>
            ) : null}
          </div>

          <Card title={tabs.find((t) => t.id === activeTab)?.label}>
            {activeTab === 'basic' ? (
              <div className="grid grid-cols-2 gap-3">
                <Input label="Customer Name" disabled={!editMode} {...register('name')} />
                <Select
                  label="Entity Type"
                  disabled={!editMode}
                  options={[
                    { value: 'Individual', label: 'Individual' },
                    { value: 'Proprietorship', label: 'Proprietorship' },
                    { value: 'LLP', label: 'LLP' },
                    { value: 'Pvt Ltd', label: 'Pvt Ltd' },
                    { value: 'Partnership', label: 'Partnership' },
                  ]}
                  {...register('entity_type')}
                />
                <Input label="PAN Number" disabled={!editMode} {...register('pan_number')} />
                <Input label="Aadhaar Number" disabled={!editMode} {...register('aadhaar_number')} />
                <Input label="CIN" disabled={!editMode} {...register('cin')} />
                <Input label="Nationality" disabled={!editMode} {...register('nationality')} />
                <Input label="Date of Birth" type="date" disabled={!editMode} {...register('date_of_birth')} />
                <Input label="Incorporation Date" type="date" disabled={!editMode} {...register('incorporation_date')} />
                <Input label="Primary Mobile" disabled={!editMode} {...register('primary_mobile')} />
                <Input label="Alternate Mobile" disabled={!editMode} {...register('alternate_mobile')} />
                <Input label="Email" disabled={!editMode} {...register('email')} />
                <Input label="Office Phone" disabled={!editMode} {...register('office_phone')} />
                <Input label="PA Contact" disabled={!editMode} {...register('pa_contact')} />
                <Input label="City" disabled={!editMode} {...register('city')} />
                <Input label="State" disabled={!editMode} {...register('state')} />
                <Input label="PIN Code" disabled={!editMode} {...register('pin_code')} />
                <Input label="Country" disabled={!editMode} {...register('country')} />
                <Textarea label="Residential Address" rows={3} disabled={!editMode} {...register('residential_address')} />
                <Textarea label="Office Address" rows={3} disabled={!editMode} {...register('office_address')} />
              </div>
            ) : null}

            {activeTab === 'business' ? (
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Profession Type"
                  disabled={!editMode}
                  options={[
                    { value: 'Doctor', label: 'Doctor' },
                    { value: 'CA', label: 'CA' },
                    { value: 'Business Owner', label: 'Business Owner' },
                    { value: 'Salaried', label: 'Salaried' },
                    { value: 'Self Employed', label: 'Self Employed' },
                    { value: 'Other', label: 'Other' },
                  ]}
                  {...register('profession_type')}
                />
                <Select
                  label="Employment Type"
                  disabled={!editMode}
                  options={[
                    { value: '', label: '—' },
                    { value: 'SEP', label: 'SEP' },
                    { value: 'SENP', label: 'SENP' },
                    { value: 'Sal', label: 'Sal' },
                  ]}
                  {...register('employment_type')}
                />
                {unsupportedCols.has('customer_type') ? null : (
                  <Select
                    label="Customer Type"
                    disabled={!editMode}
                    options={[
                      { value: '', label: '—' },
                      { value: 'NTB', label: 'NTB' },
                      { value: 'Existing', label: 'Existing' },
                    ]}
                    {...register('customer_type')}
                  />
                )}
                {unsupportedCols.has('product_offering') ? null : (
                  <Select
                    label="Product Offering"
                    disabled={!editMode}
                    options={[
                      { value: '', label: '—' },
                      { value: 'BL', label: 'BL' },
                      { value: 'HL', label: 'HL' },
                      { value: 'ODCC', label: 'ODCC' },
                      { value: 'PL', label: 'PL' },
                      { value: 'LAP', label: 'LAP' },
                      { value: 'LRD', label: 'LRD' },
                    ]}
                    {...register('product_offering')}
                  />
                )}
                <Input label="Nature of Business" disabled={!editMode} {...register('nature_of_business')} />
                <Input label="Industry Category" disabled={!editMode} {...register('industry_category')} />
                <Input label="Company Name" disabled={!editMode} {...register('business_name')} />
                <Input label="Business Vintage (years)" disabled={!editMode} {...register('business_vintage_years')} />
                <Input label="Employer Name" disabled={!editMode} {...register('employer_name')} />
                <Input label="Designation" disabled={!editMode} {...register('designation')} />
                <Select
                  label="Company Type"
                  disabled={!editMode}
                  options={[
                    { value: 'MNC', label: 'MNC' },
                    { value: 'SME', label: 'SME' },
                    { value: 'Government', label: 'Government' },
                    { value: 'Other', label: 'Other' },
                  ]}
                  {...register('company_type')}
                />
                <Input label="Number of Employees" disabled={!editMode} {...register('number_of_employees')} />
                <Input label="GST Number" disabled={!editMode} {...register('gst_number')} />
                <Input label="Annual Turnover" disabled={!editMode} {...register('annual_turnover')} />
                <Input label="Net Profit" disabled={!editMode} {...register('net_profit')} />
                <Input label="Monthly Income" disabled={!editMode} {...register('monthly_income')} />
                <Input label="Net Worth" disabled={!editMode} {...register('net_worth')} />
              </div>
            ) : null}

            {activeTab === 'credit' ? (
              <div className="grid grid-cols-2 gap-3">
                <Input label="CIBIL Score" disabled={!editMode} {...register('cibil_score')} />
                <Input label="Experian Score" disabled={!editMode} {...register('experian_score')} />
                <Input label="Equifax Score" disabled={!editMode} {...register('equifax_score')} />
                <Input label="CRIF Score" disabled={!editMode} {...register('crif_score')} />
                <Input label="Credit Card Outstanding" disabled={!editMode} {...register('credit_card_outstanding')} />
                <Input label="Existing EMI Outflow" disabled={!editMode} {...register('existing_emi_outflow')} />
                <Input label="Total Loan Exposure" disabled={!editMode} {...register('total_loan_exposure')} />
                <Textarea label="DPD History" rows={3} disabled={!editMode} {...register('dpd_history')} />
                <Textarea
                  label="Write-off / Settlement History"
                  rows={3}
                  disabled={!editMode}
                  {...register('writeoff_settlement_history')}
                />
              </div>
            ) : null}

            {activeTab === 'banking' ? (
              <div className="grid grid-cols-2 gap-3">
                <Input label="Primary Bank" disabled={!editMode} {...register('primary_bank')} />
                <Input label="Current Account Bank" disabled={!editMode} {...register('current_account_bank')} />
                <Input label="Savings Bank" disabled={!editMode} {...register('savings_bank')} />
                <Input label="OD/CC Bank" disabled={!editMode} {...register('od_cc_bank')} />
                <Input label="Banking Vintage (years)" disabled={!editMode} {...register('banking_vintage_years')} />
                <Input label="Avg Monthly Balance" disabled={!editMode} {...register('avg_monthly_balance')} />
                <Input label="Monthly Banking Turnover" disabled={!editMode} {...register('monthly_banking_turnover')} />
                <Textarea label="Cheque Bounce History" rows={3} disabled={!editMode} {...register('cheque_bounce_history')} />
              </div>
            ) : null}

            {activeTab === 'cross' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Balance Transfer Opportunity"
                    disabled={!editMode}
                    options={[
                      { value: false, label: 'No' },
                      { value: true, label: 'Yes' },
                    ]}
                    {...register('balance_transfer_opportunity')}
                  />
                  <Select
                    label="Top-up Loan Eligibility"
                    disabled={!editMode}
                    options={[
                      { value: false, label: 'No' },
                      { value: true, label: 'Yes' },
                    ]}
                    {...register('topup_loan_eligibility')}
                  />
                  <Select
                    label="Insurance Opportunity"
                    disabled={!editMode}
                    options={[
                      { value: false, label: 'No' },
                      { value: true, label: 'Yes' },
                    ]}
                    {...register('insurance_opportunity')}
                  />
                  <Select
                    label="Credit Card Offer"
                    disabled={!editMode}
                    options={[
                      { value: false, label: 'No' },
                      { value: true, label: 'Yes' },
                    ]}
                    {...register('credit_card_offer')}
                  />
                </div>
                <Textarea label="Relationship Notes" rows={4} disabled={!editMode} {...register('relationship_notes')} />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Last Interaction Date" type="date" disabled={!editMode} {...register('last_interaction_date')} />
                  <Input label="Next Follow-up Date" type="date" disabled={!editMode} {...register('next_followup_date')} />
                </div>
              </div>
            ) : null}
          </Card>
        </div>

        <div className="col-span-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <div className="text-[12px] text-text-secondary">Total Leads</div>
              <div className="mt-2 text-[16px] font-semibold">{leadStats.total}</div>
            </Card>
            <Card>
              <div className="text-[12px] text-text-secondary">Active Leads</div>
              <div className="mt-2 text-[16px] font-semibold">{leadStats.active}</div>
            </Card>
            <Card>
              <div className="text-[12px] text-text-secondary">Total Disbursed</div>
              <div className="mt-2 text-[16px] font-semibold">{leadStats.disbursed}</div>
            </Card>
          </div>

          <Card title="Leads">
            <div className="space-y-2">
              {leads.slice(0, 8).map((l) => (
                <Link
                  key={l.id}
                  to={`/leads/${l.id}`}
                  className="flex items-center justify-between rounded-md border border-border-divider px-3 py-2 hover:bg-[#F5F5F3]"
                >
                  <div>
                    <div className="text-[13px] font-medium">{l.lead_code || '—'}</div>
                    <div className="text-[12px] text-text-secondary">{l.loan_type || '—'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[12px] font-medium">{formatINR(l.required_amount)}</div>
                    <div
                      className={[
                        'mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                        getStageColor(l.stage),
                      ].join(' ')}
                    >
                      {l.stage}
                    </div>
                  </div>
                </Link>
              ))}
              {leads.length === 0 ? <div className="text-[13px] text-text-muted">No leads</div> : null}
            </div>
          </Card>

          <Card
            title="Documents"
            action={
              <Button variant="secondary" size="sm" onClick={() => setChecklistDrawerOpen(true)}>
                Checklist
              </Button>
            }
          >
            <div className="mb-2 text-[13px] text-text-secondary">
              Customer checklist: {customerChecklistProgress.receivedCount}/{customerChecklistProgress.requiredCount} received • {customerChecklistProgress.verifiedCount} verified
            </div>
            <div className="space-y-2">
              {docs.slice(0, 8).map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-md border border-border-divider px-3 py-2">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-text-muted" />
                    <div>
                      <div className="text-[13px] font-medium">{d.document_type}</div>
                      <div className="text-[12px] text-text-secondary">{d.status || 'Pending'}</div>
                    </div>
                  </div>
                  <div className="text-[12px] text-text-muted">{formatDate(d.uploaded_at)}</div>
                </div>
              ))}
              {docs.length === 0 ? <div className="text-[13px] text-text-muted">No documents</div> : null}
            </div>
          </Card>

          <Card
            title="Bank Applications"
            action={
              <Link to="/bank-applications" className="text-[12px] font-medium text-accent hover:underline">
                View all
              </Link>
            }
          >
            <div className="space-y-2">
              {bankApps.slice(0, 8).map((a) => {
                const leadCode = findLeadCode(a.lead_id)
                return (
                  <div key={a.id} className="flex items-center justify-between rounded-md border border-border-divider px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Building2 size={16} className="text-text-muted" />
                      <div>
                        <div className="text-[13px] font-medium">{a.bank_name || '—'}</div>
                        <div className="text-[12px] text-text-secondary">{leadCode ? `Lead ${leadCode}` : 'Lead —'}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[12px] text-text-muted">{formatDate(a.login_date)}</div>
                      <div className="mt-1 text-[12px] font-medium">{a.underwriting_status || '—'}</div>
                    </div>
                  </div>
                )
              })}
              {bankApps.length === 0 ? <div className="text-[13px] text-text-muted">No bank applications</div> : null}
            </div>
          </Card>

          <Card
            title="Disbursements"
            action={
              <Link to="/disbursements" className="text-[12px] font-medium text-accent hover:underline">
                View all
              </Link>
            }
          >
            <div className="space-y-2">
              {disbursements.slice(0, 8).map((d) => {
                const leadCode = findLeadCode(d.lead_id)
                const disbursedAmount =
                  d.final_disbursed_amount != null && d.final_disbursed_amount !== '' ? formatINR(d.final_disbursed_amount) : '—'
                const net = d.net_revenue != null && d.net_revenue !== '' ? formatINR(d.net_revenue) : null
                return (
                  <div key={d.id} className="flex items-center justify-between rounded-md border border-border-divider px-3 py-2">
                    <div className="flex items-center gap-2">
                      <IndianRupee size={16} className="text-text-muted" />
                      <div>
                        <div className="text-[13px] font-medium">{disbursedAmount}</div>
                        <div className="text-[12px] text-text-secondary">{leadCode ? `Lead ${leadCode}` : 'Lead —'}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[12px] text-text-muted">{formatDate(d.disbursement_date)}</div>
                      <div className="mt-1 text-[12px] text-text-secondary">{net ? `Net ${net}` : 'Net —'}</div>
                    </div>
                  </div>
                )
              })}
              {disbursements.length === 0 ? <div className="text-[13px] text-text-muted">No disbursements</div> : null}
            </div>
          </Card>
        </div>
      </div>

      <Drawer
        open={checklistDrawerOpen}
        onClose={() => setChecklistDrawerOpen(false)}
        title={customer ? `Checklist — ${customer.name}` : 'Checklist'}
        footer={
          <Button variant="secondary" onClick={() => setChecklistDrawerOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Customer" value={customer?.name || '—'} disabled />
            <Input label="Profession" value={customer?.profession_type || '—'} disabled />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Checklist Type" value={customerChecklist.type} disabled />
            <Input
              label="Progress"
              value={`${customerChecklistProgress.receivedCount}/${customerChecklistProgress.requiredCount} received • ${customerChecklistProgress.verifiedCount} verified • ${customerChecklistProgress.pendingCount} pending`}
              disabled
            />
          </div>

          <div className="space-y-2">
            {(customerChecklist.items || []).map((t) => {
              const agg = customerChecklistAgg.get(t)
              const status = agg?.bestStatus || 'Pending'
              const latestAt = agg?.latestAt
              return (
                <div key={t} className="rounded-md border border-border-divider bg-surface px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium">{t}</div>
                      {latestAt ? <div className="text-[12px] text-text-muted">{formatDate(latestAt)}</div> : null}
                    </div>
                    <Badge
                      dot={false}
                      text={status}
                      colorClass={
                        status === 'Verified'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : status === 'Received'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-50 text-slate-700 border-border-divider'
                      }
                    />
                  </div>
                </div>
              )
            })}
          </div>
          {(customerChecklist.items || []).length === 0 ? (
            <div className="text-[13px] text-text-muted">No checklist configured for this customer.</div>
          ) : null}
          <div className="text-[12px] text-text-muted">
            Checklist statuses are aggregated across all leads for this customer. Update per lead in Lead Detail → Documents.
          </div>
        </div>
      </Drawer>

      <Drawer
        open={leadDrawerOpen}
        onClose={() => setLeadDrawerOpen(false)}
        title="Add Lead"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLeadDrawerOpen(false)} disabled={leadForm.formState.isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={leadForm.handleSubmit(async (values) => {
                const payload = { ...values, customer_id: id }
                payload.required_amount = payload.required_amount ? Number(payload.required_amount) : null
                payload.preferred_tenure_months = payload.preferred_tenure_months ? Number(payload.preferred_tenure_months) : null
                Object.keys(payload).forEach((k) => {
                  if (payload[k] === '') payload[k] = null
                })
                const run = async (p) => {
                  const { error } = await supabase.from('leads').insert([p])
                  if (error) throw error
                }
                try {
                  await run(payload)
                } catch (e) {
                  const msg = String(e?.message || '')
                  const code = String(e?.code || '')
                  const missingLeadStatus =
                    (code === '42703' && msg.includes('lead_status_')) ||
                    (msg.toLowerCase().includes('does not exist') && msg.toLowerCase().includes('column') && msg.includes('lead_status_'))
                  if (!missingLeadStatus) {
                    toast.error(e?.message || 'Failed to create lead')
                    return
                  }
                  try {
                    localStorage.setItem('optom_lead_status_schema_v1', '0')
                  } catch {
                    void 0
                  }
                  const nextPayload = { ...payload }
                  delete nextPayload.lead_status_category
                  delete nextPayload.lead_status_stage
                  try {
                    await run(nextPayload)
                  } catch (e2) {
                    toast.error(e2?.message || 'Failed to create lead')
                    return
                  }
                }
                toast.success('Lead created')
                setLeadDrawerOpen(false)
                await load()
              })}
              disabled={leadForm.formState.isSubmitting}
            >
              Submit
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Loan Type"
            options={[
              { value: 'Personal Loan', label: 'Personal Loan' },
              { value: 'Business Loan', label: 'Business Loan' },
              { value: 'Loan Against Property', label: 'Loan Against Property' },
              { value: 'Working Capital', label: 'Working Capital' },
              { value: 'Overdraft / CC', label: 'Overdraft / CC' },
              { value: 'Equipment Finance', label: 'Equipment Finance' },
            ]}
            {...leadForm.register('loan_type')}
          />
          <Select
            label="Urgency Level"
            options={[
              { value: 'High', label: 'High' },
              { value: 'Medium', label: 'Medium' },
              { value: 'Low', label: 'Low' },
            ]}
            {...leadForm.register('urgency_level')}
          />
          <Select
            label="Lead Status"
            options={[
              { value: '', label: '—' },
              { value: 'Hot Lead', label: 'Hot Lead' },
              { value: 'Warm Lead', label: 'Warm Lead' },
              { value: 'Cold Lead', label: 'Cold Lead' },
              { value: 'Not Doable', label: 'Not Doable' },
            ]}
            {...leadForm.register('lead_status_category')}
          />
          <Select
            label="Status Stage"
            options={[
              { value: '', label: '—' },
              { value: 'Ready to close', label: 'Ready to close' },
              { value: 'Docs shared', label: 'Docs shared' },
              { value: 'Negotiation stage', label: 'Negotiation stage' },
              { value: 'Interested but evaluating', label: 'Interested but evaluating' },
              { value: 'Partial documents / discussion on', label: 'Partial documents / discussion on' },
              { value: 'No immediate requirement', label: 'No immediate requirement' },
              { value: 'Future potential', label: 'Future potential' },
            ]}
            {...leadForm.register('lead_status_stage')}
          />
          <Input
            label="Lead Creation Date"
            type="date"
            error={leadForm.formState.errors.lead_creation_date?.message}
            {...leadForm.register('lead_creation_date', { required: 'Lead date is required' })}
          />
          <Input label="Required Amount" {...leadForm.register('required_amount')} />
          <Input label="Preferred Tenure (months)" {...leadForm.register('preferred_tenure_months')} />
          <Input label="Preferred Bank" {...leadForm.register('preferred_bank')} />
          <Input label="Lead Source" {...leadForm.register('lead_source')} />
          <Input label="Referral Partner" {...leadForm.register('referral_partner_name')} />
          <Input label="Sales Manager" {...leadForm.register('sales_manager_name')} />
          <Input label="Sales Manager Contact" {...leadForm.register('sales_manager_contact')} />
          <Input label="Branch Location" {...leadForm.register('branch_location')} />
        </div>

        <Divider title="Notes" />
        <Textarea label="Loan Purpose" rows={3} {...leadForm.register('loan_purpose')} />
      </Drawer>
    </div>
  )
}
