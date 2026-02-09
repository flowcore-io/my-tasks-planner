import { Badge } from '@/components/ui/Badge'
import { PRIORITY_LABELS } from '@/lib/utils'
import { useState, useRef, useEffect } from 'react'

const PRIORITY_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'primary'> = {
  low: 'default',
  medium: 'primary',
  high: 'warning',
  urgent: 'danger',
}

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent']

interface PriorityBadgeProps {
  priority: string
  onChange?: (priority: string) => void
}

export function PriorityBadge({ priority, onChange }: PriorityBadgeProps) {
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
      <Badge variant={PRIORITY_VARIANTS[priority] || 'default'}>
        {PRIORITY_LABELS[priority] || priority}
      </Badge>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="cursor-pointer">
        <Badge variant={PRIORITY_VARIANTS[priority] || 'default'} className="hover:ring-2 hover:ring-primary-300 dark:hover:ring-primary-600 transition-shadow">
          {PRIORITY_LABELS[priority] || priority}
        </Badge>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1 min-w-[120px]">
          {PRIORITY_OPTIONS.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => { onChange(p); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${p === priority ? 'bg-gray-50 dark:bg-gray-700/50' : ''}`}
            >
              <Badge variant={PRIORITY_VARIANTS[p] || 'default'}>{PRIORITY_LABELS[p] || p}</Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
