import { listFragments, updateFragment, type UsableFragment } from './usable-api'
import { getWorkspaceConfig } from './workspace-config'

const SOURCE_TAG = 'source:my-tasks-plan'

/**
 * One-time migration: adds `source:my-tasks-plan` to all existing task fragments
 * that don't already have it. Runs silently on app startup.
 */
export async function migrateSourceTag(): Promise<void> {
  const config = getWorkspaceConfig()
  if (!config?.workspaceId) return

  try {
    // Fetch all fragments tagged 'task' (without source filter)
    const fragments = await listFragments(config.workspaceId, { tags: ['task'], limit: 200 })
    const needsUpdate = fragments.filter(f => !(f.tags || []).includes(SOURCE_TAG))

    if (needsUpdate.length === 0) return

    console.log(`[migrate] Adding ${SOURCE_TAG} tag to ${needsUpdate.length} existing task(s)...`)

    for (const fragment of needsUpdate) {
      const tags = [...(fragment.tags || []), SOURCE_TAG]
      await updateFragment(fragment.id, { tags })
    }

    console.log(`[migrate] Done.`)
  } catch (err) {
    console.error('[migrate] Failed to add source tags:', err)
  }
}
