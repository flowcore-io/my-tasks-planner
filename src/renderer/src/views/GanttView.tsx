import { useTasks, useUpdateTask } from '@/hooks/use-tasks'
import { useMembers, resolveMemberName } from '@/hooks/use-members'
import { getScheduleHealth, cn } from '@/lib/utils'
import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { ChevronRight, ChevronDown, AlertTriangle, Clock, Calendar, MoreVertical, X } from 'lucide-react'
import type { TaskWithTags } from '../../../shared/types'
import usableMascot from '@/assets/usable-mascot.png'

type DragType = 'move' | 'resize-start' | 'resize-end'

interface DragTracking {
  taskId: string
  type: DragType
  startX: number
  origStart: string
  origEnd: string
  moved: boolean
}

const STATUS_DOT_COLORS: Record<string, string> = {
  'todo': 'bg-gray-400 dark:bg-gray-500',
  'in-progress': 'bg-blue-500 dark:bg-blue-400',
  'done': 'bg-green-500 dark:bg-green-400',
  'archived': 'bg-gray-300 dark:bg-gray-600',
}

const STATUS_SHORT_LABELS: Record<string, string> = {
  'todo': 'To Do',
  'in-progress': 'Active',
  'done': 'Done',
  'archived': 'Archived',
}

function CompactStatus({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 shrink-0">
      <span className={cn('w-2 h-2 rounded-full', STATUS_DOT_COLORS[status] || STATUS_DOT_COLORS['todo'])} />
      <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium">
        {STATUS_SHORT_LABELS[status] || status}
      </span>
    </span>
  )
}

interface GanttViewProps {
  onTaskClick: (task: TaskWithTags) => void
  projectFilter?: string[]
  assigneeFilter?: string[]
}

type ColumnType = 'day' | 'week' | 'month'
type Horizon = '1w' | '1m' | '6m' | '1y'

const HORIZON_CONFIG: Record<Horizon, { label: string; columnType: ColumnType; baseColWidth: number; minDays: number }> = {
  '1w': { label: '1 Week', columnType: 'day', baseColWidth: 80, minDays: 7 },
  '1m': { label: '1 Month', columnType: 'day', baseColWidth: 40, minDays: 35 },
  '6m': { label: '6 Months', columnType: 'week', baseColWidth: 120, minDays: 180 },
  '1y': { label: '1 Year', columnType: 'month', baseColWidth: 140, minDays: 365 },
}

const LABEL_WIDTH = 320
const ROW_HEIGHT = 36
const HEADER_HEIGHT = 48

const STATUS_BAR_COLORS: Record<string, string> = {
  'todo': 'bg-red-400 dark:bg-red-500',
  'in-progress': 'bg-amber-400 dark:bg-amber-500',
  'done': 'bg-green-400 dark:bg-green-500',
  'archived': 'bg-gray-400 dark:bg-gray-500',
}

function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

function parseDate(s: string): Date {
  return new Date(s + 'T00:00:00')
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfMonth(d: Date): Date {
  const r = new Date(d)
  r.setDate(1)
  r.setHours(0, 0, 0, 0)
  return r
}

function formatHeaderDate(d: Date, colType: ColumnType): string {
  if (colType === 'day') return d.toLocaleDateString('en-US', { day: 'numeric' })
  if (colType === 'week') {
    const end = addDays(d, 6)
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { day: 'numeric' })}`
  }
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

/** Get the end date of a column based on its type */
function getColumnEnd(col: Date, colType: ColumnType): Date {
  if (colType === 'day') return addDays(col, 1)
  if (colType === 'week') return addDays(col, 7)
  const next = new Date(col)
  next.setMonth(next.getMonth() + 1)
  return next
}

function getMonthLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

/** Generate column boundaries for the timeline */
function generateColumns(start: Date, end: Date, colType: ColumnType): Date[] {
  const cols: Date[] = []
  const cur = new Date(start)

  if (colType === 'day') {
    while (cur <= end) {
      cols.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
    }
  } else if (colType === 'week') {
    // Align to Monday
    cur.setDate(cur.getDate() - ((cur.getDay() + 6) % 7))
    while (cur <= end) {
      cols.push(new Date(cur))
      cur.setDate(cur.getDate() + 7)
    }
  } else {
    // Month
    cur.setDate(1)
    while (cur <= end) {
      cols.push(new Date(cur))
      cur.setMonth(cur.getMonth() + 1)
    }
  }
  return cols
}

interface ProjectGroup {
  name: string
  scheduled: TaskWithTags[]
  unscheduled: TaskWithTags[]
}

function groupByProject(tasks: TaskWithTags[]): ProjectGroup[] {
  const map = new Map<string, { scheduled: TaskWithTags[]; unscheduled: TaskWithTags[] }>()

  for (const task of tasks) {
    const projects = task.projects.length > 0 ? task.projects : ['No Project']
    const hasSchedule = !!task.startDate || !!task.endDate
    for (const p of projects) {
      if (!map.has(p)) map.set(p, { scheduled: [], unscheduled: [] })
      const group = map.get(p)!
      if (hasSchedule) {
        group.scheduled.push(task)
      } else {
        group.unscheduled.push(task)
      }
    }
  }

  // Sort: named projects first (alpha), "No Project" last
  return Array.from(map.entries())
    .sort(([a], [b]) => {
      if (a === 'No Project') return 1
      if (b === 'No Project') return -1
      return a.localeCompare(b)
    })
    .map(([name, { scheduled, unscheduled }]) => ({ name, scheduled, unscheduled }))
}

export function GanttView({ onTaskClick, projectFilter, assigneeFilter }: GanttViewProps) {
  const { data: rawTasks, isLoading } = useTasks()
  const { data: members } = useMembers()
  const [horizon, setHorizon] = useState<Horizon>('6m')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [collapsedUnscheduled, setCollapsedUnscheduled] = useState<Set<string>>(new Set(['__all__']))
  const scrollRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [customStart, setCustomStart] = useState<string>('')
  const [customEnd, setCustomEnd] = useState<string>('')
  const [showSettings, setShowSettings] = useState(false)
  const [showWeekends, setShowWeekends] = useState(true)
  const settingsRef = useRef<HTMLDivElement>(null)

  const horizonConfig = HORIZON_CONFIG[horizon]
  const columnType = horizonConfig.columnType

  // Close settings menu on outside click
  useEffect(() => {
    if (!showSettings) return
    const handleClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettings(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showSettings])

  // Measure container so timeline stretches to fill available space
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const tasks = useMemo(() => {
    if (!rawTasks) return []
    let filtered = rawTasks
    if (projectFilter && projectFilter.length > 0) {
      filtered = filtered.filter(t => t.projects.some(p => projectFilter.includes(p)))
    }
    if (assigneeFilter && assigneeFilter.length > 0) {
      filtered = filtered.filter(t => t.assigneeId && assigneeFilter.includes(t.assigneeId))
    }
    return filtered
  }, [rawTasks, projectFilter, assigneeFilter])

  const groups = useMemo(() => groupByProject(tasks), [tasks])

  // Compute timeline range — start at 1st of current month, extend by horizon
  const { rangeStart, rangeEnd } = useMemo(() => {
    // Custom overrides take priority
    if (customStart && customEnd) {
      return { rangeStart: parseDate(customStart), rangeEnd: parseDate(customEnd) }
    }

    const monthStart = startOfMonth(new Date())
    const horizonEnd = addDays(monthStart, horizonConfig.minDays)
    let startMs = monthStart.getTime()
    let endMs = horizonEnd.getTime()

    // Expand to include all scheduled tasks
    const scheduledTasks = tasks.filter(t => t.startDate || t.endDate)
    for (const t of scheduledTasks) {
      if (t.startDate) { const d = parseDate(t.startDate).getTime(); if (d < startMs) startMs = d - 86400000 * 3; if (d > endMs) endMs = d + 86400000 * 3 }
      if (t.endDate) { const d = parseDate(t.endDate).getTime(); if (d < startMs) startMs = d - 86400000 * 3; if (d > endMs) endMs = d + 86400000 * 3 }
    }

    return { rangeStart: startOfDay(new Date(startMs)), rangeEnd: startOfDay(new Date(endMs)) }
  }, [tasks, horizonConfig.minDays, customStart, customEnd])

  const columns = useMemo(() => generateColumns(rangeStart, rangeEnd, columnType), [rangeStart, rangeEnd, columnType])
  const baseColWidth = horizonConfig.baseColWidth
  const minTimelineWidth = Math.max(0, containerWidth - LABEL_WIDTH)
  const columnsWidth = columns.length * baseColWidth
  // Stretch columns to fill container if they'd otherwise be too narrow
  const colWidth = columnsWidth < minTimelineWidth && columns.length > 0
    ? minTimelineWidth / columns.length
    : baseColWidth
  const totalWidth = columns.length * colWidth

  // Column-aligned date→pixel mapping (fixes alignment with grid lines)
  const dateToX = useCallback((dateStr: string): number => {
    const dMs = parseDate(dateStr).getTime()
    for (let i = 0; i < columns.length; i++) {
      const colStartMs = columns[i].getTime()
      const colEndMs = i + 1 < columns.length ? columns[i + 1].getTime() : getColumnEnd(columns[i], columnType).getTime()
      if (dMs >= colStartMs && dMs < colEndMs) {
        const fraction = (dMs - colStartMs) / (colEndMs - colStartMs)
        return i * colWidth + fraction * colWidth
      }
    }
    // Before first column
    if (columns.length > 0 && dMs < columns[0].getTime()) return 0
    // After last column
    return totalWidth
  }, [columns, colWidth, totalWidth, columnType])

  // Compute weekend bands (for shading Saturday/Sunday columns)
  const weekendBands = useMemo(() => {
    if (!showWeekends || columns.length === 0) return []
    const bands: { left: number; width: number }[] = []

    if (columnType === 'day') {
      // Each column is a day — mark Sat/Sun columns
      for (let i = 0; i < columns.length; i++) {
        const day = columns[i].getDay() // 0=Sun, 6=Sat
        if (day === 0 || day === 6) {
          bands.push({ left: i * colWidth, width: colWidth })
        }
      }
    } else {
      // For week/month columns, iterate actual days within the range
      const rStart = columns[0]
      const rEnd = getColumnEnd(columns[columns.length - 1], columnType)
      const cur = new Date(rStart)
      let bandStart: Date | null = null

      while (cur <= rEnd) {
        const day = cur.getDay()
        if (day === 0 || day === 6) {
          if (!bandStart) bandStart = new Date(cur)
        } else {
          if (bandStart) {
            const l = dateToX(toDateStr(bandStart))
            const r = dateToX(toDateStr(cur))
            if (r > l) bands.push({ left: l, width: r - l })
            bandStart = null
          }
        }
        cur.setDate(cur.getDate() + 1)
      }
      // Close trailing weekend
      if (bandStart) {
        const l = dateToX(toDateStr(bandStart))
        const r = dateToX(toDateStr(cur))
        if (r > l) bands.push({ left: l, width: r - l })
      }
    }
    return bands
  }, [columns, colWidth, columnType, showWeekends, dateToX])

  // Today position (use the same column-aligned logic)
  const today = startOfDay(new Date())
  const todayOffset = dateToX(toDateStr(today))

  const scrollToToday = useCallback(() => {
    if (!scrollRef.current) return
    const targetX = todayOffset - scrollRef.current.clientWidth / 2 + LABEL_WIDTH
    scrollRef.current.scrollLeft = Math.max(0, targetX)
  }, [todayOffset])

  // Auto-scroll to today on mount
  useEffect(() => {
    const timer = setTimeout(scrollToToday, 100)
    return () => clearTimeout(timer)
  }, [scrollToToday])

  const toggleGroup = (name: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const toggleUnscheduled = (name: string) => {
    setCollapsedUnscheduled(prev => {
      const next = new Set(prev)
      if (next.has('__all__')) {
        // Replace __all__ with individual collapses for all OTHER groups
        next.delete('__all__')
        for (const g of groups) {
          if (g.unscheduled.length > 0 && g.name !== name) {
            next.add(g.name)
          }
        }
        next.delete(name)
      } else if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  // ── Drag-to-resize/move ──────────────────────────────────────────────
  const updateTask = useUpdateTask()
  // Optimistic date overrides — persist until task data catches up so the bar never snaps back
  const [dateOverrides, setDateOverrides] = useState<Map<string, { start: string; end: string }>>(new Map())
  const dateOverridesRef = useRef(dateOverrides)
  dateOverridesRef.current = dateOverrides
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const dragRef = useRef<DragTracking | null>(null)

  // Clear overrides once the refetched task data matches (no snap-back)
  useEffect(() => {
    setDateOverrides(prev => {
      if (prev.size === 0) return prev
      let changed = false
      const next = new Map(prev)
      for (const [taskId, override] of prev) {
        const task = tasks.find(t => t.id === taskId)
        if (task && task.startDate === override.start && task.endDate === override.end) {
          next.delete(taskId)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [tasks])

  // Inverse of dateToX — pixel offset → date string
  const xToDate = useCallback((x: number): string => {
    x = Math.max(0, Math.min(x, totalWidth))
    const colIndex = Math.min(Math.max(Math.floor(x / colWidth), 0), columns.length - 1)
    if (colIndex < 0 || columns.length === 0) return toDateStr(new Date())
    const fraction = (x - colIndex * colWidth) / colWidth
    const colStart = columns[colIndex]
    const colEnd = colIndex + 1 < columns.length ? columns[colIndex + 1] : getColumnEnd(columns[colIndex], columnType)
    const ms = colStart.getTime() + fraction * (colEnd.getTime() - colStart.getTime())
    return toDateStr(startOfDay(new Date(ms)))
  }, [columns, colWidth, totalWidth, columnType])

  const getTimelineX = useCallback((e: MouseEvent | React.MouseEvent): number => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return 0
    const rect = scrollEl.getBoundingClientRect()
    return e.clientX - rect.left + scrollEl.scrollLeft - LABEL_WIDTH
  }, [])

  const handleBarMouseDown = useCallback((
    e: React.MouseEvent,
    task: TaskWithTags,
    type: DragType,
  ) => {
    if (!task.startDate || !task.endDate) return
    e.stopPropagation()
    e.preventDefault()
    dragRef.current = {
      taskId: task.id,
      type,
      startX: getTimelineX(e),
      origStart: task.startDate,
      origEnd: task.endDate,
      moved: false,
    }
  }, [getTimelineX])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return

      const currentX = getTimelineX(e)
      const deltaX = currentX - drag.startX

      if (!drag.moved && Math.abs(deltaX) < 3) return
      if (!drag.moved) {
        drag.moved = true
        setDraggingId(drag.taskId)
        document.body.style.cursor = drag.type === 'move' ? 'grabbing' : 'ew-resize'
        document.body.style.userSelect = 'none'
      }

      let newStart: string
      let newEnd: string

      if (drag.type === 'move') {
        const origLeft = dateToX(drag.origStart)
        const origRight = dateToX(drag.origEnd)
        newStart = xToDate(origLeft + deltaX)
        newEnd = xToDate(origRight + deltaX)
      } else if (drag.type === 'resize-start') {
        newStart = xToDate(dateToX(drag.origStart) + deltaX)
        newEnd = drag.origEnd
        if (newStart > newEnd) newStart = newEnd
      } else {
        newStart = drag.origStart
        newEnd = xToDate(dateToX(drag.origEnd) + deltaX)
        if (newEnd < newStart) newEnd = newStart
      }

      setDateOverrides(prev => new Map(prev).set(drag.taskId, { start: newStart, end: newEnd }))
    }

    const handleMouseUp = () => {
      const drag = dragRef.current
      if (!drag) return
      dragRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setDraggingId(null)

      const override = dateOverridesRef.current.get(drag.taskId)
      if (drag.moved && override && (override.start !== drag.origStart || override.end !== drag.origEnd)) {
        // Override stays in map — the tasks effect will clear it once data catches up
        updateTask.mutate({ id: drag.taskId, data: { startDate: override.start, endDate: override.end } })
      } else {
        // No real drag — clean up override and treat as click
        setDateOverrides(prev => { const next = new Map(prev); next.delete(drag.taskId); return next })
        if (!drag.moved) {
          const task = tasks.find(t => t.id === drag.taskId)
          if (task) onTaskClick(task)
        }
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dateToX, xToDate, getTimelineX, updateTask, tasks, onTaskClick])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <img src={usableMascot} alt="" className="w-12 h-12 object-contain animate-pulse" />
        <span className="text-gray-500 dark:text-gray-400 text-sm">Loading...</span>
      </div>
    )
  }

  const hasScheduledTasks = tasks.some(t => t.startDate || t.endDate)

  if (!hasScheduledTasks && tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <img src={usableMascot} alt="" className="w-16 h-16 object-contain opacity-60" />
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-300 mb-1">No tasks yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Create tasks with dates to see them on the timeline</p>
        </div>
      </div>
    )
  }

  // Build rows
  let rowIndex = 0
  const rows: React.ReactNode[] = []
  const labelRows: React.ReactNode[] = []

  for (const group of groups) {
    const isCollapsed = collapsedGroups.has(group.name)
    const taskCount = group.scheduled.length + group.unscheduled.length

    // Group header
    const headerY = rowIndex * ROW_HEIGHT
    labelRows.push(
      <div
        key={`lbl-hdr-${group.name}`}
        className="flex items-center gap-1.5 px-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 font-medium text-sm text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700/50"
        style={{ height: ROW_HEIGHT, position: 'absolute', top: headerY, left: 0, width: LABEL_WIDTH }}
        onClick={() => toggleGroup(group.name)}
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        <span className="truncate">{group.name}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{taskCount}</span>
      </div>
    )
    rows.push(
      <div
        key={`row-hdr-${group.name}`}
        className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/20"
        style={{ height: ROW_HEIGHT, position: 'absolute', top: headerY, left: 0, width: totalWidth }}
      />
    )
    rowIndex++

    if (!isCollapsed) {
      // Scheduled tasks
      for (const task of group.scheduled) {
        const y = rowIndex * ROW_HEIGHT
        const health = getScheduleHealth(task)

        // Label row
        const assigneeName = resolveMemberName(members, task.assigneeId)
        const assigneeInitials = task.assigneeId && assigneeName !== 'Unassigned' && assigneeName !== 'Loading...' && assigneeName !== 'Unknown'
          ? assigneeName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
          : null
        labelRows.push(
          <div
            key={`lbl-${group.name}-${task.id}`}
            className="flex items-center gap-2.5 px-3 pl-7 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700/50"
            style={{ height: ROW_HEIGHT, position: 'absolute', top: y, left: 0, width: LABEL_WIDTH }}
            onClick={() => onTaskClick(task)}
          >
            <CompactStatus status={task.status} />
            <span className="truncate text-gray-700 dark:text-gray-300 text-xs flex-1">{task.title}</span>
            {assigneeInitials && (
              <span
                title={assigneeName}
                className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center text-[9px] font-bold shrink-0"
              >
                {assigneeInitials}
              </span>
            )}
          </div>
        )

        // Task bar
        const hasStart = !!task.startDate
        const hasEnd = !!task.endDate

        if (hasStart && hasEnd) {
          const override = dateOverrides.get(task.id)
          const displayStart = override ? override.start : task.startDate!
          const displayEnd = override ? override.end : task.endDate!
          const isDragging = draggingId === task.id
          const left = dateToX(displayStart)
          const right = dateToX(displayEnd)
          const width = Math.max(right - left, 8)
          const barColor = STATUS_BAR_COLORS[task.status] || STATUS_BAR_COLORS['todo']
          const borderClass = health === 'overdue' ? 'ring-2 ring-red-500/60' : health === 'at-risk' ? 'ring-2 ring-amber-500/60' : ''

          rows.push(
            <div
              key={`bar-${group.name}-${task.id}`}
              className={cn(
                'absolute rounded select-none group/bar',
                barColor, borderClass,
                isDragging ? 'opacity-80 z-20 brightness-110' : 'cursor-grab',
              )}
              style={{ top: y + 4, left, width, height: ROW_HEIGHT - 8 }}
              onMouseDown={e => handleBarMouseDown(e, task, 'move')}
              title={`${task.title} (${displayStart} — ${displayEnd})`}
            >
              {/* Left resize handle */}
              <div
                className="absolute -left-1 top-0 w-3 h-full cursor-ew-resize z-10 flex items-center justify-center"
                onMouseDown={e => handleBarMouseDown(e, task, 'resize-start')}
              >
                <div className="w-0.5 h-3 bg-white/0 group-hover/bar:bg-white/60 rounded-full" />
              </div>
              {/* Bar content */}
              <div className="flex items-center gap-1 px-3 h-full overflow-hidden pointer-events-none">
                {health === 'overdue' && <AlertTriangle size={11} className="text-white shrink-0" />}
                {health === 'at-risk' && <Clock size={11} className="text-white shrink-0" />}
                <span className="text-[11px] text-white font-medium truncate">{task.title}</span>
              </div>
              {/* Right resize handle */}
              <div
                className="absolute -right-1 top-0 w-3 h-full cursor-ew-resize z-10 flex items-center justify-center"
                onMouseDown={e => handleBarMouseDown(e, task, 'resize-end')}
              >
                <div className="w-0.5 h-3 bg-white/0 group-hover/bar:bg-white/60 rounded-full" />
              </div>
            </div>
          )
        } else if (hasStart) {
          // Milestone marker at start
          const x = dateToX(task.startDate!)
          rows.push(
            <div
              key={`bar-${group.name}-${task.id}`}
              className={cn('absolute cursor-pointer', STATUS_BAR_COLORS[task.status] || STATUS_BAR_COLORS['todo'])}
              style={{ top: y + 10, left: x - 7, width: 14, height: 14, transform: 'rotate(45deg)', borderRadius: 2 }}
              onClick={() => onTaskClick(task)}
              title={`${task.title} (start: ${task.startDate})`}
            />
          )
        } else if (hasEnd) {
          // Deadline marker at end
          const x = dateToX(task.endDate!)
          const borderColor = health === 'overdue' ? 'ring-2 ring-red-500/60' : health === 'at-risk' ? 'ring-2 ring-amber-500/60' : ''
          rows.push(
            <div
              key={`bar-${group.name}-${task.id}`}
              className={cn('absolute cursor-pointer', STATUS_BAR_COLORS[task.status] || STATUS_BAR_COLORS['todo'], borderColor)}
              style={{ top: y + 10, left: x - 7, width: 14, height: 14, transform: 'rotate(45deg)', borderRadius: 2 }}
              onClick={() => onTaskClick(task)}
              title={`${task.title} (deadline: ${task.endDate})`}
            />
          )
        }

        // Row background
        rows.push(
          <div
            key={`rowbg-${group.name}-${task.id}`}
            className="border-b border-gray-100 dark:border-gray-700/50 pointer-events-none"
            style={{ height: ROW_HEIGHT, position: 'absolute', top: y, left: 0, width: totalWidth }}
          />
        )
        rowIndex++
      }

      // Unscheduled section
      if (group.unscheduled.length > 0) {
        const isUnschedCollapsed = collapsedUnscheduled.has(group.name) || collapsedUnscheduled.has('__all__')
        const uy = rowIndex * ROW_HEIGHT

        labelRows.push(
          <div
            key={`lbl-unsched-${group.name}`}
            className="flex items-center gap-1.5 px-3 pl-7 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 text-xs text-gray-400 dark:text-gray-500 italic border-b border-gray-100 dark:border-gray-700/50"
            style={{ height: ROW_HEIGHT, position: 'absolute', top: uy, left: 0, width: LABEL_WIDTH }}
            onClick={() => toggleUnscheduled(group.name)}
          >
            {isUnschedCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            Unscheduled ({group.unscheduled.length})
          </div>
        )
        rows.push(
          <div
            key={`row-unsched-${group.name}`}
            className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/30 dark:bg-gray-800/10"
            style={{ height: ROW_HEIGHT, position: 'absolute', top: uy, left: 0, width: totalWidth }}
          />
        )
        rowIndex++

        if (!isUnschedCollapsed) {
          for (const task of group.unscheduled) {
            const y = rowIndex * ROW_HEIGHT
            labelRows.push(
              <div
                key={`lbl-unsched-task-${group.name}-${task.id}`}
                className="flex items-center gap-2.5 px-3 pl-10 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700/50"
                style={{ height: ROW_HEIGHT, position: 'absolute', top: y, left: 0, width: LABEL_WIDTH }}
                onClick={() => onTaskClick(task)}
              >
                <CompactStatus status={task.status} />
                <span className="truncate text-gray-500 dark:text-gray-400 text-xs">{task.title}</span>
              </div>
            )
            rows.push(
              <div
                key={`rowbg-unsched-${group.name}-${task.id}`}
                className="border-b border-gray-100 dark:border-gray-700/50"
                style={{ height: ROW_HEIGHT, position: 'absolute', top: y, left: 0, width: totalWidth }}
              />
            )
            rowIndex++
          }
        }
      }
    }
  }

  const totalHeight = rowIndex * ROW_HEIGHT

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
          {(['1w', '1m', '6m', '1y'] as Horizon[]).map(h => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              className={cn(
                'px-3 py-1 text-xs font-medium transition-colors',
                horizon === h
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              )}
            >
              {HORIZON_CONFIG[h].label}
            </button>
          ))}
        </div>
        <button
          onClick={scrollToToday}
          className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors"
        >
          Today
        </button>

        {(customStart || customEnd) && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">
            {customStart || '...'} — {customEnd || '...'}
          </span>
        )}

        <div className="relative ml-auto" ref={settingsRef}>
          <button
            onClick={() => setShowSettings(v => !v)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <MoreVertical size={14} />
          </button>
          {showSettings && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3 min-w-[240px]">
              <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showWeekends}
                  onChange={e => setShowWeekends(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-500 text-primary-600 focus:ring-primary-500"
                />
                <span className="font-medium">Show weekends</span>
              </label>
              <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mb-2" />
              <div className="text-xs font-medium text-gray-700 dark:text-gray-200 mb-2">Custom Date Range</div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="w-10 shrink-0">Start</span>
                  <input
                    type="date"
                    value={customStart}
                    onChange={e => setCustomStart(e.target.value)}
                    className="flex-1 px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="w-10 shrink-0">End</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={e => setCustomEnd(e.target.value)}
                    className="flex-1 px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </label>
              </div>
              {(customStart || customEnd) && (
                <button
                  onClick={() => { setCustomStart(''); setCustomEnd('') }}
                  className="mt-2 flex items-center gap-1 text-[10px] text-red-500 hover:text-red-400 transition-colors"
                >
                  <X size={10} />
                  Reset to default
                </button>
              )}
            </div>
          )}
        </div>

        {!hasScheduledTasks && !(customStart || customEnd) && (
          <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">
            No scheduled tasks yet — add start and end dates to see them on the timeline.
          </span>
        )}
      </div>

      {/* Chart */}
      <div ref={scrollRef} className="flex-1 overflow-auto relative">
        <div style={{ minWidth: LABEL_WIDTH + totalWidth, minHeight: HEADER_HEIGHT + totalHeight }}>
          {/* Timeline header */}
          <div
            className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700"
            style={{ height: HEADER_HEIGHT, marginLeft: LABEL_WIDTH }}
          >
            <div className="relative h-full" style={{ width: totalWidth }}>
              {columns.map((col, i) => {
                const isToday = col.toDateString() === today.toDateString()
                const isWeekend = showWeekends && columnType === 'day' && (col.getDay() === 0 || col.getDay() === 6)
                return (
                  <div
                    key={i}
                    className={cn(
                      'absolute top-0 h-full flex items-end pb-1.5 px-1.5 text-[11px] border-r border-gray-100 dark:border-gray-700/50',
                      isToday ? 'text-blue-600 dark:text-blue-400 font-bold' : isWeekend ? 'text-gray-300 dark:text-gray-600' : 'text-gray-400 dark:text-gray-500',
                      isWeekend && 'bg-gray-100/60 dark:bg-gray-700/20'
                    )}
                    style={{ left: i * colWidth, width: colWidth }}
                  >
                    <span className="truncate">{formatHeaderDate(col, columnType)}</span>
                  </div>
                )
              })}
              {/* Month labels for day/week zoom */}
              {columnType !== 'month' && (() => {
                const months: { label: string; left: number; width: number }[] = []
                let curMonth = ''
                let curStart = 0
                columns.forEach((col, i) => {
                  const m = getMonthLabel(col)
                  if (m !== curMonth) {
                    if (curMonth) months.push({ label: curMonth, left: curStart * colWidth, width: (i - curStart) * colWidth })
                    curMonth = m
                    curStart = i
                  }
                })
                if (curMonth) months.push({ label: curMonth, left: curStart * colWidth, width: (columns.length - curStart) * colWidth })
                return months.map((m, i) => (
                  <div
                    key={`month-${i}`}
                    className="absolute top-0 h-5 flex items-center px-2 text-[10px] font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700"
                    style={{ left: m.left, width: m.width }}
                  >
                    {m.label}
                  </div>
                ))
              })()}
            </div>
          </div>

          {/* Labels column (sticky) */}
          <div
            className="sticky left-0 z-10 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700"
            style={{ width: LABEL_WIDTH, position: 'absolute', top: HEADER_HEIGHT, height: totalHeight }}
          >
            {labelRows}
          </div>

          {/* Timeline body */}
          <div
            className="relative"
            style={{ marginLeft: LABEL_WIDTH, width: totalWidth, height: totalHeight, marginTop: 0 }}
          >
            {/* Grid lines */}
            {columns.map((_, i) => (
              <div
                key={`grid-${i}`}
                className="absolute top-0 border-r border-gray-100 dark:border-gray-700/30"
                style={{ left: i * colWidth, height: totalHeight }}
              />
            ))}

            {/* Weekend shading */}
            {weekendBands.map((band, i) => (
              <div
                key={`wknd-${i}`}
                className="absolute top-0 bg-gray-100/60 dark:bg-gray-700/20 pointer-events-none"
                style={{ left: band.left, width: band.width, height: totalHeight }}
              />
            ))}

            {/* Today marker */}
            {todayOffset >= 0 && todayOffset <= totalWidth && (
              <div
                className="absolute top-0 w-px bg-blue-500/50 z-10"
                style={{ left: todayOffset, height: totalHeight }}
              >
                <div className="absolute -top-0.5 -left-[3px] w-[7px] h-[7px] rounded-full bg-blue-500" />
              </div>
            )}

            {/* Task bars and row backgrounds */}
            {rows}
          </div>
        </div>
      </div>
    </div>
  )
}
