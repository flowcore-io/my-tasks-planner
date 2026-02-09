import { useState, useCallback } from 'react'

export type ChatState = 'closed' | 'floating'
export type BubbleCorner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

export function useChatPanel() {
  const [chatState, setChatState] = useState<ChatState>('closed')
  const [bubbleCorner, setBubbleCorner] = useState<BubbleCorner>('bottom-right')

  const toggleChat = useCallback(() => {
    setChatState(prev => (prev === 'closed' ? 'floating' : 'closed'))
  }, [])

  const closeChat = useCallback(() => {
    setChatState('closed')
  }, [])

  const openApp = useCallback(() => {
    window.api.chat.openApp()
  }, [])

  return { chatState, bubbleCorner, setBubbleCorner, toggleChat, closeChat, openApp }
}
