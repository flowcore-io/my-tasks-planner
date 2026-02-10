import { useState, useRef, useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useUsableChat } from '@/hooks/use-usable-chat'
import { PARENT_TOOLS, createToolCallHandler, handleTokenRefreshRequest } from '@/lib/chat-tools'
import type { MultiplexerEvent } from '@/lib/embed-sdk'

const EMBED_TOKEN = import.meta.env.VITE_USABLE_EMBED_TOKEN
const CHAT_BASE_URL = (import.meta.env.VITE_USABLE_CHAT_URL as string) || 'https://chat.usable.dev'

// Full whitelabel theme definitions — explicit values for ALL variables.
// We override every --uc-* variable AND the Tailwind remappings so we
// don't rely on color-mix() derivation which can produce wrong results
// when the embed's own stylesheet interferes.
interface ThemeVars {
  // Base 5
  primary: string
  primaryFg: string
  background: string
  foreground: string
  bubbleUserBg: string
  bubbleAssistantBg: string
  // Derived
  muted: string
  mutedFg: string
  border: string
  bubbleUserFg: string
  bubbleUserBorder: string
  bubbleAssistantFg: string
  bubbleAssistantBorder: string
  thoughtBg: string
  thoughtFg: string
  thoughtBorder: string
  inputBg: string
  inputBorder: string
  inputPlaceholder: string
  codeBg: string
  codeFg: string
}

const DARK_THEME: ThemeVars = {
  primary: '#f59e0b',
  primaryFg: '#451a03',
  background: '#111827',
  foreground: '#f3f4f6',
  bubbleUserBg: '#1f2937',
  bubbleAssistantBg: '#1a2332',
  muted: '#1f2937',
  mutedFg: '#9ca3af',
  border: '#374151',
  bubbleUserFg: '#f3f4f6',
  bubbleUserBorder: '#374151',
  bubbleAssistantFg: '#f3f4f6',
  bubbleAssistantBorder: '#374151',
  thoughtBg: '#1f2937',
  thoughtFg: '#9ca3af',
  thoughtBorder: '#374151',
  inputBg: '#111827',
  inputBorder: '#374151',
  inputPlaceholder: '#6b7280',
  codeBg: '#1f2937',
  codeFg: '#f3f4f6',
}

const LIGHT_THEME: ThemeVars = {
  primary: '#f59e0b',
  primaryFg: '#ffffff',
  background: '#ffffff',
  foreground: '#111827',
  bubbleUserBg: '#fffbeb',
  bubbleAssistantBg: '#ffffff',
  muted: '#f3f4f6',
  mutedFg: '#6b7280',
  border: '#e5e7eb',
  bubbleUserFg: '#111827',
  bubbleUserBorder: '#fde68a',
  bubbleAssistantFg: '#111827',
  bubbleAssistantBorder: '#e5e7eb',
  thoughtBg: '#f3f4f6',
  thoughtFg: '#6b7280',
  thoughtBorder: '#e5e7eb',
  inputBg: '#ffffff',
  inputBorder: '#e5e7eb',
  inputPlaceholder: '#9ca3af',
  codeBg: '#f3f4f6',
  codeFg: '#111827',
}

/** Build CSS that overrides ALL .uc-whitelabel vars + Tailwind remappings
 *  AND forces text colors on actual DOM elements to cover prose/markdown */
function buildThemeCss(t: ThemeVars): string {
  return `
.uc-whitelabel {
  /* Base + derived --uc-* variables */
  --uc-primary: ${t.primary} !important;
  --uc-primary-fg: ${t.primaryFg} !important;
  --uc-background: ${t.background} !important;
  --uc-foreground: ${t.foreground} !important;
  --uc-bubble-user-bg: ${t.bubbleUserBg} !important;
  --uc-bubble-assistant-bg: ${t.bubbleAssistantBg} !important;
  --uc-muted: ${t.muted} !important;
  --uc-muted-fg: ${t.mutedFg} !important;
  --uc-border: ${t.border} !important;
  --uc-bubble-user-fg: ${t.bubbleUserFg} !important;
  --uc-bubble-user-border: ${t.bubbleUserBorder} !important;
  --uc-bubble-assistant-fg: ${t.bubbleAssistantFg} !important;
  --uc-bubble-assistant-border: ${t.bubbleAssistantBorder} !important;
  --uc-thought-bg: ${t.thoughtBg} !important;
  --uc-thought-fg: ${t.thoughtFg} !important;
  --uc-thought-border: ${t.thoughtBorder} !important;
  --uc-input-bg: ${t.inputBg} !important;
  --uc-input-border: ${t.inputBorder} !important;
  --uc-input-placeholder: ${t.inputPlaceholder} !important;
  --uc-code-bg: ${t.codeBg} !important;
  --uc-code-fg: ${t.codeFg} !important;
  /* Tailwind theme remappings */
  --background: ${t.background} !important;
  --foreground: ${t.foreground} !important;
  --primary: ${t.primary} !important;
  --primary-foreground: ${t.primaryFg} !important;
  --muted: ${t.muted} !important;
  --muted-foreground: ${t.mutedFg} !important;
  --border: ${t.border} !important;
  --card: ${t.background} !important;
  --card-foreground: ${t.foreground} !important;
  --input: ${t.inputBg} !important;
  --ring: ${t.primary} !important;
  /* Tailwind Typography prose overrides */
  --tw-prose-body: ${t.foreground} !important;
  --tw-prose-headings: ${t.foreground} !important;
  --tw-prose-lead: ${t.mutedFg} !important;
  --tw-prose-links: ${t.primary} !important;
  --tw-prose-bold: ${t.foreground} !important;
  --tw-prose-counters: ${t.mutedFg} !important;
  --tw-prose-bullets: ${t.mutedFg} !important;
  --tw-prose-hr: ${t.border} !important;
  --tw-prose-quotes: ${t.foreground} !important;
  --tw-prose-quote-borders: ${t.border} !important;
  --tw-prose-captions: ${t.mutedFg} !important;
  --tw-prose-code: ${t.codeFg} !important;
  --tw-prose-pre-code: ${t.codeFg} !important;
  --tw-prose-pre-bg: ${t.codeBg} !important;
  --tw-prose-th-borders: ${t.border} !important;
  --tw-prose-td-borders: ${t.border} !important;
  /* Force base text color so children inherit */
  color: ${t.foreground} !important;
  background-color: ${t.background} !important;
}
/* Force text color on markdown/prose elements that may have hardcoded colors */
.uc-whitelabel p,
.uc-whitelabel li,
.uc-whitelabel span,
.uc-whitelabel h1, .uc-whitelabel h2, .uc-whitelabel h3,
.uc-whitelabel h4, .uc-whitelabel h5, .uc-whitelabel h6,
.uc-whitelabel strong, .uc-whitelabel em, .uc-whitelabel blockquote,
.uc-whitelabel td, .uc-whitelabel th, .uc-whitelabel label,
.uc-whitelabel div {
  color: inherit !important;
}
.uc-whitelabel a {
  color: ${t.primary} !important;
}
.uc-whitelabel code {
  color: ${t.codeFg} !important;
  background-color: ${t.codeBg} !important;
}
.uc-whitelabel pre {
  color: ${t.codeFg} !important;
  background-color: ${t.codeBg} !important;
}
`
}

function themeToBaseVars(t: ThemeVars): Record<string, string> {
  return {
    '--uc-primary': t.primary,
    '--uc-background': t.background,
    '--uc-foreground': t.foreground,
    '--uc-bubble-user-bg': t.bubbleUserBg,
    '--uc-bubble-assistant-bg': t.bubbleAssistantBg,
  }
}

function themeToConfigColors(t: ThemeVars) {
  return {
    primaryColor: t.primary,
    backgroundColor: t.background,
    foregroundColor: t.foreground,
    bubbleUserBg: t.bubbleUserBg,
    bubbleAssistantBg: t.bubbleAssistantBg,
  }
}

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

  const { isReady, setAuth, setCssVariables, setConfig } = useUsableChat(iframeRef, {
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

  // Get the current theme colors based on dark/light mode
  const getCurrentTheme = useCallback(() => {
    const isDark = document.documentElement.classList.contains('dark')
    return isDark ? DARK_THEME : LIGHT_THEME
  }, [])

  // Apply theme to the embedded chat using three mechanisms:
  // 1. Electron CSS injection (primary) — injects <style> with !important directly
  //    into the iframe via WebFrameMain.executeJavaScript, guaranteed to override all
  // 2. CONFIG message — updates embed settings → inline styles on root div
  // 3. SET_CSS_VARIABLES — sets on document.documentElement inside iframe (backup)
  const applyTheme = useCallback(() => {
    const theme = getCurrentTheme()

    // Primary: inject CSS directly into iframe via Electron main process
    window.api.chat.injectThemeCss(buildThemeCss(theme)).catch(() => {
      // Silently ignore — frame may not exist yet
    })

    // Backup 1: send CONFIG with theme colors
    setConfig({ themeColors: themeToConfigColors(theme) })

    // Backup 2: set CSS variables via postMessage
    setCssVariables(themeToBaseVars(theme))
  }, [getCurrentTheme, setConfig, setCssVariables])

  // Apply theme when embed is ready + retry to beat async config fetch
  useEffect(() => {
    if (!isReady) return

    applyTheme()
    const retries = [300, 800, 1500, 3000].map(ms =>
      setTimeout(applyTheme, ms),
    )

    // Re-apply whenever dark/light mode toggles
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
  }, [isReady, applyTheme])

  // Re-apply after auth (conversation load can reset styles)
  useEffect(() => {
    if (!isReady || !authToken) return
    const timers = [100, 500, 1500].map(ms => setTimeout(applyTheme, ms))
    return () => timers.forEach(clearTimeout)
  }, [isReady, authToken, applyTheme])

  const embedSrc = EMBED_TOKEN
    ? `${CHAT_BASE_URL}/embed?token=${EMBED_TOKEN}`
    : null

  return { iframeRef, embedSrc, isReady }
}
