import { ipcMain } from 'electron'
import crypto from 'node:crypto'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { getWorkspaceConfig } from '../workspace-config'
import { taskToFragmentPayload, fragmentToTask } from '../fragment-serializer'
import { createFragment, updateFragment, countFragments } from '../usable-api'
import { getCachedTaskFragments, getCachedFragment, invalidateTaskCache, broadcastTasksChanged } from '../task-cache'
import { getTokenClaims } from '../auth'
import type { IpcResponse, TaskWithTags, CreateTaskInput, UpdateTaskInput } from '../../shared/types'

// Promise-based dedup guard for task creation — prevents duplicate creates from race conditions.
// Stores the in-flight Promise immediately (before await), so a second call finds it and awaits
// the same Promise instead of starting a new creation.
const inflightCreates = new Map<string, Promise<IpcResponse<TaskWithTags>>>()

function requireConfig() {
  const config = getWorkspaceConfig()
  if (!config) throw new Error('No workspace configured. Please connect a workspace in Settings.')
  if (!config.taskFragmentTypeId) throw new Error('No fragment type configured. Please select a fragment type in Settings.')
  return config
}

export function registerTaskHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.TASKS_LIST, async (_event, filters?: { status?: string; priority?: string; tag?: string }): Promise<IpcResponse<TaskWithTags[]>> => {
    try {
      const config = requireConfig()

      const fragments = await getCachedTaskFragments(config.workspaceId)
      let tasks = fragments.map(fragmentToTask)

      // Client-side filter for status/priority (cache always holds all tasks)
      if (filters?.status) {
        tasks = tasks.filter(t => t.status === filters.status)
      }
      if (filters?.priority) {
        tasks = tasks.filter(t => t.priority === filters.priority)
      }

      // Exclude archived unless explicitly filtering for them
      if (!filters?.status || filters.status !== 'archived') {
        tasks = tasks.filter(t => t.status !== 'archived')
      }

      // Client-side filter for tag (API tag filtering is OR-based)
      if (filters?.tag) {
        tasks = tasks.filter(t => t.tags.includes(filters.tag!))
      }

      // Sort by listOrder
      tasks.sort((a, b) => a.listOrder - b.listOrder)

      return { success: true, data: tasks }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TASKS_GET, async (_event, id: string): Promise<IpcResponse<TaskWithTags>> => {
    try {
      const config = requireConfig()
      const fragment = await getCachedFragment(config.workspaceId, id)
      return { success: true, data: fragmentToTask(fragment) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TASKS_CREATE, async (_event, data: CreateTaskInput): Promise<IpcResponse<TaskWithTags>> => {
    const dedupKey = JSON.stringify({ t: data.title, s: data.status, p: data.priority, tags: data.tags, proj: data.projects })

    // If an identical create is already in-flight, await the same Promise
    const inflight = inflightCreates.get(dedupKey)
    if (inflight) {
      console.log('[task-handlers] Dedup: awaiting in-flight create for:', data.title)
      return inflight
    }

    const promise = (async (): Promise<IpcResponse<TaskWithTags>> => {
      try {
        const config = requireConfig()
        const now = new Date().toISOString()

        // Get current task count for ordering
        const order = await countFragments(config.workspaceId, { tags: ['source:my-tasks-plan'] })

        const payload = taskToFragmentPayload({
          title: data.title,
          description: data.description,
          status: data.status || 'todo',
          priority: data.priority || 'medium',
          kanbanOrder: order,
          listOrder: order,
          createdAt: now,
          tags: data.tags,
          projects: data.projects,
          dependencies: [],
        })

        const result = await createFragment({
          workspaceId: config.workspaceId,
          fragmentTypeId: config.taskFragmentTypeId!,
          ...payload,
        })

        invalidateTaskCache()
      broadcastTasksChanged()

        // Construct response from input data instead of re-fetching
        const created: TaskWithTags = {
          id: result.fragmentId,
          title: data.title,
          description: data.description || '',
          status: data.status || 'todo',
          priority: data.priority || 'medium',
          kanbanOrder: order,
          listOrder: order,
          createdAt: now,
          updatedAt: now,
          tags: data.tags || [],
          projects: data.projects || [],
          dependencies: [],
          comments: [],
        }

        return { success: true, data: created }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })()

    // Store the Promise IMMEDIATELY (synchronously, before await) so the next call finds it
    inflightCreates.set(dedupKey, promise)

    try {
      const response = await promise
      // Keep in map briefly to catch late duplicates, then clean up
      setTimeout(() => inflightCreates.delete(dedupKey), 5_000)
      return response
    } catch (error) {
      inflightCreates.delete(dedupKey)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TASKS_UPDATE, async (_event, id: string, data: UpdateTaskInput): Promise<IpcResponse<TaskWithTags>> => {
    try {
      const config = requireConfig()
      // Fetch current fragment (from cache when available)
      const fragment = await getCachedFragment(config.workspaceId, id)
      const current = fragmentToTask(fragment)

      // Merge updates
      const merged = {
        title: data.title ?? current.title,
        description: data.description ?? current.description,
        status: data.status ?? current.status,
        priority: data.priority ?? current.priority,
        kanbanOrder: data.kanbanOrder ?? current.kanbanOrder,
        listOrder: data.listOrder ?? current.listOrder,
        createdAt: current.createdAt,
        tags: data.tags ?? current.tags,
        projects: data.projects ?? current.projects,
        dependencies: data.dependencies ?? current.dependencies,
        comments: data.comments ?? current.comments,
      }

      const payload = taskToFragmentPayload(merged)
      await updateFragment(id, payload)

      invalidateTaskCache()
      broadcastTasksChanged()

      // Return merged data directly instead of re-fetching
      const result: TaskWithTags = {
        id,
        ...merged,
        updatedAt: new Date().toISOString(),
      }
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TASKS_DELETE, async (_event, id: string): Promise<IpcResponse> => {
    try {
      const config = requireConfig()
      // Archive via status change (no delete endpoint in API)
      const fragment = await getCachedFragment(config.workspaceId, id)
      const current = fragmentToTask(fragment)

      const payload = taskToFragmentPayload({
        ...current,
        status: 'archived',
        tags: current.tags,
        projects: current.projects,
        dependencies: current.dependencies,
        comments: current.comments,
      })

      await updateFragment(id, {
        ...payload,
        tags: [...payload.tags.filter(t => !t.startsWith('status:')), 'status:archived'],
      })

      invalidateTaskCache()
      broadcastTasksChanged()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TASKS_REORDER, async (_event, updates: { id: string; kanbanOrder?: number; listOrder?: number; status?: string }[]): Promise<IpcResponse> => {
    try {
      const config = requireConfig()
      await Promise.all(updates.map(async (update) => {
        const fragment = await getCachedFragment(config.workspaceId, update.id)
        const current = fragmentToTask(fragment)

        const merged = {
          title: current.title,
          description: current.description,
          status: update.status ? (update.status as any) : current.status,
          priority: current.priority,
          kanbanOrder: update.kanbanOrder ?? current.kanbanOrder,
          listOrder: update.listOrder ?? current.listOrder,
          createdAt: current.createdAt,
          tags: current.tags,
          projects: current.projects,
          dependencies: current.dependencies,
          comments: current.comments,
        }

        const payload = taskToFragmentPayload(merged)
        await updateFragment(update.id, payload)
      }))

      invalidateTaskCache()
      broadcastTasksChanged()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TASKS_ADD_COMMENT, async (_event, taskId: string, text: string): Promise<IpcResponse<TaskWithTags>> => {
    try {
      const config = requireConfig()
      const fragment = await getCachedFragment(config.workspaceId, taskId)
      const current = fragmentToTask(fragment)

      const claims = getTokenClaims()
      const author = claims?.name || 'Unknown'
      const authorEmail = claims?.email || ''

      const now = new Date().toISOString()
      const newComment = {
        id: crypto.randomUUID(),
        text,
        author,
        authorEmail,
        createdAt: now,
      }

      const merged = {
        title: current.title,
        description: current.description,
        status: current.status,
        priority: current.priority,
        kanbanOrder: current.kanbanOrder,
        listOrder: current.listOrder,
        createdAt: current.createdAt,
        tags: current.tags,
        projects: current.projects,
        dependencies: current.dependencies,
        comments: [...current.comments, newComment],
      }

      const payload = taskToFragmentPayload(merged)
      await updateFragment(taskId, payload)

      invalidateTaskCache()
      broadcastTasksChanged()

      // Return merged data directly instead of re-fetching
      const result: TaskWithTags = {
        id: taskId,
        ...merged,
        updatedAt: now,
      }
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
}
