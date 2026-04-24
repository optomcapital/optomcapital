import { createColumnHelper } from '@tanstack/react-table'
import { Building2, FileText, FolderOpen, IndianRupee, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router-dom'
import { Badge, Button, Card, ConfirmDialog, Divider, Drawer, Input, Select, Table, Textarea, Toggle } from '../../components/ui/index.jsx'
import { deleteBankApplicationCascade, supabase } from '../../lib/supabase.js'
import { formatDate, formatINR, writeClipboardText } from '../../lib/utils.js'

const stages = [
  'Lead Generated',
  'Qualification Done',
  'Documents Collected',
  'Login to Bank',
  'Underwriting',
  'Sanction Approved',
  'Disbursement Processing',
  'Disbursed',
  'Declined',
]

const uwStatuses = ['Pending', 'In Review', 'Query Raised', 'Approved', 'Declined']

const leadStatusCategories = [
  { value: '', label: '—' },
  { value: 'Hot Lead', label: 'Hot Lead' },
  { value: 'Warm Lead', label: 'Warm Lead' },
  { value: 'Cold Lead', label: 'Cold Lead' },
  { value: 'Not Doable', label: 'Not Doable' },
]

const leadStatusStagesByCategory = {
  'Hot Lead': ['Ready to close', 'Docs shared', 'Negotiation stage'],
  'Warm Lead': ['Interested but evaluating', 'Partial documents / discussion on'],
  'Cold Lead': ['No immediate requirement', 'Future potential'],
  'Not Doable': [],
}

const LEAD_STATUS_SCHEMA_KEY = 'optom_lead_status_schema_v1'

function getLeadStatusSupportedDefault() {
  try {
    const v = localStorage.getItem(LEAD_STATUS_SCHEMA_KEY)
    if (v === '0') return false
    if (v === '1') return true
  } catch {
    void 0
  }
  return true
}

function isMissingColumnError(err, columnPrefix) {
  const msg = String(err?.message || '')
  const code = String(err?.code || '')
  if (code === '42703') return !columnPrefix || msg.includes(columnPrefix)
  if (msg.toLowerCase().includes('does not exist') && msg.toLowerCase().includes('column')) {
    return !columnPrefix || msg.includes(columnPrefix)
  }
  return false
}

const columnHelper = createColumnHelper()

export default function LeadDetail() {
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [lead, setLead] = useState(null)
  const [customer, setCustomer] = useState(null)
  const [activeTab, setActiveTab] = useState('loan')
  const [loanEditing, setLoanEditing] = useState(false)
  const [notesEditing, setNotesEditing] = useState(false)
  const [collateralEditing, setCollateralEditing] = useState(false)

  const [disbEditing, setDisbEditing] = useState(false)

  const [collateral, setCollateral] = useState(null)
  const [bankApps, setBankApps] = useState([])
  const [disbursement, setDisbursement] = useState(null)
  const [documents, setDocuments] = useState([])

  const [bankDrawerOpen, setBankDrawerOpen] = useState(false)
  const [editingBank, setEditingBank] = useState(null)
  const [bankReadOnly, setBankReadOnly] = useState(false)
  const [deleteBankTarget, setDeleteBankTarget] = useState(null)

  const [bankSearch, setBankSearch] = useState('')
  const [bankUwStatus, setBankUwStatus] = useState('')
  const [bankStartDate, setBankStartDate] = useState('')
  const [bankEndDate, setBankEndDate] = useState('')
  const [bankMinSanction, setBankMinSanction] = useState('')
  const [bankMaxSanction, setBankMaxSanction] = useState('')
  const [bankMinRate, setBankMinRate] = useState('')
  const [bankMaxRate, setBankMaxRate] = useState('')
  const [leadStatusSupported, setLeadStatusSupported] = useState(getLeadStatusSupportedDefault)

  const loanForm = useForm()
  const leadStatusCategoryForm = loanForm.watch('lead_status_category')
  const leadStatusStageOptions = useMemo(() => {
    const cat = String(leadStatusCategoryForm || '').trim()
    const base = leadStatusStagesByCategory[cat] || []
    const all = Array.from(
      new Set(
        Object.values(leadStatusStagesByCategory)
          .flat()
          .filter(Boolean),
      ),
    )
    const options = cat ? base : all
    return [{ value: '', label: '—' }, ...options.map((s) => ({ value: s, label: s }))]
  }, [leadStatusCategoryForm])

  useEffect(() => {
    const cat = String(leadStatusCategoryForm || '').trim()
    const stageValue = String(loanForm.getValues('lead_status_stage') || '').trim()
    const allowed = new Set(leadStatusStagesByCategory[cat] || [])
    if (cat && stageValue && allowed.size && !allowed.has(stageValue)) {
      loanForm.setValue('lead_status_stage', '')
    }
  }, [leadStatusCategoryForm, loanForm])

  const markLeadStatusUnsupported = useCallback(() => {
    setLeadStatusSupported(false)
    try {
      localStorage.setItem(LEAD_STATUS_SCHEMA_KEY, '0')
    } catch {
      void 0
    }
  }, [])
  const collateralForm = useForm({
    defaultValues: {
      property_type: 'Residential',
      property_address: '',
      market_value: '',
      distress_value: '',
      ltv_percentage: '',
      property_ownership: '',
      property_age_years: '',
    },
  })
  const bankForm = useForm({
    defaultValues: {
      bank_name: '',
      bank_rm_name: '',
      rm_contact: '',
      login_date: '',
      case_id: '',
      underwriting_status: 'Pending',
      credit_queries: '',
      sanction_amount: '',
      interest_rate: '',
      loan_tenure_months: '',
      emi_amount: '',
    },
  })
  const disbForm = useForm({
    defaultValues: {
      bank_application_id: '',
      sanction_amount: '',
      final_disbursed_amount: '',
      disbursement_date: '',
      roi_percentage: '',
      bank_payout_percentage: '',
      subvention_notes: '',
      dsa_code_confirmation: '',
      connector_name: '',
      partner_share_percentage: '0.25',
      gross_revenue: '',
      partner_share: '',
      net_revenue: '',
      invoice_raised: false,
      payout_received: false,
      payment_pending: true,
    },
  })
  const notesForm = useForm({
    defaultValues: {
      credit_observations: '',
      structuring_notes: '',
      risk_flags: '',
      rejection_reason: '',
      case_history: '',
    },
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const leadRes = await supabase
        .from('leads')
        .select(
          '*, customer:customers(id, name, customer_code, business_name, city)',
        )
        .eq('id', id)
        .single()
      if (leadRes.error) throw leadRes.error

      const leadData = leadRes.data
      setLead(leadData)
      setCustomer(leadData.customer || null)
      loanForm.reset(leadData)
      setLoanEditing(false)
      notesForm.reset({
        credit_observations: leadData.credit_observations || '',
        structuring_notes: leadData.structuring_notes || '',
        risk_flags: leadData.risk_flags || '',
        rejection_reason: leadData.rejection_reason || '',
        case_history: leadData.case_history || '',
      })
      setNotesEditing(false)
      setCollateralEditing(false)
      setDisbEditing(false)

      const [colRes, bankRes, disbRes, docRes] = await Promise.all([
        supabase.from('collateral').select('*').eq('lead_id', id).maybeSingle(),
        supabase
          .from('bank_applications')
          .select('*, lead:leads!inner(id)')
          .eq('lead.id', id)
          .order('created_at', { ascending: false }),
        supabase.from('disbursements').select('*').eq('lead_id', id).maybeSingle(),
        supabase.from('documents').select('*').eq('lead_id', id).order('uploaded_at', { ascending: false }),
      ])

      if (colRes.error) throw colRes.error
      if (bankRes.error) throw bankRes.error
      if (disbRes.error) throw disbRes.error
      if (docRes.error) throw docRes.error

      setCollateral(colRes.data || null)
      collateralForm.reset({
        property_type: colRes.data?.property_type || 'Residential',
        property_address: colRes.data?.property_address || '',
        market_value: colRes.data?.market_value || '',
        distress_value: colRes.data?.distress_value || '',
        ltv_percentage: colRes.data?.ltv_percentage || '',
        property_ownership: colRes.data?.property_ownership || '',
        property_age_years: colRes.data?.property_age_years || '',
      })

      setBankApps(bankRes.data || [])
      setDisbursement(disbRes.data || null)
      const grossBase = Number(disbRes.data?.gross_revenue || 0)
      const partnerAmt = Number(disbRes.data?.partner_share || 0)
      const partnerPct = grossBase > 0 ? Math.round(((partnerAmt / grossBase) * 100) * 100) / 100 : 0.25
      const payoutReceived = !!disbRes.data?.payout_received
      disbForm.reset({
        bank_application_id: disbRes.data?.bank_application_id || '',
        sanction_amount: disbRes.data?.sanction_amount || '',
        final_disbursed_amount: disbRes.data?.final_disbursed_amount || '',
        disbursement_date: disbRes.data?.disbursement_date || '',
        roi_percentage: disbRes.data?.roi_percentage || '',
        bank_payout_percentage: disbRes.data?.bank_payout_percentage || '',
        subvention_notes: disbRes.data?.subvention_notes || '',
        dsa_code_confirmation: disbRes.data?.dsa_code_confirmation || leadData.referral_partner_name || '',
        connector_name: disbRes.data?.connector_name || leadData.sales_manager_name || '',
        partner_share_percentage: String(partnerPct),
        gross_revenue: disbRes.data?.gross_revenue || '',
        partner_share: disbRes.data?.partner_share || '',
        net_revenue: disbRes.data?.net_revenue || '',
        invoice_raised: !!disbRes.data?.invoice_raised,
        payout_received: payoutReceived,
        payment_pending: disbRes.data?.payment_pending ?? !payoutReceived,
      })
      setDocuments(docRes.data || [])
    } catch (e) {
      toast.error(e?.message || 'Failed to load lead')
    } finally {
      setLoading(false)
    }
  }, [collateralForm, disbForm, id, loanForm, notesForm])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const formatNum = (n) => {
      if (!Number.isFinite(n)) return ''
      const rounded = Math.round(n * 100) / 100
      return rounded ? String(rounded) : '0'
    }
    const sub = disbForm.watch((values, meta) => {
      const name = meta?.name
      if (!name) return
      if (
        name !== 'final_disbursed_amount' &&
        name !== 'bank_payout_percentage' &&
        name !== 'partner_share_percentage' &&
        name !== 'bank_application_id'
      ) {
        return
      }

      if (name === 'bank_application_id') {
        const selected = bankApps.find((b) => b.id === values.bank_application_id)
        if (selected) {
          disbForm.setValue('sanction_amount', selected.sanction_amount == null ? '' : String(selected.sanction_amount), { shouldDirty: true })
          disbForm.setValue('roi_percentage', selected.interest_rate == null ? '' : String(selected.interest_rate), { shouldDirty: true })
        }
      }

      const finalAmt = Number(values.final_disbursed_amount || 0)
      const payoutPct = Number(values.bank_payout_percentage || 0)
      const partnerPct = Number(values.partner_share_percentage || 0)

      const gross = (finalAmt * payoutPct) / 100
      const partner = (gross * partnerPct) / 100
      const net = gross - partner

      disbForm.setValue('gross_revenue', formatNum(gross), { shouldDirty: true })
      disbForm.setValue('partner_share', formatNum(partner), { shouldDirty: true })
      disbForm.setValue('net_revenue', formatNum(net), { shouldDirty: true })
    })
    return () => sub.unsubscribe()
  }, [bankApps, disbForm])

  const requiredDocs = useMemo(() => {
    const p = String(customer?.profession_type || '').trim().toLowerCase()
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

    const type = lead?.loan_type || ''
    const base = ['PAN', 'Aadhaar', 'Passport/DL', 'Bank Statement 12M', 'Other']
    if (type === 'Personal Loan') return ['PAN', 'Aadhaar', 'Passport/DL', 'ITR - Year 1', 'Bank Statement 12M', 'Other']
    if (type === 'Business Loan')
      return ['PAN', 'Aadhaar', 'ITR - Year 1', 'ITR - Year 2', 'Balance Sheet', 'GST Returns', 'Bank Statement 12M', 'Other']
    if (type === 'Loan Against Property')
      return ['PAN', 'Aadhaar', 'ITR - Year 1', 'Balance Sheet', 'Bank Statement 12M', 'Title Deed', 'Sale Agreement', 'Valuation Report', 'Other']
    return base
  }, [customer?.profession_type, lead?.loan_type])

  const docsByType = useMemo(() => {
    const map = new Map()
    ;(documents || []).forEach((d) => {
      if (!d?.document_type) return
      map.set(d.document_type, d)
    })
    return map
  }, [documents])

  async function upsertDocStatus(documentType, status) {
    if (!lead?.customer_id) return
    const existing = docsByType.get(documentType)
    if (existing?.id) {
      const { error } = await supabase.from('documents').update({ status, uploaded_at: new Date().toISOString() }).eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('documents').insert([
        {
          customer_id: lead.customer_id,
          lead_id: id,
          document_type: documentType,
          status,
          uploaded_at: new Date().toISOString(),
        },
      ])
      if (error) throw error
    }
    await load()
  }

  const bankColumns = useMemo(() => {
    return [
      columnHelper.accessor('bank_name', { header: 'Bank', cell: (info) => info.getValue() || '—' }),
      columnHelper.accessor('bank_rm_name', { header: 'RM Name', cell: (info) => info.getValue() || '—' }),
      columnHelper.accessor('login_date', { header: 'Login Date', cell: (info) => formatDate(info.getValue()) }),
      columnHelper.accessor('case_id', { header: 'Case ID', cell: (info) => info.getValue() || '—' }),
      columnHelper.accessor('underwriting_status', {
        header: 'UW Status',
        cell: (info) => (
          <Badge
            text={info.getValue() || '—'}
            colorClass={
              info.getValue() === 'Approved'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : info.getValue() === 'Declined'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : info.getValue() === 'Query Raised'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-slate-50 text-slate-700 border-border-divider'
            }
          />
        ),
      }),
      columnHelper.accessor('sanction_amount', { header: 'Sanction', cell: (info) => formatINR(info.getValue()) }),
      columnHelper.accessor('interest_rate', { header: 'Rate', cell: (info) => (info.getValue() ? `${info.getValue()}%` : '—') }),
      columnHelper.accessor('loan_tenure_months', { header: 'Tenure', cell: (info) => (info.getValue() ? `${info.getValue()}m` : '—') }),
      columnHelper.accessor('emi_amount', { header: 'EMI', cell: (info) => formatINR(info.getValue()) }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const a = row.original
          return (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setBankReadOnly(true)
                  setEditingBank(a)
                  bankForm.reset({
                    bank_name: a.bank_name || '',
                    bank_rm_name: a.bank_rm_name || '',
                    rm_contact: a.rm_contact || '',
                    login_date: a.login_date || '',
                    case_id: a.case_id || '',
                    underwriting_status: a.underwriting_status || 'Pending',
                    credit_queries: a.credit_queries || '',
                    sanction_amount: a.sanction_amount || '',
                    interest_rate: a.interest_rate || '',
                    loan_tenure_months: a.loan_tenure_months || '',
                    emi_amount: a.emi_amount || '',
                  })
                  setBankDrawerOpen(true)
                }}
              >
                View
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setBankReadOnly(false)
                  setEditingBank(a)
                  bankForm.reset({
                    bank_name: a.bank_name || '',
                    bank_rm_name: a.bank_rm_name || '',
                    rm_contact: a.rm_contact || '',
                    login_date: a.login_date || '',
                    case_id: a.case_id || '',
                    underwriting_status: a.underwriting_status || 'Pending',
                    credit_queries: a.credit_queries || '',
                    sanction_amount: a.sanction_amount || '',
                    interest_rate: a.interest_rate || '',
                    loan_tenure_months: a.loan_tenure_months || '',
                    emi_amount: a.emi_amount || '',
                  })
                  setBankDrawerOpen(true)
                }}
              >
                Edit
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteBankTarget(a)
                }}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          )
        },
      }),
    ]
  }, [bankForm])

  const filteredBankApps = useMemo(() => {
    const list = Array.isArray(bankApps) ? bankApps : []

    const q = bankSearch.trim().toLowerCase()
    const uw = String(bankUwStatus || '').trim()

    const start = bankStartDate ? new Date(bankStartDate) : null
    const end = bankEndDate ? new Date(bankEndDate) : null
    if (end) end.setHours(23, 59, 59, 999)

    const minSanction = bankMinSanction === '' ? null : Number(bankMinSanction)
    const maxSanction = bankMaxSanction === '' ? null : Number(bankMaxSanction)
    const minRate = bankMinRate === '' ? null : Number(bankMinRate)
    const maxRate = bankMaxRate === '' ? null : Number(bankMaxRate)

    return list.filter((a) => {
      if (uw && (a.underwriting_status || '') !== uw) return false

      if (q) {
        const hay = [
          a.bank_name,
          a.bank_rm_name,
          a.case_id,
          a.rm_contact,
          a.underwriting_status,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }

      if (start || end) {
        const d = a.login_date ? new Date(a.login_date) : null
        if (!d) return false
        if (start && d < start) return false
        if (end && d > end) return false
      }

      const sanction = a.sanction_amount == null ? null : Number(a.sanction_amount)
      if (minSanction != null && (sanction == null || sanction < minSanction)) return false
      if (maxSanction != null && (sanction == null || sanction > maxSanction)) return false

      const rate = a.interest_rate == null ? null : Number(a.interest_rate)
      if (minRate != null && (rate == null || rate < minRate)) return false
      if (maxRate != null && (rate == null || rate > maxRate)) return false

      return true
    })
  }, [
    bankApps,
    bankEndDate,
    bankMaxSanction,
    bankMaxRate,
    bankMinSanction,
    bankMinRate,
    bankSearch,
    bankStartDate,
    bankUwStatus,
  ])

  async function updateStage(nextStage) {
    const { error } = await supabase.from('leads').update({ stage: nextStage }).eq('id', id)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Stage updated')
    setLead((prev) => ({ ...prev, stage: nextStage }))
  }

  if (loading) return null
  if (!lead) return null
  const selectedBankApp = bankApps.find((b) => b.id === disbForm.watch('bank_application_id')) || null

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[16px] font-semibold">{lead.lead_code || 'Lead'}</div>
            <div className="mt-1 text-[13px] text-text-secondary">
              <span className="mr-2">Customer:</span>
              {customer ? (
                <Link to={`/customers/${customer.id}`} className="text-accent hover:underline">
                  {customer.name}
                </Link>
              ) : (
                '—'
              )}
            </div>
            <div className="mt-2 flex items-center gap-2 text-[12px] text-text-secondary">
              <span className="inline-flex rounded-full border border-border-divider bg-slate-50 px-2 py-1 text-[12px]">
                {lead.loan_type || '—'}
              </span>
              <span>{formatINR(lead.required_amount)}</span>
              <span className="text-text-muted">•</span>
              <span>{formatDate(lead.lead_creation_date)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge text={lead.urgency_level || 'Medium'} colorClass={lead.urgency_level === 'High' ? 'bg-rose-50 text-rose-700 border-rose-200' : lead.urgency_level === 'Low' ? 'bg-slate-50 text-slate-700 border-border-divider' : 'bg-amber-50 text-amber-700 border-amber-200'} />
            {leadStatusSupported && lead.lead_status_category ? (
              <Badge
                text={lead.lead_status_category}
                colorClass={
                  lead.lead_status_category === 'Hot Lead'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : lead.lead_status_category === 'Warm Lead'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : lead.lead_status_category === 'Cold Lead'
                        ? 'bg-slate-50 text-slate-700 border-border-divider'
                        : lead.lead_status_category === 'Not Doable'
                          ? 'bg-zinc-100 text-zinc-700 border-zinc-200'
                          : 'bg-slate-50 text-slate-700 border-border-divider'
                }
              />
            ) : null}
            <Select value={lead.stage || 'Lead Generated'} onChange={(e) => updateStage(e.target.value)} options={stages.map((s) => ({ value: s, label: s }))} />
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-2 border-b border-border-divider">
        {[
          { id: 'loan', label: 'Loan Details', icon: FileText },
          { id: 'collateral', label: 'Collateral', icon: FolderOpen },
          { id: 'banks', label: 'Bank Applications', icon: Building2 },
          { id: 'disb', label: 'Disbursement', icon: IndianRupee },
          { id: 'docs', label: 'Documents', icon: FolderOpen },
          { id: 'risk', label: 'Risk & Notes', icon: FileText },
        ].map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              className={[
                'flex items-center gap-2 px-3 py-2 text-[13px] font-medium',
                activeTab === t.id ? 'text-accent border-b-2 border-accent' : 'text-text-secondary hover:text-text-primary',
              ].join(' ')}
              onClick={() => setActiveTab(t.id)}
            >
              <Icon size={14} />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {activeTab === 'loan' ? (
        <Card
          title="Loan Details"
          action={
            loanEditing ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    loanForm.reset(lead)
                    setLoanEditing(false)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={loanForm.handleSubmit(async (values) => {
                    const payload = { ...values }
                    payload.required_amount = payload.required_amount ? Number(payload.required_amount) : null
                    payload.preferred_tenure_months = payload.preferred_tenure_months ? Number(payload.preferred_tenure_months) : null
                    Object.keys(payload).forEach((k) => {
                      if (payload[k] === '') payload[k] = null
                    })
                    if (!leadStatusSupported) {
                      delete payload.lead_status_category
                      delete payload.lead_status_stage
                    }
                    const run = async (p) => {
                      const { error } = await supabase.from('leads').update(p).eq('id', id)
                      if (error) throw error
                    }
                    try {
                      await run(payload)
                    } catch (e) {
                      if (leadStatusSupported && isMissingColumnError(e, 'lead_status_')) {
                        markLeadStatusUnsupported()
                        const nextPayload = { ...payload }
                        delete nextPayload.lead_status_category
                        delete nextPayload.lead_status_stage
                        try {
                          await run(nextPayload)
                        } catch (e2) {
                          toast.error(e2?.message || 'Failed to update lead')
                          return
                        }
                      } else {
                        toast.error(e?.message || 'Failed to update lead')
                        return
                      }
                    }
                    toast.success('Lead updated')
                    setLoanEditing(false)
                    await load()
                  })}
                >
                  Save
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setLoanEditing(true)}>
                Edit
              </Button>
            )
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <Input label="Loan Purpose" disabled={!loanEditing} {...loanForm.register('loan_purpose')} />
            <Input
              label="Lead Creation Date"
              type="date"
              disabled={!loanEditing}
              error={loanForm.formState.errors.lead_creation_date?.message}
              {...loanForm.register('lead_creation_date', { required: 'Lead date is required' })}
            />
            <Input label="Required Amount" disabled={!loanEditing} {...loanForm.register('required_amount')} />
            <Input label="Preferred Tenure (months)" disabled={!loanEditing} {...loanForm.register('preferred_tenure_months')} />
            <Input label="Preferred Bank" disabled={!loanEditing} {...loanForm.register('preferred_bank')} />
            <Select
              label="Urgency Level"
              disabled={!loanEditing}
              options={[
                { value: 'High', label: 'High' },
                { value: 'Medium', label: 'Medium' },
                { value: 'Low', label: 'Low' },
              ]}
              {...loanForm.register('urgency_level')}
            />
            {leadStatusSupported ? (
              <>
                <Select label="Lead Status" disabled={!loanEditing} options={leadStatusCategories} {...loanForm.register('lead_status_category')} />
                <Select
                  label="Status Stage"
                  disabled={!loanEditing}
                  options={leadStatusStageOptions}
                  {...loanForm.register('lead_status_stage')}
                />
              </>
            ) : null}
            <Input label="Lead Source" disabled={!loanEditing} {...loanForm.register('lead_source')} />
            <Input label="Referral Partner" disabled={!loanEditing} {...loanForm.register('referral_partner_name')} />
            <Input label="Sales Manager" disabled={!loanEditing} {...loanForm.register('sales_manager_name')} />
            <Input label="Sales Manager Contact" disabled={!loanEditing} {...loanForm.register('sales_manager_contact')} />
            <Input label="Branch Location" disabled={!loanEditing} {...loanForm.register('branch_location')} />
          </div>
        </Card>
      ) : null}

      {activeTab === 'collateral' ? (
        lead.loan_type !== 'Loan Against Property' ? (
          <Card title="Collateral">
            <div className="text-[13px] text-text-secondary">Collateral is only applicable for Loan Against Property.</div>
          </Card>
        ) : (
          <Card
            title="Collateral"
            action={
              collateralEditing ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      collateralForm.reset({
                        property_type: collateral?.property_type || 'Residential',
                        property_address: collateral?.property_address || '',
                        market_value: collateral?.market_value || '',
                        distress_value: collateral?.distress_value || '',
                        ltv_percentage: collateral?.ltv_percentage || '',
                        property_ownership: collateral?.property_ownership || '',
                        property_age_years: collateral?.property_age_years || '',
                      })
                      setCollateralEditing(false)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={collateralForm.handleSubmit(async (values) => {
                      const payload = {
                        ...values,
                        lead_id: id,
                        customer_id: lead.customer_id,
                        market_value: values.market_value ? Number(values.market_value) : null,
                        distress_value: values.distress_value ? Number(values.distress_value) : null,
                        ltv_percentage: values.ltv_percentage ? Number(values.ltv_percentage) : null,
                        property_age_years: values.property_age_years ? Number(values.property_age_years) : null,
                      }
                      Object.keys(payload).forEach((k) => {
                        if (payload[k] === '') payload[k] = null
                      })
                      let res
                      if (collateral?.id) res = await supabase.from('collateral').update(payload).eq('id', collateral.id)
                      else res = await supabase.from('collateral').insert([payload])
                      if (res.error) {
                        toast.error(res.error.message)
                        return
                      }
                      toast.success('Collateral saved')
                      setCollateralEditing(false)
                      await load()
                    })}
                  >
                    Save
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setCollateralEditing(true)}>
                  {collateral?.id ? 'Edit' : 'Add'}
                </Button>
              )
            }
          >
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Property Type"
                options={[
                  { value: 'Residential', label: 'Residential' },
                  { value: 'Commercial', label: 'Commercial' },
                  { value: 'Industrial', label: 'Industrial' },
                ]}
                {...collateralForm.register('property_type')}
                disabled={!collateralEditing}
              />
              <Input label="Property Ownership" disabled={!collateralEditing} {...collateralForm.register('property_ownership')} />
              <Input label="Market Value" disabled={!collateralEditing} {...collateralForm.register('market_value')} />
              <Input label="Distress Value" disabled={!collateralEditing} {...collateralForm.register('distress_value')} />
              <Input label="LTV %" disabled={!collateralEditing} {...collateralForm.register('ltv_percentage')} />
              <Input label="Property Age (years)" disabled={!collateralEditing} {...collateralForm.register('property_age_years')} />
            </div>
            <div className="mt-3">
              <Textarea label="Property Address" rows={3} disabled={!collateralEditing} {...collateralForm.register('property_address')} />
            </div>
          </Card>
        )
      ) : null}

      {activeTab === 'banks' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[13px] text-text-secondary">
              Showing {filteredBankApps.length} of {bankApps.length}
            </div>
            <Button
              onClick={() => {
                setEditingBank(null)
                setBankReadOnly(false)
                bankForm.reset({ underwriting_status: 'Pending' })
                setBankDrawerOpen(true)
              }}
            >
              <Plus size={16} />
              <span>Add Bank Application</span>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <div className="min-w-[320px] flex-1">
              <Input
                placeholder="Search bank / RM / case / contact…"
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
              />
            </div>
            <div className="w-[170px]">
              <Select
                value={bankUwStatus}
                onChange={(e) => setBankUwStatus(e.target.value)}
                options={[
                  { value: '', label: 'All UW Status' },
                  ...uwStatuses.map((s) => ({ value: s, label: s })),
                ]}
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="text-[12px] font-medium text-text-secondary">From</div>
              <div className="w-[160px]">
                <Input type="date" value={bankStartDate} onChange={(e) => setBankStartDate(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-[12px] font-medium text-text-secondary">To</div>
              <div className="w-[160px]">
                <Input type="date" value={bankEndDate} onChange={(e) => setBankEndDate(e.target.value)} />
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setBankSearch('')
                setBankUwStatus('')
                setBankStartDate('')
                setBankEndDate('')
                setBankMinSanction('')
                setBankMaxSanction('')
                setBankMinRate('')
                setBankMaxRate('')
              }}
            >
              Clear
            </Button>
          </div>

          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-3">
              <Input
                label="Sanction Min"
                type="number"
                step="1"
                min="0"
                value={bankMinSanction}
                onChange={(e) => setBankMinSanction(e.target.value)}
              />
            </div>
            <div className="col-span-3">
              <Input
                label="Sanction Max"
                type="number"
                step="1"
                min="0"
                value={bankMaxSanction}
                onChange={(e) => setBankMaxSanction(e.target.value)}
              />
            </div>
            <div className="col-span-3">
              <Input
                label="Rate Min (%)"
                type="number"
                step="0.01"
                min="0"
                value={bankMinRate}
                onChange={(e) => setBankMinRate(e.target.value)}
              />
            </div>
            <div className="col-span-3">
              <Input
                label="Rate Max (%)"
                type="number"
                step="0.01"
                min="0"
                value={bankMaxRate}
                onChange={(e) => setBankMaxRate(e.target.value)}
              />
            </div>
          </div>

          <Table columns={bankColumns} data={filteredBankApps} loading={false} emptyIcon={Building2} />
        </div>
      ) : null}

      {activeTab === 'disb' ? (
        <Card
          title="Disbursement"
          action={
            disbEditing ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const grossBase = Number(disbursement?.gross_revenue || 0)
                    const partnerAmt = Number(disbursement?.partner_share || 0)
                    const partnerPct = grossBase > 0 ? Math.round(((partnerAmt / grossBase) * 100) * 100) / 100 : 0.25
                    const payoutReceived = !!disbursement?.payout_received
                    disbForm.reset({
                      bank_application_id: disbursement?.bank_application_id || '',
                      sanction_amount: disbursement?.sanction_amount || '',
                      final_disbursed_amount: disbursement?.final_disbursed_amount || '',
                      disbursement_date: disbursement?.disbursement_date || '',
                      roi_percentage: disbursement?.roi_percentage || '',
                      bank_payout_percentage: disbursement?.bank_payout_percentage || '',
                      subvention_notes: disbursement?.subvention_notes || '',
                      dsa_code_confirmation: disbursement?.dsa_code_confirmation || '',
                      connector_name: disbursement?.connector_name || '',
                      partner_share_percentage: String(partnerPct),
                      gross_revenue: disbursement?.gross_revenue || '',
                      partner_share: disbursement?.partner_share || '',
                      net_revenue: disbursement?.net_revenue || '',
                      invoice_raised: !!disbursement?.invoice_raised,
                      payout_received: payoutReceived,
                      payment_pending: disbursement?.payment_pending ?? !payoutReceived,
                    })
                    setDisbEditing(false)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={disbForm.handleSubmit(async (values) => {
                    if (values.payout_received && !values.invoice_raised) {
                      toast.error('Step 1 (Invoice Raised) must be completed before Step 2 (Payout Received).')
                      return
                    }
                    const payload = {
                      ...values,
                      lead_id: id,
                      sanction_amount: values.sanction_amount ? Number(values.sanction_amount) : null,
                      final_disbursed_amount: values.final_disbursed_amount ? Number(values.final_disbursed_amount) : null,
                      roi_percentage: values.roi_percentage ? Number(values.roi_percentage) : null,
                      bank_payout_percentage: values.bank_payout_percentage ? Number(values.bank_payout_percentage) : null,
                      gross_revenue: values.gross_revenue ? Number(values.gross_revenue) : null,
                      partner_share: values.partner_share ? Number(values.partner_share) : null,
                      net_revenue: values.net_revenue ? Number(values.net_revenue) : null,
                      payment_pending: !values.payout_received,
                    }
                    delete payload.partner_share_percentage
                    Object.keys(payload).forEach((k) => {
                      if (payload[k] === '') payload[k] = null
                    })

                    let res
                    if (disbursement?.id) res = await supabase.from('disbursements').update(payload).eq('id', disbursement.id)
                    else res = await supabase.from('disbursements').insert([payload])
                    if (res.error) {
                      toast.error(res.error.message)
                      return
                    }
                    toast.success('Disbursement saved')
                    setDisbEditing(false)
                    await load()
                  })}
                >
                  Save
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setDisbEditing(true)}>
                {disbursement?.id ? 'Edit' : 'Add'}
              </Button>
            )
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Bank Application"
              options={[
                { value: '', label: 'None' },
                ...bankApps.map((b) => ({ value: b.id, label: `${b.bank_name || 'Bank'} (${b.case_id || '—'})` })),
              ]}
              {...disbForm.register('bank_application_id')}
              disabled={!disbEditing}
            />
            <Input label="Disbursement Date" disabled={!disbEditing} type="date" {...disbForm.register('disbursement_date')} />
            <Input label="Customer Name" value={customer?.name || '—'} disabled />
            <Input label="Firm / Company / Entity Name" value={customer?.business_name || '—'} disabled />
            <Input label="NBFC / Bank Name" value={selectedBankApp?.bank_name || '—'} disabled />
            <Input label="Loan Type" value={lead?.loan_type || '—'} disabled />
            <Input label="Banker Name" value={selectedBankApp?.bank_rm_name || '—'} disabled />
            <Input label="Banker Number" value={selectedBankApp?.rm_contact || '—'} disabled />
            <Input
              label="Loan Tenure (months)"
              value={selectedBankApp?.loan_tenure_months == null ? '—' : String(selectedBankApp.loan_tenure_months)}
              disabled
            />
            <Input label="Location" value={customer?.city || '—'} disabled />
            <Input label="Sanction Amount" disabled={!disbEditing} type="number" step="1" min="0" {...disbForm.register('sanction_amount')} />
            <Input label="Final Disbursed Amount" disabled={!disbEditing} type="number" step="1" min="0" {...disbForm.register('final_disbursed_amount')} />
            <Input label="ROI (%)" disabled={!disbEditing} type="number" step="0.01" min="0" {...disbForm.register('roi_percentage')} />
            <Input label="Bank Payout %" disabled={!disbEditing} type="number" step="0.01" min="0" {...disbForm.register('bank_payout_percentage')} />
            <Input label="Subvention (If any / mention No)" disabled={!disbEditing} {...disbForm.register('subvention_notes')} />
            <Input label="DSA Code Confirmation" disabled={!disbEditing} {...disbForm.register('dsa_code_confirmation')} />
            <Input label="Connector Name" disabled={!disbEditing} {...disbForm.register('connector_name')} />
            <Input label="Partner Share %" disabled={!disbEditing} type="number" step="0.01" min="0" {...disbForm.register('partner_share_percentage')} />
            <Input label="Gross Revenue" disabled {...disbForm.register('gross_revenue')} />
            <Input label="Partner Share" disabled {...disbForm.register('partner_share')} />
            <Input label="Net Revenue" disabled {...disbForm.register('net_revenue')} />
          </div>
          <Divider title="Payment Tracking" />
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-md border border-border-divider bg-surface px-3 py-2">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Step 1</div>
              <Toggle
                label="Invoice Raised"
                checked={!!disbForm.watch('invoice_raised')}
                onChange={(v) => {
                  const payoutReceived = !!disbForm.getValues('payout_received')
                  if (payoutReceived) {
                    toast.error('Step 1 cannot be changed after Step 2 is completed.')
                    return
                  }
                  disbForm.setValue('invoice_raised', v)
                }}
                disabled={!disbEditing || !!disbForm.watch('payout_received')}
              />
            </div>
            <div className="rounded-md border border-border-divider bg-surface px-3 py-2">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Step 2</div>
              <Toggle
                label="Payout Received"
                checked={!!disbForm.watch('payout_received')}
                onChange={(v) => {
                  const invoiceRaised = !!disbForm.getValues('invoice_raised')
                  if (v && !invoiceRaised) {
                    toast.error('Complete Step 1 (Invoice Raised) before Step 2.')
                    return
                  }
                  disbForm.setValue('payout_received', v)
                  disbForm.setValue('payment_pending', !v)
                }}
                disabled={!disbEditing}
              />
            </div>
            <div className="rounded-md border border-border-divider bg-surface px-3 py-2">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Step 3</div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-text-secondary">Payment Status</span>
                <Badge
                  dot={false}
                  text={disbForm.watch('payout_received') ? 'Done' : 'Pending'}
                  colorClass={
                    disbForm.watch('payout_received')
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }
                />
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {activeTab === 'docs' ? (
        <Card
          title="Documents"
        >
          <div className="space-y-3">
            <div className="text-[13px] text-text-secondary">Checklist only (no file storage)</div>
            <div className="space-y-3">
              {requiredDocs.map((t) => {
                const existing = docsByType.get(t)
                const status = existing?.status || 'Pending'
                return (
                  <div key={t} className="rounded-md border border-border-divider bg-surface px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium">{t}</div>
                        {existing?.uploaded_at ? <div className="text-[12px] text-text-muted">{formatDate(existing.uploaded_at)}</div> : null}
                      </div>
                      <div className="w-[160px] shrink-0">
                        <Select
                          value={status}
                          onChange={async (e) => {
                            const next = e.target.value
                            try {
                              await upsertDocStatus(t, next)
                              toast.success('Updated')
                            } catch (err) {
                              toast.error(err?.message || 'Failed to update')
                            }
                          }}
                          options={[
                            { value: 'Pending', label: 'Pending' },
                            { value: 'Received', label: 'Received' },
                            { value: 'Verified', label: 'Verified' },
                          ]}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {requiredDocs.length === 0 ? <div className="text-[13px] text-text-muted">No checklist configured</div> : null}
          </div>
        </Card>
      ) : null}

      {activeTab === 'risk' ? (
        <Card
          title="Risk & Notes"
          action={
            notesEditing ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    notesForm.reset({
                      credit_observations: lead.credit_observations || '',
                      structuring_notes: lead.structuring_notes || '',
                      risk_flags: lead.risk_flags || '',
                      rejection_reason: lead.rejection_reason || '',
                      case_history: lead.case_history || '',
                    })
                    setNotesEditing(false)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={notesForm.handleSubmit(async (values) => {
                    const { error } = await supabase.from('leads').update(values).eq('id', id)
                    if (error) {
                      toast.error(error.message)
                      return
                    }
                    toast.success('Notes updated')
                    setNotesEditing(false)
                    await load()
                  })}
                >
                  Save
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setNotesEditing(true)}>
                Edit
              </Button>
            )
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <Textarea label="Credit Observations" rows={4} disabled={!notesEditing} {...notesForm.register('credit_observations')} />
            <Textarea label="Structuring Notes" rows={4} disabled={!notesEditing} {...notesForm.register('structuring_notes')} />
            <Textarea label="Risk Flags" rows={4} disabled={!notesEditing} {...notesForm.register('risk_flags')} />
            <Textarea label="Rejection Reason" rows={4} disabled={!notesEditing} {...notesForm.register('rejection_reason')} />
          </div>
          <div className="mt-3">
            <Textarea label="Case History" rows={4} disabled={!notesEditing} {...notesForm.register('case_history')} />
          </div>
        </Card>
      ) : null}

      <Drawer
        open={bankDrawerOpen}
        onClose={() => {
          setBankDrawerOpen(false)
          setEditingBank(null)
          setBankReadOnly(false)
        }}
        title={bankReadOnly ? 'View Bank Application' : editingBank ? 'Edit Bank Application' : 'Add Bank Application'}
        footer={
          bankReadOnly ? (
            <Button
              variant="secondary"
              onClick={() => {
                setBankDrawerOpen(false)
                setEditingBank(null)
                setBankReadOnly(false)
              }}
            >
              Close
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setBankDrawerOpen(false)
                  setEditingBank(null)
                  setBankReadOnly(false)
                }}
                disabled={bankForm.formState.isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={bankForm.handleSubmit(async (values) => {
                  const payload = {
                    ...values,
                    lead_id: id,
                    sanction_amount: values.sanction_amount ? Number(values.sanction_amount) : null,
                    interest_rate: values.interest_rate ? Number(values.interest_rate) : null,
                    loan_tenure_months: values.loan_tenure_months ? Number(values.loan_tenure_months) : null,
                    emi_amount: values.emi_amount ? Number(values.emi_amount) : null,
                  }
                  Object.keys(payload).forEach((k) => {
                    if (payload[k] === '') payload[k] = null
                  })

                  let res
                  if (editingBank?.id) res = await supabase.from('bank_applications').update(payload).eq('id', editingBank.id)
                  else res = await supabase.from('bank_applications').insert([payload])

                  if (res.error) {
                    toast.error(res.error.message)
                    return
                  }
                  toast.success('Bank application saved')
                  setBankDrawerOpen(false)
                  setEditingBank(null)
                  setBankReadOnly(false)
                  await load()
                })}
                disabled={bankForm.formState.isSubmitting}
              >
                Submit
              </Button>
            </>
          )
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Input label="Bank Name" {...bankForm.register('bank_name', { required: true })} disabled={bankReadOnly} />
          <Select
            label="Underwriting Status"
            options={uwStatuses.map((s) => ({ value: s, label: s }))}
            {...bankForm.register('underwriting_status')}
            disabled={bankReadOnly}
          />
          <Input label="RM Name" {...bankForm.register('bank_rm_name')} disabled={bankReadOnly} />
          <Input label="RM Contact" {...bankForm.register('rm_contact')} disabled={bankReadOnly} />
          <Input label="Login Date" type="date" {...bankForm.register('login_date')} disabled={bankReadOnly} />
          <Input label="Case ID" {...bankForm.register('case_id')} disabled={bankReadOnly} />
          <Input label="Sanction Amount" {...bankForm.register('sanction_amount')} disabled={bankReadOnly} />
          <Input label="Interest Rate (%)" {...bankForm.register('interest_rate')} disabled={bankReadOnly} />
          <Input label="Tenure (months)" {...bankForm.register('loan_tenure_months')} disabled={bankReadOnly} />
          <Input label="EMI Amount" {...bankForm.register('emi_amount')} disabled={bankReadOnly} />
        </div>
        <Divider title="Credit Queries" />
        <Textarea label="Credit Queries" rows={3} {...bankForm.register('credit_queries')} disabled={bankReadOnly} />
        <div className="mt-3 flex items-center justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={async () => {
              const v = bankForm.getValues()
              const msg = [
                `Customer: ${customer?.name || '—'}`,
                `Lead: ${lead.lead_code || '—'}`,
                `Bank: ${v.bank_name || '—'}`,
                v.case_id ? `Case ID: ${v.case_id}` : null,
                v.underwriting_status ? `Status: ${v.underwriting_status}` : null,
                v.credit_queries ? `Credit Queries: ${v.credit_queries}` : null,
              ]
                .filter(Boolean)
                .join('\n')
              try {
                await writeClipboardText(msg)
                toast.success('Copied')
              } catch (e) {
                if (e?.name === 'AbortError') return
                toast.error(e?.message || 'Failed to copy')
              }
            }}
          >
            Copy Message
          </Button>
        </div>
      </Drawer>

      <ConfirmDialog
        open={!!deleteBankTarget}
        title="Delete bank application?"
        description={deleteBankTarget ? `This will permanently delete ${deleteBankTarget.bank_name}.` : ''}
        onClose={() => setDeleteBankTarget(null)}
        onConfirm={async () => {
          const bid = deleteBankTarget?.id
          if (!bid) return
          try {
            await deleteBankApplicationCascade(bid)
            toast.success('Bank application deleted')
            setDeleteBankTarget(null)
            await load()
          } catch (e) {
            toast.error(e?.message || 'Failed to delete bank application')
          }
        }}
      />
    </div>
  )
}
