import { createColumnHelper } from '@tanstack/react-table'
import { AlertTriangle, Plus, RadioTower, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Badge, Button, ConfirmDialog, Drawer, Input, Select, Table } from '../../components/ui/index.jsx'
import {
  createUptimeMonitor,
  deleteIssue,
  deleteUptimeMonitor,
  ignoreIssue,
  listIssues,
  listUptimeMonitors,
  reopenIssue,
  resolveIssue,
} from '../../lib/monitoring.js'
import { formatDate } from '../../lib/utils.js'

const columnHelper = createColumnHelper()

const issueStatusFilters = [
  { value: 'is:unresolved', label: 'Unresolved' },
  { value: 'is:resolved', label: 'Resolved' },
  { value: 'is:ignored', label: 'Ignored' },
  { value: '', label: 'All' },
]

const levelColors = {
  fatal: 'bg-rose-50 text-rose-700 border-rose-200',
  error: 'bg-rose-50 text-rose-700 border-rose-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  debug: 'bg-slate-50 text-slate-700 border-border-divider',
}

const issueStatusColors = {
  unresolved: 'bg-rose-50 text-rose-700 border-rose-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ignored: 'bg-slate-50 text-slate-700 border-border-divider',
}

const intervalOptions = [
  { value: '60', label: 'Every 1 minute' },
  { value: '300', label: 'Every 5 minutes' },
  { value: '600', label: 'Every 10 minutes' },
  { value: '1800', label: 'Every 30 minutes' },
  { value: '3600', label: 'Every 1 hour' },
]

function IssuesTab() {
  const [loading, setLoading] = useState(true)
  const [issues, setIssues] = useState([])
  const [statusFilter, setStatusFilter] = useState('is:unresolved')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listIssues(statusFilter)
      setIssues(Array.isArray(data) ? data : [])
    } catch (e) {
      toast.error(e?.message || 'Failed to load issues from Sentry')
      setIssues([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    load()
  }, [load])

  const runAction = useCallback(
    async (id, fn, successMessage) => {
      setBusyId(id)
      try {
        await fn(id)
        toast.success(successMessage)
        await load()
      } catch (e) {
        toast.error(e?.message || 'Action failed')
      } finally {
        setBusyId(null)
      }
    },
    [load],
  )

  const columns = useMemo(
    () => [
      columnHelper.accessor('title', {
        header: 'Issue',
        cell: (info) => {
          const row = info.row.original
          return (
            <a
              href={row.permalink}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
              title="View in Sentry"
            >
              {info.getValue() || row.metadata?.value || 'Untitled issue'}
            </a>
          )
        },
      }),
      columnHelper.accessor('culprit', { header: 'Where', cell: (info) => info.getValue() || '—' }),
      columnHelper.accessor('level', {
        header: 'Level',
        cell: (info) => <Badge text={info.getValue() || '—'} colorClass={levelColors[info.getValue()] || levelColors.debug} />,
      }),
      columnHelper.accessor('count', { header: 'Events', cell: (info) => info.getValue() ?? '—' }),
      columnHelper.accessor('lastSeen', { header: 'Last Seen', cell: (info) => formatDate(info.getValue()) }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => <Badge text={info.getValue() || '—'} colorClass={issueStatusColors[info.getValue()] || issueStatusColors.unresolved} />,
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const issue = row.original
          const isBusy = busyId === issue.id
          return (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {issue.status !== 'resolved' ? (
                <Button variant="secondary" size="sm" disabled={isBusy} onClick={() => runAction(issue.id, resolveIssue, 'Marked resolved')}>
                  Resolve
                </Button>
              ) : null}
              {issue.status !== 'ignored' ? (
                <Button variant="secondary" size="sm" disabled={isBusy} onClick={() => runAction(issue.id, ignoreIssue, 'Ignored')}>
                  Ignore
                </Button>
              ) : null}
              {issue.status !== 'unresolved' ? (
                <Button variant="secondary" size="sm" disabled={isBusy} onClick={() => runAction(issue.id, reopenIssue, 'Reopened')}>
                  Reopen
                </Button>
              ) : null}
              <Button variant="danger" size="sm" disabled={isBusy} onClick={() => setDeleteTarget(issue)}>
                <Trash2 size={16} />
              </Button>
            </div>
          )
        },
      }),
    ],
    [busyId, runAction],
  )

  return (
    <div className="space-y-4">
      <div className="w-[220px]">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={issueStatusFilters}
        />
      </div>

      <Table columns={columns} data={issues} loading={loading} emptyIcon={AlertTriangle} />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete issue?"
        description={deleteTarget ? `This will permanently delete "${deleteTarget.title}" from Sentry.` : ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          try {
            await deleteIssue(deleteTarget.id)
            toast.success('Issue deleted')
            setDeleteTarget(null)
            await load()
          } catch (e) {
            toast.error(e?.message || 'Failed to delete issue')
          }
        }}
      />
    </div>
  )
}

function UptimeTab() {
  const [loading, setLoading] = useState(true)
  const [monitors, setMonitors] = useState([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ name: '', url: '', intervalSeconds: '300', timeoutMs: '10000' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listUptimeMonitors()
      setMonitors(Array.isArray(data) ? data : [])
    } catch (e) {
      toast.error(e?.message || 'Failed to load uptime monitors from Sentry')
      setMonitors([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name', cell: (info) => info.getValue() || '—' }),
      columnHelper.accessor('url', { header: 'URL', cell: (info) => info.getValue() || '—' }),
      columnHelper.accessor('status', {
        header: 'Monitor',
        cell: (info) => {
          // Sentry's `status` here means "is this monitor enabled and
          // checking", not "is the site currently up" — an actual outage
          // shows up as a new Issue in the Issues tab instead.
          const v = String(info.getValue() || 'unknown').toLowerCase()
          const color =
            v === 'active'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : v === 'disabled'
                ? 'bg-slate-50 text-slate-700 border-border-divider'
                : 'bg-amber-50 text-amber-700 border-amber-200'
          return <Badge text={v === 'active' ? 'checking' : v} colorClass={color} />
        },
      }),
      columnHelper.accessor((row) => row.intervalSeconds ?? row.interval_seconds, {
        id: 'interval',
        header: 'Interval',
        cell: (info) => {
          const v = Number(info.getValue())
          if (!v) return '—'
          return v % 60 === 0 ? `${v / 60}m` : `${v}s`
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Button variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); setDeleteTarget(row.original) }}>
            <Trash2 size={16} />
          </Button>
        ),
      }),
    ],
    [],
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setForm({ name: '', url: '', intervalSeconds: '300', timeoutMs: '10000' })
            setDrawerOpen(true)
          }}
        >
          <Plus size={16} />
          <span>Add Monitor</span>
        </Button>
      </div>

      <Table columns={columns} data={monitors} loading={loading} emptyIcon={RadioTower} />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Add Uptime Monitor"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              disabled={submitting}
              onClick={async () => {
                if (!form.name.trim() || !form.url.trim()) {
                  toast.error('Name and URL are required')
                  return
                }
                setSubmitting(true)
                try {
                  await createUptimeMonitor({
                    name: form.name.trim(),
                    url: form.url.trim(),
                    intervalSeconds: Number(form.intervalSeconds),
                    timeoutMs: Number(form.timeoutMs),
                  })
                  toast.success('Monitor created')
                  setDrawerOpen(false)
                  await load()
                } catch (e) {
                  toast.error(e?.message || 'Failed to create monitor')
                } finally {
                  setSubmitting(false)
                }
              }}
            >
              {submitting ? 'Creating…' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Portal (production)"
          />
          <Input
            label="URL"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            placeholder="https://portal.optomcapital.com"
          />
          <Select
            label="Check Interval"
            value={form.intervalSeconds}
            onChange={(e) => setForm((f) => ({ ...f, intervalSeconds: e.target.value }))}
            options={intervalOptions}
          />
          <Input
            label="Timeout (ms)"
            type="number"
            value={form.timeoutMs}
            onChange={(e) => setForm((f) => ({ ...f, timeoutMs: e.target.value }))}
          />
        </div>
      </Drawer>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete uptime monitor?"
        description={deleteTarget ? `This will stop monitoring "${deleteTarget.name}".` : ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          try {
            await deleteUptimeMonitor(deleteTarget.id)
            toast.success('Monitor deleted')
            setDeleteTarget(null)
            await load()
          } catch (e) {
            toast.error(e?.message || 'Failed to delete monitor')
          }
        }}
      />
    </div>
  )
}

export default function MonitoringPage() {
  const [tab, setTab] = useState('issues')

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[18px] font-semibold">Monitoring</div>
        <div className="text-[13px] text-text-secondary">Live errors and uptime, pulled from Sentry</div>
      </div>

      <div className="flex gap-2 border-b border-border-divider">
        <button
          className={[
            'px-3 py-2 text-[13px] font-medium border-b-2 -mb-px',
            tab === 'issues' ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary',
          ].join(' ')}
          onClick={() => setTab('issues')}
        >
          Issues
        </button>
        <button
          className={[
            'px-3 py-2 text-[13px] font-medium border-b-2 -mb-px',
            tab === 'uptime' ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary',
          ].join(' ')}
          onClick={() => setTab('uptime')}
        >
          Uptime
        </button>
      </div>

      {tab === 'issues' ? <IssuesTab /> : <UptimeTab />}
    </div>
  )
}
