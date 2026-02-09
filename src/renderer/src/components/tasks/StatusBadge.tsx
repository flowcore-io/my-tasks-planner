import { Badge } from '@/components/ui/Badge'
import { STATUS_LABELS } from '@/lib/utils'
import { useState, useRef, useEffect } from 'react'

const STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'primary'> = {
  'todo': 'default',
  'in-progress': 'primary',
  'done': 'success',
  'archived': 'default',
}

const STATUS_OPTIONS = ['todo', 'in-progress', 'done', 'archived']

interface StatusBadgeProps {
  status: string
  onChange?: (status: string) => void
}

export function StatusBadge({ status, onChange }: StatusBadgeProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  if (!onChange) {
    return (
      <Badge variant={STATUS_VARIANTS[status] || 'default'}>
        {STATUS_LABELS[status] || status}
      </Badge>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="cursor-pointer">
        <Badge variant={STATUS_VARIANTS[status] || 'default'} className="hover:ring-2 hover:ring-primary-300 dark:hover:ring-primary-600 transition-shadow">
          {STATUS_LABELS[status] || status}
        </Badge>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1 min-w-[120px]">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => { onChange(s); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${s === status ? 'bg-gray-50 dark:bg-gray-700/50' : ''}`}
            >
              <Badge variant={STATUS_VARIANTS[s] || 'default'}>{STATUS_LABELS[s] || s}</Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
