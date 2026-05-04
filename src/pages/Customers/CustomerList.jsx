import { createColumnHelper } from '@tanstack/react-table'
import { Mail, MessageCircle, Search, Trash2, Upload, UserPlus, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Button, ConfirmDialog, Divider, Drawer, Input, Modal, Select, Table, Textarea, Toggle } from '../../components/ui/index.jsx'
import { deleteCustomerCascade, supabase } from '../../lib/supabase.js'
import { downloadCsv, formatDate, getScoreColor, isOverdue, writeClipboardText } from '../../lib/utils.js'

const entityOptions = [
  { value: '', label: 'All Entity Types' },
  { value: 'Individual', label: 'Individual' },
  { value: 'Proprietorship', label: 'Proprietorship' },
  { value: 'LLP', label: 'LLP' },
  { value: 'Pvt Ltd', label: 'Pvt Ltd' },
  { value: 'Partnership', label: 'Partnership' },
]

const professionOptions = [
  { value: '', label: 'All Professions' },
  { value: 'Doctor', label: 'Doctor' },
  { value: 'CA', label: 'CA' },
  { value: 'Business Owner', label: 'Business Owner' },
  { value: 'Salaried', label: 'Salaried' },
  { value: 'Self Employed', label: 'Self Employed' },
  { value: 'Other', label: 'Other' },
]

const employmentTypeOptions = [
  { value: '', label: '—' },
  { value: 'SEP', label: 'SEP' },
  { value: 'SENP', label: 'SENP' },
  { value: 'Sal', label: 'Sal' },
]

const productOfferingOptions = [
  { value: '', label: '—' },
  { value: 'BL', label: 'BL' },
  { value: 'HL', label: 'HL' },
  { value: 'ODCC', label: 'ODCC' },
  { value: 'PL', label: 'PL' },
  { value: 'LAP', label: 'LAP' },
  { value: 'LRD', label: 'LRD' },
]

const customerTypeOptions = [
  { value: '', label: '—' },
  { value: 'NTB', label: 'NTB' },
  { value: 'Existing', label: 'Existing' },
]

const employmentTypeFilterOptions = [
  { value: '', label: 'All Employment Types' },
  { value: 'SEP', label: 'SEP' },
  { value: 'SENP', label: 'SENP' },
  { value: 'Sal', label: 'Sal' },
]

const productOfferingFilterOptions = [
  { value: '', label: 'All Product Offerings' },
  { value: 'BL', label: 'BL' },
  { value: 'HL', label: 'HL' },
  { value: 'ODCC', label: 'ODCC' },
  { value: 'PL', label: 'PL' },
  { value: 'LAP', label: 'LAP' },
  { value: 'LRD', label: 'LRD' },
]

const customerTypeFilterOptions = [
  { value: '', label: 'All Customer Types' },
  { value: 'NTB', label: 'NTB' },
  { value: 'Existing', label: 'Existing' },
]

const columnHelper = createColumnHelper()

export default function CustomerList() {
  const CUSTOMER_SCHEMA_UNSUPPORTED_KEY = 'optom_customers_schema_unsupported_v1'
  const MESSAGE_TEMPLATE_KEY = 'optom_customer_message_template_v1'

  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState([])
  const [searchBy, setSearchBy] = useState('')
  const [search, setSearch] = useState('')
  const [entityType, setEntityType] = useState('')
  const [professionType, setProfessionType] = useState('')
  const [employmentType, setEmploymentType] = useState('')
  const [customerType, setCustomerType] = useState('')
  const [productOffering, setProductOffering] = useState('')
  const [location, setLocation] = useState('')
  const [locationOptions, setLocationOptions] = useState([{ value: '', label: 'All Locations' }])
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [totalCount, setTotalCount] = useState(0)
  const [pageCount, setPageCount] = useState(1)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [messageOpen, setMessageOpen] = useState(false)
  const [messageTarget, setMessageTarget] = useState(null)
  const [messageDraft, setMessageDraft] = useState('')
  const [templateOpen, setTemplateOpen] = useState(false)
  const [templateDraft, setTemplateDraft] = useState('')
  const [templateLoading, setTemplateLoading] = useState(true)
  const [messageTemplate, setMessageTemplate] = useState(() => {
    try {
      return String(window.localStorage.getItem(MESSAGE_TEMPLATE_KEY) || '')
    } catch {
      return ''
    }
  })
  const [importOpen, setImportOpen] = useState(false)
  const [importTemplateOpen, setImportTemplateOpen] = useState(false)
  const [importFileName, setImportFileName] = useState('')
  const [importPreview, setImportPreview] = useState([])
  const [importErrors, setImportErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const [unsupportedCols, setUnsupportedCols] = useState(() => new Set())

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: '',
      entity_type: 'Individual',
      pan_number: '',
      aadhaar_number: '',
      cin: '',
      date_of_birth: '',
      incorporation_date: '',
      nationality: 'Indian',
      primary_mobile: '',
      alternate_mobile: '',
      email: '',
      office_phone: '',
      pa_contact: '',
      residential_address: '',
      office_address: '',
      city: '',
      state: '',
      pin_code: '',
      country: 'India',
      profession_type: 'Other',
      employment_type: '',
      product_offering: '',
      customer_type: '',
      nature_of_business: '',
      industry_category: '',
      business_name: '',
      business_vintage_years: '',
      employer_name: '',
      designation: '',
      company_type: 'Other',
      number_of_employees: '',
      gst_number: '',
      annual_turnover: '',
      net_profit: '',
      monthly_income: '',
      net_worth: '',
      cibil_score: '',
      experian_score: '',
      equifax_score: '',
      crif_score: '',
      credit_card_outstanding: '',
      existing_emi_outflow: '',
      total_loan_exposure: '',
      dpd_history: '',
      writeoff_settlement_history: '',
      primary_bank: '',
      current_account_bank: '',
      savings_bank: '',
      od_cc_bank: '',
      banking_vintage_years: '',
      avg_monthly_balance: '',
      monthly_banking_turnover: '',
      cheque_bounce_history: '',
      last_interaction_date: '',
      next_followup_date: '',
      relationship_notes: '',
      balance_transfer_opportunity: false,
      topup_loan_eligibility: false,
      insurance_opportunity: false,
      credit_card_offer: false,
    },
  })

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

  useEffect(() => {
    refreshCustomerSchema()
  }, [refreshCustomerSchema])

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

  const opp = {
    balance_transfer_opportunity: watch('balance_transfer_opportunity'),
    topup_loan_eligibility: watch('topup_loan_eligibility'),
    insurance_opportunity: watch('insurance_opportunity'),
    credit_card_offer: watch('credit_card_offer'),
  }

  const loadCustomers = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase.from('customers').select('*', { count: 'exact' }).order('created_at', { ascending: false })

      if (entityType) query = query.eq('entity_type', entityType)
      if (professionType) query = query.eq('profession_type', professionType)
      if (employmentType && !unsupportedCols.has('employment_type')) query = query.eq('employment_type', employmentType)
      if (customerType && !unsupportedCols.has('customer_type')) query = query.eq('customer_type', customerType)
      if (productOffering && !unsupportedCols.has('product_offering')) query = query.eq('product_offering', productOffering)
      if (location) query = query.eq('city', location)

      const q = search.trim()
      if (q) {
        if (searchBy === 'name') query = query.ilike('name', `%${q}%`)
        else if (searchBy === 'pan') query = query.ilike('pan_number', `%${q}%`)
        else if (searchBy === 'mobile') query = query.ilike('primary_mobile', `%${q}%`)
        else if (searchBy === 'email') query = query.ilike('email', `%${q}%`)
        else if (searchBy === 'city') query = query.ilike('city', `%${q}%`)
        else query = query.or(`name.ilike.%${q}%,pan_number.ilike.%${q}%,primary_mobile.ilike.%${q}%,email.ilike.%${q}%,city.ilike.%${q}%`)
      }

      const from = pageIndex * pageSize
      const to = from + pageSize - 1
      const { data, error, count } = await query.range(from, to)
      if (error) throw error
      setCustomers(data || [])
      const nextTotal = count || 0
      setTotalCount(nextTotal)
      setPageCount(Math.max(1, Math.ceil(nextTotal / pageSize)))
    } catch (e) {
      toast.error(e?.message || 'Failed to load customers')
    } finally {
      setLoading(false)
    }
  }, [
    customerType,
    employmentType,
    entityType,
    location,
    pageIndex,
    pageSize,
    productOffering,
    professionType,
    search,
    searchBy,
    unsupportedCols,
  ])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  useEffect(() => {
    setPageIndex(0)
  }, [search, searchBy, entityType, professionType, employmentType, customerType, productOffering, location])

  useEffect(() => {
    const t = setTimeout(() => loadCustomers(), 250)
    return () => clearTimeout(t)
  }, [loadCustomers])

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

  useEffect(() => {
    loadLocationOptions()
  }, [loadLocationOptions])

  const loadMessageTemplate = useCallback(async () => {
    setTemplateLoading(true)
    try {
      const local = (() => {
        try {
          return String(window.localStorage.getItem(MESSAGE_TEMPLATE_KEY) || '')
        } catch {
          return ''
        }
      })()
      setMessageTemplate(local)

      const { data, error } = await supabase.from('app_settings').select('value').eq('key', MESSAGE_TEMPLATE_KEY).maybeSingle()
      if (error) throw error
      if (!data) return
      const next = String(data.value || '')
      setMessageTemplate(next)
      try {
        if (next.trim()) window.localStorage.setItem(MESSAGE_TEMPLATE_KEY, next)
        else window.localStorage.removeItem(MESSAGE_TEMPLATE_KEY)
      } catch (e2) {
        void e2
      }
    } catch {
      void 0
    } finally {
      setTemplateLoading(false)
    }
  }, [MESSAGE_TEMPLATE_KEY])

  const saveMessageTemplate = useCallback(
    async (nextValue) => {
      const next = String(nextValue || '')
      const trimmed = next.trim()
      try {
        if (!trimmed) {
          const { error } = await supabase.from('app_settings').delete().eq('key', MESSAGE_TEMPLATE_KEY)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('app_settings')
            .upsert({ key: MESSAGE_TEMPLATE_KEY, value: next }, { onConflict: 'key' })
          if (error) throw error
        }
        setMessageTemplate(trimmed ? next : '')
        try {
          if (trimmed) window.localStorage.setItem(MESSAGE_TEMPLATE_KEY, next)
          else window.localStorage.removeItem(MESSAGE_TEMPLATE_KEY)
        } catch (e2) {
          void e2
        }
        return
      } catch {
        try {
          if (trimmed) window.localStorage.setItem(MESSAGE_TEMPLATE_KEY, next)
          else window.localStorage.removeItem(MESSAGE_TEMPLATE_KEY)
        } catch (e2) {
          void e2
        }
        setMessageTemplate(trimmed ? next : '')
      }
    },
    [MESSAGE_TEMPLATE_KEY],
  )

  useEffect(() => {
    loadMessageTemplate()
  }, [loadMessageTemplate])

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

  const buildMessageDraft = useCallback((c) => {
    const name = String(c?.name || '').trim()
    const template = String(messageTemplate || '')
    if (!template.trim()) return ''
    return template.replaceAll('{name}', name || '')
  }, [messageTemplate])

  const copyToClipboard = useCallback(async (text) => {
    const msg = String(text || '')
    if (!msg.trim()) {
      toast.error('Message is empty')
      return
    }
    try {
      await writeClipboardText(msg)
      toast.success('Copied')
    } catch (e) {
      if (e?.name === 'AbortError') return
      toast.error(e?.message || 'Failed to copy')
    }
  }, [])

  const openWhatsappWindow = useCallback((waTarget, message = '') => {
    const target = getWhatsappTarget(waTarget)
    if (!target) return

    const encodedMsg = encodeURIComponent(String(message || ''))
    const deepLink = `whatsapp://send?phone=${target}&text=${encodedMsg}`
    const webLink = `https://wa.me/${target}?text=${encodedMsg}`

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
    } catch (e) {
      void e
    }
  }, [])

  const openEditCustomer = useCallback(
    async (c) => {
      setEditing(c)
      let data = c
      try {
        const res = await supabase.from('customers').select('*').eq('id', c.id).single()
        if (res.error) throw res.error
        data = res.data || c
      } catch (e) {
        const missing = extractMissingColumn(e)
        if (missing) markUnsupported(missing)
      }
      reset({
        ...data,
        business_name: data?.business_name || '',
        country: data?.country || 'India',
        entity_type: data?.entity_type || 'Individual',
        profession_type: data?.profession_type || 'Other',
        company_type: data?.company_type || 'Other',
      })
      setDrawerOpen(true)
    },
    [extractMissingColumn, markUnsupported, reset],
  )

  const columns = useMemo(() => {
    return [
      columnHelper.accessor('customer_code', {
        header: 'Customer ID',
        cell: (info) => info.getValue() || '—',
      }),
      columnHelper.accessor('business_name', {
        header: 'Company Name',
        cell: (info) => info.getValue() || '—',
      }),
      columnHelper.accessor('name', {
        header: 'Customer Name',
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      columnHelper.accessor('relationship_notes', {
        header: 'Remarks',
        cell: (info) => {
          const v = String(info.getValue() || '').trim()
          if (!v) return '—'
          return (
            <span className="block max-w-[240px] truncate" title={v}>
              {v}
            </span>
          )
        },
      }),
      columnHelper.accessor('entity_type', {
        header: 'Entity Type',
        cell: (info) => (
          <span className="inline-flex rounded-full border border-border-divider bg-slate-50 px-2 py-1 text-[12px] text-slate-700">
            {info.getValue() || '—'}
          </span>
        ),
      }),
      columnHelper.accessor('profession_type', {
        header: 'Profession',
        cell: (info) => (
          <span className="inline-flex rounded-full border border-border-divider bg-slate-50 px-2 py-1 text-[12px] text-slate-700">
            {info.getValue() || '—'}
          </span>
        ),
      }),
      columnHelper.accessor('primary_mobile', { header: 'Mobile', cell: (info) => info.getValue() || '—' }),
      columnHelper.accessor('email', { header: 'Email', cell: (info) => info.getValue() || '—' }),
      columnHelper.accessor('city', { header: 'City', cell: (info) => info.getValue() || '—' }),
      columnHelper.accessor('cibil_score', {
        header: 'CIBIL',
        cell: (info) => <span className={['font-medium', getScoreColor(info.getValue())].join(' ')}>{info.getValue() || '—'}</span>,
      }),
      columnHelper.accessor('next_followup_date', {
        header: 'Next Follow-up',
        cell: (info) => {
          const c = info.row.original
          const v = info.getValue()
          return (
            <button
              type="button"
              className={[
                isOverdue(v) ? 'text-danger font-medium' : 'text-text-secondary',
                'hover:underline',
              ].join(' ')}
              onClick={(e) => {
                e.stopPropagation()
                openEditCustomer(c)
              }}
            >
              {formatDate(v)}
            </button>
          )
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const c = row.original
          const waTarget = getWhatsappTarget(c.primary_mobile)
          const emailTarget = String(c.email || '').trim() || null
          return (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/customers/${c.id}`)
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
                  setMessageTarget(c)
                  setMessageDraft(buildMessageDraft(c))
                  setMessageOpen(true)
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
                  openEditCustomer(c)
                }}
              >
                Edit
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteTarget(c)
                }}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          )
        },
      }),
    ]
  }, [buildMessageDraft, getWhatsappTarget, navigate, openEditCustomer, openGmailWindow])

  function openCreate() {
    setEditing(null)
    reset()
    setDrawerOpen(true)
  }

  function downloadImportTemplateSheet() {
    const url =
      'https://docs.google.com/spreadsheets/d/1d65tvDbS0LDwFVK8VwADxmWL_h1k5EZ2hBb1t_3PxAE/edit?usp=sharing'
    const w = window.open(url, '_blank', 'noopener,noreferrer')
    if (!w) toast.error('Popup blocked. Allow popups for this site to open the template in a new tab.')
  }

  function downloadImportTemplateCsv() {
    downloadCsv('Import Temp - Customers.csv', [
      [
        'name',
        'entity_type',
        'primary_mobile',
        'profession_type',
        'business_name',
        'employment_type',
        'customer_type',
        'product_offering',
        'nature_of_business',
        'email',
        'city',
        'state',
        'pin_code',
        'cibil_score',
      ],
    ])
  }

  function parseCsvText(text) {
    const rows = []
    let row = []
    let cell = ''
    let inQuotes = false

    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i]
      const next = text[i + 1]
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
        if (row.some((c) => String(c || '').trim() !== '')) rows.push(row)
        row = []
        continue
      }

      if (ch === '\r') continue

      cell += ch
    }

    row.push(cell)
    if (row.some((c) => String(c || '').trim() !== '')) rows.push(row)
    return rows
  }

  function normalizeHeader(h) {
    return String(h || '')
      .trim()
      .toLowerCase()
      .replaceAll(' ', '_')
      .replaceAll('-', '_')
  }

  function openImport() {
    setImportFileName('')
    setImportPreview([])
    setImportErrors([])
    setImportOpen(true)
  }

  async function onPickImportFile(file) {
    if (!file) return
    setImportFileName(file.name || '')
    const text = await file.text()
    const rows = parseCsvText(text)
    if (rows.length < 2) {
      setImportPreview([])
      setImportErrors(['CSV must include a header row and at least 1 data row'])
      return
    }
    const headers = rows[0].map(normalizeHeader)
    const dataRows = rows.slice(1)
    const preview = []
    const errors = []

    const allowed = new Set([
      'customer_name',
      'name',
      'entity_type',
      'profession_type',
      'business_name',
      'employment_type',
      'product_offering',
      'customer_type',
      'nature_of_business',
      'primary_mobile',
      'email',
      'city',
      'state',
      'pin_code',
      'pan_number',
      'cibil_score',
    ])
    const unknown = headers.filter((h) => h && !allowed.has(h))
    if (unknown.length) errors.push(`Unknown columns: ${unknown.join(', ')}`)

    const canonicalMap = (values) => {
      const map = new Map()
      values.forEach((v) => {
        const key = String(v || '')
          .trim()
          .toLowerCase()
          .replace(/\s+/g, ' ')
        if (!key) return
        map.set(key, v)
      })
      return map
    }

    const normalizeChoice = (raw, map) => {
      const key = String(raw || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
      if (!key) return ''
      return map.get(key) || null
    }

    const entityMap = canonicalMap(entityOptions.map((o) => o.value).filter(Boolean))
    const professionMap = canonicalMap(professionOptions.map((o) => o.value).filter(Boolean))
    const employmentMap = canonicalMap(employmentTypeOptions.map((o) => o.value).filter(Boolean))
    const productMap = canonicalMap(productOfferingOptions.map((o) => o.value).filter(Boolean))

    dataRows.forEach((r, idx) => {
      const obj = {}
      headers.forEach((h, i) => {
        if (!h) return
        obj[h] = (r[i] == null ? '' : String(r[i])).trim()
      })
      const name = obj.customer_name || obj.name || ''
      if (!name) errors.push(`Row ${idx + 2}: name is required`)

      const entity = normalizeChoice(obj.entity_type, entityMap)
      if (obj.entity_type && !entity) errors.push(`Row ${idx + 2}: invalid entity_type "${obj.entity_type}"`)

      const profession = normalizeChoice(obj.profession_type, professionMap)
      if (obj.profession_type && !profession) errors.push(`Row ${idx + 2}: invalid profession_type "${obj.profession_type}"`)

      const employment = normalizeChoice(obj.employment_type, employmentMap)
      if (obj.employment_type && !employment) errors.push(`Row ${idx + 2}: invalid employment_type "${obj.employment_type}"`)

      const product = normalizeChoice(obj.product_offering, productMap)
      if (obj.product_offering && !product) errors.push(`Row ${idx + 2}: invalid product_offering "${obj.product_offering}"`)

      preview.push({
        name,
        entity_type: entity || 'Individual',
        profession_type: profession || 'Other',
        business_name: obj.business_name || '',
        employment_type: employment || '',
        product_offering: product || '',
        customer_type: obj.customer_type || '',
        nature_of_business: obj.nature_of_business || '',
        primary_mobile: obj.primary_mobile || '',
        email: obj.email || '',
        city: obj.city || '',
        state: obj.state || '',
        pin_code: obj.pin_code || '',
        pan_number: obj.pan_number || '',
        cibil_score: obj.cibil_score || '',
      })
    })

    setImportPreview(preview)
    setImportErrors(errors)
  }

  async function runImport() {
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
      const batchSize = 100
      for (let from = 0; from < importPreview.length; from += batchSize) {
        let batch = importPreview.slice(from, from + batchSize).map((r) => {
          const payload = stripUnsupported({ ...r })
          Object.keys(payload).forEach((k) => {
            if (payload[k] === '') payload[k] = null
          })
          return payload
        })

        for (let attempt = 0; attempt < 6; attempt += 1) {
          const { error } = await supabase.from('customers').insert(batch)
          if (!error) break

          const missing = extractMissingColumn(error)
          if (!missing) throw error

          markUnsupported(missing)
          batch = batch.map((r) => {
            if (!r || typeof r !== 'object' || !(missing in r)) return r
            const next = { ...r }
            delete next[missing]
            return next
          })

          if (attempt === 5) throw error
        }
      }
      toast.success(`Imported ${importPreview.length} customers`)
      setImportOpen(false)
      await loadCustomers()
    } catch (e) {
      toast.error(e?.message || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  async function upsertCustomer(values) {
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
    const nextValues = { ...values }
    if (nextValues.entity_type && nextValues.entity_type !== 'Individual' && !nextValues.business_name && nextValues.name) {
      nextValues.business_name = nextValues.name
    }
    const payload = {
      ...nextValues,
      business_vintage_years: toIntOrNull(nextValues.business_vintage_years),
      number_of_employees: toIntOrNull(nextValues.number_of_employees),
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
      banking_vintage_years: toIntOrNull(nextValues.banking_vintage_years),
      avg_monthly_balance: toNumberOrNull(nextValues.avg_monthly_balance),
      monthly_banking_turnover: toNumberOrNull(nextValues.monthly_banking_turnover),
    }

    Object.keys(payload).forEach((k) => {
      if (payload[k] === '') payload[k] = null
    })

    try {
      const op = async (nextPayload) => {
        if (editing?.id) {
          const safe = { ...(nextPayload || {}) }
          delete safe.id
          delete safe.customer_code
          delete safe.created_at
          return supabase.from('customers').update(safe).eq('id', editing.id)
        }
        return supabase.from('customers').insert([nextPayload])
      }

      let attempt = stripUnsupported(payload)
      for (let i = 0; i < 2; i += 1) {
        const { error } = await op(attempt)
        if (!error) {
          toast.success(editing?.id ? 'Customer updated' : 'Customer created')
          break
        }
        const missing = extractMissingColumn(error)
        if (!missing || !(missing in attempt)) throw error
        markUnsupported(missing)
        const next = { ...attempt }
        delete next[missing]
        attempt = next
      }
      setDrawerOpen(false)
      await loadCustomers()
    } catch (e) {
      toast.error(e?.message || 'Failed to save customer')
      throw e
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[18px] font-semibold">Customers</div>
          <div className="text-[13px] text-text-secondary">Manage borrower profiles and follow-ups</div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setTemplateDraft(String(messageTemplate || ''))
              setTemplateOpen(true)
            }}
            disabled={templateLoading}
          >
            <span>
              {templateLoading ? 'Template…' : String(messageTemplate || '').trim() ? 'Edit Template' : 'Add Template'}
            </span>
          </Button>
          <Button variant="secondary" onClick={openImport}>
            <Upload size={16} />
            <span>Import CSV</span>
          </Button>
          <Button onClick={openCreate}>
            <UserPlus size={16} />
            <span>Add Customer</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-10 gap-3">
        <Select
          value={searchBy}
          onChange={(e) => setSearchBy(e.target.value)}
          options={[
            { value: '', label: 'Search: All' },
            { value: 'name', label: 'Search: Customer Name' },
            { value: 'pan', label: 'Search: PAN' },
            { value: 'mobile', label: 'Search: Mobile' },
            { value: 'email', label: 'Search: Email' },
            { value: 'city', label: 'Search: City' },
          ]}
        />
        <div className="col-span-3">
          <div className="relative">
            <input
              className="h-[34px] w-full rounded-md border border-border-input bg-surface pl-9 pr-3 text-[13px] outline-none focus:border-accent"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          </div>
        </div>
        <Select value={entityType} onChange={(e) => setEntityType(e.target.value)} options={entityOptions} />
        <Select value={professionType} onChange={(e) => setProfessionType(e.target.value)} options={professionOptions} />
        <Select value={location} onChange={(e) => setLocation(e.target.value)} options={locationOptions} />
        {unsupportedCols.has('employment_type') ? null : (
          <Select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} options={employmentTypeFilterOptions} />
        )}
        {unsupportedCols.has('customer_type') ? null : (
          <Select value={customerType} onChange={(e) => setCustomerType(e.target.value)} options={customerTypeFilterOptions} />
        )}
        {unsupportedCols.has('product_offering') ? null : (
          <Select
            value={productOffering}
            onChange={(e) => setProductOffering(e.target.value)}
            options={productOfferingFilterOptions}
          />
        )}
      </div>

      <Table
        columns={columns}
        data={customers}
        loading={loading}
        emptyIcon={Users}
        onRowClick={(row) => navigate(`/customers/${row.id}`)}
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
        open={messageOpen}
        onClose={() => setMessageOpen(false)}
        title={messageTarget?.name ? `Message: ${messageTarget.name}` : 'Message'}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setMessageOpen(false)
                setMessageTarget(null)
              }}
            >
              Close
            </Button>
            <Button variant="secondary" onClick={() => copyToClipboard(messageDraft)}>
              Copy
            </Button>
            <Button
              disabled={!getWhatsappTarget(messageTarget?.primary_mobile)}
              onClick={() => {
                const waTarget = getWhatsappTarget(messageTarget?.primary_mobile)
                if (!waTarget) return
                openWhatsappWindow(waTarget, messageDraft)
                setMessageOpen(false)
                setMessageTarget(null)
              }}
            >
              Open WhatsApp
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="text-[12px] text-text-secondary">
            {messageTarget?.primary_mobile ? `To: ${messageTarget.primary_mobile}` : 'No mobile number'}
          </div>
          <div className="text-[12px] text-text-muted">Use {'{name}'} placeholder in template.</div>
          <Textarea label="Message" rows={8} value={messageDraft} onChange={(e) => setMessageDraft(e.target.value)} />
        </div>
      </Drawer>

      <Drawer
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title={String(messageTemplate || '').trim() ? 'Edit WhatsApp Template' : 'Add WhatsApp Template'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTemplateOpen(false)}>
              Close
            </Button>
            <Button
              onClick={async () => {
                try {
                  await saveMessageTemplate(templateDraft)
                  toast.success(String(templateDraft || '').trim() ? 'Template saved' : 'Template cleared')
                  setTemplateOpen(false)
                } catch {
                  toast.error('Failed to save template')
                }
              }}
            >
              Save Template
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="text-[12px] text-text-secondary">If no template is saved, message will open blank.</div>
          <div className="text-[12px] text-text-muted">Use {'{name}'} placeholder for customer name.</div>
          <Textarea label="Template" rows={10} value={templateDraft} onChange={(e) => setTemplateDraft(e.target.value)} />
        </div>
      </Drawer>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Customer' : 'Add Customer'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(upsertCustomer)} disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Submit'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Input label="Customer Name" error={errors.name?.message} {...register('name', { required: 'Name is required' })} />
          <Select
            label="Entity Type"
            options={[
              { value: 'Individual', label: 'Individual' },
              { value: 'Proprietorship', label: 'Proprietorship' },
              { value: 'LLP', label: 'LLP' },
              { value: 'Pvt Ltd', label: 'Pvt Ltd' },
              { value: 'Partnership', label: 'Partnership' },
            ]}
            {...register('entity_type')}
          />
        </div>

        <Divider title="Identity" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="PAN Number" {...register('pan_number')} />
          <Input label="Aadhaar Number" {...register('aadhaar_number')} />
          <Input label="CIN" {...register('cin')} />
          <Input label="Nationality" {...register('nationality')} />
          <Input label="Date of Birth" type="date" {...register('date_of_birth')} />
          <Input label="Incorporation Date" type="date" {...register('incorporation_date')} />
        </div>

        <Divider title="Contact" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Primary Mobile" {...register('primary_mobile')} />
          <Input label="Alternate Mobile" {...register('alternate_mobile')} />
          <Input label="Email" type="email" {...register('email')} />
          <Input label="Office Phone" {...register('office_phone')} />
          <Input label="PA Contact" {...register('pa_contact')} />
        </div>

        <Divider title="Address" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="City" {...register('city')} />
          <Input label="State" {...register('state')} />
          <Input label="PIN Code" {...register('pin_code')} />
          <Input label="Country" {...register('country')} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Textarea label="Residential Address" rows={3} {...register('residential_address')} />
          <Textarea label="Office Address" rows={3} {...register('office_address')} />
        </div>

        <Divider title="Business" />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Profession Type"
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
          <Select label="Employment Type" options={employmentTypeOptions} {...register('employment_type')} />
          {unsupportedCols.has('customer_type') ? null : (
            <Select label="Customer Type" options={customerTypeOptions} {...register('customer_type')} />
          )}
          {unsupportedCols.has('product_offering') ? null : (
            <Select label="Product Offering" options={productOfferingOptions} {...register('product_offering')} />
          )}
          <Input label="Nature of Business" {...register('nature_of_business')} />
          <Input label="Industry Category" {...register('industry_category')} />
          <Input label="Company Name" {...register('business_name')} />
          <Input label="Business Vintage (years)" type="number" step="1" min="0" {...register('business_vintage_years')} />
          <Input label="Employer Name" {...register('employer_name')} />
          <Input label="Designation" {...register('designation')} />
          <Select
            label="Company Type"
            options={[
              { value: 'MNC', label: 'MNC' },
              { value: 'SME', label: 'SME' },
              { value: 'Government', label: 'Government' },
              { value: 'Other', label: 'Other' },
            ]}
            {...register('company_type')}
          />
          <Input label="Number of Employees" type="number" step="1" min="0" {...register('number_of_employees')} />
          <Input label="GST Number" {...register('gst_number')} />
          <Input label="Annual Turnover" type="number" step="1" min="0" {...register('annual_turnover')} />
          <Input label="Net Profit" type="number" step="1" {...register('net_profit')} />
          <Input label="Monthly Income" type="number" step="1" min="0" {...register('monthly_income')} />
          <Input label="Net Worth" type="number" step="1" {...register('net_worth')} />
        </div>

        <Divider title="Credit" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="CIBIL Score" type="number" step="1" min="0" max="900" {...register('cibil_score')} />
          <Input label="Experian Score" type="number" step="1" min="0" max="999" {...register('experian_score')} />
          <Input label="Equifax Score" type="number" step="1" min="0" max="900" {...register('equifax_score')} />
          <Input label="CRIF Score" type="number" step="1" min="0" max="900" {...register('crif_score')} />
          <Input label="Credit Card Outstanding" type="number" step="1" {...register('credit_card_outstanding')} />
          <Input label="Existing EMI Outflow" type="number" step="1" {...register('existing_emi_outflow')} />
          <Input label="Total Loan Exposure" type="number" step="1" {...register('total_loan_exposure')} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Textarea label="DPD History" rows={3} {...register('dpd_history')} />
          <Textarea label="Write-off / Settlement History" rows={3} {...register('writeoff_settlement_history')} />
        </div>

        <Divider title="Banking" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Primary Bank" {...register('primary_bank')} />
          <Input label="Current Account Bank" {...register('current_account_bank')} />
          <Input label="Savings Bank" {...register('savings_bank')} />
          <Input label="OD/CC Bank" {...register('od_cc_bank')} />
          <Input label="Banking Vintage (years)" type="number" step="1" min="0" {...register('banking_vintage_years')} />
          <Input label="Avg Monthly Balance" type="number" step="1" min="0" {...register('avg_monthly_balance')} />
          <Input label="Monthly Banking Turnover" type="number" step="1" min="0" {...register('monthly_banking_turnover')} />
        </div>
        <div className="mt-3">
          <Textarea label="Cheque Bounce History" rows={3} {...register('cheque_bounce_history')} />
        </div>

        <Divider title="Relationship" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Last Interaction Date" type="date" {...register('last_interaction_date')} />
          <Input label="Next Follow-up Date" type="date" {...register('next_followup_date')} />
        </div>
        <div className="mt-3">
          <Textarea label="Remarks" rows={3} {...register('relationship_notes')} />
        </div>

        <Divider title="Cross-Sell" />
        <div className="grid grid-cols-2 gap-3">
          <Toggle
            label="Balance Transfer Opportunity"
            checked={opp.balance_transfer_opportunity}
            onChange={(v) => setValue('balance_transfer_opportunity', v)}
          />
          <Toggle
            label="Top-up Loan Eligibility"
            checked={opp.topup_loan_eligibility}
            onChange={(v) => setValue('topup_loan_eligibility', v)}
          />
          <Toggle
            label="Insurance Opportunity"
            checked={opp.insurance_opportunity}
            onChange={(v) => setValue('insurance_opportunity', v)}
          />
          <Toggle label="Credit Card Offer" checked={opp.credit_card_offer} onChange={(v) => setValue('credit_card_offer', v)} />
        </div>
      </Drawer>

      <Drawer
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Customers (CSV)"
        footer={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(false)} disabled={importing}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={() => setImportTemplateOpen(true)} disabled={importing}>
              Download Template
            </Button>
            <Button onClick={runImport} disabled={importing || !importPreview.length || importErrors.length > 0}>
              {importing ? 'Importing…' : 'Import'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <div className="mb-1 text-[12px] font-medium text-text-secondary">CSV File</div>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => onPickImportFile(e.target.files?.[0])}
              className="block w-full text-[13px]"
            />
            {importFileName ? <div className="mt-1 text-[12px] text-text-muted">{importFileName}</div> : null}
          </div>

          {importErrors.length ? (
            <div className="rounded-md border border-border-divider bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
              {importErrors.slice(0, 8).map((err) => (
                <div key={err}>{err}</div>
              ))}
              {importErrors.length > 8 ? <div>+{importErrors.length - 8} more…</div> : null}
            </div>
          ) : null}

          <Divider title="Preview" />
          <div className="text-[12px] text-text-secondary">{importPreview.length ? `${importPreview.length} rows ready` : 'No rows loaded'}</div>
          {importPreview.length ? (
            <div className="max-h-[320px] overflow-auto rounded-md border border-border-divider">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-[#F5F5F3] text-text-secondary">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Entity</th>
                    <th className="px-3 py-2">Profession</th>
                    <th className="px-3 py-2">Mobile</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">City</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.slice(0, 50).map((r, idx) => (
                    <tr key={`${r.name}-${idx}`} className="border-t border-border-divider">
                      <td className="px-3 py-2">{r.name || '—'}</td>
                      <td className="px-3 py-2">{r.entity_type || '—'}</td>
                      <td className="px-3 py-2">{r.profession_type || '—'}</td>
                      <td className="px-3 py-2">{r.primary_mobile || '—'}</td>
                      <td className="px-3 py-2">{r.email || '—'}</td>
                      <td className="px-3 py-2">{r.city || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {importPreview.length > 50 ? <div className="text-[12px] text-text-muted">Showing first 50 rows</div> : null}
        </div>
      </Drawer>

      <Modal open={importTemplateOpen} onClose={() => setImportTemplateOpen(false)} title="Download Template">
        <div className="space-y-3 text-[13px] text-text-secondary">
          <div>For these fields, use only the allowed values (same as Google Sheet dropdowns):</div>
          <div className="rounded-md border border-border-divider bg-[#F5F5F3] px-3 py-2 text-[12px] text-text-secondary">
            <div>
              <span className="font-medium">entity_type:</span> Individual, Proprietorship, LLP, Pvt Ltd, Partnership
            </div>
            <div>
              <span className="font-medium">profession_type:</span> Doctor, CA, Business Owner, Salaried, Self Employed, Other
            </div>
            <div>
              <span className="font-medium">employment_type:</span> SEP, SENP, Sal
            </div>
            <div>
              <span className="font-medium">product_offering:</span> BL, HL, ODCC, PL, LAP, LRD
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                downloadImportTemplateCsv()
                setImportTemplateOpen(false)
              }}
            >
              Download CSV
            </Button>
            <Button
              onClick={() => {
                downloadImportTemplateSheet()
                setImportTemplateOpen(false)
              }}
            >
              Open Google Sheet
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete customer?"
        description={deleteTarget ? `This will permanently delete ${deleteTarget.name}.` : ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          const id = deleteTarget?.id
          if (!id) return
          try {
            await deleteCustomerCascade(id)
            toast.success('Customer deleted')
            setDeleteTarget(null)
            await loadCustomers()
          } catch (e) {
            toast.error(e?.message || 'Failed to delete customer')
          }
        }}
      />
    </div>
  )
}
