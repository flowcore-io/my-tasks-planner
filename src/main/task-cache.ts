import { listFragments, getFragment, type UsableFragment } from './usable-api'

let cachedFragments: Map<string, UsableFragment> | null = null
let cachedWorkspaceId: string | null = null
let cacheTimestamp = 0
const CACHE_TTL = 120_000 // 2 minutes

// Callback for notifying all renderer windows about task data changes.
// Set by index.ts which has access to the BrowserWindow references.
let tasksChangedCallback: (() => void) | null = null

export function setTasksChangedCallback(callback: () => void): void {
  tasksChangedCallback = callback
}

export function broadcastTasksChanged(): void {
  tasksChangedCallback?.()
}

/**
 * Get all task fragments, using cache when available.
 * Both task-handlers and dependency-handlers call this instead of listFragments directly.
 */
export async function getCachedTaskFragments(workspaceId: string): Promise<UsableFragment[]> {
  const now = Date.now()
  if (cachedFragments && cachedWorkspaceId === workspaceId && (now - cacheTimestamp) < CACHE_TTL) {
    return Array.from(cachedFragments.values())
  }

  const fragments = await listFragments(workspaceId, { tags: ['source:my-tasks-plan'], limit: 200 })
  cachedFragments = new Map(fragments.map(f => [f.id, f]))
  cachedWorkspaceId = workspaceId
  cacheTimestamp = Date.now()
  return fragments
}

/**
 * Get a single task fragment, serving from cache if available.
 * Falls back to individual API fetch if not in cache.
 */
export async function getCachedFragment(workspaceId: string, id: string): Promise<UsableFragment> {
  const now = Date.now()
  if (cachedFragments && cachedWorkspaceId === workspaceId && (now - cacheTimestamp) < CACHE_TTL) {
    const cached = cachedFragments.get(id)
    if (cached) return cached
  }
  // Not in cache — fetch individually
  const fragment = await getFragment(id)
  // Store in cache if cache is warm
  if (cachedFragments && cachedWorkspaceId === workspaceId) {
    cachedFragments.set(id, fragment)
  }
  return fragment
}

/**
 * Invalidate the entire cache. Call after any mutation.
 */
export function invalidateTaskCache(): void {
  cachedFragments = null
  cacheTimestamp = 0
}
