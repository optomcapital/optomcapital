import { createColumnHelper } from '@tanstack/react-table'
import { FolderOpen, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Badge, Button, Drawer, Input, Select, Table } from '../../components/ui/index.jsx'
import { supabase } from '../../lib/supabase.js'
import { formatDate } from '../../lib/utils.js'

const columnHelper = createColumnHelper()

function requiredDocsForProfessionType(professionType) {
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
  if (p === 'business owner' || p === 'self employed' || p === 'other') {
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
  return null
}

function requiredDocsForLoanType(type) {
  const base = ['PAN', 'Aadhaar', 'Passport/DL', 'Bank Statement 12M', 'Other']
  if (type === 'Personal Loan') return ['PAN', 'Aadhaar', 'Passport/DL', 'ITR - Year 1', 'Bank Statement 12M', 'Other']
  if (type === 'Business Loan')
    return ['PAN', 'Aadhaar', 'ITR - Year 1', 'ITR - Year 2', 'Balance Sheet', 'GST Returns', 'Bank Statement 12M', 'Other']
  if (type === 'Loan Against Property')
    return ['PAN', 'Aadhaar', 'ITR - Year 1', 'Balance Sheet', 'Bank Statement 12M', 'Title Deed', 'Sale Agreement', 'Valuation Report', 'Other']
  return base
}

function requiredDocsForLead(lead) {
  const byProfession = requiredDocsForProfessionType(lead?.customer?.profession_type)
  if (byProfession?.length) return byProfession
  return requiredDocsForLoanType(lead?.loan_type || '')
}

function computeProgress(lead, leadDocs) {
  const required = requiredDocsForLead(lead)
  const byType = new Map()
  ;(leadDocs || []).forEach((d) => {
    if (!d?.document_type) return
    byType.set(d.document_type, d)
  })

  let received = 0
  let verified = 0
  required.forEach((t) => {
    const s = byType.get(t)?.status || 'Pending'
    if (s === 'Received' || s === 'Verified') received += 1
    if (s === 'Verified') verified += 1
  })
  const pending = Math.max(0, required.length - received)
  return { requiredCount: required.length, receivedCount: received, verifiedCount: verified, pendingCount: pending }
}

export default function DocumentsPage() {
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [loanType, setLoanType] = useState('')
  const [stage, setStage] = useState('')
  const [pendingOnly, setPendingOnly] = useState(false)
  const [location, setLocation] = useState('')
  const [locationOptions, setLocationOptions] = useState([{ value: '', label: 'All Locations' }])

  const [leads, setLeads] = useState([])
  const [docsByLeadId, setDocsByLeadId] = useState(new Map())

  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [totalCount, setTotalCount] = useState(0)
  const [pageCount, setPageCount] = useState(1)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeLead, setActiveLead] = useState(null)
  const [drawerDocs, setDrawerDocs] = useState([])

  const loanTypeOptions = useMemo(
    () => ['', 'Business Loan', 'Personal Loan', 'Loan Against Property', 'Working Capital', 'Overdraft / CC', 'Equipment Finance'],
    [],
  )

  const stageOptions = useMemo(
    () => [
      '',
      'Lead Generated',
      'Qualification Done',
      'Documents Collected',
      'Login to Bank',
      'Underwriting',
      'Sanction Approved',
      'Disbursement Processing',
      'Disbursed',
      'Declined',
    ],
    [],
  )

  const loadLeadDocs = useCallback(async (lead) => {
    if (!lead?.id) return
    const docsRes = await supabase.from('documents').select('id, lead_id, document_type, status, uploaded_at').eq('lead_id', lead.id)
    if (docsRes.error) throw docsRes.error
    setDrawerDocs(docsRes.data || [])
  }, [])

  const loadLeads = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('leads')
        .select('id, lead_code, loan_type, stage, customer_id, created_at, customer:customers(id, name, profession_type, city)', { count: 'exact' })
        .order('created_at', { ascending: false })

      if (loanType) query = query.eq('loan_type', loanType)
      if (stage) query = query.eq('stage', stage)
      if (location) query = query.eq('customer.city', location)

      const q = search.trim()
      if (q) query = query.or(`lead_code.ilike.%${q}%,customer.name.ilike.%${q}%`)

      const from = pageIndex * pageSize
      const to = from + pageSize - 1
      const res = await query.range(from, to)
      if (res.error) throw res.error

      const nextLeads = res.data || []
      setLeads(nextLeads)

      const nextTotal = res.count || 0
      setTotalCount(nextTotal)
      setPageCount(Math.max(1, Math.ceil(nextTotal / pageSize)))

      const leadIds = nextLeads.map((l) => l.id).filter(Boolean)
      if (leadIds.length === 0) {
        setDocsByLeadId(new Map())
        return
      }

      const docsRes = await supabase.from('documents').select('id, lead_id, document_type, status, uploaded_at').in('lead_id', leadIds)
      if (docsRes.error) throw docsRes.error

      const map = new Map()
      ;(docsRes.data || []).forEach((d) => {
        if (!d?.lead_id) return
        const list = map.get(d.lead_id) || []
        list.push(d)
        map.set(d.lead_id, list)
      })
      setDocsByLeadId(map)
    } catch (e) {
      toast.error(e?.message || 'Failed to load leads')
      setLeads([])
      setDocsByLeadId(new Map())
      setTotalCount(0)
      setPageCount(1)
    } finally {
      setLoading(false)
    }
  }, [loanType, location, pageIndex, pageSize, search, stage])

  const loadLocationOptions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('city')
        .not('city', 'is', null)
        .order('city', { ascending: true })
        .range(0, 9999)
      if (error) throw error
      const unique = Array.from(
        new Set(
          (data || [])
            .map((r) => String(r.city || '').trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b))
      setLocationOptions([{ value: '', label: 'All Locations' }, ...unique.map((c) => ({ value: c, label: c }))])
    } catch {
      setLocationOptions([{ value: '', label: 'All Locations' }])
    }
  }, [])

  async function upsertDocStatus(lead, documentType, nextStatus) {
    if (!lead?.id || !lead?.customer_id) return
    const existing = (drawerDocs || []).find((d) => d.document_type === documentType)
    if (existing?.id) {
      const { error } = await supabase.from('documents').update({ status: nextStatus, uploaded_at: new Date().toISOString() }).eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('documents').insert([
        { lead_id: lead.id, customer_id: lead.customer_id, document_type: documentType, status: nextStatus, uploaded_at: new Date().toISOString() },
      ])
      if (error) throw error
    }
    await loadLeadDocs(lead)
    await loadLeads()
  }

  const filteredLeads = useMemo(() => {
    if (!pendingOnly) return leads
    return (leads || []).filter((lead) => {
      const leadDocs = docsByLeadId.get(lead.id) || []
      const p = computeProgress(lead, leadDocs)
      return p.pendingCount > 0
    })
  }, [docsByLeadId, leads, pendingOnly])

  const columns = useMemo(() => {
    return [
      columnHelper.accessor('lead_code', { header: 'Lead', cell: (info) => info.getValue() || '—' }),
      columnHelper.accessor((row) => row.customer?.name, { id: 'customer', header: 'Customer', cell: (info) => info.getValue() || '—' }),
      columnHelper.accessor((row) => row.customer?.city, { id: 'location', header: 'Location', cell: (info) => info.getValue() || '—' }),
      columnHelper.accessor('loan_type', { header: 'Loan Type', cell: (info) => info.getValue() || '—' }),
      columnHelper.accessor('stage', { header: 'Stage', cell: (info) => info.getValue() || '—' }),
      columnHelper.display({
        id: 'progress',
        header: 'Checklist',
        cell: ({ row }) => {
          const lead = row.original
          const leadDocs = docsByLeadId.get(lead.id) || []
          const p = computeProgress(lead, leadDocs)
          return (
            <div className="flex items-center gap-2">
              <Badge
                text={`${p.receivedCount}/${p.requiredCount} received`}
                colorClass={p.pendingCount === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-700 border-border-divider'}
              />
              {p.verifiedCount ? <span className="text-[12px] text-text-muted">{p.verifiedCount} verified</span> : null}
            </div>
          )
        },
      }),
      columnHelper.display({
        id: 'pending',
        header: 'Pending',
        cell: ({ row }) => {
          const lead = row.original
          const leadDocs = docsByLeadId.get(lead.id) || []
          const p = computeProgress(lead, leadDocs)
          return p.pendingCount === 0 ? (
            <Badge text="0" colorClass="bg-emerald-50 text-emerald-700 border-emerald-200" />
          ) : (
            <Badge text={String(p.pendingCount)} colorClass="bg-amber-50 text-amber-700 border-amber-200" />
          )
        },
      }),
      columnHelper.accessor('created_at', { header: 'Created', cell: (info) => formatDate(info.getValue()) }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const lead = row.original
          return (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveLead(lead)
                  setDrawerOpen(true)
                  loadLeadDocs(lead).catch((err) => toast.error(err?.message || 'Failed to load documents'))
                }}
              >
                View
              </Button>
            </div>
          )
        },
      }),
    ]
  }, [docsByLeadId, loadLeadDocs])

  useEffect(() => {
    setPageIndex(0)
  }, [search, loanType, stage, pendingOnly, location])

  useEffect(() => {
    loadLocationOptions()
  }, [loadLocationOptions])

  useEffect(() => {
    const t = setTimeout(() => loadLeads(), 250)
    return () => clearTimeout(t)
  }, [loadLeads])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[18px] font-semibold">Documents</div>
          <div className="text-[13px] text-text-secondary">Checklist only (no file storage / preview)</div>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-3">
        <div className="col-span-2">
          <div className="relative">
            <input
              className="h-[34px] w-full rounded-md border border-border-input bg-surface pl-9 pr-3 text-[13px] outline-none focus:border-accent"
              placeholder="Search lead code, customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          </div>
        </div>
        <Select value={loanType} onChange={(e) => setLoanType(e.target.value)} options={loanTypeOptions.map((t) => ({ value: t, label: t || 'All Loan Types' }))} />
        <Select value={stage} onChange={(e) => setStage(e.target.value)} options={stageOptions.map((s) => ({ value: s, label: s || 'All Stages' }))} />
        <Select
          value={pendingOnly ? '1' : '0'}
          onChange={(e) => setPendingOnly(e.target.value === '1')}
          options={[
            { value: '0', label: 'All' },
            { value: '1', label: 'Pending only' },
          ]}
        />
        <Select value={location} onChange={(e) => setLocation(e.target.value)} options={locationOptions} />
      </div>

      <Table
        columns={columns}
        data={filteredLeads}
        loading={loading}
        emptyIcon={FolderOpen}
        pagination={{
          pageIndex,
          pageSize,
          pageCount,
          onPageChange: setPageIndex,
          onPageSizeChange: (next) => {
            setPageSize(next)
            setPageIndex(0)
          },
          totalCount,
          pageSizeOptions: [10, 25, 50, 100],
        }}
      />

      <Drawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setActiveLead(null)
          setDrawerDocs([])
        }}
        title={activeLead ? `Documents — ${activeLead.lead_code || 'Lead'}` : 'Documents'}
        footer={
          <Button
            variant="secondary"
            onClick={() => {
              setDrawerOpen(false)
              setActiveLead(null)
              setDrawerDocs([])
            }}
          >
            Close
          </Button>
        }
      >
        {activeLead ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Customer" value={activeLead.customer?.name || '—'} disabled />
              <Input label="Loan Type" value={activeLead.loan_type || '—'} disabled />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Profession" value={activeLead.customer?.profession_type || '—'} disabled />
              <Input label="Checklist Type" value={requiredDocsForProfessionType(activeLead.customer?.profession_type) ? 'Profession' : 'Loan Type'} disabled />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {requiredDocsForLead(activeLead).map((t) => {
                const existing = (drawerDocs || []).find((d) => d.document_type === t)
                const statusValue = existing?.status || 'Pending'
                const receivedChecked = statusValue === 'Received' || statusValue === 'Verified'
                const verifiedChecked = statusValue === 'Verified'
                return (
                  <div key={t} className="rounded-md border border-border-divider bg-surface px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium">{t}</div>
                        {existing?.uploaded_at ? <div className="text-[12px] text-text-muted">{formatDate(existing.uploaded_at)}</div> : null}
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-[12px] text-text-secondary">
                          <input
                            type="checkbox"
                            checked={receivedChecked}
                            onChange={async (e) => {
                              const next = e.target.checked ? 'Received' : 'Pending'
                              try {
                                await upsertDocStatus(activeLead, t, next)
                                toast.success('Updated')
                              } catch (err) {
                                toast.error(err?.message || 'Failed to update')
                              }
                            }}
                          />
                          <span>Received</span>
                        </label>
                        <label className="flex items-center gap-2 text-[12px] text-text-secondary">
                          <input
                            type="checkbox"
                            checked={verifiedChecked}
                            onChange={async (e) => {
                              const next = e.target.checked ? 'Verified' : receivedChecked ? 'Received' : 'Pending'
                              try {
                                await upsertDocStatus(activeLead, t, next)
                                toast.success('Updated')
                              } catch (err) {
                                toast.error(err?.message || 'Failed to update')
                              }
                            }}
                          />
                          <span>Verified</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}
