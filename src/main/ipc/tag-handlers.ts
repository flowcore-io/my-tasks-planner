import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { getWorkspaceConfig } from '../workspace-config'
import { fragmentToTask, taskToFragmentPayload } from '../fragment-serializer'
import { listFragments, getFragment, updateFragment } from '../usable-api'
import { invalidateTaskCache, broadcastTasksChanged } from '../task-cache'
import type { IpcResponse } from '../../shared/types'

export function registerTagHandlers(): void {
  // List all unique user tags across task fragments
  ipcMain.handle(IPC_CHANNELS.TAGS_LIST, async (): Promise<IpcResponse<string[]>> => {
    try {
      const config = getWorkspaceConfig()
      if (!config) return { success: true, data: [] }

      const fragments = await listFragments(config.workspaceId, { tags: ['source:my-tasks-plan'], limit: 200 })
      const tagSet = new Set<string>()

      for (const fragment of fragments) {
        const task = fragmentToTask(fragment)
        for (const tag of task.tags) {
          tagSet.add(tag)
        }
      }

      return { success: true, data: Array.from(tagSet).sort() }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // No-op: tags are created implicitly when assigned
  ipcMain.handle(IPC_CHANNELS.TAGS_CREATE, async (_event, data: { name: string }): Promise<IpcResponse> => {
    return { success: true, data: { name: data.name } }
  })

  // Delete a tag from all task fragments
  ipcMain.handle(IPC_CHANNELS.TAGS_DELETE, async (_event, tagName: string): Promise<IpcResponse> => {
    try {
      const config = getWorkspaceConfig()
      if (!config) return { success: false, error: 'No workspace configured' }

      const fragments = await listFragments(config.workspaceId, { tags: ['task', tagName], limit: 200 })

      for (const fragment of fragments) {
        const task = fragmentToTask(fragment)
        const newTags = task.tags.filter(t => t !== tagName)
        if (newTags.length !== task.tags.length) {
          const payload = taskToFragmentPayload({ ...task, tags: newTags })
          await updateFragment(fragment.id, payload)
        }
      }

      invalidateTaskCache()
      broadcastTasksChanged()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Assign a tag to a task
  ipcMain.handle(IPC_CHANNELS.TAGS_ASSIGN, async (_event, taskId: string, tagName: string): Promise<IpcResponse> => {
    try {
      const fragment = await getFragment(taskId)
      const task = fragmentToTask(fragment)

      if (task.tags.includes(tagName)) {
        return { success: true } // Already assigned
      }

      const newTags = [...task.tags, tagName]
      const payload = taskToFragmentPayload({ ...task, tags: newTags })
      await updateFragment(taskId, payload)

      invalidateTaskCache()
      broadcastTasksChanged()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Unassign a tag from a task
  ipcMain.handle(IPC_CHANNELS.TAGS_UNASSIGN, async (_event, taskId: string, tagName: string): Promise<IpcResponse> => {
    try {
      const fragment = await getFragment(taskId)
      const task = fragmentToTask(fragment)

      const newTags = task.tags.filter(t => t !== tagName)
      const payload = taskToFragmentPayload({ ...task, tags: newTags })
      await updateFragment(taskId, payload)

      invalidateTaskCache()
      broadcastTasksChanged()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
}
