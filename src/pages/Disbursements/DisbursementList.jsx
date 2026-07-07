import { createColumnHelper } from '@tanstack/react-table'
import { IndianRupee, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { Badge, Button, Card, ConfirmDialog, Drawer, Input, Select, Table, Toggle } from '../../components/ui/index.jsx'
import { deleteDisbursementsBulk, supabase } from '../../lib/supabase.js'
import { formatDate, formatINR } from '../../lib/utils.js'

const columnHelper = createColumnHelper()

export default function DisbursementList() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [banks, setBanks] = useState([])
  const [summary, setSummary] = useState({ totalDisbursed: 0, gross: 0, net: 0, pending: 0 })

  const [leadOptions, setLeadOptions] = useState([])
  const [leadQuery, setLeadQuery] = useState('')
  const [leadLoading, setLeadLoading] = useState(false)
  const [bankAppOptions, setBankAppOptions] = useState([])
  const [bankAppLoading, setBankAppLoading] = useState(false)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [bank, setBank] = useState('')
  const [payoutReceived, setPayoutReceived] = useState('')
  const [location, setLocation] = useState('')
  const [locationOptions, setLocationOptions] = useState([{ value: '', label: 'All Locations' }])
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
  const leadIdField = form.register('lead_id', { required: true })
  const bankAppIdField = form.register('bank_application_id')

  const selectedLeadId = form.watch('lead_id')
  const selectedLead = useMemo(() => leadOptions.find((l) => l.id === selectedLeadId) || null, [leadOptions, selectedLeadId])
  const selectedBankAppId = form.watch('bank_application_id')
  const selectedBankApp = useMemo(() => bankAppOptions.find((b) => b.id === selectedBankAppId) || null, [bankAppOptions, selectedBankAppId])

  const loadLeadOptions = useCallback(async (query) => {
    setLeadLoading(true)
    try {
      const q = String(query || '').trim()
      let req = supabase
        .from('leads')
        .select('id, lead_code, loan_type, referral_partner_name, sales_manager_name, customer:customers(name, business_name, city)')
        .order('created_at', { ascending: false })
      if (q) req = req.ilike('lead_code', `%${q}%`)
      const res = await req.range(0, 49)
      if (res.error) throw res.error
      setLeadOptions(res.data || [])
    } catch (e) {
      toast.error(e?.message || 'Failed to load leads')
      setLeadOptions([])
    } finally {
      setLeadLoading(false)
    }
  }, [])

  const loadBankAppOptions = useCallback(async (leadId) => {
    if (!leadId) {
      setBankAppOptions([])
      return
    }
    setBankAppLoading(true)
    try {
      const res = await supabase
        .from('bank_applications')
        .select('id, bank_name, case_id, sanction_amount, interest_rate, loan_tenure_months, bank_rm_name, rm_contact')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .range(0, 49)
      if (res.error) throw res.error
      setBankAppOptions(res.data || [])
    } catch (e) {
      toast.error(e?.message || 'Failed to load bank applications')
      setBankAppOptions([])
    } finally {
      setBankAppLoading(false)
    }
  }, [])

  const loadBankOptions = useCallback(async () => {
    try {
      const countRes = await supabase.from('bank_applications').select('id', { count: 'exact', head: true })
      if (countRes.error) throw countRes.error
      const total = countRes.count || 0
      const pageSize = 1000
      const names = new Set()
      for (let from = 0; from < total; from += pageSize) {
        const to = Math.min(from + pageSize - 1, total - 1)
        const pageRes = await supabase.from('bank_applications').select('bank_name').range(from, to)
        if (pageRes.error) throw pageRes.error
        ;(pageRes.data || []).forEach((r) => {
          if (r.bank_name) names.add(r.bank_name)
        })
      }
      setBanks(Array.from(names).sort())
    } catch {
      setBanks([])
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

  const loadSummary = useCallback(async () => {
    try {
      let base = supabase
        .from('disbursements')
        .select('id, bank_application:bank_applications(bank_name), lead:leads(customer:customers(city))', { count: 'exact', head: true })
      if (startDate) base = base.gte('disbursement_date', startDate)
      if (endDate) base = base.lte('disbursement_date', endDate)
      if (payoutReceived) base = base.eq('payout_received', payoutReceived === 'true')
      if (bank) base = base.eq('bank_application.bank_name', bank)
      if (location) base = base.eq('lead.customer.city', location)

      const countRes = await base
      if (countRes.error) throw countRes.error
      const total = countRes.count || 0
      if (total === 0) {
        setSummary({ totalDisbursed: 0, gross: 0, net: 0, pending: 0 })
        return
      }

      let totalDisbursed = 0
      let gross = 0
      let net = 0
      let pending = 0

      const pageSize = 1000
      for (let from = 0; from < total; from += pageSize) {
        const to = Math.min(from + pageSize - 1, total - 1)
        let q = supabase
          .from('disbursements')
          .select(
            'final_disbursed_amount, gross_revenue, net_revenue, payment_pending, bank_application:bank_applications(bank_name), lead:leads(customer:customers(city))',
          )
        if (startDate) q = q.gte('disbursement_date', startDate)
        if (endDate) q = q.lte('disbursement_date', endDate)
        if (payoutReceived) q = q.eq('payout_received', payoutReceived === 'true')
        if (bank) q = q.eq('bank_application.bank_name', bank)
        if (location) q = q.eq('lead.customer.city', location)
        const pageRes = await q.order('disbursement_date', { ascending: false }).range(from, to)
        if (pageRes.error) throw pageRes.error
        ;(pageRes.data || []).forEach((r) => {
          totalDisbursed += Number(r.final_disbursed_amount || 0)
          gross += Number(r.gross_revenue || 0)
          net += Number(r.net_revenue || 0)
          if (r.payment_pending) pending += 1
        })
      }

      setSummary({ totalDisbursed, gross, net, pending })
    } catch {
      setSummary({ totalDisbursed: 0, gross: 0, net: 0, pending: 0 })
    }
  }, [bank, endDate, location, payoutReceived, startDate])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('disbursements')
        .select(
          '*, lead:leads(id, lead_code, customer:customers(id, name, city)), bank_application:bank_applications(id, bank_name)',
          { count: 'exact' },
        )
        .order('disbursement_date', { ascending: false })

      if (startDate) query = query.gte('disbursement_date', startDate)
      if (endDate) query = query.lte('disbursement_date', endDate)
      if (payoutReceived) query = query.eq('payout_received', payoutReceived === 'true')
      if (bank) query = query.eq('bank_application.bank_name', bank)
      if (location) query = query.eq('lead.customer.city', location)

      const from = pageIndex * pageSize
      const to = from + pageSize - 1
      const { data, error, count } = await query.range(from, to)
      if (error) throw error

      setRows(data || [])
      const nextTotal = count || 0
      setTotalCount(nextTotal)
      setPageCount(Math.max(1, Math.ceil(nextTotal / pageSize)))
    } catch (e) {
      toast.error(e?.message || 'Failed to load disbursements')
    } finally {
      setLoading(false)
    }
  }, [bank, endDate, location, pageIndex, pageSize, payoutReceived, startDate])

  useEffect(() => {
    loadBankOptions()
    loadLocationOptions()
    load()
  }, [load, loadBankOptions, loadLocationOptions])

  useEffect(() => {
    setPageIndex(0)
  }, [startDate, endDate, bank, payoutReceived, location])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [pageIndex, pageSize, startDate, endDate, bank, payoutReceived, location])

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
    const t = setTimeout(() => load(), 250)
    return () => clearTimeout(t)
  }, [load])

  useEffect(() => {
    const t = setTimeout(() => loadSummary(), 250)
    return () => clearTimeout(t)
  }, [loadSummary])

  useEffect(() => {
    if (!drawerOpen) return
    const t = setTimeout(() => loadLeadOptions(leadQuery), 250)
    return () => clearTimeout(t)
  }, [drawerOpen, leadQuery, loadLeadOptions])

  useEffect(() => {
    if (!drawerOpen) return
    const t = setTimeout(() => loadBankAppOptions(selectedLeadId), 250)
    return () => clearTimeout(t)
  }, [drawerOpen, loadBankAppOptions, selectedLeadId])

  useEffect(() => {
    if (!drawerOpen || !selectedLead) return
    const currentConnector = String(form.getValues('connector_name') || '').trim()
    const currentDsa = String(form.getValues('dsa_code_confirmation') || '').trim()
    if (!currentConnector && selectedLead.sales_manager_name) {
      form.setValue('connector_name', selectedLead.sales_manager_name, { shouldDirty: true })
    }
    if (!currentDsa && selectedLead.referral_partner_name) {
      form.setValue('dsa_code_confirmation', selectedLead.referral_partner_name, { shouldDirty: true })
    }
  }, [drawerOpen, form, selectedLead])

  useEffect(() => {
    const formatNum = (n) => {
      if (!Number.isFinite(n)) return ''
      const rounded = Math.round(n * 100) / 100
      return rounded ? String(rounded) : '0'
    }
    const sub = form.watch((values, meta) => {
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
        const selected = bankAppOptions.find((b) => b.id === values.bank_application_id)
        if (selected) {
          form.setValue('sanction_amount', selected.sanction_amount == null ? '' : String(selected.sanction_amount), { shouldDirty: true })
          form.setValue('roi_percentage', selected.interest_rate == null ? '' : String(selected.interest_rate), { shouldDirty: true })
        }
      }

      const finalAmt = Number(values.final_disbursed_amount || 0)
      const payoutPct = Number(values.bank_payout_percentage || 0)
      const partnerPct = Number(values.partner_share_percentage || 0)

      const gross = (finalAmt * payoutPct) / 100
      const partner = (gross * partnerPct) / 100
      const net = gross - partner

      form.setValue('gross_revenue', formatNum(gross), { shouldDirty: true })
      form.setValue('partner_share', formatNum(partner), { shouldDirty: true })
      form.setValue('net_revenue', formatNum(net), { shouldDirty: true })
    })
    return () => sub.unsubscribe()
  }, [bankAppOptions, form])

  const columns = useMemo(() => {
    return [
      columnHelper.accessor((row) => row.lead?.lead_code, { id: 'lead', header: 'Lead ID', cell: (info) => info.getValue() || '—' }),
      columnHelper.accessor((row) => row.lead?.customer?.name, { id: 'customer', header: 'Customer', cell: (info) => info.getValue() || '—' }),
      columnHelper.accessor((row) => row.lead?.customer?.city, { id: 'location', header: 'Location', cell: (info) => info.getValue() || '—' }),
      columnHelper.accessor((row) => row.bank_application?.bank_name, { id: 'bank', header: 'Bank', cell: (info) => info.getValue() || '—' }),
      columnHelper.accessor('final_disbursed_amount', { header: 'Disbursed', cell: (info) => formatINR(info.getValue()) }),
      columnHelper.accessor('disbursement_date', { header: 'Date', cell: (info) => formatDate(info.getValue()) }),
      columnHelper.accessor('bank_payout_percentage', { header: 'Payout %', cell: (info) => (info.getValue() ? `${info.getValue()}%` : '—') }),
      columnHelper.accessor('gross_revenue', { header: 'Gross', cell: (info) => formatINR(info.getValue()) }),
      columnHelper.accessor('partner_share', { header: 'Partner', cell: (info) => formatINR(info.getValue()) }),
      columnHelper.accessor('net_revenue', { header: 'Net', cell: (info) => formatINR(info.getValue()) }),
      columnHelper.accessor('invoice_raised', { header: 'Invoice', cell: (info) => (info.getValue() ? '✓' : '✗') }),
      columnHelper.accessor('payout_received', { header: 'Payout', cell: (info) => (info.getValue() ? '✓' : '✗') }),
      columnHelper.accessor('payment_pending', {
        header: 'Payment Pending',
        cell: (info) => (
          <Badge
            text={info.getValue() ? 'Pending' : 'Done'}
            colorClass={info.getValue() ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}
          />
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const r = row.original
          return (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setReadOnly(true)
                  setEditing(r)
                  setLeadQuery('')
                  const grossBase = Number(r.gross_revenue || 0)
                  const partnerAmt = Number(r.partner_share || 0)
                  const partnerPct = grossBase > 0 ? Math.round(((partnerAmt / grossBase) * 100) * 100) / 100 : 0.25
                  form.reset({
                    lead_id: r.lead?.id || '',
                    bank_application_id: r.bank_application?.id || '',
                    sanction_amount: r.sanction_amount || '',
                    final_disbursed_amount: r.final_disbursed_amount || '',
                    disbursement_date: r.disbursement_date || '',
                    roi_percentage: r.roi_percentage || '',
                    bank_payout_percentage: r.bank_payout_percentage || '',
                    subvention_notes: r.subvention_notes || '',
                    dsa_code_confirmation: r.dsa_code_confirmation || '',
                    connector_name: r.connector_name || '',
                    partner_share_percentage: String(partnerPct),
                    gross_revenue: r.gross_revenue || '',
                    partner_share: r.partner_share || '',
                    net_revenue: r.net_revenue || '',
                    invoice_raised: !!r.invoice_raised,
                    payout_received: !!r.payout_received,
                    payment_pending: r.payment_pending ?? true,
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
                  setEditing(r)
                  setLeadQuery('')
                  const grossBase = Number(r.gross_revenue || 0)
                  const partnerAmt = Number(r.partner_share || 0)
                  const partnerPct = grossBase > 0 ? Math.round(((partnerAmt / grossBase) * 100) * 100) / 100 : 0.25
                  form.reset({
                    lead_id: r.lead?.id || '',
                    bank_application_id: r.bank_application?.id || '',
                    sanction_amount: r.sanction_amount || '',
                    final_disbursed_amount: r.final_disbursed_amount || '',
                    disbursement_date: r.disbursement_date || '',
                    roi_percentage: r.roi_percentage || '',
                    bank_payout_percentage: r.bank_payout_percentage || '',
                    subvention_notes: r.subvention_notes || '',
                    dsa_code_confirmation: r.dsa_code_confirmation || '',
                    connector_name: r.connector_name || '',
                    partner_share_percentage: String(partnerPct),
                    gross_revenue: r.gross_revenue || '',
                    partner_share: r.partner_share || '',
                    net_revenue: r.net_revenue || '',
                    invoice_raised: !!r.invoice_raised,
                    payout_received: !!r.payout_received,
                    payment_pending: r.payment_pending ?? true,
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
                  setDeleteTarget(r)
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[18px] font-semibold">Disbursements</div>
          <div className="text-[13px] text-text-secondary">Revenue and payout tracking</div>
        </div>
        <Button
          onClick={() => {
            setEditing(null)
            setReadOnly(false)
            setLeadQuery('')
            form.reset({
              lead_id: '',
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
            })
            setDrawerOpen(true)
          }}
        >
          <Plus size={16} />
          <span>Add Disbursement</span>
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <div className="text-[12px] text-text-secondary">Total Disbursed</div>
          <div className="mt-2 text-[16px] font-semibold">{formatINR(summary.totalDisbursed)}</div>
        </Card>
        <Card>
          <div className="text-[12px] text-text-secondary">Total Gross Revenue</div>
          <div className="mt-2 text-[16px] font-semibold">{formatINR(summary.gross)}</div>
        </Card>
        <Card>
          <div className="text-[12px] text-text-secondary">Total Net Revenue</div>
          <div className="mt-2 text-[16px] font-semibold">{formatINR(summary.net)}</div>
        </Card>
        <Card>
          <div className="text-[12px] text-text-secondary">Pending Payouts</div>
          <div className="mt-2 text-[16px] font-semibold">{summary.pending}</div>
        </Card>
      </div>

      <div className="grid grid-cols-6 gap-3">
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <Select value={location} onChange={(e) => setLocation(e.target.value)} options={locationOptions} />
        <Select value={bank} onChange={(e) => setBank(e.target.value)} options={[{ value: '', label: 'All Banks' }, ...banks.map((b) => ({ value: b, label: b }))]} />
        <Select
          value={payoutReceived}
          onChange={(e) => setPayoutReceived(e.target.value)}
          options={[
            { value: '', label: 'All Payout Status' },
            { value: 'true', label: 'Payout Received' },
            { value: 'false', label: 'Not Received' },
          ]}
        />
        <div />
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
        data={rows}
        loading={loading}
        emptyIcon={IndianRupee}
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
        title={readOnly ? 'View Disbursement' : editing ? 'Edit Disbursement' : 'Add Disbursement'}
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
                  if (values.payout_received && !values.invoice_raised) {
                    toast.error('Step 1 (Invoice Raised) must be completed before Step 2 (Payout Received).')
                    return
                  }
                  const payload = {
                    ...values,
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
                  if (editing?.id) res = await supabase.from('disbursements').update(payload).eq('id', editing.id)
                  else res = await supabase.from('disbursements').insert([payload])
                  if (res.error) {
                    toast.error(res.error.message)
                    return
                  }
                  toast.success('Saved')
                  setDrawerOpen(false)
                  setEditing(null)
                  setReadOnly(false)
                  await load()
                  await loadSummary()
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
          <div className="space-y-2">
            <Input placeholder="Search lead code…" value={leadQuery} onChange={(e) => setLeadQuery(e.target.value)} disabled={readOnly} />
            <Select
              label="Lead"
              options={[
                { value: '', label: leadLoading ? 'Loading…' : 'Select Lead' },
                ...leadOptions.map((l) => ({ value: l.id, label: `${l.lead_code || '—'} — ${l.customer?.name || '—'}` })),
              ]}
              {...leadIdField}
              onChange={(e) => {
                leadIdField.onChange(e)
                form.setValue('bank_application_id', '', { shouldDirty: true })
              }}
              disabled={readOnly}
            />
          </div>
          <Select
            label="Bank Application (optional)"
            options={[
              { value: '', label: bankAppLoading ? 'Loading…' : 'None' },
              ...bankAppOptions.map((b) => ({ value: b.id, label: `${b.bank_name || 'Bank'} (${b.case_id || '—'})` })),
            ]}
            {...bankAppIdField}
            disabled={readOnly}
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <Input label="Customer Name" value={selectedLead?.customer?.name || '—'} disabled />
          <Input label="Firm / Company / Entity Name" value={selectedLead?.customer?.business_name || '—'} disabled />
          <Input label="NBFC / Bank Name" value={selectedBankApp?.bank_name || '—'} disabled />
          <Input label="Loan Type" value={selectedLead?.loan_type || '—'} disabled />
          <Input label="Banker Name" value={selectedBankApp?.bank_rm_name || '—'} disabled />
          <Input label="Banker Number" value={selectedBankApp?.rm_contact || '—'} disabled />
          <Input
            label="Loan Tenure (months)"
            value={selectedBankApp?.loan_tenure_months == null ? '—' : String(selectedBankApp.loan_tenure_months)}
            disabled
          />
          <Input label="Location" value={selectedLead?.customer?.city || '—'} disabled />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Disbursement Date" type="date" {...form.register('disbursement_date')} disabled={readOnly} />
          <Input label="Sanction Amount" type="number" step="1" min="0" {...form.register('sanction_amount')} disabled={readOnly} />
          <Input label="Final Disbursed Amount" type="number" step="1" min="0" {...form.register('final_disbursed_amount')} disabled={readOnly} />
          <Input label="ROI (%)" type="number" step="0.01" min="0" {...form.register('roi_percentage')} disabled={readOnly} />
          <Input label="Bank Payout %" type="number" step="0.01" min="0" {...form.register('bank_payout_percentage')} disabled={readOnly} />
          <Input label="Subvention (If any / mention No)" {...form.register('subvention_notes')} disabled={readOnly} />
          <Input label="DSA Code Confirmation" {...form.register('dsa_code_confirmation')} disabled={readOnly} />
          <Input label="Connector Name" {...form.register('connector_name')} disabled={readOnly} />
          <Input label="Partner Share %" type="number" step="0.01" min="0" {...form.register('partner_share_percentage')} disabled={readOnly} />
          <Input label="Gross Revenue" disabled type="number" step="1" min="0" {...form.register('gross_revenue')} />
          <Input label="Partner Share" disabled type="number" step="1" min="0" {...form.register('partner_share')} />
          <Input label="Net Revenue" disabled type="number" step="1" min="0" {...form.register('net_revenue')} />
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-md border border-border-divider bg-surface px-3 py-2">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Step 1</div>
            <Toggle
              label="Invoice Raised"
              checked={!!form.watch('invoice_raised')}
              onChange={(v) => {
                const payoutReceived = !!form.getValues('payout_received')
                if (payoutReceived) {
                  toast.error('Step 1 cannot be changed after Step 2 is completed.')
                  return
                }
                form.setValue('invoice_raised', v)
              }}
              disabled={readOnly || !!form.watch('payout_received')}
            />
          </div>
          <div className="rounded-md border border-border-divider bg-surface px-3 py-2">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Step 2</div>
            <Toggle
              label="Payout Received"
              checked={!!form.watch('payout_received')}
              onChange={(v) => {
                const invoiceRaised = !!form.getValues('invoice_raised')
                if (v && !invoiceRaised) {
                  toast.error('Complete Step 1 (Invoice Raised) before Step 2.')
                  return
                }
                form.setValue('payout_received', v)
                form.setValue('payment_pending', !v)
              }}
              disabled={readOnly}
            />
          </div>
          <div className="rounded-md border border-border-divider bg-surface px-3 py-2">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Step 3</div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-text-secondary">Payment Status</span>
              <Badge
                dot={false}
                text={form.watch('payout_received') ? 'Done' : 'Pending'}
                colorClass={
                  form.watch('payout_received')
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }
              />
            </div>
          </div>
        </div>
      </Drawer>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete disbursement?"
        description={deleteTarget ? `This will permanently delete the disbursement for ${deleteTarget.lead?.lead_code || 'this lead'}.` : ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          const target = deleteTarget
          if (!target?.id) return
          const { error } = await supabase.from('disbursements').delete().eq('id', target.id)
          if (error) {
            toast.error(error.message)
            return
          }
          toast.success('Deleted')
          setDeleteTarget(null)
          await load()
          await loadSummary()
        }}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        title="Delete selected disbursements?"
        description={`This will permanently delete ${selectedIds.size} disbursement${selectedIds.size === 1 ? '' : 's'}.`}
        confirmText={bulkDeleting ? 'Deleting…' : 'Delete'}
        onClose={() => {
          if (bulkDeleting) return
          setBulkDeleteOpen(false)
        }}
        onConfirm={async () => {
          setBulkDeleting(true)
          try {
            await deleteDisbursementsBulk(Array.from(selectedIds))
            toast.success('Selected disbursements deleted')
            setSelectedIds(new Set())
            await load()
            await loadSummary()
          } catch (e) {
            toast.error(e?.message || 'Failed to delete selected disbursements')
          } finally {
            setBulkDeleting(false)
          }
        }}
      />
    </div>
  )
}
