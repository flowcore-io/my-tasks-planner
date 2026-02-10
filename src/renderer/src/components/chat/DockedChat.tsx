import { useCallback, useState, useRef, useEffect } from 'react'
import { useChatEmbed } from '@/hooks/use-chat-embed'
import { X, PanelLeftClose } from 'lucide-react'

const MIN_WIDTH = 300
const MAX_WIDTH = 700
const DEFAULT_WIDTH = 380
const STORAGE_KEY = 'docked-chat-width'

function loadWidth(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const n = Number(saved)
      if (n >= MIN_WIDTH && n <= MAX_WIDTH) return n
    }
  } catch { /* ignore */ }
  return DEFAULT_WIDTH
}

function clampWidth(v: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, v))
}

interface DockedChatProps {
  open: boolean
  onClose: () => void
}

export function DockedChat({ open, onClose }: DockedChatProps) {
  const { iframeRef, embedSrc } = useChatEmbed()
  const [width, setWidth] = useState(loadWidth)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const handlePopout = useCallback(() => {
    window.api.chat.setMode('bubble')
  }, [])

  // Persist width on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(width))
  }, [width])

  // Resize via direct DOM manipulation — only commit to React state on mouseup
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startWidth.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    // Disable iframe pointer events so mousemove isn't swallowed
    if (iframeRef.current) iframeRef.current.style.pointerEvents = 'none'
  }, [width, iframeRef])

  useEffect(() => {
    let rafId = 0
    let latestX = 0

    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      latestX = e.clientX
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = 0
          if (!containerRef.current) return
          const delta = startX.current - latestX
          containerRef.current.style.width = `${clampWidth(startWidth.current + delta)}px`
        })
      }
    }
    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0 }
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (iframeRef.current) iframeRef.current.style.pointerEvents = ''
      if (containerRef.current) {
        setWidth(clampWidth(parseInt(containerRef.current.style.width, 10)))
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [iframeRef])

  if (!embedSrc) return null

  return (
    <div
      ref={containerRef}
      className="h-full border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out relative"
      style={{ width: open ? width : 0 }}
    >
      {/* Resize handle */}
      {open && (
        <div
          onMouseDown={onDragStart}
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-500/40 active:bg-primary-500/60 z-10"
        />
      )}

      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 shrink-0"
        style={{ minWidth: MIN_WIDTH }}
      >
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Chat</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePopout}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            title="Pop out to bubble overlay"
          >
            <PanelLeftClose size={14} />
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
        src={embedSrc}
        className="flex-1 border-0"
        style={{ minWidth: MIN_WIDTH }}
        allow="clipboard-write"
        title="Usable Chat"
      />
    </div>
  )
}
