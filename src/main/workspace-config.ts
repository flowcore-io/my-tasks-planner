import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { WorkspaceConfig } from '../shared/types'

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'usable-workspace.json')
}

export function getWorkspaceConfig(): WorkspaceConfig | null {
  const filePath = getConfigPath()
  if (!fs.existsSync(filePath)) return null

  try {
    const data = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(data) as WorkspaceConfig
  } catch {
    return null
  }
}

export function setWorkspaceConfig(config: WorkspaceConfig): void {
  const filePath = getConfigPath()
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8')
}

export function clearWorkspaceConfig(): void {
  const filePath = getConfigPath()
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}
