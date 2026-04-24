import { format } from 'date-fns'

export function formatINR(amount) {
  const value = Number(amount || 0)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDate(date) {
  if (!date) return '—'
  try {
    return format(new Date(date), 'dd MMM yyyy')
  } catch {
    return '—'
  }
}

export function generateCode(prefix, count) {
  const next = Number(count || 0) + 1
  const padded = String(next).padStart(4, '0')
  return `${prefix}-${padded}`
}

const stageColors = {
  'Lead Generated': 'bg-slate-50 text-slate-700 border-border-divider',
  'Qualification Done': 'bg-blue-50 text-blue-700 border-blue-200',
  'Documents Collected': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Login to Bank': 'bg-violet-50 text-violet-700 border-violet-200',
  Underwriting: 'bg-amber-50 text-amber-700 border-amber-200',
  'Sanction Approved': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Disbursement Processing': 'bg-orange-50 text-orange-700 border-orange-200',
  Disbursed: 'bg-green-50 text-green-700 border-green-200',
  Declined: 'bg-rose-50 text-rose-700 border-rose-200',
}

export function getStageColor(stage) {
  return stageColors[stage] || 'bg-slate-50 text-slate-700 border-border-divider'
}

export function getScoreColor(score) {
  const value = Number(score)
  if (!Number.isFinite(value)) return 'text-text-muted'
  if (value >= 750) return 'text-success'
  if (value >= 650) return 'text-warning'
  return 'text-danger'
}

export function truncateText(text, length = 32) {
  if (!text) return ''
  if (text.length <= length) return text
  return `${text.slice(0, length - 1)}…`
}

export function isOverdue(date) {
  if (!date) return false
  try {
    const today = new Date()
    const d = new Date(date)
    today.setHours(0, 0, 0, 0)
    d.setHours(0, 0, 0, 0)
    return d < today
  } catch {
    return false
  }
}

export function downloadCsv(filename, rows) {
  const escapeCell = (value) => {
    const str = String(value ?? '')
    if (/[",\n]/.test(str)) return `"${str.replaceAll('"', '""')}"`
    return str
  }

  const csv = rows.map((row) => row.map(escapeCell).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

let clipboardWriteChain = Promise.resolve()

export function writeClipboardText(text) {
  const msg = String(text ?? '')
  const run = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(msg)
        return
      } catch (e) {
        if (e?.name === 'AbortError') {
          await new Promise((r) => setTimeout(r, 75))
          await navigator.clipboard.writeText(msg)
          return
        }
        throw e
      }
    }

    const el = document.createElement('textarea')
    el.value = msg
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  }

  clipboardWriteChain = clipboardWriteChain.catch(() => {}).then(run)
  return clipboardWriteChain
}
