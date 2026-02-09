import { useState, useRef, useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useUsableChat } from '@/hooks/use-usable-chat'
import { cn } from '@/lib/utils'
import { PARENT_TOOLS, createToolCallHandler, handleTokenRefreshRequest } from '@/lib/chat-tools'
import { motion, useMotionValue } from 'framer-motion'
import { MessageCircle, X, ExternalLink } from 'lucide-react'
import type { ChatState, BubbleCorner } from '@/hooks/use-chat-panel'

const EMBED_TOKEN = import.meta.env.VITE_USABLE_EMBED_TOKEN

const CORNER_POSITIONS: Record<BubbleCorner, React.CSSProperties> = {
  'bottom-right': { bottom: 20, right: 20, top: 'auto', left: 'auto' },
  'bottom-left': { bottom: 20, left: 20, top: 'auto', right: 'auto' },
  'top-right': { top: 20, right: 20, bottom: 'auto', left: 'auto' },
  'top-left': { top: 20, left: 20, bottom: 'auto', right: 'auto' },
}

const PANEL_CLASSES: Record<BubbleCorner, string> = {
  'bottom-right': 'fixed bottom-24 right-5',
  'bottom-left': 'fixed bottom-24 left-5',
  'top-right': 'fixed top-24 right-5',
  'top-left': 'fixed top-24 left-5',
}

interface UsableEmbedProps {
  chatState: ChatState
  bubbleCorner: BubbleCorner
  onToggle: () => void
  onClose: () => void
  onOpenApp: () => void
  onBubbleCornerChange: (corner: BubbleCorner) => void
}

export function UsableEmbed({
  chatState,
  bubbleCorner,
  onToggle,
  onClose,
  onOpenApp,
  onBubbleCornerChange,
}: UsableEmbedProps) {
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

  const { isReady, setAuth } = useUsableChat(iframeRef, {
    tools: PARENT_TOOLS,
    onToolCall: handleToolCall,
    onTokenRefreshRequest: onTokenRefresh,
  })

  useEffect(() => {
    if (isReady && authToken) {
      setAuth(authToken)
    }
  }, [isReady, authToken, setAuth])

  // Mouse enter/leave — toggle click-through on the transparent overlay window.
  // When mouse is over interactive content, disable ignore so clicks register.
  // When mouse leaves, re-enable ignore so clicks pass through to the desktop.
  const handleMouseEnter = useCallback(() => {
    window.api.chat.setIgnoreMouseEvents(false)
  }, [])

  const handleMouseLeave = useCallback(() => {
    window.api.chat.setIgnoreMouseEvents(true)
  }, [])

  // Restore click-through when panel closes so the overlay doesn't block the desktop
  useEffect(() => {
    if (chatState !== 'floating') {
      window.api.chat.setIgnoreMouseEvents(true)
    }
  }, [chatState])

  // Motion values for drag — reset to 0 after each drag so the offset doesn't persist
  const dragX = useMotionValue(0)
  const dragY = useMotionValue(0)

  // Track drag so we can suppress the click that Framer Motion fires after drag end
  const isDraggingRef = useRef(false)

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true
  }, [])

  // Drag handling — compute nearest corner from pointer release position
  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: { point: { x: number; y: number } }) => {
      const { x, y } = info.point
      const midX = window.innerWidth / 2
      const midY = window.innerHeight / 2
      const isRight = x >= midX
      const isBottom = y >= midY

      const corner: BubbleCorner =
        isBottom && isRight ? 'bottom-right' :
        isBottom && !isRight ? 'bottom-left' :
        !isBottom && isRight ? 'top-right' :
        'top-left'

      onBubbleCornerChange(corner)

      // Reset drag offset so it doesn't persist on top of the new corner position
      dragX.set(0)
      dragY.set(0)

      // Reset after a tick so the subsequent click event is suppressed
      requestAnimationFrame(() => {
        isDraggingRef.current = false
      })
    },
    [onBubbleCornerChange],
  )

  const handleBubbleClick = useCallback(() => {
    if (isDraggingRef.current) return
    onToggle()
  }, [onToggle])

  if (!EMBED_TOKEN) return null

  const isOpen = chatState === 'floating'

  return (
    <>
      {/* Floating chat panel — always mounted so iframe retains state */}
      <div
        onMouseEnter={isOpen ? handleMouseEnter : undefined}
        onMouseLeave={isOpen ? handleMouseLeave : undefined}
        className={cn(
          'z-40 flex flex-col bg-white dark:bg-gray-800',
          PANEL_CLASSES[bubbleCorner],
          'w-[380px] h-[500px] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700',
          !isOpen && 'fixed -left-[9999px] -top-[9999px] w-0 h-0 overflow-hidden pointer-events-none',
        )}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 shrink-0 rounded-t-2xl">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Chat</span>
          <div className="flex items-center gap-1">
            <button
              onClick={onOpenApp}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
              title="Open task manager"
            >
              <ExternalLink size={14} />
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            >
              <X size={14} />
            </button>
          </div>
        </div>
        <iframe
          ref={iframeRef}
          src={`https://chat.usable.dev/embed?token=${EMBED_TOKEN}`}
          className="flex-1 w-full border-0 rounded-b-2xl"
          allow="clipboard-write"
          title="Usable Chat"
        />
      </div>

      {/* Draggable bubble button */}
      <motion.button
        drag
        dragMomentum={false}
        style={{ ...CORNER_POSITIONS[bubbleCorner], x: dragX, y: dragY }}
        animate={CORNER_POSITIONS[bubbleCorner]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleBubbleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          'fixed w-14 h-14 rounded-full shadow-lg z-50',
          'flex items-center justify-center',
          'bg-primary-500 hover:bg-primary-400 text-primary-950',
          'transition-colors duration-200 cursor-grab active:cursor-grabbing'
        )}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </motion.button>
    </>
  )
}
