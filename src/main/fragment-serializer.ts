import type { TaskWithTags, TaskStatus, TaskPriority, TaskComment } from '../shared/types'
import type { UsableFragment } from './usable-api'

/** Tags containing a colon are system/organizational tags (status:, priority:, repo:, project:, etc.) */
function isSystemTag(tag: string): boolean {
  return tag === 'task' || tag.includes(':')
}

/**
 * Convert a task to a Usable fragment create/update payload.
 * Stores structured metadata in YAML frontmatter + markdown description.
 */
export function taskToFragmentPayload(task: {
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  kanbanOrder: number
  listOrder: number
  createdAt: string
  tags?: string[]
  projects?: string[]
  dependencies?: string[]
  comments?: TaskComment[]
  startDate?: string
  endDate?: string
}): {
  title: string
  content: string
  summary: string
  tags: string[]
} {
  const userTags = task.tags || []
  const projects = task.projects || []
  const dependencies = task.dependencies || []

  const fmLines = [
    '---',
    `status: "${task.status}"`,
    `priority: "${task.priority}"`,
    `kanbanOrder: ${task.kanbanOrder}`,
    `listOrder: ${task.listOrder}`,
    `createdAt: "${task.createdAt}"`,
  ]

  if (task.startDate) {
    fmLines.push(`startDate: "${task.startDate}"`)
  }
  if (task.endDate) {
    fmLines.push(`endDate: "${task.endDate}"`)
  }

  if (dependencies.length > 0) {
    fmLines.push('dependencies:')
    for (const dep of dependencies) {
      fmLines.push(`  - "${dep}"`)
    }
  }

  fmLines.push('---')

  let content = `${fmLines.join('\n')}\n\n${task.description || ''}`

  if (task.comments && task.comments.length > 0) {
    content += `\n\n<!-- comments:json -->\n${JSON.stringify(task.comments)}`
  }

  const projectTags = projects.map(p => `project:${p}`)

  const fragmentTags = [...new Set([
    'task',
    'source:my-tasks-plan',
    `status:${task.status}`,
    `priority:${task.priority}`,
    ...projectTags,
    ...userTags,
  ])]

  return {
    title: task.title,
    content,
    summary: `Task: ${task.title} [${task.status}/${task.priority}]`,
    tags: fragmentTags,
  }
}

/**
 * Parse a Usable fragment into a TaskWithTags.
 */
export function fragmentToTask(fragment: UsableFragment): TaskWithTags {
  const frontmatter = parseFrontmatter(fragment.content || '')
  const description = extractDescription(fragment.content || '')

  const status = (frontmatter.status as TaskStatus) || 'todo'
  const priority = (frontmatter.priority as TaskPriority) || 'medium'
  const kanbanOrder = typeof frontmatter.kanbanOrder === 'number' ? frontmatter.kanbanOrder : 0
  const listOrder = typeof frontmatter.listOrder === 'number' ? frontmatter.listOrder : 0
  const createdAt = (frontmatter.createdAt as string) || fragment.updatedAt || new Date().toISOString()
  const dependencies = Array.isArray(frontmatter.dependencies) ? frontmatter.dependencies as string[] : []
  const startDate = typeof frontmatter.startDate === 'string' ? frontmatter.startDate : undefined
  const endDate = typeof frontmatter.endDate === 'string' ? frontmatter.endDate : undefined

  // Filter tags: only keep simple user tags (no colon-prefixed system tags), deduplicated
  const allTags = fragment.tags || []
  const userTags = [...new Set(allTags.filter(tag => !isSystemTag(tag)))]

  // Extract project names from project: tags
  const projects = [...new Set(
    allTags
      .filter(tag => tag.startsWith('project:'))
      .map(tag => tag.slice('project:'.length))
  )]

  return {
    id: fragment.id,
    title: fragment.title,
    description,
    status,
    priority,
    kanbanOrder,
    listOrder,
    createdAt,
    updatedAt: fragment.updatedAt || createdAt,
    tags: userTags,
    projects,
    dependencies,
    comments: extractComments(fragment.content || ''),
    startDate,
    endDate,
  }
}

/**
 * Parse YAML frontmatter from content string.
 * Hand-rolled parser for our controlled frontmatter format.
 */
function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}

  const fm = match[1]
  const result: Record<string, unknown> = {}

  const lines = fm.split('\n')
  let currentArrayKey: string | null = null
  let currentArray: string[] = []

  for (const line of lines) {
    // Check if this is an array item (starts with whitespace + "- ")
    const arrayItemMatch = line.match(/^\s+-\s+"?([^"]*)"?$/)
    if (arrayItemMatch && currentArrayKey) {
      currentArray.push(arrayItemMatch[1])
      continue
    }

    // If we were collecting an array, save it
    if (currentArrayKey) {
      result[currentArrayKey] = currentArray
      currentArrayKey = null
      currentArray = []
    }

    // Check for key: value pair
    const kvMatch = line.match(/^(\w+):\s*(.*)$/)
    if (!kvMatch) continue

    const [, key, rawValue] = kvMatch
    const value = rawValue.trim()

    // Check if this starts an array (value is empty, next lines are "- items")
    if (value === '') {
      currentArrayKey = key
      currentArray = []
      continue
    }

    // Parse quoted string
    const quotedMatch = value.match(/^"(.*)"$/)
    if (quotedMatch) {
      result[key] = quotedMatch[1]
      continue
    }

    // Parse number
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      result[key] = Number(value)
      continue
    }

    // Plain string
    result[key] = value
  }

  // Save any trailing array
  if (currentArrayKey) {
    result[currentArrayKey] = currentArray
  }

  return result
}

const COMMENTS_MARKER = '\n\n<!-- comments:json -->\n'

/**
 * Extract the description (everything after frontmatter, before comments marker).
 */
function extractDescription(content: string): string {
  const fmMatch = content.match(/^---\n[\s\S]*?\n---\n*/)
  const afterFm = fmMatch ? content.slice(fmMatch[0].length) : content
  const markerIdx = afterFm.indexOf('<!-- comments:json -->')
  const desc = markerIdx >= 0 ? afterFm.slice(0, markerIdx) : afterFm
  return desc.trim()
}

/**
 * Extract comments JSON array from after the marker.
 */
function extractComments(content: string): TaskComment[] {
  const markerIdx = content.indexOf('<!-- comments:json -->\n')
  if (markerIdx < 0) return []
  const jsonStr = content.slice(markerIdx + '<!-- comments:json -->\n'.length).trim()
  if (!jsonStr) return []
  try {
    const parsed = JSON.parse(jsonStr)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
