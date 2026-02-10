import { useRef, useState, useEffect, useCallback } from 'react'
import { createUsableChatEmbed } from '@/lib/embed-sdk'
import type { UsableChatEmbed, ContextItem, ParentToolSchema, MultiplexerEvent } from '@/lib/embed-sdk'

interface UseUsableChatOptions {
  onToolCall?: (tool: string, args: unknown) => Promise<unknown> | unknown
  onEvent?: (event: string, data: unknown) => void
  onMultiplexerStream?: (events: MultiplexerEvent[]) => void
  onError?: (code: string, message: string) => void
  onTokenRefreshRequest?: () => Promise<string>
  initialContext?: ContextItem[]
  tools?: ParentToolSchema[]
}

export function useUsableChat(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  options: UseUsableChatOptions = {}
) {
  const embedRef = useRef<UsableChatEmbed | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const chatBaseUrl = (import.meta.env.VITE_USABLE_CHAT_URL as string) || 'https://chat.usable.dev'
    const embed = createUsableChatEmbed(iframe, {
      iframeOrigin: chatBaseUrl,
      onReady: () => {
        console.debug('[useUsableChat] READY received from embed')
        setIsReady(true)
      },
      onToolCall: (tool, args) => {
        console.debug('[useUsableChat] Tool call received:', tool, args)
        return optionsRef.current.onToolCall?.(tool, args)
      },
      onEvent: (event, data) => optionsRef.current.onEvent?.(event, data),
      onMultiplexerStream: (events) => optionsRef.current.onMultiplexerStream?.(events),
      onError: (code, message) => {
        console.debug('[useUsableChat] Error from embed:', code, message)
        optionsRef.current.onError?.(code, message)
      },
      onConversationChange: (id) => setConversationId(id),
      onToolsRegistered: (tools, errors) => {
        console.debug('[useUsableChat] Tools registered:', tools, 'errors:', errors)
      },
      onTokenRefreshRequest: () => {
        if (optionsRef.current.onTokenRefreshRequest) {
          return optionsRef.current.onTokenRefreshRequest()
        }
        return Promise.reject(new Error('No token refresh handler'))
      },
    })

    embedRef.current = embed

    return () => {
      embed.destroy()
      embedRef.current = null
      setIsReady(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- iframeRef is stable; the iframe is always mounted
  }, [])

  // Register tools and initial context when embed is ready
  useEffect(() => {
    if (!isReady || !embedRef.current) return

    if (options.tools?.length) {
      console.debug('[useUsableChat] Registering tools:', options.tools.map(t => t.name))
      embedRef.current.registerTools(options.tools)
    }
    if (options.initialContext?.length) {
      embedRef.current.addContext(options.initialContext)
    }
  }, [isReady])

  const addContext = useCallback((items: ContextItem[]) => {
    embedRef.current?.addContext(items)
  }, [])

  const setAuth = useCallback((token: string) => {
    embedRef.current?.setAuth(token)
  }, [])

  const setCssVariables = useCallback((variables: Record<string, string>) => {
    console.debug('[useUsableChat] setCssVariables:', Object.keys(variables).length, 'vars', embedRef.current ? '(embed exists)' : '(no embed)')
    embedRef.current?.setCssVariables(variables)
  }, [])

  const setConfig = useCallback((config: unknown) => {
    console.debug('[useUsableChat] setConfig:', config, embedRef.current ? '(embed exists)' : '(no embed)')
    embedRef.current?.setConfig(config)
  }, [])

  return { isReady, conversationId, addContext, setAuth, setCssVariables, setConfig, embed: embedRef.current }
}
