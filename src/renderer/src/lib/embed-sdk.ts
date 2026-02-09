// Usable Chat Embed SDK - Copy-paste, not npm
// Based on PostMessage protocol from Usable Chat

export interface ContextItem {
  contextType: 'workspace' | 'fragment'
  contextId: string
  metadata?: {
    name?: string
    summary?: string
    tags?: string[]
  }
}

export interface ParentToolSchema {
  name: string
  description: string
  parameters?: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

type ParentToIframeMessage =
  | { type: 'AUTH'; payload: { token: string } }
  | { type: 'CONFIG'; payload: unknown }
  | { type: 'TOGGLE_VISIBILITY'; payload: { visible: boolean } }
  | { type: 'TOOL_RESPONSE'; payload: { requestId: string; result: unknown } }
  | { type: 'ADD_CONTEXT'; payload: { items: ContextItem[] } }
  | { type: 'REGISTER_TOOLS'; payload: { tools: ParentToolSchema[] } }
  | { type: 'NEW_CONVERSATION' }

type IframeToParentMessage =
  | { type: 'READY' }
  | { type: 'TOOL_CALL'; payload: { requestId: string; tool: string; args: unknown } }
  | { type: 'EVENT'; payload: { event: string; data: unknown } }
  | { type: 'ERROR'; payload: { code: string; message: string } }
  | { type: 'RESIZE'; payload: { width: number; height: number } }
  | { type: 'CONVERSATION_CHANGED'; payload: { conversationId: string | null } }
  | { type: 'TOOLS_REGISTERED'; payload: { tools: string[]; errors?: string[] } }
  | { type: 'REQUEST_TOKEN_REFRESH' }

export interface UsableChatEmbedOptions {
  iframeOrigin?: string
  onToolCall?: (tool: string, args: unknown) => Promise<unknown> | unknown
  onEvent?: (event: string, data: unknown) => void
  onError?: (code: string, message: string) => void
  onResize?: (width: number, height: number) => void
  onConversationChange?: (conversationId: string | null) => void
  onToolsRegistered?: (tools: string[], errors?: string[]) => void
  onTokenRefreshRequest?: () => Promise<string>
  onReady?: () => void
}

export class UsableChatEmbed {
  private iframe: HTMLIFrameElement
  private options: UsableChatEmbedOptions
  private iframeOrigin: string
  private readyCallbacks: (() => void)[] = []
  private isReady = false
  private messageHandler: (event: MessageEvent) => void
  private handledRequestIds = new Set<string>()

  constructor(iframe: HTMLIFrameElement, options: UsableChatEmbedOptions = {}) {
    this.iframe = iframe
    this.options = options
    this.iframeOrigin = options.iframeOrigin || new URL(iframe.src).origin

    this.messageHandler = this.handleMessage.bind(this)
    window.addEventListener('message', this.messageHandler)
  }

  private handleMessage(event: MessageEvent) {
    if (event.origin !== this.iframeOrigin) {
      if (event.data?.type) {
        console.debug('[UsableEmbed] Ignored message from origin:', event.origin, 'expected:', this.iframeOrigin, 'type:', event.data.type)
      }
      return
    }

    const msg = event.data as IframeToParentMessage
    if (!msg || typeof msg.type !== 'string') return
    console.debug('[UsableEmbed] Received message:', msg.type)

    switch (msg.type) {
      case 'READY':
        this.isReady = true
        this.readyCallbacks.forEach(cb => cb())
        this.options.onReady?.()
        break
      case 'TOOL_CALL':
        if (this.options.onToolCall) {
          const { requestId, tool, args } = msg.payload
          if (this.handledRequestIds.has(requestId)) {
            console.debug('[UsableEmbed] Duplicate TOOL_CALL ignored:', requestId)
            break
          }
          this.handledRequestIds.add(requestId)
          Promise.resolve(this.options.onToolCall(tool, args)).then(result => {
            this.send({ type: 'TOOL_RESPONSE', payload: { requestId, result } })
          })
        }
        break
      case 'EVENT':
        this.options.onEvent?.(msg.payload.event, msg.payload.data)
        break
      case 'ERROR':
        this.options.onError?.(msg.payload.code, msg.payload.message)
        break
      case 'RESIZE':
        this.options.onResize?.(msg.payload.width, msg.payload.height)
        break
      case 'CONVERSATION_CHANGED':
        this.options.onConversationChange?.(msg.payload.conversationId)
        break
      case 'TOOLS_REGISTERED':
        this.options.onToolsRegistered?.(msg.payload.tools, msg.payload.errors)
        break
      case 'REQUEST_TOKEN_REFRESH':
        if (this.options.onTokenRefreshRequest) {
          this.options.onTokenRefreshRequest().then(token => {
            if (token) this.setAuth(token)
          })
        }
        break
    }
  }

  private send(message: ParentToIframeMessage) {
    this.iframe.contentWindow?.postMessage(message, this.iframeOrigin)
  }

  onReady(callback: () => void) {
    if (this.isReady) {
      callback()
    } else {
      this.readyCallbacks.push(callback)
    }
  }

  setAuth(token: string) {
    this.send({ type: 'AUTH', payload: { token } })
  }

  toggle(visible: boolean) {
    this.send({ type: 'TOGGLE_VISIBILITY', payload: { visible } })
  }

  setConfig(config: unknown) {
    this.send({ type: 'CONFIG', payload: config })
  }

  addContext(items: ContextItem[]) {
    this.send({ type: 'ADD_CONTEXT', payload: { items } })
  }

  registerTools(tools: ParentToolSchema[]) {
    this.send({ type: 'REGISTER_TOOLS', payload: { tools } })
  }

  destroy() {
    window.removeEventListener('message', this.messageHandler)
    this.readyCallbacks = []
    this.isReady = false
    this.handledRequestIds.clear()
  }
}

export function createUsableChatEmbed(
  iframe: HTMLIFrameElement | string,
  options: UsableChatEmbedOptions = {}
): UsableChatEmbed {
  const el = typeof iframe === 'string' ? document.getElementById(iframe) as HTMLIFrameElement : iframe
  if (!el) throw new Error('iframe element not found')
  return new UsableChatEmbed(el, options)
}
