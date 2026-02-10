import { useState, useRef, useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useUsableChat } from '@/hooks/use-usable-chat'
import { PARENT_TOOLS, createToolCallHandler, handleTokenRefreshRequest } from '@/lib/chat-tools'
import type { MultiplexerEvent } from '@/lib/embed-sdk'

const EMBED_TOKEN = import.meta.env.VITE_USABLE_EMBED_TOKEN
const CHAT_BASE_URL = (import.meta.env.VITE_USABLE_CHAT_URL as string) || 'https://chat.usable.dev'

export function useChatEmbed() {
  const [authToken, setAuthToken] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const qc = useQueryClient()

  useEffect(() => {
    window.api.auth.getToken().then((result) => {
      if (result.success && result.data) setAuthToken(result.data)
    })
    const cleanup = window.api.auth.onTokenChanged((token) => {
      setAuthToken(token)
    })
    return cleanup
  }, [])

  const onTokenRefresh = useCallback(async (): Promise<string> => {
    return handleTokenRefreshRequest(setAuthToken)
  }, [])

  const handleToolCall = useCallback(createToolCallHandler(qc), [qc])

  const invalidateAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['tasks'] })
    qc.invalidateQueries({ queryKey: ['task'] })
    qc.invalidateQueries({ queryKey: ['graph'] })
    qc.invalidateQueries({ queryKey: ['tags'] })
  }, [qc])

  const { isReady, setAuth, setCssVariables } = useUsableChat(iframeRef, {
    tools: PARENT_TOOLS,
    onToolCall: handleToolCall,
    onTokenRefreshRequest: onTokenRefresh,
    onEvent: useCallback((_event: string, _data: unknown) => {
      if (_event === 'MESSAGE_COMPLETE') {
        invalidateAll()
      }
    }, [invalidateAll]),
    onMultiplexerStream: useCallback((events: MultiplexerEvent[]) => {
      if (events.some(e => e.type === 'toolResult')) {
        invalidateAll()
      }
    }, [invalidateAll]),
  })

  useEffect(() => {
    if (isReady && authToken) {
      setAuth(authToken)
    }
  }, [isReady, authToken, setAuth])

  // Apply app theme to the embedded chat via whitelabel CSS variables
  useEffect(() => {
    if (!isReady) return
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setCssVariables(
      isDark
        ? {
            '--uc-primary': '#f59e0b',
            '--uc-background': '#111827',
            '--uc-foreground': '#f3f4f6',
            '--uc-bubble-user-bg': '#1f2937',
            '--uc-bubble-assistant-bg': '#111827',
          }
        : {
            '--uc-primary': '#f59e0b',
            '--uc-background': '#ffffff',
            '--uc-foreground': '#111827',
            '--uc-bubble-user-bg': '#fffbeb',
            '--uc-bubble-assistant-bg': '#ffffff',
          },
    )
  }, [isReady, setCssVariables])

  const embedSrc = EMBED_TOKEN
    ? `${CHAT_BASE_URL}/embed?token=${EMBED_TOKEN}`
    : null

  return { iframeRef, embedSrc, isReady }
}
