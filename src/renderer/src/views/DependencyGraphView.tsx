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
  type Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import ELK from 'elkjs/lib/elk.bundled.js'
import { useGraph, useAddDependency, useRemoveDependency } from '@/hooks/use-dependencies'
import { useBulkDeleteTasks, useBulkUpdateStatus, useBulkAddToProject } from '@/hooks/use-tasks'
import { useProjects } from '@/hooks/use-projects'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { ArrowDown, ArrowRight, Play, Filter, MousePointer2, Trash2, Loader2, ArrowLeftRight, ChevronUp } from 'lucide-react'
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

const PRIORITY_CHEVRONS: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
}

const centerHandleStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  background: 'transparent',
  border: 'none',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  cursor: 'crosshair',
  opacity: 0,
}

function PriorityChevrons({ priority }: { priority: string }) {
  const count = PRIORITY_CHEVRONS[priority] ?? 1
  return (
    <div className="shrink-0 flex flex-col items-center -space-y-[5px]" title={priority}>
      {Array.from({ length: count }, (_, i) => (
        <ChevronUp key={i} size={10} className="text-gray-400 dark:text-gray-500" strokeWidth={2.5} />
      ))}
    </div>
  )
}

function TaskNode({ data }: { data: { task: TaskWithTags; direction: 'TB' | 'LR'; isRoot: boolean; isDimmed: boolean; isSelected: boolean } }) {
  const accent = STATUS_ACCENT[data.task.status] || STATUS_ACCENT.todo
  const statusLabel = STATUS_LABEL[data.task.status] || data.task.status
  const targetPos = data.direction === 'TB' ? Position.Top : Position.Left
  const sourcePos = data.direction === 'TB' ? Position.Bottom : Position.Right

  return (
    <div
      className={`group relative px-3 py-2.5 rounded-lg shadow-sm cursor-pointer min-w-[200px] max-w-[240px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${data.isDimmed ? 'opacity-40' : ''} ${data.isSelected ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-900' : ''}`}
      style={{ borderLeftWidth: 4, borderLeftColor: accent }}
    >
      <Handle type="target" position={targetPos} style={{ ...centerHandleStyle, zIndex: 1 }} />
      <Handle type="source" position={sourcePos} style={{ ...centerHandleStyle, zIndex: 2 }} />
      {/* Connection point indicator — visible on hover */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <div className="w-3 h-3 rounded-full bg-gray-400/40 border-2 border-gray-400/60" />
      </div>
      <div className="flex items-center gap-2">
        {data.isRoot && (
          <Play size={12} className="shrink-0 text-green-500 fill-green-500" />
        )}
        <div className="text-[13px] font-semibold truncate text-gray-900 dark:text-gray-100 flex-1">{data.task.title}</div>
        <PriorityChevrons priority={data.task.priority} />
      </div>
      <div className="text-[11px] mt-1 text-gray-500 dark:text-gray-400">{statusLabel}</div>
    </div>
  )
}

const nodeTypes = { task: TaskNode }

const elk = new ELK()

async function getLayoutedElements(nodes: Node[], edges: Edge[], direction: 'TB' | 'LR') {
  const elkDirection = direction === 'TB' ? 'DOWN' : 'RIGHT'

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': elkDirection,
      'elk.spacing.nodeNode': '80',
      'elk.layered.spacing.nodeNodeBetweenLayers': '100',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.separateConnectedComponents': 'false',
    },
    children: nodes.map(node => ({
      id: node.id,
      width: 240,
      height: 70,
    })),
    edges: edges.map(edge => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  }

  const layouted = await elk.layout(graph)

  const layoutedNodes = nodes.map(node => {
    const elkNode = layouted.children?.find(n => n.id === node.id)
    return {
      ...node,
      position: {
        x: Math.round((elkNode?.x ?? 0) / 20) * 20,
        y: Math.round((elkNode?.y ?? 0) / 20) * 20,
      },
    }
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

  const addDependency = useAddDependency()
  const removeDependency = useRemoveDependency()
  const [clickedEdge, setClickedEdge] = useState<{ id: string; source: string; target: string; x: number; y: number } | null>(null)

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    const bounds = (event.currentTarget as HTMLElement).closest('.react-flow')?.getBoundingClientRect()
    if (!bounds) return
    setClickedEdge({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    })
  }, [])

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

  const [computedLayout, setComputedLayout] = useState<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] })

  const orphanCount = useMemo(() => {
    if (!graph || hasProjectFilter || showAvailableOnly) return 0

    let filteredNodes = graph.nodes.filter(t => t.status !== 'archived')
    const filteredNodeIds = new Set(filteredNodes.map(t => t.id))
    const filteredEdges = graph.edges.filter(e =>
      filteredNodeIds.has(e.taskId) && filteredNodeIds.has(e.dependsOnId)
    )

    const connectedIds = new Set<string>()
    filteredEdges.forEach(edge => {
      connectedIds.add(edge.taskId)
      connectedIds.add(edge.dependsOnId)
    })
    return filteredNodes.filter(t => !connectedIds.has(t.id)).length
  }, [graph, hasProjectFilter, showAvailableOnly])

  useEffect(() => {
    if (!graph) {
      setComputedLayout({ nodes: [], edges: [] })
      return
    }

    // Exclude archived tasks, then apply project filter
    let filteredNodes = graph.nodes.filter(t => t.status !== 'archived')
    if (hasProjectFilter) {
      filteredNodes = filteredNodes.filter(t =>
        t.projects.some(p => projectFilter!.includes(p))
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

    if (hasProjectFilter || showAvailableOnly) {
      tasksToRender = visibleTasks
    } else {
      const connectedIds = new Set<string>()
      visibleEdges.forEach(edge => {
        connectedIds.add(edge.taskId)
        connectedIds.add(edge.dependsOnId)
      })
      tasksToRender = visibleTasks.filter(t => connectedIds.has(t.id))
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
        style: { stroke: '#6b7280', strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280', width: 16, height: 16 },
      }))

    let cancelled = false
    getLayoutedElements(nodes, edges, direction).then(result => {
      if (!cancelled) {
        setComputedLayout(result)
      }
    })

    return () => { cancelled = true }
  }, [graph, direction, hasProjectFilter, projectFilter, showAvailableOnly])

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (selectMode) return // In select mode, clicking toggles selection (handled by ReactFlow)
    const task = (node.data as { task: TaskWithTags }).task
    onTaskClick(task)
  }, [onTaskClick, selectMode])

  const [nodes, setNodes, onNodesChange] = useNodesState(computedLayout.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(computedLayout.edges)

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return
    if (connection.source === connection.target) return

    // Optimistic: show an animated edge immediately
    const pendingId = `pending-${connection.source}-${connection.target}`
    const pendingEdge: Edge = {
      id: pendingId,
      source: connection.source,
      target: connection.target,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#60a5fa', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#60a5fa', width: 16, height: 16 },
    }
    setEdges(eds => [...eds, pendingEdge])

    addDependency.mutate(
      { taskId: connection.target, dependsOnId: connection.source },
      {
        onSuccess: () => toast({ title: 'Dependency added', variant: 'success' }),
        onError: (err) => {
          setEdges(eds => eds.filter(e => e.id !== pendingId))
          toast({ title: err instanceof Error ? err.message : 'Failed to add dependency', variant: 'error' })
        },
      },
    )
  }, [addDependency, toast, setEdges])

  const handleDeleteEdge = useCallback(() => {
    if (!clickedEdge) return
    const { id, source, target } = clickedEdge
    setClickedEdge(null)

    // Optimistic: remove edge immediately
    setEdges(eds => eds.filter(e => e.id !== id))

    // source = dependsOnId, target = taskId (matches how edges are built)
    removeDependency.mutate(
      { taskId: target, dependsOnId: source },
      {
        onSuccess: () => toast({ title: 'Dependency removed', variant: 'success' }),
        onError: (err) => {
          toast({ title: err instanceof Error ? err.message : 'Failed to remove dependency', variant: 'error' })
        },
      },
    )
  }, [clickedEdge, removeDependency, toast, setEdges])

  const handleSwapEdge = useCallback(() => {
    if (!clickedEdge) return
    const { id, source, target } = clickedEdge
    setClickedEdge(null)

    // Optimistic: replace edge with reversed animated one
    const pendingId = `pending-${target}-${source}`
    setEdges(eds => [
      ...eds.filter(e => e.id !== id),
      {
        id: pendingId,
        source: target,
        target: source,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#60a5fa', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#60a5fa', width: 16, height: 16 },
      },
    ])

    // Remove old, then add reversed
    removeDependency.mutate(
      { taskId: target, dependsOnId: source },
      {
        onSuccess: () => {
          addDependency.mutate(
            { taskId: source, dependsOnId: target },
            {
              onSuccess: () => toast({ title: 'Dependency direction swapped', variant: 'success' }),
              onError: (err) => {
                toast({ title: err instanceof Error ? err.message : 'Failed to add reversed dependency', variant: 'error' })
              },
            },
          )
        },
        onError: (err) => {
          toast({ title: err instanceof Error ? err.message : 'Failed to remove original dependency', variant: 'error' })
        },
      },
    )
  }, [clickedEdge, removeDependency, addDependency, toast, setEdges])

  // Update when layout changes
  useEffect(() => {
    setNodes(computedLayout.nodes)
    setEdges(computedLayout.edges)
  }, [computedLayout, setNodes, setEdges])

  // Update isSelected in node data when selection changes
  useEffect(() => {
    setNodes(nds => nds.map(node => ({
      ...node,
      data: { ...node.data, isSelected: selectedIds.has(node.id) },
    })))
  }, [selectedIds, setNodes])

  // Highlight clicked edge
  useEffect(() => {
    setEdges(eds => eds.map(edge => {
      if (edge.id === clickedEdge?.id) {
        return { ...edge, style: { stroke: '#ef4444', strokeWidth: 2.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#ef4444', width: 16, height: 16 } }
      }
      // Reset non-clicked edges to default style (skip pending edges)
      if (edge.id.startsWith('pending-')) return edge
      return { ...edge, style: { stroke: '#6b7280', strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280', width: 16, height: 16 } }
    }))
  }, [clickedEdge, setEdges])

  if (isLoading) return <div className="text-gray-500 dark:text-gray-400 text-center py-8">Loading graph...</div>

  if (!graph?.nodes.length) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
        <p className="text-gray-600 dark:text-gray-300 mb-2">No tasks to display</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">Create tasks and add dependencies to see the graph</p>
      </div>
    )
  }

  if (!computedLayout.nodes.length) {
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
    <div className="relative h-full w-full rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ minHeight: 500 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={() => setClickedEdge(null)}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        selectionOnDrag={selectMode}
        panOnDrag={!selectMode}
        selectionMode={SelectionMode.Partial}
        selectNodesOnDrag={selectMode}
        connectionLineStyle={{ stroke: '#60a5fa', strokeWidth: 2 }}
        snapToGrid={true}
        snapGrid={[20, 20]}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background variant={BackgroundVariant.Dots} color="#374151" gap={20} size={1} />
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
      {/* Edge delete popover — outside ReactFlow to avoid event interference */}
      {clickedEdge && (
        <div
          className="absolute z-50 flex items-center gap-1 px-1 py-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg"
          style={{ left: clickedEdge.x, top: clickedEdge.y, transform: 'translate(-50%, -120%)' }}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={handleSwapEdge}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <ArrowLeftRight size={12} />
            Swap
          </button>
          <div className="w-px h-4 bg-gray-600" />
          <button
            onClick={handleDeleteEdge}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-danger-400 hover:text-danger-300 hover:bg-gray-700 transition-colors"
          >
            <Trash2 size={12} />
            Remove
          </button>
        </div>
      )}
    </div>
  )
}
