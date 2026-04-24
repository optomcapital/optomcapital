import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { BarChart2 } from 'lucide-react'
import { Button, Card, Select } from '../../components/ui/index.jsx'
import { supabase } from '../../lib/supabase.js'
import { downloadCsv, formatINR } from '../../lib/utils.js'

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

function monthKey(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key) {
  const [y, m] = key.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleString('en-IN', { month: 'short', year: '2-digit' })
}

function rangeFromPreset(preset) {
  const now = new Date()
  if (preset === 'month') {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
    }
  }
  if (preset === 'quarter') {
    const q = Math.floor(now.getMonth() / 3)
    const startMonth = q * 3
    return {
      start: new Date(now.getFullYear(), startMonth, 1).toISOString().slice(0, 10),
      end: new Date(now.getFullYear(), startMonth + 3, 0).toISOString().slice(0, 10),
    }
  }
  return { start: '', end: '' }
}

export default function ReportsPage() {
  const [preset, setPreset] = useState('month')
  const initial = rangeFromPreset('month')
  const [startDate, setStartDate] = useState(initial.start)
  const [endDate, setEndDate] = useState(initial.end)
  const [loading, setLoading] = useState(true)

  const [leadStageCounts, setLeadStageCounts] = useState([])
  const [disbRows, setDisbRows] = useState([])
  const [summary, setSummary] = useState({ totalLeads: 0, totalDisbursed: 0, gross: 0, net: 0 })
  const [bankPerfRows, setBankPerfRows] = useState([])
  const [partnerPerfRows, setPartnerPerfRows] = useState([])

  useEffect(() => {
    const next = rangeFromPreset(preset)
    setStartDate(next.start)
    setEndDate(next.end)
  }, [preset])

  const load = useCallback(async () => {
    if (!startDate || !endDate) return
    setLoading(true)
    try {
      const [leadsRes, disbRes, bankRes] = await Promise.all([
        supabase
          .from('leads')
          .select('stage, referral_partner_name')
          .gte('lead_creation_date', startDate)
          .lte('lead_creation_date', endDate)
          .range(0, 9999),
        supabase
          .from('disbursements')
          .select('final_disbursed_amount, gross_revenue, net_revenue, disbursement_date')
          .gte('disbursement_date', startDate)
          .lte('disbursement_date', endDate)
          .range(0, 9999),
        supabase
          .from('bank_applications')
          .select('bank_name, sanction_amount, interest_rate, underwriting_status, login_date')
          .gte('login_date', startDate)
          .lte('login_date', endDate)
          .range(0, 9999),
      ])

      if (leadsRes.error) throw leadsRes.error
      if (disbRes.error) throw disbRes.error
      if (bankRes.error) throw bankRes.error

      const leads = leadsRes.data || []
      const disb = disbRes.data || []
      const banks = bankRes.data || []

      const stageAgg = new Map(stages.map((s) => [s, 0]))
      const partnerAgg = new Map()
      leads.forEach((l) => {
        const s = l.stage || 'Lead Generated'
        stageAgg.set(s, (stageAgg.get(s) || 0) + 1)
        const p = l.referral_partner_name || '—'
        partnerAgg.set(p, (partnerAgg.get(p) || 0) + 1)
      })
      const stageCounts = Array.from(stageAgg.entries())
        .filter(([, c]) => c > 0)
        .map(([stage, count]) => ({ stage, count }))
      setLeadStageCounts(stageCounts)

      const totalLeads = leads.length
      const totalDisbursed = disb.reduce((s, r) => s + Number(r.final_disbursed_amount || 0), 0)
      const gross = disb.reduce((s, r) => s + Number(r.gross_revenue || 0), 0)
      const net = disb.reduce((s, r) => s + Number(r.net_revenue || 0), 0)
      setSummary({ totalLeads, totalDisbursed, gross, net })
      setDisbRows(disb)

      setPartnerPerfRows(
        Array.from(partnerAgg.entries())
          .map(([partner, count]) => ({ partner, leads: count }))
          .sort((a, b) => b.leads - a.leads)
          .slice(0, 10),
      )

      const bankAgg = new Map()
      banks.forEach((b) => {
        const key = b.bank_name || '—'
        if (!bankAgg.has(key)) {
          bankAgg.set(key, {
            bank: key,
            applications: 0,
            sanctioned: 0,
            declined: 0,
            totalSanction: 0,
            avgRateSum: 0,
            avgRateCount: 0,
          })
        }
        const row = bankAgg.get(key)
        row.applications += 1
        row.totalSanction += Number(b.sanction_amount || 0)
        const r = Number(b.interest_rate)
        if (Number.isFinite(r)) {
          row.avgRateSum += r
          row.avgRateCount += 1
        }
        if (b.underwriting_status === 'Approved') row.sanctioned += 1
        if (b.underwriting_status === 'Declined') row.declined += 1
      })

      setBankPerfRows(
        Array.from(bankAgg.values())
          .map((r) => ({
            bank: r.bank,
            applications: r.applications,
            sanctioned: r.sanctioned,
            declined: r.declined,
            totalSanction: r.totalSanction,
            avgRate: r.avgRateCount ? r.avgRateSum / r.avgRateCount : null,
          }))
          .sort((a, b) => b.applications - a.applications),
      )
    } catch (e) {
      toast.error(e?.message || 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [endDate, startDate])

  useEffect(() => {
    load()
  }, [load])

  const totals = useMemo(() => summary, [summary])

  const netByMonth = useMemo(() => {
    const agg = new Map()
    disbRows.forEach((r) => {
      if (!r.disbursement_date) return
      const k = monthKey(r.disbursement_date)
      agg.set(k, (agg.get(k) || 0) + Number(r.net_revenue || 0))
    })
    const keys = Array.from(agg.keys()).sort()
    return keys.map((k) => ({ month: monthLabel(k), net: agg.get(k) }))
  }, [disbRows])

  const funnel = useMemo(() => {
    const agg = new Map(stages.map((s) => [s, 0]))
    leadStageCounts.forEach((r) => {
      const s = r.stage || 'Lead Generated'
      agg.set(s, (agg.get(s) || 0) + Number(r.count || 0))
    })
    const total = totals.totalLeads || 1
    return stages.map((s) => ({ stage: s, count: agg.get(s) || 0, pct: Math.round(((agg.get(s) || 0) / total) * 100) }))
  }, [leadStageCounts, totals.totalLeads])

  const bankPerf = useMemo(() => bankPerfRows, [bankPerfRows])

  const partnerPerf = useMemo(() => partnerPerfRows, [partnerPerfRows])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[18px] font-semibold">Reports</div>
          <div className="text-[13px] text-text-secondary">Revenue, funnel, and performance</div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            options={[
              { value: 'month', label: 'This Month' },
              { value: 'quarter', label: 'This Quarter' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
          {preset === 'custom' ? (
            <div className="flex items-center gap-2">
              <input
                className="h-[34px] rounded-md border border-border-input bg-surface px-3 text-[13px] outline-none focus:border-accent"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <input
                className="h-[34px] rounded-md border border-border-input bg-surface px-3 text-[13px] outline-none focus:border-accent"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          ) : null}
        </div>
      </div>

      <Card
        title="Revenue Report"
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              downloadCsv('revenue_report.csv', [
                ['Metric', 'Value'],
                ['Total Leads', totals.totalLeads],
                ['Total Disbursed Amount', totals.totalDisbursed],
                ['Gross Revenue', totals.gross],
                ['Net Revenue', totals.net],
              ])
            }}
          >
            Export CSV
          </Button>
        }
      >
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-md border border-border-divider bg-bg p-3">
            <div className="text-[12px] text-text-secondary">Total Leads</div>
            <div className="mt-2 text-[16px] font-semibold">{loading ? '—' : totals.totalLeads}</div>
          </div>
          <div className="rounded-md border border-border-divider bg-bg p-3">
            <div className="text-[12px] text-text-secondary">Total Disbursed</div>
            <div className="mt-2 text-[16px] font-semibold">{loading ? '—' : formatINR(totals.totalDisbursed)}</div>
          </div>
          <div className="rounded-md border border-border-divider bg-bg p-3">
            <div className="text-[12px] text-text-secondary">Gross Revenue</div>
            <div className="mt-2 text-[16px] font-semibold">{loading ? '—' : formatINR(totals.gross)}</div>
          </div>
          <div className="rounded-md border border-border-divider bg-bg p-3">
            <div className="text-[12px] text-text-secondary">Net Revenue</div>
            <div className="mt-2 text-[16px] font-semibold">{loading ? '—' : formatINR(totals.net)}</div>
          </div>
        </div>

        <div className="mt-4 h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={netByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${Math.round(v / 1000)}K`} />
              <Tooltip formatter={(v) => formatINR(v)} />
              <Bar dataKey="net" fill="#2F6FED" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card
          title="Lead Funnel"
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                downloadCsv('lead_funnel.csv', [['Stage', 'Count', 'Percent'], ...funnel.map((r) => [r.stage, r.count, r.pct])])
              }}
            >
              Export CSV
            </Button>
          }
        >
          <div className="space-y-2">
            {funnel.map((r) => (
              <div key={r.stage} className="flex items-center justify-between text-[13px]">
                <div className="text-text-secondary">{r.stage}</div>
                <div className="flex items-center gap-2">
                  <div className="text-text-muted">{r.pct}%</div>
                  <div className="font-medium">{r.count}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Top Referral Partners"
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                downloadCsv('top_referral_partners.csv', [['Partner', 'Leads'], ...partnerPerf.map((r) => [r.partner, r.leads])])
              }}
            >
              Export CSV
            </Button>
          }
        >
          <div className="space-y-2">
            {partnerPerf.map((r) => (
              <div key={r.partner} className="flex items-center justify-between text-[13px]">
                <div className="text-text-secondary">{r.partner}</div>
                <div className="font-medium">{r.leads}</div>
              </div>
            ))}
            {!loading && partnerPerf.length === 0 ? <div className="text-[13px] text-text-muted">—</div> : null}
          </div>
        </Card>
      </div>

      <Card
        title="Bank Performance"
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              downloadCsv('bank_performance.csv', [
                ['Bank', 'Applications', 'Sanctioned', 'Declined', 'Total Sanctioned Amount', 'Avg Interest Rate'],
                ...bankPerf.map((r) => [r.bank, r.applications, r.sanctioned, r.declined, r.totalSanction, r.avgRate ?? '']),
              ])
            }}
          >
            Export CSV
          </Button>
        }
      >
        <div className="overflow-auto">
          <table className="min-w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border-divider text-text-secondary">
                <th className="px-3 py-2 font-semibold">Bank</th>
                <th className="px-3 py-2 font-semibold">Applications</th>
                <th className="px-3 py-2 font-semibold">Sanctioned</th>
                <th className="px-3 py-2 font-semibold">Declined</th>
                <th className="px-3 py-2 font-semibold">Total Sanction</th>
                <th className="px-3 py-2 font-semibold">Avg Rate</th>
              </tr>
            </thead>
            <tbody>
              {bankPerf.map((r) => (
                <tr key={r.bank} className="border-b border-border-divider last:border-b-0 hover:bg-[#F5F5F3]">
                  <td className="px-3 py-2 font-medium">{r.bank}</td>
                  <td className="px-3 py-2">{r.applications}</td>
                  <td className="px-3 py-2">{r.sanctioned}</td>
                  <td className="px-3 py-2">{r.declined}</td>
                  <td className="px-3 py-2">{formatINR(r.totalSanction)}</td>
                  <td className="px-3 py-2">{r.avgRate ? `${r.avgRate.toFixed(2)}%` : '—'}</td>
                </tr>
              ))}
              {!loading && bankPerf.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-text-muted">
                    No records
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-center gap-2 text-[12px] text-text-muted">
          <BarChart2 size={14} />
          <span>Use the filters above to generate reports for any time period.</span>
        </div>
      </Card>
    </div>
  )
}
