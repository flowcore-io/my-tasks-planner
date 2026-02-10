import { useState, useEffect, useCallback } from 'react'
import type { ChatMode } from '../../../shared/types'

export function useChatMode() {
  const [chatMode, setChatMode] = useState<ChatMode>('bubble')

  useEffect(() => {
    window.api.chat.getMode().then((result) => {
      if (result.success && result.data) {
        setChatMode(result.data)
      }
    })

    const cleanup = window.api.chat.onModeChanged((mode) => {
      setChatMode(mode)
    })
    return cleanup
  }, [])

  const setMode = useCallback(async (mode: ChatMode) => {
    setChatMode(mode) // optimistic
    await window.api.chat.setMode(mode)
  }, [])

  return { chatMode, setMode }
}
