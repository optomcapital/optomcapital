import { X } from 'lucide-react'
import { Fragment, forwardRef, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'

export function Button({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-md text-[13px] font-medium transition disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = {
    sm: 'h-8 px-3',
    md: 'h-[34px] px-3.5',
    lg: 'h-10 px-4',
  }
  const variants = {
    primary: 'bg-accent text-white hover:bg-[#2559C2]',
    secondary: 'bg-surface border border-border-input text-text-primary hover:bg-[#F5F5F3]',
    danger: 'bg-danger text-white hover:bg-[#D64045]',
    ghost: 'bg-transparent text-text-secondary hover:bg-[#F5F5F3]',
  }

  return (
    <button
      className={[base, sizes[size] || sizes.md, variants[variant] || variants.primary, className].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}

export const Input = forwardRef(function Input({ label, error, className = '', ...props }, ref) {
  return (
    <div className="w-full">
      {label ? <div className="mb-1 text-[12px] font-medium text-text-secondary">{label}</div> : null}
      <input
        ref={ref}
        className={[
          'h-[34px] w-full rounded-md border border-border-input bg-surface px-3 text-[13px] outline-none focus:border-accent',
          error ? 'border-danger focus:border-danger' : '',
          className,
        ].join(' ')}
        {...props}
      />
      {error ? <div className="mt-1 text-[12px] text-danger">{error}</div> : null}
    </div>
  )
})

export const Textarea = forwardRef(function Textarea({ label, error, className = '', ...props }, ref) {
  return (
    <div className="w-full">
      {label ? <div className="mb-1 text-[12px] font-medium text-text-secondary">{label}</div> : null}
      <textarea
        ref={ref}
        className={[
          'w-full rounded-md border border-border-input bg-surface px-3 py-2 text-[13px] outline-none focus:border-accent',
          error ? 'border-danger focus:border-danger' : '',
          className,
        ].join(' ')}
        {...props}
      />
      {error ? <div className="mt-1 text-[12px] text-danger">{error}</div> : null}
    </div>
  )
})

export const Select = forwardRef(function Select({ label, error, options, className = '', ...props }, ref) {
  return (
    <div className="w-full">
      {label ? <div className="mb-1 text-[12px] font-medium text-text-secondary">{label}</div> : null}
      <select
        ref={ref}
        className={[
          'h-[34px] w-full rounded-md border border-border-input bg-surface px-3 text-[13px] outline-none focus:border-accent',
          error ? 'border-danger focus:border-danger' : '',
          className,
        ].join(' ')}
        {...props}
      >
        {(options || []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error ? <div className="mt-1 text-[12px] text-danger">{error}</div> : null}
    </div>
  )
})

export function Badge({ text, colorClass = 'bg-slate-50 text-slate-700 border-border-divider', dot = true }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[12px] font-medium',
        colorClass,
      ].join(' ')}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" /> : null}
      <span>{text}</span>
    </span>
  )
}

export function Card({ title, action, children, className = '' }) {
  return (
    <div className={['rounded-panel border border-border-subtle bg-surface shadow-panel', className].join(' ')}>
      {title ? (
        <div className="flex items-center justify-between border-b border-border-divider px-4 py-3">
          <div className="text-[14px] font-semibold">{title}</div>
          {action ? <div>{action}</div> : null}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </div>
  )
}

export function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-panel border border-border-subtle bg-surface shadow-panel p-4">
      <div className="text-[12px] text-text-secondary">{label}</div>
      <div className="mt-2 text-[18px] font-semibold text-text-primary">{value}</div>
      {hint ? <div className="mt-2 text-[12px] text-text-muted">{hint}</div> : null}
    </div>
  )
}

export function Skeleton({ className = '' }) {
  return <div className={['animate-pulse rounded-md bg-[#EDEDEB]', className].join(' ')} />
}

export function EmptyState({ icon, title = 'No records found', description }) {
  const Icon = icon
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      {Icon ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5F5F3] text-text-secondary">
          <Icon size={18} />
        </div>
      ) : null}
      <div className="text-[13px] font-medium">{title}</div>
      {description ? <div className="text-[12px] text-text-secondary">{description}</div> : null}
    </div>
  )
}

export function Breadcrumb({ items }) {
  const safeItems = items || []
  return (
    <div className="flex items-center gap-2 text-[12px] text-text-secondary">
      {safeItems.map((item, idx) => (
        <Fragment key={`${item.label}-${idx}`}>
          {idx > 0 ? <span className="text-text-muted">/</span> : null}
          {item.to ? (
            <Link to={item.to} className="hover:text-accent">
              {item.label}
            </Link>
          ) : (
            <span className="text-text-muted">{item.label}</span>
          )}
        </Fragment>
      ))}
    </div>
  )
}

export function ConfirmDialog({ open, title, description, confirmText = 'Delete', onClose, onConfirm }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="text-[13px] text-text-secondary">{description}</div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={async () => {
            await onConfirm?.()
            onClose?.()
          }}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  )
}

export function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className="relative w-[560px] max-w-[calc(100vw-32px)] rounded-panel border border-border-subtle bg-surface shadow-panel">
        <div className="flex items-center justify-between border-b border-border-divider px-4 py-3">
          <div className="text-[14px] font-semibold">{title}</div>
          <button className="text-text-secondary hover:text-text-primary" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function Drawer({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-[600px] max-w-[calc(100vw-16px)] bg-surface shadow-panel">
        <div className="flex h-[52px] items-center justify-between border-b border-border px-4">
          <div className="text-[14px] font-semibold">{title}</div>
          <button className="text-text-secondary hover:text-text-primary" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="h-[calc(100%-52px-64px)] overflow-auto p-4">{children}</div>
        <div className="flex h-[64px] items-center justify-end gap-2 border-t border-border px-4">
          {footer}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function Pagination({ table, pageSizeOptions = [10, 25, 50] }) {
  const pageIndex = table.getState().pagination.pageIndex
  const pageCount = table.getPageCount()
  const pageSize = table.getState().pagination.pageSize

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-2 text-[12px] text-text-secondary">
        <span>Rows</span>
        <select
          className="h-8 rounded-md border border-border-input bg-surface px-2 text-[12px] outline-none focus:border-accent"
          value={pageSize}
          onChange={(e) => table.setPageSize(Number(e.target.value))}
        >
          {pageSizeOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2 text-[12px] text-text-secondary">
        <Button variant="secondary" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          Prev
        </Button>
        <span>
          Page {pageIndex + 1} of {pageCount || 1}
        </span>
        <Button variant="secondary" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          Next
        </Button>
      </div>
    </div>
  )
}

export function Table({ columns, data, loading, emptyIcon, onRowClick, pagination }) {
  const safeData = data || []

  const isServer = Boolean(pagination)
  const serverPaginationState = isServer
    ? {
        pagination: {
          pageIndex: pagination.pageIndex ?? 0,
          pageSize: pagination.pageSize ?? 25,
        },
      }
    : undefined

  const table = useReactTable({
    data: safeData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: isServer ? undefined : getPaginationRowModel(),
    manualPagination: isServer,
    pageCount: isServer ? pagination.pageCount : undefined,
    state: serverPaginationState,
    onPaginationChange: isServer
      ? (updater) => {
          const prev = {
            pageIndex: pagination.pageIndex ?? 0,
            pageSize: pagination.pageSize ?? 25,
          }
          const next = typeof updater === 'function' ? updater(prev) : updater
          if (next.pageSize !== prev.pageSize) pagination.onPageSizeChange?.(next.pageSize)
          if (next.pageIndex !== prev.pageIndex) pagination.onPageChange?.(next.pageIndex)
        }
      : undefined,
    initialState: isServer ? undefined : { pagination: { pageSize: 25 } },
  })

  const rows = table.getRowModel().rows

  return (
    <div className="rounded-panel border border-border-subtle bg-surface shadow-panel">
      <div className="overflow-auto">
        <table className="min-w-full text-left text-[13px]">
          <thead className="sticky top-0 bg-surface">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border-divider">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="whitespace-nowrap px-4 py-3 font-semibold text-text-secondary"
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        className="inline-flex items-center gap-1 hover:text-text-primary"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' ? '↑' : header.column.getIsSorted() === 'desc' ? '↓' : ''}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-[85%]" />
                    <Skeleton className="h-4 w-[90%]" />
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6">
                  <EmptyState icon={emptyIcon} />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={[
                    'border-b border-border-divider last:border-b-0 hover:bg-[#F5F5F3]',
                    onRowClick ? 'cursor-pointer' : '',
                  ].join(' ')}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="whitespace-nowrap px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border-divider px-4">
        <Pagination table={table} pageSizeOptions={pagination?.pageSizeOptions} />
      </div>
    </div>
  )
}

Table.propTypes = {
  pagination: PropTypes.shape({
    pageIndex: PropTypes.number,
    pageSize: PropTypes.number,
    pageCount: PropTypes.number,
    onPageChange: PropTypes.func,
    onPageSizeChange: PropTypes.func,
  }),
}

export function Divider({ title }) {
  return (
    <div className="mt-6 mb-3 flex items-center gap-3">
      <div className="text-[12px] font-semibold uppercase tracking-wide text-text-muted">{title}</div>
      <div className="h-px flex-1 bg-border-divider" />
    </div>
  )
}

export function Toggle({ label, checked, onChange, disabled = false }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className={['text-[13px]', disabled ? 'text-text-muted' : 'text-text-secondary'].join(' ')}>{label}</span>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={!!checked}
        aria-disabled={disabled}
        className={[
          'relative h-6 w-10 rounded-full border transition',
          disabled ? 'opacity-60 cursor-not-allowed' : '',
          checked ? 'bg-accent border-accent' : 'bg-[#F5F5F3] border-border-input',
        ].join(' ')}
        onClick={() => onChange?.(!checked)}
      >
        <span
          className={[
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition',
            checked ? 'left-4' : 'left-0.5',
          ].join(' ')}
        />
      </button>
    </label>
  )
}

export function FileUpload({ label = 'Upload', onUpload, accept }) {
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)

  const inputId = useMemo(() => `file-${Math.random().toString(16).slice(2)}`, [])

  return (
    <div className="w-full">
      <input
        id={inputId}
        type="file"
        className="hidden"
        accept={accept}
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          setUploading(true)
          setProgress(0)
          try {
            await onUpload?.(file, (p) => setProgress(p))
          } finally {
            setUploading(false)
            e.target.value = ''
          }
        }}
      />
      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={() => document.getElementById(inputId)?.click()} disabled={uploading}>
          {label}
        </Button>
        {uploading ? <div className="text-[12px] text-text-secondary">{progress}%</div> : null}
      </div>
      {uploading ? (
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#F5F5F3]">
          <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
    </div>
  )
}
