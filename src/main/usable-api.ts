import { net } from 'electron'
import { getToken } from './auth'

const BASE_URL = 'https://usable.dev'

async function usableRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T> {
  const token = getToken()
  if (!token) throw new Error('Not authenticated')

  return new Promise((resolve, reject) => {
    const request = net.request({
      method,
      url: `${BASE_URL}${path}`,
    })
    request.setHeader('Authorization', `Bearer ${token}`)
    request.setHeader('Content-Type', 'application/json')

    let responseData = ''
    request.on('response', (response) => {
      response.on('data', (chunk) => {
        responseData += chunk.toString()
      })
      response.on('end', () => {
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
          try {
            resolve(responseData ? JSON.parse(responseData) : ({} as T))
          } catch {
            reject(new Error('Failed to parse Usable API response'))
          }
        } else {
          reject(new Error(`Usable API error: ${response.statusCode} ${responseData}`))
        }
      })
    })
    request.on('error', reject)

    if (body) {
      request.write(JSON.stringify(body))
    }
    request.end()
  })
}

// --- Response types matching the actual Usable API spec (v1.4.0) ---

export interface UsableWorkspace {
  id: string
  name: string
  description?: string
  visibility?: string
  role?: string
}

export interface UsableFragmentType {
  id: string
  workspaceId: string
  name: string
  description?: string
  icon?: string
  color?: string
  isSystemDefault?: boolean
}

export interface UsableFragmentCreateResponse {
  success: boolean
  fragmentId: string
  status: string
  message: string
  key?: string
}

export interface UsableFragmentUpdateResponse {
  success: boolean
  fragmentId: string
  status: string
  message: string
}

export interface UsableFragment {
  id: string
  title: string
  content: string
  summary?: string
  tags?: string[]
  status?: string
  workspaceId?: string
  fragmentTypeId?: string
  updatedAt?: string
  createdAt?: string
}

// --- API functions ---

/** GET /api/workspaces -> { success, workspaces } */
export async function listWorkspaces(): Promise<UsableWorkspace[]> {
  const result = await usableRequest<{ success: boolean; workspaces: UsableWorkspace[] }>(
    'GET',
    '/api/workspaces'
  )
  return result.workspaces || []
}

/** GET /api/workspaces/{id}/fragment-types -> { fragmentTypes } */
export async function getFragmentTypes(workspaceId: string): Promise<UsableFragmentType[]> {
  const result = await usableRequest<{ fragmentTypes: UsableFragmentType[] }>(
    'GET',
    `/api/workspaces/${workspaceId}/fragment-types`
  )
  return result.fragmentTypes || []
}

/**
 * POST /api/memory-fragments
 * Required: workspaceId, fragmentTypeId, title, summary, content
 */
export async function createFragment(data: {
  workspaceId: string
  fragmentTypeId: string
  title: string
  summary: string
  content: string
  tags?: string[]
  key?: string
}): Promise<UsableFragmentCreateResponse> {
  return usableRequest<UsableFragmentCreateResponse>('POST', '/api/memory-fragments', {
    ...data,
    createdVia: 'api',
  })
}

/** PATCH /api/memory-fragments/{id} */
export async function updateFragment(
  fragmentId: string,
  data: {
    title?: string
    summary?: string
    content?: string
    tags?: string[]
  }
): Promise<UsableFragmentUpdateResponse> {
  return usableRequest<UsableFragmentUpdateResponse>(
    'PATCH',
    `/api/memory-fragments/${fragmentId}`,
    data
  )
}

/** GET /api/memory-fragments?workspaceId=...&tags=...&limit=... */
export async function listFragments(
  workspaceId: string,
  opts?: { tags?: string[]; limit?: number; offset?: number }
): Promise<UsableFragment[]> {
  const params = new URLSearchParams({ workspaceId })
  if (opts?.tags) {
    for (const tag of opts.tags) params.append('tags', tag)
  }
  // Usable API requires limit >= 5
  const limit = Math.max(opts?.limit ?? 20, 5)
  params.set('limit', String(limit))
  if (opts?.offset) params.set('offset', String(opts.offset))

  const result = await usableRequest<{ success: boolean; fragments: UsableFragment[]; count: number }>(
    'GET',
    `/api/memory-fragments?${params.toString()}`
  )
  return result.fragments || []
}

/** Count fragments matching filters without fetching all data */
export async function countFragments(
  workspaceId: string,
  opts?: { tags?: string[] }
): Promise<number> {
  const params = new URLSearchParams({ workspaceId, limit: '5' })
  if (opts?.tags) {
    for (const tag of opts.tags) params.append('tags', tag)
  }
  const result = await usableRequest<{ success: boolean; fragments: unknown[]; count: number }>(
    'GET',
    `/api/memory-fragments?${params.toString()}`
  )
  return result.count ?? 0
}

/** GET /api/memory-fragments/{id} */
export async function getFragment(fragmentId: string): Promise<UsableFragment> {
  const result = await usableRequest<{ success: boolean; fragment: UsableFragment }>(
    'GET',
    `/api/memory-fragments/${fragmentId}`
  )
  return result.fragment
}

/** Check if connected to Usable API by listing workspaces */
export async function checkConnection(): Promise<boolean> {
  try {
    await listWorkspaces()
    return true
  } catch {
    return false
  }
}
