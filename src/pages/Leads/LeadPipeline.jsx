import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd'
import { Kanban } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, Input, Select } from '../../components/ui/index.jsx'
import { supabase } from '../../lib/supabase.js'
import { formatINR, getStageColor } from '../../lib/utils.js'

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
  '',
  'Personal Loan',
  'Business Loan',
  'Loan Against Property',
  'Working Capital',
  'Overdraft / CC',
  'Equipment Finance',
]

export default function LeadPipeline() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stageCounts, setStageCounts] = useState(() => Object.fromEntries(stages.map((s) => [s, 0])))
  const [stageLeads, setStageLeads] = useState(() => Object.fromEntries(stages.map((s) => [s, []])))
  const [stagePageIndex, setStagePageIndex] = useState(() => Object.fromEntries(stages.map((s) => [s, 0])))
  const [stageLoading, setStageLoading] = useState(() => Object.fromEntries(stages.map((s) => [s, false])))
  const [loanType, setLoanType] = useState('')
  const [salesManager, setSalesManager] = useState('')
  const [urgency, setUrgency] = useState('')

  const PAGE_SIZE = 50

  const buildBaseQuery = useCallback(
    (q) => {
      let query = q
      if (loanType) query = query.eq('loan_type', loanType)
      if (salesManager) query = query.ilike('sales_manager_name', `%${salesManager}%`)
      if (urgency) query = query.eq('urgency_level', urgency)
      return query
    },
    [loanType, salesManager, urgency],
  )

  const buildStageQuery = useCallback(
    ({ stage, table, select, countOnly }) => {
      const base = supabase.from(table).select(select, countOnly ? { count: 'exact', head: true } : undefined)
      let query = buildBaseQuery(base).order('created_at', { ascending: false })
      if (stage === 'Lead Generated') query = query.or('stage.is.null,stage.eq.Lead Generated')
      else query = query.eq('stage', stage)
      return query
    },
    [buildBaseQuery],
  )

  const loadStagePage = useCallback(
    async ({ stage, nextPageIndex, append }) => {
      setStageLoading((prev) => ({ ...prev, [stage]: true }))
      try {
        const from = nextPageIndex * PAGE_SIZE
        const to = from + PAGE_SIZE - 1
        const pageRes = await buildStageQuery({
          stage,
          table: 'leads',
          select: 'id, lead_code, loan_type, required_amount, urgency_level, stage, customer:customers(id, name), sales_manager_name',
          countOnly: false,
        }).range(from, to)
        if (pageRes.error) throw pageRes.error
        const rows = pageRes.data || []
        setStageLeads((prev) => ({ ...prev, [stage]: append ? [...(prev[stage] || []), ...rows] : rows }))
        setStagePageIndex((prev) => ({ ...prev, [stage]: nextPageIndex }))
      } finally {
        setStageLoading((prev) => ({ ...prev, [stage]: false }))
      }
    },
    [buildStageQuery],
  )

  const loadAll = useCallback(async () => {
    setLoading(true)
    setStageLeads(Object.fromEntries(stages.map((s) => [s, []])))
    setStagePageIndex(Object.fromEntries(stages.map((s) => [s, 0])))
    try {
      const countResults = await Promise.all(
        stages.map(async (stage) => {
          const countRes = await buildStageQuery({ stage, table: 'leads', select: 'id', countOnly: true })
          if (countRes.error) throw countRes.error
          return [stage, countRes.count || 0]
        }),
      )
      setStageCounts(Object.fromEntries(countResults))

      await Promise.all(
        stages.map(async (stage) => {
          const total = Object.fromEntries(countResults)[stage] || 0
          if (total === 0) return
          await loadStagePage({ stage, nextPageIndex: 0, append: false })
        }),
      )
    } catch (e) {
      toast.error(e?.message || 'Failed to load pipeline')
    } finally {
      setLoading(false)
    }
  }, [buildStageQuery, loadStagePage])

  useEffect(() => {
    const t = setTimeout(() => loadAll(), 300)
    return () => clearTimeout(t)
  }, [loadAll, loanType, salesManager, urgency])

  async function onDragEnd(result) {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const nextStage = destination.droppableId
    const leadId = draggableId

    const fromStage = source.droppableId
    setStageLeads((prev) => {
      const sourceItems = Array.isArray(prev[fromStage]) ? [...prev[fromStage]] : []
      const destItems = Array.isArray(prev[nextStage]) ? [...prev[nextStage]] : []
      const sourceIndex = sourceItems.findIndex((l) => l.id === leadId)
      if (sourceIndex === -1) return prev
      const [moved] = sourceItems.splice(sourceIndex, 1)
      const nextMoved = { ...moved, stage: nextStage }
      destItems.splice(destination.index, 0, nextMoved)
      return { ...prev, [fromStage]: sourceItems, [nextStage]: destItems }
    })
    if (fromStage !== nextStage) {
      setStageCounts((prev) => ({
        ...prev,
        [fromStage]: Math.max(0, Number(prev[fromStage] || 0) - 1),
        [nextStage]: Number(prev[nextStage] || 0) + 1,
      }))
    }

    const { error } = await supabase.from('leads').update({ stage: nextStage }).eq('id', leadId)
    if (error) {
      toast.error(error.message)
      await loadAll()
      return
    }
    toast.success('Stage updated')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[18px] font-semibold">Pipeline</div>
          <div className="text-[13px] text-text-secondary">Drag leads across stages</div>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={loanType}
            onChange={(e) => setLoanType(e.target.value)}
            options={loanTypes.map((t) => ({ value: t, label: t || 'All Loan Types' }))}
          />
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
          <Input placeholder="Sales manager…" value={salesManager} onChange={(e) => setSalesManager(e.target.value)} />
        </div>
      </div>

      <div className="rounded-panel border border-border-subtle bg-surface shadow-panel p-3">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {stages.map((stage) => {
              const items = stageLeads[stage] || []
              const total = stageCounts[stage] || 0
              const canLoadMore = items.length < total
              return (
                <Droppable key={stage} droppableId={stage}>
                  {(provided) => (
                    <div className="w-[320px] shrink-0" ref={provided.innerRef} {...provided.droppableProps}>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-[13px] font-semibold text-text-primary">{stage}</div>
                        <div className="text-[12px] text-text-muted">
                          {total ? `${items.length}/${total}` : items.length}
                        </div>
                      </div>
                      <div className="h-[calc(100vh-240px)] overflow-y-auto rounded-md border border-border-divider bg-bg p-2">
                        {loading || stageLoading[stage] ? <div className="text-[13px] text-text-muted">Loading…</div> : null}
                        {items.map((l, idx) => (
                          <Draggable key={l.id} draggableId={l.id} index={idx}>
                            {(drag) => (
                              <div
                                ref={drag.innerRef}
                                {...drag.draggableProps}
                                {...drag.dragHandleProps}
                                className="mb-2 cursor-pointer rounded-panel border border-border-divider bg-surface p-3 shadow-panel"
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key !== 'Enter' && e.key !== ' ') return
                                  if (e.target.closest('a')) return
                                  e.preventDefault()
                                  navigate(`/leads/${l.id}`)
                                }}
                                onClick={(e) => {
                                  if (e.target.closest('a')) return
                                  navigate(`/leads/${l.id}`)
                                }}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <Link to={`/leads/${l.id}`} className="text-[13px] font-semibold hover:underline">
                                    {l.lead_code || '—'}
                                  </Link>
                                  <Badge
                                    text={l.urgency_level || 'Medium'}
                                    colorClass={
                                      l.urgency_level === 'High'
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : l.urgency_level === 'Low'
                                          ? 'bg-slate-50 text-slate-700 border-border-divider'
                                          : 'bg-amber-50 text-amber-700 border-amber-200'
                                    }
                                  />
                                </div>
                                {l.customer?.id ? (
                                  <Link
                                    to={`/customers/${l.customer.id}`}
                                    className="mt-1 block text-[12px] text-text-secondary hover:underline"
                                  >
                                    {l.customer?.name || '—'}
                                  </Link>
                                ) : (
                                  <div className="mt-1 text-[12px] text-text-secondary">{l.customer?.name || '—'}</div>
                                )}
                                <div className="mt-2 flex items-center justify-between text-[12px] text-text-secondary">
                                  <span className="inline-flex rounded-full border border-border-divider bg-slate-50 px-2 py-1">
                                    {l.loan_type || '—'}
                                  </span>
                                  <span className="font-medium text-text-primary">{formatINR(l.required_amount)}</span>
                                </div>
                                <div className="mt-2">
                                  <span className={['inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium', getStageColor(stage)].join(' ')}>
                                    {stage}
                                  </span>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {!loading && items.length === 0 ? (
                          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-[12px] text-text-muted">
                            <Kanban size={16} />
                            <div>No leads</div>
                          </div>
                        ) : null}
                        {!loading && canLoadMore ? (
                          <button
                            type="button"
                            className="mt-2 w-full rounded-md border border-border-divider bg-surface px-3 py-2 text-[12px] text-text-secondary hover:bg-[#F5F5F3]"
                            onClick={() => loadStagePage({ stage, nextPageIndex: (stagePageIndex[stage] || 0) + 1, append: true })}
                            disabled={stageLoading[stage]}
                          >
                            Load more
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </Droppable>
              )
            })}
          </div>
        </DragDropContext>
      </div>
    </div>
  )
}
