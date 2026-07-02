import { createColumnHelper } from '@tanstack/react-table'
import { Building2, Plus, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { Badge, Button, ConfirmDialog, Drawer, Input, Select, Table, Textarea } from '../../components/ui/index.jsx'
import { deleteBankApplicationCascade, deleteBankApplicationsCascade, supabase } from '../../lib/supabase.js'
import { formatDate, formatINR } from '../../lib/utils.js'

const uwStatuses = ['', 'Pending', 'In Review', 'Query Raised', 'Approved', 'Declined']
const columnHelper = createColumnHelper()

function isPermissionOrSchemaError(err) {
  const code = String(err?.code || '')
  const msg = String(err?.message || '').toLowerCase()
  return (
    code === '42501' ||
    code === 'PGRST301' ||
    msg.includes('permission denied') ||
    msg.includes('row-level security') ||
    msg.includes('does not exist')
  )
}

export default function BankApplicationList() {
  const LOCAL_NOTES_KEY = 'optom_bank_application_notes_v1'

  const [loading, setLoading] = useState(true)
  const [apps, setApps] = useState([])
  const [leadOptions, setLeadOptions] = useState([])
  const [leadSearch, setLeadSearch] = useState('')
  const [leadTotalCount, setLeadTotalCount] = useState(0)
  const [leadsLoading, setLeadsLoading] = useState(false)

  const [relationshipOptions, setRelationshipOptions] = useState([])
  const [relationshipsLoading, setRelationshipsLoading] = useState(false)
  const [relationshipId, setRelationshipId] = useState('')
  const [pendenciesAsked, setPendenciesAsked] = useState('')
  const [pendenciesReceived, setPendenciesReceived] = useState('')
  const [creditComments, setCreditComments] = useState('')

  const [search, setSearch] = useState('')
  const [uwStatus, setUwStatus] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [totalCount, setTotalCount] = useState(0)
  const [pageCount, setPageCount] = useState(1)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [readOnly, setReadOnly] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const form = useForm({
    defaultValues: {
      lead_id: '',
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

  const bankName = form.watch('bank_name')
  const leadId = form.watch('lead_id')
  const rmName = form.watch('bank_rm_name')
  const rmContact = form.watch('rm_contact')

  const readNotesStore = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(LOCAL_NOTES_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }, [LOCAL_NOTES_KEY])

  const writeNotesStore = useCallback(
    (next) => {
      try {
        window.localStorage.setItem(LOCAL_NOTES_KEY, JSON.stringify(next || {}))
      } catch (e) {
        void e
      }
    },
    [LOCAL_NOTES_KEY],
  )

  const getNotesKey = useCallback(
    (id, values) => {
      if (id) return String(id)
      const v = values || {}
      const parts = [
        String(v.lead_id || ''),
        String(v.bank_name || ''),
        String(v.bank_rm_name || ''),
        String(v.rm_contact || ''),
      ]
        .map((p) => p.trim())
        .filter(Boolean)
      return parts.length ? `draft:${parts.join('|')}` : 'draft:empty'
    },
    [],
  )

  const loadLocalNotes = useCallback(
    (key) => {
      const store = readNotesStore()
      const row = store?.[key] || {}
      setPendenciesAsked(String(row.pendencies_asked || ''))
      setPendenciesReceived(String(row.pendencies_received || ''))
      setCreditComments(String(row.credit_comments || ''))
    },
    [readNotesStore],
  )

  const saveLocalNotes = useCallback(
    (key, notes) => {
      const store = readNotesStore()
      const next = { ...store, [key]: { ...(store?.[key] || {}), ...(notes || {}) } }
      writeNotesStore(next)
    },
    [readNotesStore, writeNotesStore],
  )

  useEffect(() => {
    if (!drawerOpen) return
    const key = getNotesKey(editing?.id, { lead_id: leadId, bank_name: bankName, bank_rm_name: rmName, rm_contact: rmContact })
    loadLocalNotes(key)
  }, [bankName, drawerOpen, editing?.id, getNotesKey, leadId, loadLocalNotes, rmContact, rmName])

  const loadRelationshipOptions = useCallback(async () => {
    if (!drawerOpen) return
    setRelationshipsLoading(true)
    try {
      const { data, error } = await supabase
        .from('bank_relationships')
        .select('id, bank_name, rm_name, rm_contact, rm_email, product_handled')
        .order('created_at', { ascending: false })
        .range(0, 999)
      const masterRows = error ? [] : data || []
      if (error && isPermissionOrSchemaError(error)) {
        toast.error(`RM master not accessible: ${error?.message || 'Check RLS/policies'}`)
      }

      const derived = await supabase
        .from('bank_applications')
        .select('bank_name, bank_rm_name, rm_contact, created_at')
        .order('created_at', { ascending: false })
        .range(0, 999)
      if (derived.error) throw derived.error

      const seen = new Set()
      const merged = []
      ;(masterRows || []).forEach((r) => {
        const bank = (r.bank_name || '').trim()
        const rm = (r.rm_name || '').trim()
        const contact = (r.rm_contact || '').trim()
        if (!bank && !rm && !contact) return
        const key = `${bank.toLowerCase()}|${rm.toLowerCase()}|${contact}`
        if (seen.has(key)) return
        seen.add(key)
        merged.push(r)
      })

      ;(derived.data || []).forEach((a) => {
        const bank = (a.bank_name || '').trim()
        const rm = (a.bank_rm_name || '').trim()
        const contact = (a.rm_contact || '').trim()
        if (!bank && !rm && !contact) return
        const key = `${bank.toLowerCase()}|${rm.toLowerCase()}|${contact}`
        if (seen.has(key)) return
        seen.add(key)
        merged.push({
          id: `derived:${key}`,
          bank_name: bank || null,
          rm_name: rm || null,
          rm_contact: contact || null,
          rm_email: null,
          product_handled: null,
          created_at: a.created_at || null,
          __derived: true,
        })
      })

      setRelationshipOptions(merged)
    } catch (e2) {
      setRelationshipOptions([])
      toast.error(e2?.message || 'Failed to load RM options')
    } finally {
      setRelationshipsLoading(false)
    }
  }, [drawerOpen])

  useEffect(() => {
    if (!drawerOpen || readOnly) return
    const b = String(bankName || '').trim()
    if (!b) return
    if (relationshipId) return
    if (String(rmName || '').trim() || String(rmContact || '').trim()) return
    const norm = (s) => String(s || '').trim().toLowerCase()
    const nb = norm(b)
    const matches = (relationshipOptions || []).filter((r) => {
      const rb = norm(r?.bank_name)
      const okBank = rb === nb || rb.includes(nb) || nb.includes(rb)
      return okBank && String(r?.rm_name || '').trim()
    })
    if (!matches.length) return
    const pick = matches[0]
    setRelationshipId(pick.id)
    form.setValue('bank_rm_name', pick.rm_name || '', { shouldDirty: true })
    form.setValue('rm_contact', pick.rm_contact || '', { shouldDirty: true })
  }, [bankName, drawerOpen, form, readOnly, relationshipId, relationshipOptions, rmContact, rmName])

  const loadLeadOptions = useCallback(async () => {
    if (!drawerOpen) return
    setLeadsLoading(true)
    try {
      let query = supabase
        .from('leads')
        .select('id, lead_code, customer:customers(id, name)', { count: 'exact' })
        .order('created_at', { ascending: false })

      const q = leadSearch.trim()
      if (q) query = query.ilike('lead_code', `%${q}%`)

      const pageSize = 50
      const from = 0
      const to = pageSize - 1
      const { data, error, count } = await query.range(from, to)
      if (error) throw error

      setLeadOptions(data || [])
      const nextTotal = count || 0
      setLeadTotalCount(nextTotal)
    } catch {
      setLeadOptions([])
      setLeadTotalCount(0)
    } finally {
      setLeadsLoading(false)
    }
  }, [drawerOpen, leadSearch])

  const loadApps = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('bank_applications')
        .select('*, lead:leads(id, lead_code, customer:customers(id, name))', { count: 'exact' })
        .order('created_at', { ascending: false })

      if (uwStatus) query = query.eq('underwriting_status', uwStatus)
      if (startDate) query = query.gte('login_date', startDate)
      if (endDate) query = query.lte('login_date', endDate)

      const q = search.trim()
      if (q) query = query.or(`bank_name.ilike.%${q}%,bank_rm_name.ilike.%${q}%,rm_contact.ilike.%${q}%,case_id.ilike.%${q}%`)

      const from = pageIndex * pageSize
      const to = from + pageSize - 1
      const { data, error, count } = await query.range(from, to)
      if (error) throw error
      setApps(data || [])
      const nextTotal = count || 0
      setTotalCount(nextTotal)
      setPageCount(Math.max(1, Math.ceil(nextTotal / pageSize)))
    } catch (e) {
      toast.error(e?.message || 'Failed to load bank applications')
    } finally {
      setLoading(false)
    }
  }, [endDate, pageIndex, pageSize, search, startDate, uwStatus])

  const leadSelectOptions = useMemo(() => {
    const list = Array.isArray(leadOptions) ? leadOptions : []
    const selected = editing?.lead?.id ? editing.lead : null
    if (selected && !list.some((l) => l.id === selected.id)) return [selected, ...list]
    return list
  }, [editing, leadOptions])

  useEffect(() => {
    loadApps()
  }, [loadApps])

  useEffect(() => {
    if (!drawerOpen) return
    const t = setTimeout(() => loadLeadOptions(), 250)
    return () => clearTimeout(t)
  }, [drawerOpen, loadLeadOptions])

  useEffect(() => {
    if (!drawerOpen) return
    loadRelationshipOptions()
  }, [drawerOpen, loadRelationshipOptions])

  useEffect(() => {
    if (!drawerOpen) return
    if (editing) return
    const current = form.getValues('lead_id')
    if (current) return
    const first = leadSelectOptions[0]?.id
    if (first) form.setValue('lead_id', first)
  }, [drawerOpen, editing, form, leadSelectOptions])

  useEffect(() => {
    if (!drawerOpen) return
    if (!editing) {
      setRelationshipId('')
      return
    }
    const match = (relationshipOptions || []).find(
      (r) =>
        (r.bank_name || '').toLowerCase().trim() === (editing.bank_name || '').toLowerCase().trim() &&
        (r.rm_name || '').toLowerCase().trim() === (editing.bank_rm_name || '').toLowerCase().trim(),
    )
    setRelationshipId(match?.id || '')
  }, [drawerOpen, editing, relationshipOptions])

  useEffect(() => {
    setPageIndex(0)
  }, [search, uwStatus, startDate, endDate])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [pageIndex, pageSize, search, uwStatus, startDate, endDate])

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
    const t = setTimeout(() => loadApps(), 250)
    return () => clearTimeout(t)
  }, [loadApps])

  const columns = useMemo(() => {
    return [
      columnHelper.accessor('id', {
        header: 'Application ID',
        cell: (info) => String(info.getValue()).slice(0, 8),
      }),
      columnHelper.accessor((row) => row.lead?.lead_code, {
        id: 'lead',
        header: 'Lead ID',
        cell: (info) => {
          const row = info.row.original
          return row.lead?.id ? (
            <Link to={`/leads/${row.lead.id}`} className="text-accent hover:underline">
              {info.getValue() || '—'}
            </Link>
          ) : (
            '—'
          )
        },
      }),
      columnHelper.accessor((row) => row.lead?.customer?.name, {
        id: 'customer',
        header: 'Customer',
        cell: (info) => info.getValue() || '—',
      }),
      columnHelper.accessor('bank_name', { header: 'Bank Name', cell: (info) => info.getValue() || '—' }),
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
                  setReadOnly(true)
                  setEditing(a)
                  setLeadSearch('')
                  setRelationshipId('')
                  setPendenciesAsked('')
                  setPendenciesReceived('')
                  setCreditComments('')
                  form.reset({
                    lead_id: a.lead_id || '',
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
                  setDrawerOpen(true)
                }}
              >
                View
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setReadOnly(false)
                  setEditing(a)
                  setLeadSearch('')
                  setRelationshipId('')
                  setPendenciesAsked('')
                  setPendenciesReceived('')
                  setCreditComments('')
                  form.reset({
                    lead_id: a.lead_id || '',
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
                  setDeleteTarget(a)
                }}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          )
        },
      }),
    ]
  }, [form])

  function openCreate() {
    setEditing(null)
    setReadOnly(false)
    setLeadSearch('')
    setRelationshipId('')
    form.reset({
      lead_id: '',
      underwriting_status: 'Pending',
    })
    setPendenciesAsked('')
    setPendenciesReceived('')
    setCreditComments('')
    setDrawerOpen(true)
  }

  async function upsert(values) {
    const payload = {
      ...values,
      sanction_amount: values.sanction_amount ? Number(values.sanction_amount) : null,
      interest_rate: values.interest_rate ? Number(values.interest_rate) : null,
      loan_tenure_months: values.loan_tenure_months ? Number(values.loan_tenure_months) : null,
      emi_amount: values.emi_amount ? Number(values.emi_amount) : null,
    }
    Object.keys(payload).forEach((k) => {
      if (payload[k] === '') payload[k] = null
    })

    const res = editing?.id
      ? await supabase.from('bank_applications').update(payload).eq('id', editing.id)
      : await supabase.from('bank_applications').insert([payload])
    if (res.error) throw res.error
    const insertedId = editing?.id ? editing.id : res?.data?.[0]?.id || null
    return insertedId
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[18px] font-semibold">Bank Applications</div>
          <div className="text-[13px] text-text-secondary">Track login and underwriting status</div>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} />
          <span>Add Application</span>
        </Button>
      </div>

      <div className="grid grid-cols-6 gap-3">
        <div className="col-span-3">
          <div className="relative">
            <input
              className="h-[34px] w-full rounded-md border border-border-input bg-surface pl-9 pr-3 text-[13px] outline-none focus:border-accent"
              placeholder="Search bank / RM / case / contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          </div>
        </div>
        <Select value={uwStatus} onChange={(e) => setUwStatus(e.target.value)} options={uwStatuses.map((s) => ({ value: s, label: s || 'All UW Status' }))} />
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
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
        data={apps}
        loading={loading}
        emptyIcon={Building2}
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
        onClose={() => {
          setDrawerOpen(false)
          setEditing(null)
          setReadOnly(false)
        }}
        title={readOnly ? 'View Application' : editing ? 'Edit Application' : 'Add Application'}
        footer={
          readOnly ? (
            <Button
              variant="secondary"
              onClick={() => {
                setDrawerOpen(false)
                setEditing(null)
                setReadOnly(false)
              }}
            >
              Close
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setDrawerOpen(false)
                  setEditing(null)
                  setReadOnly(false)
                }}
                disabled={form.formState.isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={form.handleSubmit(async (values) => {
                  try {
                    const draftKey = getNotesKey(editing?.id, values)
                    const insertedId = await upsert(values)
                    const finalKey = insertedId ? String(insertedId) : draftKey
                    saveLocalNotes(finalKey, {
                      pendencies_asked: pendenciesAsked,
                      pendencies_received: pendenciesReceived,
                      credit_comments: creditComments,
                    })
                    if (draftKey !== finalKey) {
                      const store = readNotesStore()
                      if (store?.[draftKey]) {
                        const next = { ...store }
                        delete next[draftKey]
                        try {
                          window.localStorage.setItem(LOCAL_NOTES_KEY, JSON.stringify(next))
                        } catch (e2) {
                          void e2
                        }
                      }
                    }
                    toast.success('Saved')
                    setDrawerOpen(false)
                    setEditing(null)
                    setReadOnly(false)
                    await loadApps()
                  } catch (e) {
                    toast.error(e?.message || 'Failed to save')
                  }
                })}
                disabled={form.formState.isSubmitting}
              >
                Submit
              </Button>
            </>
          )
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 grid grid-cols-2 gap-3">
            <Input
              label="Find Lead"
              placeholder="Search by lead code…"
              value={leadSearch}
              onChange={(e) => setLeadSearch(e.target.value)}
              disabled={readOnly}
            />
            <div className="flex items-end justify-end">
              <div className="pb-2 text-[12px] text-text-secondary">{leadsLoading ? 'Loading leads…' : `${leadTotalCount} leads`}</div>
            </div>
          </div>
          <Select
            label="Lead"
            options={leadSelectOptions.map((l) => ({ value: l.id, label: `${l.lead_code || '—'} — ${l.customer?.name || '—'}` }))}
            {...form.register('lead_id', { required: true })}
            disabled={readOnly}
          />
          <Select
            label="Relationship (optional)"
            value={relationshipId}
            onChange={(e) => {
              const next = e.target.value
              if (next === '__bulk_add__') {
                try {
                  window.open('/relationships', '_blank')
                } catch (e2) {
                  void e2
                }
                setRelationshipId('')
                return
              }
              setRelationshipId(next)
              const match = (relationshipOptions || []).find((r) => r.id === next)
              if (!match) return
              form.setValue('bank_name', match.bank_name || '', { shouldDirty: true })
              form.setValue('bank_rm_name', match.rm_name || '', { shouldDirty: true })
              form.setValue('rm_contact', match.rm_contact || '', { shouldDirty: true })
            }}
            options={[
              { value: '', label: relationshipsLoading ? 'Loading…' : 'Manual entry' },
              { value: '__bulk_add__', label: 'Bulk add RM list…' },
              ...(relationshipOptions || []).map((r) => ({
                value: r.id,
                label: `${r.bank_name || '—'} — ${r.rm_name || '—'}${r.product_handled ? ` (${r.product_handled})` : ''}`,
              })),
            ]}
            disabled={readOnly}
          />
          <Input label="Bank Name" {...form.register('bank_name', { required: true })} disabled={readOnly} />
          <Input label="RM Name" {...form.register('bank_rm_name')} disabled={readOnly} />
          <Input label="RM Contact" {...form.register('rm_contact')} disabled={readOnly} />
          <Input label="Login Date" type="date" {...form.register('login_date')} disabled={readOnly} />
          <Input label="Case ID" {...form.register('case_id')} disabled={readOnly} />
          <Select
            label="Underwriting Status"
            options={uwStatuses.filter(Boolean).map((s) => ({ value: s, label: s }))}
            {...form.register('underwriting_status')}
            disabled={readOnly}
          />
          <Input label="Sanction Amount" type="number" step="1" min="0" {...form.register('sanction_amount')} disabled={readOnly} />
          <Input label="Interest Rate (%)" type="number" step="0.01" min="0" {...form.register('interest_rate')} disabled={readOnly} />
          <Input label="Tenure (months)" type="number" step="1" min="0" {...form.register('loan_tenure_months')} disabled={readOnly} />
          <Input label="EMI Amount" type="number" step="1" min="0" {...form.register('emi_amount')} disabled={readOnly} />
        </div>
        <div className="mt-3">
          <Textarea label="Credit Queries" rows={3} {...form.register('credit_queries')} disabled={readOnly} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Textarea
            label="Pendencies Asked"
            rows={3}
            value={pendenciesAsked}
            onChange={(e) => setPendenciesAsked(e.target.value)}
            disabled={readOnly}
          />
          <Textarea
            label="Pendencies Received"
            rows={3}
            value={pendenciesReceived}
            onChange={(e) => setPendenciesReceived(e.target.value)}
            disabled={readOnly}
          />
          <div className="col-span-2">
            <Textarea
              label="Credit Comments"
              rows={3}
              value={creditComments}
              onChange={(e) => setCreditComments(e.target.value)}
              disabled={readOnly}
            />
          </div>
        </div>
      </Drawer>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete application?"
        description={deleteTarget ? `This will permanently delete ${deleteTarget.bank_name}.` : ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          const aid = deleteTarget?.id
          if (!aid) return
          try {
            await deleteBankApplicationCascade(aid)
            toast.success('Deleted')
            setDeleteTarget(null)
            await loadApps()
          } catch (e) {
            toast.error(e?.message || 'Failed to delete')
          }
        }}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        title="Delete selected applications?"
        description={`This will permanently delete ${selectedIds.size} application${selectedIds.size === 1 ? '' : 's'} and any linked disbursements.`}
        confirmText={bulkDeleting ? 'Deleting…' : 'Delete'}
        onClose={() => {
          if (bulkDeleting) return
          setBulkDeleteOpen(false)
        }}
        onConfirm={async () => {
          setBulkDeleting(true)
          try {
            await deleteBankApplicationsCascade(Array.from(selectedIds))
            toast.success('Selected applications deleted')
            setSelectedIds(new Set())
            await loadApps()
          } catch (e) {
            toast.error(e?.message || 'Failed to delete selected applications')
          } finally {
            setBulkDeleting(false)
          }
        }}
      />
    </div>
  )
}
