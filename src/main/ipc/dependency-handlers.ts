import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { getWorkspaceConfig } from '../workspace-config'
import { fragmentToTask, taskToFragmentPayload } from '../fragment-serializer'
import { updateFragment } from '../usable-api'
import { getCachedTaskFragments, getCachedFragment, invalidateTaskCache, broadcastTasksChanged } from '../task-cache'
import type { IpcResponse, GraphData, TaskWithTags } from '../../shared/types'

function hasCycle(
  allTasks: TaskWithTags[],
  newTaskId: string,
  newDependsOnId: string
): boolean {
  // Build adjacency map from all tasks' dependencies
  const adjList = new Map<string, string[]>()
  for (const task of allTasks) {
    adjList.set(task.id, [...task.dependencies])
  }

  // Add the proposed edge
  const existing = adjList.get(newTaskId) || []
  adjList.set(newTaskId, [...existing, newDependsOnId])

  // DFS from newDependsOnId to see if we can reach newTaskId
  const visited = new Set<string>()
  const stack = [newDependsOnId]

  while (stack.length > 0) {
    const current = stack.pop()!
    if (current === newTaskId) return true
    if (visited.has(current)) continue
    visited.add(current)
    const neighbors = adjList.get(current) || []
    for (const neighbor of neighbors) {
      stack.push(neighbor)
    }
  }

  return false
}

export function registerDependencyHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.DEPS_LIST, async (_event, taskId: string): Promise<IpcResponse> => {
    try {
      const config = getWorkspaceConfig()
      if (!config) return { success: false, error: 'No workspace configured' }
      const fragment = await getCachedFragment(config.workspaceId, taskId)
      const task = fragmentToTask(fragment)
      return { success: true, data: task.dependencies }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.DEPS_ADD, async (_event, taskId: string, dependsOnId: string): Promise<IpcResponse> => {
    try {
      if (taskId === dependsOnId) {
        return { success: false, error: 'A task cannot depend on itself' }
      }

      const config = getWorkspaceConfig()
      if (!config) return { success: false, error: 'No workspace configured' }

      // Fetch all tasks for cycle detection (uses cache)
      const fragments = await getCachedTaskFragments(config.workspaceId)
      const allTasks = fragments.map(fragmentToTask)

      const currentTask = allTasks.find(t => t.id === taskId)
      if (!currentTask) return { success: false, error: 'Task not found' }

      // Check for existing dependency
      if (currentTask.dependencies.includes(dependsOnId)) {
        return { success: false, error: 'Dependency already exists' }
      }

      // Cycle detection
      if (hasCycle(allTasks, taskId, dependsOnId)) {
        return { success: false, error: 'Adding this dependency would create a circular dependency' }
      }

      // Update the task's dependencies in frontmatter
      const newDeps = [...currentTask.dependencies, dependsOnId]
      const payload = taskToFragmentPayload({
        ...currentTask,
        dependencies: newDeps,
      })
      await updateFragment(taskId, payload)

      invalidateTaskCache()
      broadcastTasksChanged()
      return { success: true, data: { taskId, dependsOnId } }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.DEPS_REMOVE, async (_event, taskId: string, dependsOnId: string): Promise<IpcResponse> => {
    try {
      const config = getWorkspaceConfig()
      if (!config) return { success: false, error: 'No workspace configured' }
      const fragment = await getCachedFragment(config.workspaceId, taskId)
      const task = fragmentToTask(fragment)

      const newDeps = task.dependencies.filter(d => d !== dependsOnId)
      const payload = taskToFragmentPayload({
        ...task,
        dependencies: newDeps,
      })
      await updateFragment(taskId, payload)

      invalidateTaskCache()
      broadcastTasksChanged()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.DEPS_GET_GRAPH, async (): Promise<IpcResponse<GraphData>> => {
    try {
      const config = getWorkspaceConfig()
      if (!config) return { success: false, error: 'No workspace configured' }

      const fragments = await getCachedTaskFragments(config.workspaceId)
      const nodes = fragments.map(fragmentToTask)

      // Build edges from each task's dependencies array
      const edges: { id: string; taskId: string; dependsOnId: string }[] = []
      for (const task of nodes) {
        for (const depId of task.dependencies) {
          edges.push({
            id: `${task.id}-${depId}`,
            taskId: task.id,
            dependsOnId: depId,
          })
        }
      }

      return { success: true, data: { nodes, edges } }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
}
