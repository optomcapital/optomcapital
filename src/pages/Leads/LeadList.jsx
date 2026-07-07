import { createColumnHelper } from '@tanstack/react-table'
import { FilePlus2, FileText, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, ConfirmDialog, Divider, Drawer, Input, Select, Table, Textarea } from '../../components/ui/index.jsx'
import { deleteLeadCascade, deleteLeadsCascade, supabase } from '../../lib/supabase.js'
import { formatDate, formatINR, getStageColor } from '../../lib/utils.js'

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

const loanTypes = [
  'Personal Loan',
  'Business Loan',
  'Loan Against Property',
  'Working Capital',
  'Overdraft / CC',
  'Equipment Finance',
]

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

export default function LeadList() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState([])
  const [customers, setCustomers] = useState([])
  const [leadStatusSupported, setLeadStatusSupported] = useState(getLeadStatusSupportedDefault)

  const [searchBy, setSearchBy] = useState('')
  const [search, setSearch] = useState('')
  const [loanType, setLoanType] = useState('')
  const [stage, setStage] = useState('')
  const [urgency, setUrgency] = useState('')
  const [leadStatusCategory, setLeadStatusCategory] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [location, setLocation] = useState('')
  const [locationOptions, setLocationOptions] = useState([{ value: '', label: 'All Locations' }])
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [totalCount, setTotalCount] = useState(0)
  const [pageCount, setPageCount] = useState(1)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      customer_id: '',
      loan_type: 'Business Loan',
      loan_purpose: '',
      required_amount: '',
      preferred_tenure_months: '',
      preferred_bank: '',
      urgency_level: 'Medium',
      lead_source: '',
      referral_partner_name: '',
      sales_manager_name: '',
      sales_manager_contact: '',
      branch_location: '',
      lead_creation_date: '',
      stage: 'Lead Generated',
      lead_status_category: '',
      lead_status_stage: '',
      credit_observations: '',
      structuring_notes: '',
      risk_flags: '',
      rejection_reason: '',
      case_history: '',
    },
  })

  const leadStatusCategoryForm = watch('lead_status_category')
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
    const stageValue = String(watch('lead_status_stage') || '').trim()
    const allowed = new Set(leadStatusStagesByCategory[cat] || [])
    if (cat && stageValue && allowed.size && !allowed.has(stageValue)) {
      setValue('lead_status_stage', '')
    }
  }, [leadStatusCategoryForm, setValue, watch])

  const markLeadStatusUnsupported = useCallback(() => {
    setLeadStatusSupported(false)
    try {
      localStorage.setItem(LEAD_STATUS_SCHEMA_KEY, '0')
    } catch {
      void 0
    }
  }, [])

  const markLeadStatusSupported = useCallback(() => {
    setLeadStatusSupported(true)
    try {
      localStorage.setItem(LEAD_STATUS_SCHEMA_KEY, '1')
    } catch {
      void 0
    }
  }, [])

  const loadCustomers = useCallback(async () => {
    try {
      const countRes = await supabase.from('customers').select('id', { count: 'exact', head: true })
      if (countRes.error) throw countRes.error
      const total = countRes.count || 0
      const pageSize = 1000
      const all = []
      for (let from = 0; from < total; from += pageSize) {
        const to = Math.min(from + pageSize - 1, total - 1)
        const pageRes = await supabase
          .from('customers')
          .select('id, name')
          .order('created_at', { ascending: false })
          .range(from, to)
        if (pageRes.error) throw pageRes.error
        all.push(...(pageRes.data || []))
      }
      setCustomers(all)
    } catch {
      setCustomers([])
    }
  }, [])

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

  const loadLeads = useCallback(async () => {
    setLoading(true)
    try {
      const run = async (includeLeadStatus) => {
        const selectFields = includeLeadStatus
          ? 'id, lead_code, loan_type, required_amount, stage, urgency_level, lead_status_category, lead_status_stage, sales_manager_name, lead_creation_date, customer:customers(id, name, city)'
          : 'id, lead_code, loan_type, required_amount, stage, urgency_level, sales_manager_name, lead_creation_date, customer:customers(id, name, city)'

        let query = supabase.from('leads').select(selectFields, { count: 'exact' }).order('created_at', { ascending: false })

        if (loanType) query = query.eq('loan_type', loanType)
        if (stage) query = query.eq('stage', stage)
        if (urgency) query = query.eq('urgency_level', urgency)
        if (includeLeadStatus && leadStatusCategory) query = query.eq('lead_status_category', leadStatusCategory)
        if (startDate) query = query.gte('lead_creation_date', startDate)
        if (endDate) query = query.lte('lead_creation_date', endDate)
        if (location) query = query.eq('customer.city', location)

        const q = search.trim()
        if (q) {
          if (searchBy === 'lead') {
            query = query.ilike('lead_code', `%${q}%`)
          } else if (searchBy === 'referral') {
            query = query.ilike('referral_partner_name', `%${q}%`)
          } else if (searchBy === 'sales_manager') {
            query = query.ilike('sales_manager_name', `%${q}%`)
          } else if (searchBy === 'bank' || searchBy === 'rm') {
            let bq = supabase.from('bank_applications').select('lead_id').not('lead_id', 'is', null)
            if (searchBy === 'bank') bq = bq.ilike('bank_name', `%${q}%`)
            if (searchBy === 'rm') bq = bq.ilike('bank_rm_name', `%${q}%`)
            const { data: bdata, error: berr } = await bq.range(0, 999)
            if (berr) throw berr
            const ids = Array.from(new Set((bdata || []).map((r) => r.lead_id).filter(Boolean)))
            if (ids.length === 0) {
              return { data: [], count: 0 }
            }
            query = query.in('id', ids)
          } else {
            let bankLeadIds = []
            const { data: bdata, error: berr } = await supabase
              .from('bank_applications')
              .select('lead_id')
              .not('lead_id', 'is', null)
              .or(`bank_name.ilike.%${q}%,bank_rm_name.ilike.%${q}%`)
              .range(0, 999)
            if (berr) throw berr
            bankLeadIds = Array.from(new Set((bdata || []).map((r) => r.lead_id).filter(Boolean)))
            const idOr = bankLeadIds.length ? `,id.in.(${bankLeadIds.join(',')})` : ''
            query = query.or(`lead_code.ilike.%${q}%,referral_partner_name.ilike.%${q}%,sales_manager_name.ilike.%${q}%${idOr}`)
          }
        }

        const from = pageIndex * pageSize
        const to = from + pageSize - 1
        const { data, error, count } = await query.range(from, to)
        if (error) throw error
        return { data: data || [], count: count || 0 }
      }

      try {
        const res = await run(leadStatusSupported)
        setLeads(res.data)
        setTotalCount(res.count)
        setPageCount(Math.max(1, Math.ceil(res.count / pageSize)))
        if (leadStatusSupported) markLeadStatusSupported()
      } catch (err) {
        if (leadStatusSupported && isMissingColumnError(err, 'lead_status_')) {
          markLeadStatusUnsupported()
          setLeadStatusCategory('')
          const res = await run(false)
          setLeads(res.data)
          setTotalCount(res.count)
          setPageCount(Math.max(1, Math.ceil(res.count / pageSize)))
          return
        }
        throw err
      }
    } catch (e) {
      toast.error(e?.message || 'Failed to load leads')
    } finally {
      setLoading(false)
    }
  }, [
    endDate,
    leadStatusCategory,
    leadStatusSupported,
    location,
    loanType,
    markLeadStatusSupported,
    markLeadStatusUnsupported,
    pageIndex,
    pageSize,
    search,
    searchBy,
    stage,
    startDate,
    urgency,
  ])

  useEffect(() => {
    loadCustomers()
    loadLocationOptions()
    loadLeads()
  }, [loadCustomers, loadLeads, loadLocationOptions])

  useEffect(() => {
    setPageIndex(0)
  }, [search, searchBy, loanType, stage, urgency, leadStatusCategory, startDate, endDate, location])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [pageIndex, pageSize, search, searchBy, loanType, stage, urgency, leadStatusCategory, startDate, endDate, location])

  const toggleRowSelected = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAllSelected = useCallback((ids, shouldSelect) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => {
        if (shouldSelect) next.add(id)
        else next.delete(id)
      })
      return next
    })
  }, [])

  useEffect(() => {
    const t = setTimeout(() => loadLeads(), 250)
    return () => clearTimeout(t)
  }, [loadLeads])

  const columns = useMemo(() => {
    const cols = [
      columnHelper.accessor('lead_code', { header: 'Lead ID', cell: (info) => info.getValue() || '—' }),
      columnHelper.accessor((row) => row.customer?.name, {
        id: 'customer',
        header: 'Customer',
        cell: (info) => <span className="font-medium">{info.getValue() || '—'}</span>,
      }),
      columnHelper.accessor((row) => row.customer?.city, {
        id: 'location',
        header: 'Location',
        cell: (info) => info.getValue() || '—',
      }),
      columnHelper.accessor('loan_type', {
        header: 'Loan Type',
        cell: (info) => (
          <span className="inline-flex rounded-full border border-border-divider bg-slate-50 px-2 py-1 text-[12px] text-slate-700">
            {info.getValue() || '—'}
          </span>
        ),
      }),
      columnHelper.accessor('required_amount', {
        header: 'Required Amount',
        cell: (info) => <span className="font-medium">{formatINR(info.getValue())}</span>,
      }),
      columnHelper.accessor('stage', {
        header: 'Stage',
        cell: (info) => <Badge text={info.getValue() || '—'} colorClass={getStageColor(info.getValue())} />,
      }),
      columnHelper.accessor('urgency_level', {
        header: 'Urgency',
        cell: (info) => {
          const v = info.getValue() || '—'
          const cls =
            v === 'High'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : v === 'Medium'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-slate-50 text-slate-700 border-border-divider'
          return <Badge text={v} colorClass={cls} />
        },
      }),
      columnHelper.accessor('sales_manager_name', { header: 'Sales Manager', cell: (info) => info.getValue() || '—' }),
      columnHelper.accessor('lead_creation_date', { header: 'Lead Date', cell: (info) => formatDate(info.getValue()) }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const l = row.original
          return (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/leads/${l.id}`)
                }}
              >
                View
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setEditing(l)
                  reset({
                    ...l,
                    customer_id: l.customer?.id || '',
                  })
                  setDrawerOpen(true)
                }}
              >
                Edit
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteTarget(l)
                }}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          )
        },
      }),
    ]

    if (leadStatusSupported) {
      cols.splice(
        cols.findIndex((c) => c.id === 'actions') - 2,
        0,
        columnHelper.accessor('lead_status_category', {
          header: 'Lead Status',
          cell: (info) => {
            const v = info.getValue() || '—'
            const cls =
              v === 'Hot Lead'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : v === 'Warm Lead'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : v === 'Cold Lead'
                    ? 'bg-slate-50 text-slate-700 border-border-divider'
                    : v === 'Not Doable'
                      ? 'bg-zinc-100 text-zinc-700 border-zinc-200'
                      : 'bg-slate-50 text-slate-700 border-border-divider'
            return <Badge text={v} colorClass={cls} />
          },
        }),
        columnHelper.accessor('lead_status_stage', { header: 'Status Stage', cell: (info) => info.getValue() || '—' }),
      )
    }

    return cols
  }, [leadStatusSupported, navigate, reset])

  function openCreate() {
    setEditing(null)
    reset({
      customer_id: customers[0]?.id || '',
      loan_type: 'Business Loan',
      urgency_level: 'Medium',
      stage: 'Lead Generated',
      lead_status_category: '',
      lead_status_stage: '',
    })
    setDrawerOpen(true)
  }

  async function upsertLead(values) {
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

    try {
      const run = async (p) => {
        if (editing?.id) {
          const safe = { ...(p || {}) }
          delete safe.id
          delete safe.lead_code
          delete safe.created_at
          const { error } = await supabase.from('leads').update(safe).eq('id', editing.id)
          if (error) throw error
          toast.success('Lead updated')
        } else {
          const { error } = await supabase.from('leads').insert([p])
          if (error) throw error
          toast.success('Lead created')
        }
      }

      try {
        await run(payload)
        if (leadStatusSupported) markLeadStatusSupported()
      } catch (err) {
        if (leadStatusSupported && isMissingColumnError(err, 'lead_status_')) {
          markLeadStatusUnsupported()
          const nextPayload = { ...payload }
          delete nextPayload.lead_status_category
          delete nextPayload.lead_status_stage
          await run(nextPayload)
        } else {
          throw err
        }
      }
      setDrawerOpen(false)
      await loadLeads()
    } catch (e) {
      toast.error(e?.message || 'Failed to save lead')
      throw e
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[18px] font-semibold">Leads</div>
          <div className="text-[13px] text-text-secondary">Track loan requirements and deal progress</div>
        </div>
        <Button onClick={openCreate}>
          <FilePlus2 size={16} />
          <span>Add Lead</span>
        </Button>
      </div>

      <div className={`grid gap-3 ${leadStatusSupported ? 'grid-cols-7' : 'grid-cols-6'}`}>
        <Select
          value={searchBy}
          onChange={(e) => setSearchBy(e.target.value)}
          options={[
            { value: '', label: 'Search: All' },
            { value: 'lead', label: 'Search: Lead ID' },
            { value: 'referral', label: 'Search: Referral' },
            { value: 'sales_manager', label: 'Search: Sales Manager' },
            { value: 'bank', label: 'Search: Bank' },
            { value: 'rm', label: 'Search: RM' },
          ]}
        />
        <div className="col-span-2">
          <div className="relative">
            <input
              className="h-[34px] w-full rounded-md border border-border-input bg-surface pl-9 pr-3 text-[13px] outline-none focus:border-accent"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          </div>
        </div>
        <Select
          value={loanType}
          onChange={(e) => setLoanType(e.target.value)}
          options={[{ value: '', label: 'All Loan Types' }, ...loanTypes.map((t) => ({ value: t, label: t }))]}
        />
        <Select value={stage} onChange={(e) => setStage(e.target.value)} options={[{ value: '', label: 'All Stages' }, ...stages.map((s) => ({ value: s, label: s }))]} />
        <Select
          value={urgency}
          onChange={(e) => setUrgency(e.target.value)}
          options={[
            { value: '', label: 'All Urgency' },
            { value: 'High', label: 'High' },
            { value: 'Medium', label: 'Medium' },
            { value: 'Low', label: 'Low' },
          ]}
        />
        {leadStatusSupported ? (
          <Select
            value={leadStatusCategory}
            onChange={(e) => setLeadStatusCategory(e.target.value)}
            options={[{ value: '', label: 'All Lead Status' }, ...leadStatusCategories.slice(1)]}
          />
        ) : null}
      </div>

      <div className="grid grid-cols-6 gap-3">
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <Select value={location} onChange={(e) => setLocation(e.target.value)} options={locationOptions} />
        <div className="col-span-3" />
      </div>

      {selectedIds.size > 0 ? (
        <div className="flex items-center justify-between rounded-md border border-border-divider bg-[#F5F5F3] px-4 py-2">
          <div className="text-[13px] text-text-secondary">{selectedIds.size} selected</div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
            <Button variant="danger" size="sm" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 size={16} />
              <span>Delete Selected</span>
            </Button>
          </div>
        </div>
      ) : null}

      <Table
        columns={columns}
        data={leads}
        loading={loading}
        emptyIcon={FileText}
        onRowClick={(row) => navigate(`/leads/${row.id}`)}
        selection={{
          selectedIds,
          onToggleRow: toggleRowSelected,
          onToggleAll: toggleAllSelected,
        }}
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
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Lead' : 'Add Lead'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(upsertLead)} disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Submit'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Customer"
            options={customers.map((c) => ({ value: c.id, label: c.name }))}
            error={errors.customer_id?.message}
            {...register('customer_id', { required: 'Customer is required' })}
          />
          <Select label="Loan Type" options={loanTypes.map((t) => ({ value: t, label: t }))} {...register('loan_type')} />
          <Input label="Required Amount" type="number" step="1" min="0" {...register('required_amount')} />
          <Input label="Preferred Tenure (months)" type="number" step="1" min="0" {...register('preferred_tenure_months')} />
          <Input label="Preferred Bank" {...register('preferred_bank')} />
          <Select
            label="Urgency Level"
            options={[
              { value: 'High', label: 'High' },
              { value: 'Medium', label: 'Medium' },
              { value: 'Low', label: 'Low' },
            ]}
            {...register('urgency_level')}
          />
          <Select label="Stage" options={stages.map((s) => ({ value: s, label: s }))} {...register('stage')} />
          {leadStatusSupported ? (
            <>
              <Select label="Lead Status" options={leadStatusCategories} {...register('lead_status_category')} />
              <Select label="Status Stage" options={leadStatusStageOptions} {...register('lead_status_stage')} />
            </>
          ) : null}
          <Input label="Lead Date" type="date" error={errors.lead_creation_date?.message} {...register('lead_creation_date', { required: 'Lead date is required' })} />
        </div>

        <Divider title="Sources" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Lead Source" {...register('lead_source')} />
          <Input label="Referral Partner" {...register('referral_partner_name')} />
          <Input label="Sales Manager Name" {...register('sales_manager_name')} />
          <Input label="Sales Manager Contact" {...register('sales_manager_contact')} />
          <Input label="Branch Location" {...register('branch_location')} />
        </div>

        <Divider title="Purpose & Notes" />
        <Textarea label="Loan Purpose" rows={3} {...register('loan_purpose')} />
      </Drawer>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete lead?"
        description={deleteTarget ? `This will permanently delete ${deleteTarget.lead_code || 'this lead'}.` : ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          const id = deleteTarget?.id
          if (!id) return
          try {
            await deleteLeadCascade(id)
            toast.success('Lead deleted')
            setDeleteTarget(null)
            await loadLeads()
          } catch (e) {
            toast.error(e?.message || 'Failed to delete lead')
          }
        }}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        title="Delete selected leads?"
        description={`This will permanently delete ${selectedIds.size} lead${selectedIds.size === 1 ? '' : 's'} and all linked bank applications, disbursements, collateral, and documents.`}
        confirmText={bulkDeleting ? 'Deleting…' : 'Delete'}
        onClose={() => {
          if (bulkDeleting) return
          setBulkDeleteOpen(false)
        }}
        onConfirm={async () => {
          setBulkDeleting(true)
          try {
            await deleteLeadsCascade(Array.from(selectedIds))
            toast.success('Selected leads deleted')
            setSelectedIds(new Set())
            await loadLeads()
          } catch (e) {
            toast.error(e?.message || 'Failed to delete selected leads')
          } finally {
            setBulkDeleting(false)
          }
        }}
      />
    </div>
  )
}
