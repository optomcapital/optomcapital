import { createColumnHelper } from '@tanstack/react-table'
import { Mail, MessageCircle, Plus, Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { Badge, Button, ConfirmDialog, Drawer, Input, Select, Table, Textarea } from '../../components/ui/index.jsx'
import { supabase } from '../../lib/supabase.js'
import { downloadCsv, formatDate } from '../../lib/utils.js'

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

export default function RelationshipsPage() {
  const REL_SCHEMA_UNSUPPORTED_KEY = 'optom_bank_relationships_schema_unsupported_v1'

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [searchBy, setSearchBy] = useState('')
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [locationOptions, setLocationOptions] = useState([{ value: '', label: 'All Locations' }])
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [totalCount, setTotalCount] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [showingDerived, setShowingDerived] = useState(false)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [readOnly, setReadOnly] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importFileName, setImportFileName] = useState('')
  const [importPreview, setImportPreview] = useState([])
  const [importErrors, setImportErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const [unsupportedCols, setUnsupportedCols] = useState(new Set())

  const form = useForm({
    defaultValues: {
      bank_name: '',
      rm_name: '',
      designation: '',
      location: '',
      rm_contact: '',
      rm_email: '',
      product_handled: '',
      notes: '',
    },
  })

  // Clear stale unsupported-column cache on mount so columns are re-enabled.
  // If a column truly doesn't exist, the save() error handling will re-mark it.
  useEffect(() => {
    try {
      window.localStorage.removeItem(REL_SCHEMA_UNSUPPORTED_KEY)
    } catch (e) {
      void e
    }
    setUnsupportedCols(new Set())
  }, [REL_SCHEMA_UNSUPPORTED_KEY])

  const persistUnsupportedCols = useCallback(
    (nextSet) => {
      try {
        window.localStorage.setItem(REL_SCHEMA_UNSUPPORTED_KEY, JSON.stringify(Array.from(nextSet)))
      } catch (e) {
        void e
      }
    },
    [REL_SCHEMA_UNSUPPORTED_KEY],
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
      if (!col) return
      setUnsupportedCols((prev) => {
        if (prev.has(col)) return prev
        const next = new Set(prev)
        next.add(col)
        persistUnsupportedCols(next)
        return next
      })
    },
    [persistUnsupportedCols],
  )

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

  const supportsDesignation = useMemo(() => !unsupportedCols.has('designation'), [unsupportedCols])
  const supportsLocation = useMemo(() => !unsupportedCols.has('location'), [unsupportedCols])

  const getWhatsappTarget = useCallback((phone) => {
    const raw = String(phone || '').trim()
    if (!raw) return null
    let digits = raw.replace(/[^\d+]/g, '')
    digits = digits.replace(/[^\d]/g, '')
    if (!digits) return null
    if (digits.length === 10) return `91${digits}`
    if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`
    return digits
  }, [])

  const openWhatsappWindow = useCallback((waTarget) => {
    const target = getWhatsappTarget(waTarget)
    if (!target) return
    const deepLink = `whatsapp://send?phone=${target}&text=`
    const webLink = `https://wa.me/${target}?text=`

    const openFallback = () => {
      try {
        const existing = window.__optomWhatsappWindow
        if (existing && !existing.closed) {
          try {
            existing.location.replace(webLink)
          } catch {
            try {
              existing.location.href = webLink
            } catch (e2) {
              void e2
            }
          }
          try {
            existing.focus()
          } catch (e2) {
            void e2
          }
          return
        }
      } catch (e) {
        void e
      }

      const w = window.open('about:blank', 'optom_whatsapp')
      if (!w) return toast.error('Popup blocked. Allow popups for this site.')
      window.__optomWhatsappWindow = w
      try {
        w.location.replace(webLink)
      } catch {
        w.location.href = webLink
      }
      try {
        w.focus()
      } catch (e) {
        void e
      }
    }

    let didLoseFocus = false
    const token = `${Date.now()}_${Math.random()}`
    try {
      if (window.__optomWhatsappFallbackTimer) window.clearTimeout(window.__optomWhatsappFallbackTimer)
    } catch (e) {
      void e
    }
    window.__optomWhatsappAttemptToken = token

    const onBlur = () => {
      didLoseFocus = true
    }
    const onVis = () => {
      if (document.hidden) didLoseFocus = true
    }
    window.addEventListener('blur', onBlur, { once: true })
    document.addEventListener('visibilitychange', onVis)

    try {
      window.location.href = deepLink
    } catch (e) {
      void e
    }

    window.__optomWhatsappFallbackTimer = window.setTimeout(() => {
      if (window.__optomWhatsappAttemptToken !== token) return
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVis)
      if (!didLoseFocus) openFallback()
    }, 1200)
  }, [getWhatsappTarget])

  const openGmailWindow = useCallback((toEmail) => {
    const email = String(toEmail || '').trim()
    if (!email) return
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`

    try {
      const existing = window.__optomGmailWindow
      if (existing && !existing.closed) {
        try {
          existing.location.href = url
        } catch {
          try {
            existing.location.replace(url)
          } catch {
            // ignore
          }
        }
        try {
          existing.focus()
        } catch {
          // ignore
        }
        return
      }
    } catch {
      // ignore
    }

    const w = window.open('about:blank', 'optom_gmail')
    if (!w) {
      toast.error('Popup blocked. Allow popups for this site.')
      return
    }
    window.__optomGmailWindow = w
    try {
      w.location.replace(url)
    } catch {
      w.location.href = url
    }
    try {
      w.focus()
    } catch {
      // ignore
    }
  }, [])

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const q = search.trim()
      const makeKey = (bank, rm, contact) =>
        `${String(bank || '').trim().toLowerCase()}|${String(rm || '').trim().toLowerCase()}|${String(contact || '').trim()}`
      const getApplicationCity = (row) => {
        const lead = Array.isArray(row?.lead) ? row.lead[0] : row?.lead
        const customer = Array.isArray(lead?.customer) ? lead.customer[0] : lead?.customer
        return String(customer?.city || '').trim()
      }

      let masterData = null
      let masterError = null

      for (let attempt = 0; attempt < 2; attempt += 1) {
        let mq = supabase
          .from('bank_relationships')
          .select('*')
          .order('created_at', { ascending: false })

        if (q) {
          if (searchBy === 'bank') mq = mq.ilike('bank_name', `%${q}%`)
          else if (searchBy === 'rm') mq = mq.ilike('rm_name', `%${q}%`)
          else if (searchBy === 'contact') mq = mq.ilike('rm_contact', `%${q}%`)
          else if (searchBy === 'email') mq = mq.ilike('rm_email', `%${q}%`)
          else mq = mq.or(`bank_name.ilike.%${q}%,rm_name.ilike.%${q}%,rm_contact.ilike.%${q}%,rm_email.ilike.%${q}%`)
        }

        const res = await mq.range(0, 4999)
        masterData = res.data
        masterError = res.error

        if (masterError) {
          const missing = extractMissingColumn(masterError)
          if (missing) {
            markUnsupported(missing)
            continue // retry without the problematic column
          }
        }
        break
      }

      if (masterError && isPermissionOrSchemaError(masterError)) {
        toast.error(`RM master table access issue: ${masterError?.message || 'Check RLS/policies'}`)
      } else if (masterError) {
        throw masterError
      }
      const masterRows = masterData || []
      const appCityByKey = new Map()

      let derivedRows = []
      if (!(q && searchBy === 'email')) {
        let derivedQuery = supabase
          .from('bank_applications')
          .select('bank_name, bank_rm_name, rm_contact, created_at, lead:leads(customer:customers(city))')
          .order('created_at', { ascending: false })

        if (q) {
          if (searchBy === 'bank') derivedQuery = derivedQuery.ilike('bank_name', `%${q}%`)
          else if (searchBy === 'rm') derivedQuery = derivedQuery.ilike('bank_rm_name', `%${q}%`)
          else if (searchBy === 'contact') derivedQuery = derivedQuery.ilike('rm_contact', `%${q}%`)
          else derivedQuery = derivedQuery.or(`bank_name.ilike.%${q}%,bank_rm_name.ilike.%${q}%,rm_contact.ilike.%${q}%`)
        }

        const derivedRes = await derivedQuery.range(0, 4999)
        if (derivedRes.error) throw derivedRes.error

        const seenDerived = new Set()
        derivedRows = (derivedRes.data || []).flatMap((a) => {
          const bank = (a.bank_name || '').trim()
          const rm = (a.bank_rm_name || '').trim()
          const contact = (a.rm_contact || '').trim()
          const city = getApplicationCity(a)
          if (!bank && !rm && !contact) return []
          const key = makeKey(bank, rm, contact)
          if (city && !appCityByKey.has(key)) appCityByKey.set(key, city)
          if (seenDerived.has(key)) return []
          seenDerived.add(key)
          return [
            {
              id: `derived:${key}`,
              bank_name: bank || null,
              rm_name: rm || null,
              designation: null,
              location: city || null,
              rm_contact: contact || null,
              rm_email: null,
              product_handled: null,
              notes: null,
              created_at: a.created_at || null,
              __derived: true,
            },
          ]
        })
      }

      const seen = new Set()
      const merged = []
      masterRows.forEach((r) => {
        const key = makeKey(r.bank_name, r.rm_name, r.rm_contact)
        if (seen.has(key)) return
        seen.add(key)
        const directLocation = String(r.location || r.city || '').trim()
        const fallbackLocation = String(appCityByKey.get(key) || '').trim()
        merged.push({ ...r, location: directLocation || fallbackLocation || null })
      })
      derivedRows.forEach((r) => {
        const key = makeKey(r.bank_name, r.rm_name, r.rm_contact)
        if (seen.has(key)) return
        seen.add(key)
        merged.push(r)
      })

      const filtered = supportsLocation && locationFilter ? merged.filter((r) => String(r.location || '').trim() === locationFilter) : merged
      const from = pageIndex * pageSize
      const to = from + pageSize
      setRows(filtered.slice(from, to))
      setTotalCount(filtered.length)
      setPageCount(Math.max(1, Math.ceil(filtered.length / pageSize)))
      setShowingDerived(filtered.some((r) => r.__derived))
    } catch (e) {
      toast.error(e?.message || 'Failed to load relationships')
      setRows([])
      setTotalCount(0)
      setPageCount(1)
      setShowingDerived(false)
    } finally {
      setLoading(false)
    }
  }, [extractMissingColumn, locationFilter, markUnsupported, pageIndex, pageSize, search, searchBy, supportsLocation])
  const loadLocationOptions = useCallback(async () => {
    if (!supportsLocation) {
      setLocationOptions([{ value: '', label: 'All Locations' }])
      return
    }

    try {
      const makeKey = (bank, rm, contact) =>
        `${String(bank || '').trim().toLowerCase()}|${String(rm || '').trim().toLowerCase()}|${String(contact || '').trim()}`
      const getApplicationCity = (row) => {
        const lead = Array.isArray(row?.lead) ? row.lead[0] : row?.lead
        const customer = Array.isArray(lead?.customer) ? lead.customer[0] : lead?.customer
        return String(customer?.city || '').trim()
      }

      const { data, error } = await supabase
        .from('bank_relationships')
        .select('*')
        .order('created_at', { ascending: false })
        .range(0, 9999)

      if (error) {
        const missing = extractMissingColumn(error)
        if (missing) {
          markUnsupported(missing)
          setLocationOptions([{ value: '', label: 'All Locations' }])
          return
        }
        throw error
      }
      const appCityByKey = new Map()
      const derivedRes = await supabase
        .from('bank_applications')
        .select('bank_name, bank_rm_name, rm_contact, lead:leads(customer:customers(city))')
        .order('created_at', { ascending: false })
        .range(0, 9999)
      if (!derivedRes.error) {
        ;(derivedRes.data || []).forEach((a) => {
          const bank = (a.bank_name || '').trim()
          const rm = (a.bank_rm_name || '').trim()
          const contact = (a.rm_contact || '').trim()
          const city = getApplicationCity(a)
          if (!city) return
          const key = makeKey(bank, rm, contact)
          if (!appCityByKey.has(key)) appCityByKey.set(key, city)
        })
      }

      const unique = Array.from(
        new Set(
          [
            ...(data || []).map((r) => {
              const key = makeKey(r.bank_name, r.rm_name, r.rm_contact)
              return String(r.location || r.city || appCityByKey.get(key) || '').trim()
            }),
            ...Array.from(appCityByKey.values()).map((v) => String(v || '').trim()),
          ].filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b))
      setLocationOptions([{ value: '', label: 'All Locations' }, ...unique.map((v) => ({ value: v, label: v }))])
    } catch {
      setLocationOptions([{ value: '', label: 'All Locations' }])
    }
  }, [extractMissingColumn, markUnsupported, supportsLocation])

  useEffect(() => {
    loadLocationOptions()
  }, [loadLocationOptions])

  useEffect(() => {
    setPageIndex(0)
  }, [search, searchBy, locationFilter])

  useEffect(() => {
    const t = setTimeout(() => loadRows(), 250)
    return () => clearTimeout(t)
  }, [loadRows])

  const columns = useMemo(() => {
    return [
      columnHelper.accessor('bank_name', { header: 'Bank', cell: (info) => info.getValue() || '—' }),
      columnHelper.accessor('rm_name', { header: 'RM Name', cell: (info) => info.getValue() || '—' }),
      ...(supportsDesignation
        ? [columnHelper.accessor('designation', { header: 'Designation', cell: (info) => info.getValue() || '—' })]
        : []),
      ...(supportsLocation ? [columnHelper.accessor('location', { header: 'Location', cell: (info) => info.getValue() || '—' })] : []),
      columnHelper.accessor('rm_contact', { header: 'RM Contact', cell: (info) => info.getValue() || '—' }),
      columnHelper.accessor('rm_email', { header: 'RM Email', cell: (info) => info.getValue() || '—' }),
      columnHelper.accessor((row) => (row.__derived ? 'Derived' : 'Master'), {
        id: 'source_type',
        header: 'Type',
        cell: (info) => {
          const v = info.getValue()
          return (
            <Badge
              text={v}
              colorClass={
                v === 'Master'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-50 text-slate-700 border-border-divider'
              }
            />
          )
        },
      }),
      columnHelper.accessor('product_handled', {
        header: 'Product',
        cell: (info) => (info.getValue() ? <Badge text={info.getValue()} colorClass="bg-slate-50 text-slate-700 border-border-divider" /> : '—'),
      }),
      columnHelper.accessor('created_at', { header: 'Created', cell: (info) => formatDate(info.getValue()) }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const r = row.original
          if (r.__derived) {
            const waTarget = getWhatsappTarget(r.rm_contact)
            const emailTarget = String(r.rm_email || '').trim() || null
            return (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setReadOnly(true)
                    setEditing(null)
                    form.reset({
                      bank_name: r.bank_name || '',
                      rm_name: r.rm_name || '',
                      designation: '',
                      location: '',
                      rm_contact: r.rm_contact || '',
                      rm_email: '',
                      product_handled: '',
                      notes: '',
                    })
                    setDrawerOpen(true)
                  }}
                >
                  View
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!waTarget}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!waTarget) return
                    openWhatsappWindow(waTarget)
                  }}
                >
                  <MessageCircle size={16} />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!emailTarget}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!emailTarget) return
                    openGmailWindow(emailTarget)
                  }}
                >
                  <Mail size={16} />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setReadOnly(false)
                    setEditing(null)
                    form.reset({
                      bank_name: r.bank_name || '',
                      rm_name: r.rm_name || '',
                      designation: '',
                      location: '',
                      rm_contact: r.rm_contact || '',
                      rm_email: '',
                      product_handled: '',
                      notes: '',
                    })
                    setDrawerOpen(true)
                  }}
                >
                  Add
                </Button>
                <Button variant="danger" size="sm" disabled title="Only master rows can be deleted">
                  <Trash2 size={16} />
                </Button>
              </div>
            )
          }
          const waTarget = getWhatsappTarget(r.rm_contact)
          const emailTarget = String(r.rm_email || '').trim() || null
          return (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setReadOnly(true)
                  setEditing(r)
                  form.reset({
                    bank_name: r.bank_name || '',
                    rm_name: r.rm_name || '',
                    designation: r.designation || '',
                    location: r.location || '',
                    rm_contact: r.rm_contact || '',
                    rm_email: r.rm_email || '',
                    product_handled: r.product_handled || '',
                    notes: r.notes || '',
                  })
                  setDrawerOpen(true)
                }}
              >
                View
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!waTarget}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!waTarget) return
                  openWhatsappWindow(waTarget)
                }}
              >
                <MessageCircle size={16} />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!emailTarget}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!emailTarget) return
                  openGmailWindow(emailTarget)
                }}
              >
                <Mail size={16} />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setReadOnly(false)
                  setEditing(r)
                  form.reset({
                    bank_name: r.bank_name || '',
                    rm_name: r.rm_name || '',
                    designation: r.designation || '',
                    location: r.location || '',
                    rm_contact: r.rm_contact || '',
                    rm_email: r.rm_email || '',
                    product_handled: r.product_handled || '',
                    notes: r.notes || '',
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
  }, [form, getWhatsappTarget, openGmailWindow, openWhatsappWindow, supportsDesignation, supportsLocation])

  function openCreate() {
    setEditing(null)
    setReadOnly(false)
    form.reset()
    setDrawerOpen(true)
  }

  async function save(values) {
    try {
      const payload = { ...values }
      Object.keys(payload).forEach((k) => {
        if (payload[k] === '') payload[k] = null
      })
      let attempt = stripUnsupported(payload)

      for (let i = 0; i < 2; i += 1) {
        const res = editing?.id
          ? await supabase.from('bank_relationships').update(attempt).eq('id', editing.id)
          : await supabase.from('bank_relationships').insert([attempt])
        if (!res.error) {
          toast.success(editing?.id ? 'RM updated' : 'RM added')
          setDrawerOpen(false)
          await loadRows()
          return
        }
        const missing = extractMissingColumn(res.error)
        if (!missing || !(missing in attempt)) throw res.error
        markUnsupported(missing)
        const next = { ...attempt }
        delete next[missing]
        attempt = next
      }
    } catch (e) {
      toast.error(e?.message || 'Failed to save RM')
      throw e
    }
  }

  async function deleteRow() {
    if (!deleteTarget?.id) return
    try {
      const { error } = await supabase.from('bank_relationships').delete().eq('id', deleteTarget.id)
      if (error) throw error
      toast.success('Deleted')
      setDeleteTarget(null)
      await loadRows()
    } catch (e) {
      toast.error(e?.message || 'Failed to delete')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[18px] font-semibold">RM List</div>
          <div className="text-[13px] text-text-secondary">
            {showingDerived ? 'Showing merged RM list: Master + Bank Applications history' : 'Bank / RM master list'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setImportFileName('')
              setImportPreview([])
              setImportErrors([])
              setImportOpen(true)
            }}
          >
            <Upload size={16} />
            <span>Import CSV</span>
          </Button>
          <Button onClick={openCreate}>
            <Plus size={16} />
            <span>Add RM</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-3">
        <Select
          value={searchBy}
          onChange={(e) => setSearchBy(e.target.value)}
          options={[
            { value: '', label: 'Search: All' },
            { value: 'bank', label: 'Search: Bank' },
            { value: 'rm', label: 'Search: RM' },
            { value: 'contact', label: 'Search: Contact' },
            { value: 'email', label: 'Search: Email' },
          ]}
        />
        <div className="col-span-3">
          <Input
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          options={locationOptions}
          disabled={!supportsLocation}
        />
        <Select
          value={String(pageSize)}
          onChange={(e) => setPageSize(Number(e.target.value))}
          options={[
            { value: '10', label: '10 rows' },
            { value: '25', label: '25 rows' },
            { value: '50', label: '50 rows' },
            { value: '100', label: '100 rows' },
          ]}
        />
      </div>

      <Table
        data={rows}
        columns={columns}
        loading={loading}
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
        title={readOnly ? 'View Relationship' : editing ? 'Edit Relationship' : 'Add Relationship'}
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
                  await save(values)
                  setEditing(null)
                  setReadOnly(false)
                })}
                disabled={form.formState.isSubmitting}
              >
                Save
              </Button>
            </>
          )
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Bank Name"
            {...form.register('bank_name', { required: 'Bank name is required' })}
            error={form.formState.errors.bank_name?.message}
            disabled={readOnly}
          />
          <Input
            label="RM Name"
            {...form.register('rm_name', { required: 'RM name is required' })}
            error={form.formState.errors.rm_name?.message}
            disabled={readOnly}
          />
          {supportsDesignation ? <Input label="Designation" {...form.register('designation')} disabled={readOnly} /> : null}
          {supportsLocation ? <Input label="Location" {...form.register('location')} disabled={readOnly} /> : null}
          <Input label="RM Contact" {...form.register('rm_contact')} disabled={readOnly} />
          <Input label="RM Email" {...form.register('rm_email')} disabled={readOnly} />
          <Input label="Product Handled" {...form.register('product_handled')} disabled={readOnly} />
          <Textarea label="Notes" rows={4} className="col-span-2" {...form.register('notes')} disabled={readOnly} />
        </div>
      </Drawer>

      <Drawer
        open={importOpen}
        onClose={() => {
          setImportOpen(false)
          setImportFileName('')
          setImportPreview([])
          setImportErrors([])
        }}
        title="Import RM List (CSV)"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                downloadCsv('bank_rm_import_template.csv', [
                  ['bank_name', 'rm_name', 'designation', 'location', 'rm_contact', 'rm_email', 'product_handled', 'notes'],
                  ['HDFC', 'Amit Sharma', 'RM', 'Mumbai', '9980019289', 'amit@example.com', 'BL', ''],
                ])
              }}
            >
              Download Template
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setImportOpen(false)
                setImportFileName('')
                setImportPreview([])
                setImportErrors([])
              }}
              disabled={importing}
            >
              Close
            </Button>
            <Button
              onClick={async () => {
                if (!importPreview.length) {
                  toast.error('No rows to import')
                  return
                }
                if (importErrors.length) {
                  toast.error('Fix import errors first')
                  return
                }
                setImporting(true)
                try {
                  const batchSize = 200
                  for (let from = 0; from < importPreview.length; from += batchSize) {
                    let attemptBatch = importPreview.slice(from, from + batchSize).map((r) => {
                      const payload = { ...r }
                      Object.keys(payload).forEach((k) => {
                        if (payload[k] === '') payload[k] = null
                      })
                      return stripUnsupported(payload)
                    })
                    for (let i = 0; i < 2; i += 1) {
                      const { error } = await supabase.from('bank_relationships').insert(attemptBatch)
                      if (!error) break
                      const missing = extractMissingColumn(error)
                      if (!missing) throw error
                      markUnsupported(missing)
                      attemptBatch = attemptBatch.map((r) => {
                        if (!r || typeof r !== 'object' || !(missing in r)) return r
                        const next = { ...r }
                        delete next[missing]
                        return next
                      })
                      if (i === 1) throw error
                    }
                  }
                  toast.success(`Imported ${importPreview.length} RMs`)
                  setImportOpen(false)
                  setImportFileName('')
                  setImportPreview([])
                  setImportErrors([])
                  await loadRows()
                } catch (e) {
                  toast.error(e?.message || 'Import failed')
                } finally {
                  setImporting(false)
                }
              }}
              disabled={importing}
            >
              {importing ? 'Importing…' : 'Import'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-md border border-border-divider bg-[#F5F5F3] p-3">
            <div className="text-[13px] font-medium">Upload CSV</div>
            <div className="mt-1 text-[12px] text-text-secondary">
              Columns: bank_name, rm_name, designation, location, rm_contact, rm_email, product_handled, notes
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setImportFileName(file.name || '')
                  try {
                    const text = await file.text()

                    const parseCsvText = (t) => {
                      const out = []
                      let row = []
                      let cell = ''
                      let inQuotes = false
                      for (let i = 0; i < t.length; i += 1) {
                        const ch = t[i]
                        const next = t[i + 1]
                        if (inQuotes) {
                          if (ch === '"' && next === '"') {
                            cell += '"'
                            i += 1
                            continue
                          }
                          if (ch === '"') {
                            inQuotes = false
                            continue
                          }
                          cell += ch
                          continue
                        }
                        if (ch === '"') {
                          inQuotes = true
                          continue
                        }
                        if (ch === ',') {
                          row.push(cell)
                          cell = ''
                          continue
                        }
                        if (ch === '\n') {
                          row.push(cell)
                          cell = ''
                          if (row.some((c) => String(c || '').trim() !== '')) out.push(row)
                          row = []
                          continue
                        }
                        if (ch === '\r') continue
                        cell += ch
                      }
                      row.push(cell)
                      if (row.some((c) => String(c || '').trim() !== '')) out.push(row)
                      return out
                    }

                    const normalizeHeader = (h) =>
                      String(h || '')
                        .trim()
                        .toLowerCase()
                        .replaceAll(' ', '_')
                        .replaceAll('-', '_')

                    const rowsParsed = parseCsvText(text)
                    if (rowsParsed.length < 2) {
                      setImportPreview([])
                      setImportErrors(['CSV must include a header row and at least 1 data row'])
                      return
                    }
                    const headers = rowsParsed[0].map(normalizeHeader)
                    const dataRows = rowsParsed.slice(1)
                    const preview = []
                    const errors = []

                    const allowed = new Set([
                      'bank_name',
                      'rm_name',
                      'designation',
                      'location',
                      'rm_contact',
                      'rm_email',
                      'product_handled',
                      'notes',
                    ])
                    const unknown = headers.filter((h) => h && !allowed.has(h))
                    if (unknown.length) errors.push(`Unknown columns: ${unknown.join(', ')}`)

                    dataRows.forEach((r, idx) => {
                      const obj = {}
                      headers.forEach((h, i) => {
                        if (!h) return
                        obj[h] = (r[i] == null ? '' : String(r[i])).trim()
                      })
                      if (!obj.bank_name) errors.push(`Row ${idx + 2}: bank_name is required`)
                      if (!obj.rm_name) errors.push(`Row ${idx + 2}: rm_name is required`)
                      preview.push({
                        bank_name: obj.bank_name || '',
                        rm_name: obj.rm_name || '',
                        designation: obj.designation || '',
                        location: obj.location || '',
                        rm_contact: obj.rm_contact || '',
                        rm_email: obj.rm_email || '',
                        product_handled: obj.product_handled || '',
                        notes: obj.notes || '',
                      })
                    })

                    setImportPreview(preview)
                    setImportErrors(errors)
                  } catch (err) {
                    toast.error(err?.message || 'Failed to read file')
                  }
                }}
              />
              {importFileName ? <div className="text-[12px] text-text-secondary">{importFileName}</div> : null}
            </div>
          </div>

          {importErrors.length ? (
            <div className="rounded-md border border-danger bg-danger/5 p-3 text-[12px] text-danger">
              <div className="font-medium">Fix these issues:</div>
              <div className="mt-2 space-y-1">
                {importErrors.slice(0, 8).map((e, idx) => (
                  <div key={`${e}-${idx}`}>- {e}</div>
                ))}
                {importErrors.length > 8 ? <div>+{importErrors.length - 8} more…</div> : null}
              </div>
            </div>
          ) : null}

          <div className="text-[12px] text-text-secondary">{importPreview.length ? `${importPreview.length} rows ready` : 'No rows loaded'}</div>
          {importPreview.length ? (
            <div className="max-h-[320px] overflow-auto rounded-md border border-border-divider">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-[#F5F5F3] text-text-secondary">
                  <tr>
                    <th className="px-3 py-2">Bank</th>
                    <th className="px-3 py-2">RM</th>
                    <th className="px-3 py-2">Designation</th>
                    <th className="px-3 py-2">Location</th>
                    <th className="px-3 py-2">Contact</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Product</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.slice(0, 50).map((r, idx) => (
                    <tr key={`${r.bank_name}-${r.rm_name}-${idx}`} className="border-t border-border-divider">
                      <td className="px-3 py-2">{r.bank_name || '—'}</td>
                      <td className="px-3 py-2">{r.rm_name || '—'}</td>
                      <td className="px-3 py-2">{r.designation || '—'}</td>
                      <td className="px-3 py-2">{r.location || '—'}</td>
                      <td className="px-3 py-2">{r.rm_contact || '—'}</td>
                      <td className="px-3 py-2">{r.rm_email || '—'}</td>
                      <td className="px-3 py-2">{r.product_handled || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {importPreview.length > 50 ? <div className="text-[12px] text-text-muted">Showing first 50 rows</div> : null}
        </div>
      </Drawer>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete relationship?"
        description="This will remove the RM/bank entry."
        confirmText="Delete"
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteRow}
      />
    </div>
  )
}
