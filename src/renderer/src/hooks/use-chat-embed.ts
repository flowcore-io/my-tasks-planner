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

  // Build the theme variables for the current app mode
  const getThemeVars = useCallback(() => {
    const isDark = document.documentElement.classList.contains('dark')
    return isDark
      ? {
          '--uc-primary': '#f59e0b',
          '--uc-primary-fg': '#451a03',
          '--uc-background': '#111827',
          '--uc-foreground': '#f3f4f6',
          '--uc-bubble-user-bg': '#1f2937',
          '--uc-bubble-assistant-bg': '#111827',
          '--uc-muted': '#1f2937',
          '--uc-muted-fg': '#9ca3af',
          '--uc-border': '#374151',
          '--uc-input-bg': '#111827',
          '--uc-input-border': '#374151',
          '--uc-input-placeholder': '#6b7280',
          '--uc-code-bg': '#1f2937',
          '--uc-code-fg': '#f3f4f6',
          '--uc-thought-bg': '#1f2937',
          '--uc-thought-fg': '#9ca3af',
          '--uc-thought-border': '#374151',
          '--uc-bubble-user-border': '#374151',
          '--uc-bubble-assistant-border': '#374151',
        }
      : {
          '--uc-primary': '#f59e0b',
          '--uc-primary-fg': '#ffffff',
          '--uc-background': '#ffffff',
          '--uc-foreground': '#111827',
          '--uc-bubble-user-bg': '#fffbeb',
          '--uc-bubble-assistant-bg': '#ffffff',
          '--uc-muted': '#f3f4f6',
          '--uc-muted-fg': '#6b7280',
          '--uc-border': '#e5e7eb',
          '--uc-input-bg': '#ffffff',
          '--uc-input-border': '#e5e7eb',
          '--uc-input-placeholder': '#9ca3af',
          '--uc-code-bg': '#f3f4f6',
          '--uc-code-fg': '#111827',
          '--uc-thought-bg': '#f3f4f6',
          '--uc-thought-fg': '#6b7280',
          '--uc-thought-border': '#e5e7eb',
          '--uc-bubble-user-border': '#fde68a',
          '--uc-bubble-assistant-border': '#e5e7eb',
        }
  }, [])

  // Apply app theme to the embedded chat via whitelabel CSS variables.
  // The embed fetches its config async after READY, so we re-apply the
  // theme multiple times to win the race against server-side inline styles.
  useEffect(() => {
    if (!isReady) return

    const applyTheme = () => setCssVariables(getThemeVars())

    // Apply immediately, then re-apply to beat the async config fetch
    applyTheme()
    const retries = [300, 800, 1500, 3000].map(ms =>
      setTimeout(applyTheme, ms),
    )

    // Re-apply whenever the dark class toggles
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          applyTheme()
        }
      }
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => {
      retries.forEach(clearTimeout)
      observer.disconnect()
    }
  }, [isReady, setCssVariables, getThemeVars])

  // Re-apply theme after auth completes (triggers conversation load which can reset styles)
  useEffect(() => {
    if (!isReady || !authToken) return
    const timers = [100, 500, 1500].map(ms =>
      setTimeout(() => setCssVariables(getThemeVars()), ms),
    )
    return () => timers.forEach(clearTimeout)
  }, [isReady, authToken, setCssVariables, getThemeVars])

  const embedSrc = EMBED_TOKEN
    ? `${CHAT_BASE_URL}/embed?token=${EMBED_TOKEN}`
    : null

  return { iframeRef, embedSrc, isReady }
}
