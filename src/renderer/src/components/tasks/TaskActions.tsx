import { useState, useRef, useEffect } from 'react'
import { MoreVertical, ExternalLink } from 'lucide-react'
import { useWorkspaceConfig } from '@/hooks/use-usable'

interface TaskActionsProps {
  taskId: string
}

export function TaskActions({ taskId }: TaskActionsProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { data: config } = useWorkspaceConfig()

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const usableUrl = config?.workspaceId
    ? `https://usable.dev/dashboard/workspaces/${config.workspaceId}/fragments/${taskId}`
    : null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(!open) }}
        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 min-w-[160px] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-lg py-1">
          {usableUrl && (
            <a
              href={usableUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => { e.stopPropagation(); setOpen(false) }}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <ExternalLink size={14} />
              Open in Usable
            </a>
          )}
        </div>
      )}
    </div>
  )
}
