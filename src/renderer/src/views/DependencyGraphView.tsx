import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  MarkerType,
  SelectionMode,
  type OnSelectionChangeParams,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import { useGraph } from '@/hooks/use-dependencies'
import { useBulkDeleteTasks, useBulkUpdateStatus, useBulkAddToProject } from '@/hooks/use-tasks'
import { useProjects } from '@/hooks/use-projects'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { ArrowDown, ArrowRight, Play, Filter, MousePointer2, Trash2, Loader2 } from 'lucide-react'
import { STATUS_LABELS } from '@/lib/utils'
import type { TaskWithTags } from '../../../shared/types'

const STATUS_ACCENT: Record<string, string> = {
  todo: '#ef4444',
  'in-progress': '#f59e0b',
  done: '#22c55e',
  archived: '#9ca3af',
}

const STATUS_LABEL: Record<string, string> = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  done: 'Done',
  archived: 'Archived',
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#9ca3af',
}

const handleStyle = {
  width: 6,
  height: 6,
  background: '#d1d5db',
  border: 'none',
}

function TaskNode({ data }: { data: { task: TaskWithTags; direction: 'TB' | 'LR'; isRoot: boolean; isDimmed: boolean; isSelected: boolean } }) {
  const accent = STATUS_ACCENT[data.task.status] || STATUS_ACCENT.todo
  const priorityColor = PRIORITY_DOT[data.task.priority] || PRIORITY_DOT.low
  const statusLabel = STATUS_LABEL[data.task.status] || data.task.status
  const targetPos = data.direction === 'TB' ? Position.Top : Position.Left
  const sourcePos = data.direction === 'TB' ? Position.Bottom : Position.Right

  return (
    <div
      className={`px-3 py-2.5 rounded-lg shadow-sm cursor-pointer min-w-[200px] max-w-[240px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${data.isDimmed ? 'opacity-40' : ''} ${data.isSelected ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-900' : ''}`}
      style={{ borderLeftWidth: 4, borderLeftColor: accent }}
    >
      <Handle type="target" position={targetPos} style={handleStyle} />
      <div className="flex items-center gap-2">
        {data.isRoot && (
          <Play size={12} className="shrink-0 text-green-500 fill-green-500" />
        )}
        <div className="text-[13px] font-semibold truncate text-gray-900 dark:text-gray-100 flex-1">{data.task.title}</div>
        <span
          className="shrink-0 w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: priorityColor }}
          title={data.task.priority}
        />
      </div>
      <div className="text-[11px] mt-1 text-gray-500 dark:text-gray-400">{statusLabel}</div>
      <Handle type="source" position={sourcePos} style={handleStyle} />
    </div>
  )
}

const nodeTypes = { task: TaskNode }

function getLayoutedElements(nodes: Node[], edges: Edge[], direction: 'TB' | 'LR') {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, nodesep: 70, ranksep: 100 })

  nodes.forEach(node => g.setNode(node.id, { width: 220, height: 70 }))
  edges.forEach(edge => g.setEdge(edge.source, edge.target))

  dagre.layout(g)

  const layoutedNodes = nodes.map(node => {
    const pos = g.node(node.id)
    return { ...node, position: { x: pos.x - 110, y: pos.y - 35 } }
  })

  return { nodes: layoutedNodes, edges }
}

interface DependencyGraphViewProps {
  onTaskClick: (task: TaskWithTags) => void
  projectFilter?: string[]
}

export function DependencyGraphView({ onTaskClick, projectFilter }: DependencyGraphViewProps) {
  const { data: graph, isLoading } = useGraph()
  const [direction, setDirection] = useState<'TB' | 'LR'>('TB')
  const [showAvailableOnly, setShowAvailableOnly] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const bulkDelete = useBulkDeleteTasks()
  const bulkStatus = useBulkUpdateStatus()
  const bulkAddProject = useBulkAddToProject()
  const projects = useProjects()
  const { toast } = useToast()

  const onSelectionChange = useCallback(({ nodes }: OnSelectionChangeParams) => {
    setSelectedIds(new Set(nodes.map(n => n.id)))
  }, [])

  const handleBulkDelete = useCallback(() => {
    const ids = [...selectedIds]
    const count = ids.length
    setSelectedIds(new Set())
    bulkDelete.mutate(ids, {
      onSuccess: () => toast({ title: `Deleted ${count} task${count > 1 ? 's' : ''}`, variant: 'success' }),
      onError: () => toast({ title: 'Failed to delete tasks', variant: 'error' }),
    })
  }, [selectedIds, bulkDelete, toast])

  const handleBulkStatus = useCallback((status: string) => {
    const ids = [...selectedIds]
    const count = ids.length
    setSelectedIds(new Set())
    bulkStatus.mutate({ ids, status }, {
      onSuccess: () => toast({ title: `Updated ${count} task${count > 1 ? 's' : ''}`, variant: 'success' }),
      onError: () => toast({ title: 'Failed to update tasks', variant: 'error' }),
    })
  }, [selectedIds, bulkStatus, toast])

  const handleBulkAddProject = useCallback((project: string) => {
    const ids = [...selectedIds]
    const count = ids.length
    setSelectedIds(new Set())
    bulkAddProject.mutate({ ids, project }, {
      onSuccess: () => toast({ title: `Added ${count} task${count > 1 ? 's' : ''} to "${project}"`, variant: 'success' }),
      onError: () => toast({ title: 'Failed to update tasks', variant: 'error' }),
    })
  }, [selectedIds, bulkAddProject, toast])

  const hasProjectFilter = projectFilter && projectFilter.length > 0

  const { layoutedNodes, layoutedEdges, orphanCount } = useMemo(() => {
    if (!graph) return { layoutedNodes: [], layoutedEdges: [], orphanCount: 0 }

    // Apply project filter first
    let filteredNodes = graph.nodes
    if (hasProjectFilter) {
      filteredNodes = graph.nodes.filter(t =>
        t.projects.some(p => projectFilter.includes(p))
      )
    }

    const filteredNodeIds = new Set(filteredNodes.map(t => t.id))

    // Filter edges to only include those between filtered nodes
    let filteredEdges = graph.edges.filter(e =>
      filteredNodeIds.has(e.taskId) && filteredNodeIds.has(e.dependsOnId)
    )

    // Build a set of incoming dependency IDs per task (within the filtered set)
    const incomingDeps = new Map<string, string[]>()
    for (const task of filteredNodes) {
      const deps = task.dependencies.filter(depId => filteredNodeIds.has(depId))
      incomingDeps.set(task.id, deps)
    }

    // Determine root nodes: no incomplete incoming dependencies
    const rootIds = new Set<string>()
    for (const task of filteredNodes) {
      const deps = incomingDeps.get(task.id) || []
      const allDepsDone = deps.every(depId => {
        const depTask = filteredNodes.find(t => t.id === depId)
        return depTask && depTask.status === 'done'
      })
      if (allDepsDone) {
        rootIds.add(task.id)
      }
    }

    // Available tasks toggle: filter to tasks whose deps are all done and which are not done/archived themselves
    let visibleTasks = filteredNodes
    let visibleEdges = filteredEdges
    const dimmedIds = new Set<string>()

    if (showAvailableOnly) {
      const availableIds = new Set<string>()
      const contextIds = new Set<string>()

      for (const task of filteredNodes) {
        const deps = incomingDeps.get(task.id) || []
        const allDepsDone = deps.every(depId => {
          const depTask = filteredNodes.find(t => t.id === depId)
          return depTask && depTask.status === 'done'
        })
        if (allDepsDone && task.status !== 'done' && task.status !== 'archived') {
          availableIds.add(task.id)
          // Also include immediate done-dependencies for context
          for (const depId of deps) {
            contextIds.add(depId)
          }
        }
      }

      const showIds = new Set([...availableIds, ...contextIds])
      visibleTasks = filteredNodes.filter(t => showIds.has(t.id))
      visibleEdges = filteredEdges.filter(e => showIds.has(e.taskId) && showIds.has(e.dependsOnId))

      // Context (done deps) are dimmed
      for (const id of contextIds) {
        if (!availableIds.has(id)) {
          dimmedIds.add(id)
        }
      }
    }

    // When project filter is active, include ALL tasks (including orphans)
    // When no project filter, only show connected tasks (current behavior)
    let tasksToRender: TaskWithTags[]
    let orphanCount = 0

    if (hasProjectFilter || showAvailableOnly) {
      tasksToRender = visibleTasks
    } else {
      const connectedIds = new Set<string>()
      visibleEdges.forEach(edge => {
        connectedIds.add(edge.taskId)
        connectedIds.add(edge.dependsOnId)
      })
      tasksToRender = visibleTasks.filter(t => connectedIds.has(t.id))
      orphanCount = visibleTasks.length - tasksToRender.length
    }

    const nodes: Node[] = tasksToRender.map(task => ({
      id: task.id,
      type: 'task',
      data: { task, direction, isRoot: rootIds.has(task.id), isDimmed: dimmedIds.has(task.id), isSelected: false },
      position: { x: 0, y: 0 },
      selectable: true,
    }))

    const taskIdSet = new Set(tasksToRender.map(t => t.id))
    const edges: Edge[] = visibleEdges
      .filter(e => taskIdSet.has(e.taskId) && taskIdSet.has(e.dependsOnId))
      .map(edge => ({
        id: edge.id,
        source: edge.dependsOnId,
        target: edge.taskId,
        type: 'smoothstep',
        style: { stroke: '#d1d5db' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#d1d5db' },
      }))

    const { nodes: ln, edges: le } = getLayoutedElements(nodes, edges, direction)
    return { layoutedNodes: ln, layoutedEdges: le, orphanCount }
  }, [graph, direction, hasProjectFilter, projectFilter, showAvailableOnly])

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (selectMode) return // In select mode, clicking toggles selection (handled by ReactFlow)
    const task = (node.data as { task: TaskWithTags }).task
    onTaskClick(task)
  }, [onTaskClick, selectMode])

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges)

  // Update when graph changes
  useMemo(() => {
    setNodes(layoutedNodes)
    setEdges(layoutedEdges)
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges])

  // Update isSelected in node data when selection changes
  useEffect(() => {
    setNodes(nds => nds.map(node => ({
      ...node,
      data: { ...node.data, isSelected: selectedIds.has(node.id) },
    })))
  }, [selectedIds, setNodes])

  if (isLoading) return <div className="text-gray-500 dark:text-gray-400 text-center py-8">Loading graph...</div>

  if (!graph?.nodes.length) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
        <p className="text-gray-600 dark:text-gray-300 mb-2">No tasks to display</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">Create tasks and add dependencies to see the graph</p>
      </div>
    )
  }

  if (!layoutedNodes.length) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
        <p className="text-gray-600 dark:text-gray-300 mb-2">
          {showAvailableOnly ? 'No available tasks' : 'No dependencies yet'}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {showAvailableOnly
            ? 'All tasks are either done or still blocked by incomplete dependencies.'
            : `${graph.nodes.length} task${graph.nodes.length !== 1 ? 's' : ''} exist but none have dependencies. Open a task and add dependencies to see the graph.`
          }
        </p>
      </div>
    )
  }

  return (
    <div className="h-full w-full rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ minHeight: 500 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        selectionOnDrag={selectMode}
        panOnDrag={!selectMode}
        selectionMode={SelectionMode.Partial}
        selectNodesOnDrag={selectMode}
        nodesConnectable={false}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background variant={BackgroundVariant.Dots} color="#d1d5db" gap={20} size={1} />
        <Controls />
        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <Panel position="top-left">
            <div className="flex items-center gap-3 px-4 py-2 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                {selectedIds.size} selected
              </span>
              <div className="h-4 w-px bg-primary-300 dark:bg-primary-700" />
              <select
                defaultValue=""
                disabled={bulkStatus.isPending}
                onChange={e => { if (e.target.value) handleBulkStatus(e.target.value); e.target.value = '' }}
                className="text-sm px-2 py-1 rounded border border-primary-300 dark:border-primary-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-50"
              >
                <option value="" disabled>{bulkStatus.isPending ? 'Updating...' : 'Set status...'}</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select
                defaultValue=""
                disabled={bulkAddProject.isPending}
                onChange={e => { if (e.target.value) handleBulkAddProject(e.target.value); e.target.value = '' }}
                className="text-sm px-2 py-1 rounded border border-primary-300 dark:border-primary-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-50"
              >
                <option value="" disabled>{bulkAddProject.isPending ? 'Adding...' : 'Add to project...'}</option>
                {projects.map(project => (
                  <option key={project} value={project}>{project}</option>
                ))}
              </select>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDelete.isPending}
                className="flex items-center gap-1 text-sm text-danger-600 dark:text-danger-400 hover:text-danger-700 dark:hover:text-danger-300 transition-colors disabled:opacity-50"
              >
                {bulkDelete.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="ml-auto text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                Clear
              </button>
            </div>
          </Panel>
        )}
        <Panel position="top-right">
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-1">
              <Button
                size="sm"
                variant={direction === 'TB' ? 'primary' : 'ghost'}
                onClick={() => setDirection('TB')}
                className="gap-1"
              >
                <ArrowDown size={14} /> Top-Down
              </Button>
              <Button
                size="sm"
                variant={direction === 'LR' ? 'primary' : 'ghost'}
                onClick={() => setDirection('LR')}
                className="gap-1"
              >
                <ArrowRight size={14} /> Left-Right
              </Button>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-1">
              <Button
                size="sm"
                variant={selectMode ? 'primary' : 'ghost'}
                onClick={() => setSelectMode(!selectMode)}
                className="gap-1"
              >
                <MousePointer2 size={14} /> Select
              </Button>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-1">
              <Button
                size="sm"
                variant={showAvailableOnly ? 'primary' : 'ghost'}
                onClick={() => setShowAvailableOnly(!showAvailableOnly)}
                className="gap-1"
              >
                <Filter size={14} /> Available Tasks
              </Button>
            </div>
            {orphanCount > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded px-2 py-1 shadow border border-gray-200 dark:border-gray-700">
                {orphanCount} task{orphanCount !== 1 ? 's' : ''} without dependencies hidden
              </span>
            )}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}
