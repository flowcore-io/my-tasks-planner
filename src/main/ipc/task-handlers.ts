import { ipcMain } from 'electron'
import crypto from 'node:crypto'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { getWorkspaceConfig } from '../workspace-config'
import { taskToFragmentPayload, fragmentToTask } from '../fragment-serializer'
import { listFragments, getFragment, createFragment, updateFragment, countFragments } from '../usable-api'
import { getTokenClaims } from '../auth'
import type { IpcResponse, TaskWithTags, CreateTaskInput, UpdateTaskInput } from '../../shared/types'

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

      const tags = ['task']
      if (filters?.status) tags.push(`status:${filters.status}`)
      if (filters?.priority) tags.push(`priority:${filters.priority}`)

      const fragments = await listFragments(config.workspaceId, { tags, limit: 200 })
      let tasks = fragments.map(fragmentToTask)

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
      const fragment = await getFragment(id)
      return { success: true, data: fragmentToTask(fragment) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TASKS_CREATE, async (_event, data: CreateTaskInput): Promise<IpcResponse<TaskWithTags>> => {
    try {
      const config = requireConfig()
      const now = new Date().toISOString()

      // Get current task count for ordering
      const order = await countFragments(config.workspaceId, { tags: ['task'] })

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

      // Fetch the created fragment to return complete data
      const fragment = await getFragment(result.fragmentId)
      return { success: true, data: fragmentToTask(fragment) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TASKS_UPDATE, async (_event, id: string, data: UpdateTaskInput): Promise<IpcResponse<TaskWithTags>> => {
    try {
      // Fetch current fragment
      const fragment = await getFragment(id)
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

      // Fetch updated fragment
      const updated = await getFragment(id)
      return { success: true, data: fragmentToTask(updated) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TASKS_DELETE, async (_event, id: string): Promise<IpcResponse> => {
    try {
      // Archive via status change (no delete endpoint in API)
      const fragment = await getFragment(id)
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

      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TASKS_REORDER, async (_event, updates: { id: string; kanbanOrder?: number; listOrder?: number; status?: string }[]): Promise<IpcResponse> => {
    try {
      await Promise.all(updates.map(async (update) => {
        const fragment = await getFragment(update.id)
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

      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TASKS_ADD_COMMENT, async (_event, taskId: string, text: string): Promise<IpcResponse<TaskWithTags>> => {
    try {
      const fragment = await getFragment(taskId)
      const current = fragmentToTask(fragment)

      const claims = getTokenClaims()
      const author = claims?.name || 'Unknown'
      const authorEmail = claims?.email || ''

      const newComment = {
        id: crypto.randomUUID(),
        text,
        author,
        authorEmail,
        createdAt: new Date().toISOString(),
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

      const updated = await getFragment(taskId)
      return { success: true, data: fragmentToTask(updated) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
}
