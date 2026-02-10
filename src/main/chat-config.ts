import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { ChatMode } from '../shared/types'

interface ChatConfig {
  chatMode: ChatMode
}

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'chat-config.json')
}

export function getChatConfig(): ChatConfig {
  const filePath = getConfigPath()
  if (!fs.existsSync(filePath)) return { chatMode: 'bubble' }

  try {
    const data = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(data) as ChatConfig
  } catch {
    return { chatMode: 'bubble' }
  }
}

export function setChatMode(mode: ChatMode): void {
  const filePath = getConfigPath()
  const config = getChatConfig()
  config.chatMode = mode
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8')
}
