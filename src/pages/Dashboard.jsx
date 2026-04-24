import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase.js'
import { formatDate, formatINR, getStageColor, truncateText } from '../lib/utils.js'
import { Card, StatCard } from '../components/ui/index.jsx'

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
  return d.toLocaleString('en-IN', { month: 'short' })
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalLeads: 0,
    activeCases: 0,
    sanctioned: 0,
    disbursed: 0,
    conversionRatio: 0,
    averageTicketSize: 0,
    monthlyRevenue: 0,
  })
  const [monthlyDisbursed, setMonthlyDisbursed] = useState([])
  const [stageDistribution, setStageDistribution] = useState([])
  const [topBanks, setTopBanks] = useState([])
  const [topPartners, setTopPartners] = useState([])
  const [recentLeads, setRecentLeads] = useState([])

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      try {
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        const sixMonthStart = new Date(now.getFullYear(), now.getMonth() - 5, 1)
        const twelveMonthStart = new Date(now.getFullYear(), now.getMonth() - 11, 1)

        const [
          totalLeadsRes,
          activeCasesRes,
          sanctionedRes,
          disbursedRes,
          recentLeadsRes,
        ] = await Promise.all([
          supabase.from('leads').select('id', { count: 'exact', head: true }),
          supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .not('stage', 'in', '("Disbursed","Declined")'),
          supabase.from('leads').select('id', { count: 'exact', head: true }).eq('stage', 'Sanction Approved'),
          supabase.from('leads').select('id', { count: 'exact', head: true }).eq('stage', 'Disbursed'),
          supabase
            .from('leads')
            .select(
              'id, lead_code, loan_type, required_amount, stage, lead_creation_date, customer:customers(id, name)',
            )
            .order('created_at', { ascending: false })
            .limit(10),
        ])

        if (!active) return

        const totalLeads = totalLeadsRes.count || 0
        const disbursedLeads = disbursedRes.count || 0
        const conversionRatio = totalLeads > 0 ? (disbursedLeads / totalLeads) * 100 : 0

        const monthRevenueRes = await supabase
          .from('disbursements')
          .select('net_revenue')
          .gte('disbursement_date', monthStart.toISOString().slice(0, 10))
          .lte('disbursement_date', monthEnd.toISOString().slice(0, 10))
          .range(0, 9999)
        if (monthRevenueRes.error) throw monthRevenueRes.error
        const monthlyRevenue = (monthRevenueRes.data || []).reduce((s, r) => s + Number(r.net_revenue || 0), 0)

        const disbCountRes = await supabase
          .from('disbursements')
          .select('id', { count: 'exact', head: true })
          .gte('disbursement_date', twelveMonthStart.toISOString().slice(0, 10))
          .lte('disbursement_date', monthEnd.toISOString().slice(0, 10))
          .not('final_disbursed_amount', 'is', null)
        if (disbCountRes.error) throw disbCountRes.error
        const disbCount = disbCountRes.count || 0
        const disbPageSize = 1000
        const disbMax = Math.min(disbCount, 20000)
        let totalDisbursedAmount = 0
        let disbursementCount = 0
        for (let from = 0; from < disbMax; from += disbPageSize) {
          const to = Math.min(from + disbPageSize - 1, disbMax - 1)
          const { data, error } = await supabase
            .from('disbursements')
            .select('final_disbursed_amount')
            .gte('disbursement_date', twelveMonthStart.toISOString().slice(0, 10))
            .lte('disbursement_date', monthEnd.toISOString().slice(0, 10))
            .not('final_disbursed_amount', 'is', null)
            .order('disbursement_date', { ascending: false })
            .range(from, to)
          if (error) throw error
          ;(data || []).forEach((r) => {
            const v = Number(r.final_disbursed_amount)
            if (!Number.isFinite(v)) return
            totalDisbursedAmount += v
            disbursementCount += 1
          })
        }
        const averageTicketSize = disbursementCount > 0 ? totalDisbursedAmount / disbursementCount : 0

        const disbAgg = new Map()
        const disbAllRes = await supabase
          .from('disbursements')
          .select('final_disbursed_amount, disbursement_date')
          .gte('disbursement_date', sixMonthStart.toISOString().slice(0, 10))
          .lte('disbursement_date', monthEnd.toISOString().slice(0, 10))
          .range(0, 9999)
        if (disbAllRes.error) throw disbAllRes.error
        ;(disbAllRes.data || []).forEach((r) => {
          if (!r.disbursement_date) return
          const key = monthKey(r.disbursement_date)
          disbAgg.set(key, (disbAgg.get(key) || 0) + Number(r.final_disbursed_amount || 0))
        })

        const months = []
        for (let i = 5; i >= 0; i -= 1) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          months.push(monthKey(d))
        }

        setMonthlyDisbursed(
          months.map((k) => ({
            month: monthLabel(k),
            amount: disbAgg.get(k) || 0,
          })),
        )

        const stageCounts = await Promise.all(
          stages.map(async (s) => {
            const { count, error } = await supabase.from('leads').select('id', { count: 'exact', head: true }).eq('stage', s)
            if (error) throw error
            return { stage: s, count: count || 0 }
          }),
        )
        setStageDistribution(
          stageCounts
            .filter((r) => r.count > 0)
            .map((r) => ({
              name: r.stage,
              value: r.count,
            })),
        )

        const bankCountRes = await supabase
          .from('bank_applications')
          .select('id', { count: 'exact', head: true })
          .gte('login_date', twelveMonthStart.toISOString().slice(0, 10))
          .lte('login_date', monthEnd.toISOString().slice(0, 10))
        if (bankCountRes.error) throw bankCountRes.error
        const bankCount = bankCountRes.count || 0
        const bankPageSize = 1000
        const bankMax = Math.min(bankCount, 20000)
        const bankAgg = new Map()
        for (let from = 0; from < bankMax; from += bankPageSize) {
          const to = Math.min(from + bankPageSize - 1, bankMax - 1)
          const { data, error } = await supabase
            .from('bank_applications')
            .select('bank_name, sanction_amount')
            .gte('login_date', twelveMonthStart.toISOString().slice(0, 10))
            .lte('login_date', monthEnd.toISOString().slice(0, 10))
            .order('login_date', { ascending: false })
            .range(from, to)
          if (error) throw error
          ;(data || []).forEach((r) => {
            const k = r.bank_name || '—'
            bankAgg.set(k, (bankAgg.get(k) || 0) + Number(r.sanction_amount || 0))
          })
        }
        setTopBanks(
          Array.from(bankAgg.entries())
            .map(([bankName, sanctionAmount]) => ({ bankName, sanctionAmount }))
            .sort((a, b) => b.sanctionAmount - a.sanctionAmount)
            .slice(0, 5),
        )

        const partnerCountRes = await supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .gte('lead_creation_date', twelveMonthStart.toISOString().slice(0, 10))
          .lte('lead_creation_date', monthEnd.toISOString().slice(0, 10))
        if (partnerCountRes.error) throw partnerCountRes.error
        const partnerCount = partnerCountRes.count || 0
        const partnerPageSize = 1000
        const partnerMax = Math.min(partnerCount, 20000)
        const partnerAgg = new Map()
        for (let from = 0; from < partnerMax; from += partnerPageSize) {
          const to = Math.min(from + partnerPageSize - 1, partnerMax - 1)
          const { data, error } = await supabase
            .from('leads')
            .select('referral_partner_name')
            .gte('lead_creation_date', twelveMonthStart.toISOString().slice(0, 10))
            .lte('lead_creation_date', monthEnd.toISOString().slice(0, 10))
            .order('created_at', { ascending: false })
            .range(from, to)
          if (error) throw error
          ;(data || []).forEach((r) => {
            const k = r.referral_partner_name || '—'
            partnerAgg.set(k, (partnerAgg.get(k) || 0) + 1)
          })
        }
        setTopPartners(
          Array.from(partnerAgg.entries())
            .map(([partnerName, leads]) => ({ partnerName, leads }))
            .sort((a, b) => b.leads - a.leads)
            .slice(0, 5),
        )

        setRecentLeads(recentLeadsRes.data || [])

        setStats({
          totalLeads,
          activeCases: activeCasesRes.count || 0,
          sanctioned: sanctionedRes.count || 0,
          disbursed: disbursedLeads,
          conversionRatio,
          averageTicketSize,
          monthlyRevenue,
        })
      } catch (e) {
        toast.error(e?.message || 'Failed to load dashboard')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const stageColors = useMemo(() => {
    const palette = ['#2F6FED', '#30A46C', '#F76B15', '#8B5CF6', '#0EA5E9', '#E5484D', '#64748B']
    return (stageDistribution || []).reduce((acc, item, idx) => {
      acc[item.name] = palette[idx % palette.length]
      return acc
    }, {})
  }, [stageDistribution])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-7 gap-4">
        <StatCard label="Total Leads" value={loading ? '—' : stats.totalLeads} hint="All time" />
        <StatCard label="Active Cases" value={loading ? '—' : stats.activeCases} hint="Not disbursed/declined" />
        <StatCard label="Sanctioned Cases" value={loading ? '—' : stats.sanctioned} hint="Stage = Sanction Approved" />
        <StatCard label="Disbursed Cases" value={loading ? '—' : stats.disbursed} hint="Stage = Disbursed" />
        <StatCard
          label="Conversion Ratio"
          value={loading ? '—' : `${stats.conversionRatio.toFixed(1)}%`}
          hint="Disbursed / Total"
        />
        <StatCard
          label="Average Ticket Size"
          value={loading ? '—' : formatINR(stats.averageTicketSize)}
          hint="Avg final disbursed (12M)"
        />
        <StatCard label="Monthly Revenue" value={loading ? '—' : formatINR(stats.monthlyRevenue)} hint="Net revenue (MTD)" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card title="Monthly Disbursed Amount (Last 6 Months)">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyDisbursed}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${Math.round(v / 100000)}L`} />
                <Tooltip formatter={(v) => formatINR(v)} />
                <Bar dataKey="amount" fill="#2F6FED" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Lead Stage Distribution">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip />
                <Pie data={stageDistribution} dataKey="value" nameKey="name" outerRadius={90}>
                  {stageDistribution.map((entry) => (
                    <Cell key={entry.name} fill={stageColors[entry.name]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {stageDistribution.slice(0, 6).map((s) => (
              <div key={s.name} className="flex items-center gap-2 text-[12px] text-text-secondary">
                <div className="h-2 w-2 rounded-full" style={{ background: stageColors[s.name] }} />
                <div className="truncate">{truncateText(s.name, 18)}</div>
                <div className="text-text-muted">{s.value}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card title="Top Performing Banks">
          <div className="space-y-2">
            {topBanks.map((b) => (
              <div key={b.bankName} className="flex items-center justify-between text-[13px]">
                <div className="text-text-secondary">{b.bankName}</div>
                <div className="font-medium">{formatINR(b.sanctionAmount)}</div>
              </div>
            ))}
            {!loading && topBanks.length === 0 ? <div className="text-[13px] text-text-muted">—</div> : null}
          </div>
        </Card>

        <Card title="Top Referral Partners">
          <div className="space-y-2">
            {topPartners.map((p) => (
              <div key={p.partnerName} className="flex items-center justify-between text-[13px]">
                <div className="text-text-secondary">{p.partnerName}</div>
                <div className="font-medium">{p.leads}</div>
              </div>
            ))}
            {!loading && topPartners.length === 0 ? <div className="text-[13px] text-text-muted">—</div> : null}
          </div>
        </Card>
      </div>

      <Card title="Recent Leads">
        <div className="overflow-auto">
          <table className="min-w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border-divider text-text-secondary">
                <th className="px-3 py-2 font-semibold">Lead ID</th>
                <th className="px-3 py-2 font-semibold">Customer</th>
                <th className="px-3 py-2 font-semibold">Loan Type</th>
                <th className="px-3 py-2 font-semibold">Amount</th>
                <th className="px-3 py-2 font-semibold">Stage</th>
                <th className="px-3 py-2 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-text-muted">
                    Loading…
                  </td>
                </tr>
              ) : recentLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-text-muted">
                    No recent leads
                  </td>
                </tr>
              ) : (
                recentLeads.map((l) => (
                  <tr key={l.id} className="border-b border-border-divider last:border-b-0 hover:bg-[#F5F5F3]">
                    <td className="px-3 py-2 font-medium">{l.lead_code || '—'}</td>
                    <td className="px-3 py-2">{l.customer?.name || '—'}</td>
                    <td className="px-3 py-2">{l.loan_type || '—'}</td>
                    <td className="px-3 py-2">{formatINR(l.required_amount)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={[
                          'inline-flex items-center rounded-full border px-2 py-1 text-[12px] font-medium',
                          getStageColor(l.stage),
                        ].join(' ')}
                      >
                        {l.stage}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{formatDate(l.lead_creation_date)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
