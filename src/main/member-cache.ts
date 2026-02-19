import { listWorkspaceMembers } from './usable-api'
import { getCachedTaskFragments } from './task-cache'
import { fragmentToTask } from './fragment-serializer'
import { getTokenClaims } from './auth'

interface MemberInfo {
  id: string
  userId: string
  name: string
  email: string
  role: string
}

let cachedMembers: MemberInfo[] | null = null
let cachedWorkspaceId: string | null = null
let cacheTimestamp = 0
const CACHE_TTL = 300_000 // 5 minutes

/**
 * Fallback: build a member list from task assignees, comment authors,
 * and the current user's JWT claims.
 */
async function buildMembersFromTasks(workspaceId: string): Promise<MemberInfo[]> {
  const seen = new Map<string, MemberInfo>()

  // Add current user
  const claims = getTokenClaims()
  if (claims?.sub) {
    seen.set(claims.sub, {
      id: claims.sub,
      userId: claims.sub,
      name: claims.name || 'You',
      email: claims.email || '',
      role: 'member',
    })
  }

  // Extract unique authors from task comments + assignees
  try {
    const fragments = await getCachedTaskFragments(workspaceId)
    for (const fragment of fragments) {
      const task = fragmentToTask(fragment)
      for (const comment of task.comments) {
        if (comment.authorId && !seen.has(comment.authorId)) {
          seen.set(comment.authorId, {
            id: comment.authorId,
            userId: comment.authorId,
            name: comment.author || 'Unknown',
            email: comment.authorEmail || '',
            role: 'member',
          })
        }
      }
      if (task.assigneeId && !seen.has(task.assigneeId)) {
        seen.set(task.assigneeId, {
          id: task.assigneeId,
          userId: task.assigneeId,
          name: task.assigneeId,
          email: '',
          role: 'member',
        })
      }
    }
  } catch {
    // If tasks can't be loaded, just return current user
  }

  return Array.from(seen.values())
}

/**
 * Get workspace members, using cache when available.
 * Tries the API first, falls back to building from task data.
 */
export async function getCachedMembers(workspaceId: string): Promise<MemberInfo[]> {
  const now = Date.now()
  if (cachedMembers && cachedWorkspaceId === workspaceId && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedMembers
  }

  let members: MemberInfo[]
  try {
    members = await listWorkspaceMembers(workspaceId)
  } catch {
    // API unavailable — fall back to task data
    members = await buildMembersFromTasks(workspaceId)
  }

  cachedMembers = members
  cachedWorkspaceId = workspaceId
  cacheTimestamp = Date.now()
  return members
}

/**
 * Resolve an assignee value that may be an email or name to a userId.
 * Returns the original value unchanged if it's already a userId (UUID)
 * or if no matching member is found.
 */
export async function resolveAssigneeId(workspaceId: string, value: string): Promise<string> {
  const members = await getCachedMembers(workspaceId)
  const lower = value.toLowerCase()

  // Check email match
  const byEmail = members.find(m => m.email.toLowerCase() === lower)
  if (byEmail) return byEmail.userId

  // Check name match (case-insensitive)
  const byName = members.find(m => m.name.toLowerCase() === lower)
  if (byName) return byName.userId

  // Already a userId or no match found — return as-is
  return value
}

/**
 * Invalidate the member cache.
 */
export function invalidateMemberCache(): void {
  cachedMembers = null
  cacheTimestamp = 0
}
