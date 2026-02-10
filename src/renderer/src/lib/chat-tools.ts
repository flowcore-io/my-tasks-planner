import type { QueryClient } from '@tanstack/react-query'
import type { ParentToolSchema } from '@/lib/embed-sdk'

// Promise-based deduplication for mutating tool calls.
// Stores the in-flight Promise immediately (before await), so a duplicate call awaits
// the same Promise instead of starting a new API call.
const inflightCalls = new Map<string, Promise<unknown>>()

export const PARENT_TOOLS: ParentToolSchema[] = [
  {
    name: 'list_tasks',
    description: 'List all tasks. Each task includes: id, title, description, status, priority, tags (string[]), projects (string[]), dependencies (id[]), createdAt, updatedAt. Optionally filter by status or priority.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['todo', 'in-progress', 'done', 'archived'], description: 'Filter by status' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Filter by priority' },
      },
    },
  },
  {
    name: 'get_task',
    description: 'Get a single task by ID with full details including tags, projects, and dependencies',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Task ID' } },
      required: ['id'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task. Tags and projects are plain string arrays stored on the task directly.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title (required)' },
        description: { type: 'string', description: 'Task description' },
        status: { type: 'string', enum: ['todo', 'in-progress', 'done', 'archived'], description: 'Task status (default: todo)' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Task priority (default: medium)' },
        tags: { type: 'array', items: { type: 'string' }, description: 'User tags (plain strings, e.g. ["frontend", "bug"])' },
        projects: { type: 'array', items: { type: 'string' }, description: 'Project names (e.g. ["website-redesign", "q1-launch"])' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_task',
    description: 'Update an existing task. Only include fields you want to change. Tags and projects replace the full array when provided.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Task ID to update' },
        title: { type: 'string', description: 'New title' },
        description: { type: 'string', description: 'New description' },
        status: { type: 'string', enum: ['todo', 'in-progress', 'done', 'archived'], description: 'New status' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'New priority' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Replace all user tags' },
        projects: { type: 'array', items: { type: 'string' }, description: 'Replace all project assignments' },
        dependencies: { type: 'array', items: { type: 'string' }, description: 'Replace all dependency task IDs' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_task',
    description: 'Archive a task (sets status to archived)',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Task ID to delete' } },
      required: ['id'],
    },
  },
  {
    name: 'add_dependency',
    description: 'Add a dependency: taskId depends on dependsOnId. Will fail if it creates a circular dependency.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task that depends on another' },
        dependsOnId: { type: 'string', description: 'The task that must be completed first' },
      },
      required: ['taskId', 'dependsOnId'],
    },
  },
  {
    name: 'remove_dependency',
    description: 'Remove a dependency between two tasks',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task that has the dependency' },
        dependsOnId: { type: 'string', description: 'The dependency to remove' },
      },
      required: ['taskId', 'dependsOnId'],
    },
  },
  { name: 'get_task_graph', description: 'Get all tasks and their dependency edges for the full dependency graph' },
  {
    name: 'add_comment',
    description: 'Add a comment to a task. The author is automatically set from the current user.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID to comment on' },
        text: { type: 'string', description: 'Comment text' },
      },
      required: ['taskId', 'text'],
    },
  },
  {
    name: 'list_comments',
    description: 'List all comments on a task. Returns an array of {id, text, author, authorEmail, createdAt}.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID to get comments for' },
      },
      required: ['taskId'],
    },
  },
]

const MUTATING_TOOLS = new Set([
  'create_task', 'update_task', 'delete_task',
  'add_dependency', 'remove_dependency', 'add_comment',
])

export function createToolCallHandler(qc: QueryClient) {
  return async (tool: string, args: unknown) => {
    const a = args as Record<string, unknown>

    // Promise-based dedup for mutating calls
    if (MUTATING_TOOLS.has(tool)) {
      const key = JSON.stringify({ tool, args })
      const inflight = inflightCalls.get(key)
      if (inflight) {
        console.debug('[chat-tools] Dedup: awaiting in-flight call:', tool, args)
        return inflight
      }
    }

    const execute = async (): Promise<unknown> => {
      switch (tool) {
        case 'list_tasks':
          return window.api.tasks.list(a as { status?: string; priority?: string })
        case 'get_task':
          return window.api.tasks.get(a.id as string)
        case 'create_task':
          return window.api.tasks.create(a as { title: string; description?: string; status?: string; priority?: string; tags?: string[]; projects?: string[] })
        case 'update_task': {
          const { id, ...data } = a
          return window.api.tasks.update(id as string, data)
        }
        case 'delete_task':
          return window.api.tasks.delete(a.id as string)
        case 'add_dependency':
          return window.api.deps.add(a.taskId as string, a.dependsOnId as string)
        case 'remove_dependency':
          return window.api.deps.remove(a.taskId as string, a.dependsOnId as string)
        case 'get_task_graph':
          return window.api.deps.getGraph()
        case 'add_comment':
          return window.api.tasks.addComment(a.taskId as string, a.text as string)
        case 'list_comments': {
          const taskResult = await window.api.tasks.get(a.taskId as string)
          return taskResult.success ? { success: true, data: taskResult.data.comments } : taskResult
        }
        default:
          return { error: `Unknown tool: ${tool}` }
      }
    }

    // For non-mutating tools, just execute directly
    if (!MUTATING_TOOLS.has(tool)) {
      return execute()
    }

    const key = JSON.stringify({ tool, args })
    const promise = execute()

    // Store the Promise IMMEDIATELY (synchronously, before await) so duplicates find it
    inflightCalls.set(key, promise)

    try {
      const result = await promise
      // Keep in map briefly to catch late duplicates, then clean up
      setTimeout(() => inflightCalls.delete(key), 5_000)

      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['task'] })
      qc.invalidateQueries({ queryKey: ['graph'] })
      qc.invalidateQueries({ queryKey: ['tags'] })

      return result
    } catch (error) {
      inflightCalls.delete(key)
      throw error
    }
  }
}

export async function handleTokenRefreshRequest(setAuthToken: (token: string) => void): Promise<string> {
  const result = await window.api.auth.refreshToken()
  if (result.success && result.data) {
    setAuthToken(result.data)
    return result.data
  }
  throw new Error(result.error || 'Token refresh failed')
}
