import { useCallback } from 'react'
import { useChatEmbed } from '@/hooks/use-chat-embed'
import { X, PanelLeftClose } from 'lucide-react'

interface DockedChatProps {
  open: boolean
  onClose: () => void
}

export function DockedChat({ open, onClose }: DockedChatProps) {
  const { iframeRef, embedSrc } = useChatEmbed()

  const handlePopout = useCallback(() => {
    window.api.chat.setMode('bubble')
  }, [])

  if (!embedSrc) return null

  return (
    <div
      className="h-full border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out"
      style={{ width: open ? 380 : 0 }}
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 shrink-0"
        style={{ minWidth: 380 }}
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
        style={{ minWidth: 380 }}
        allow="clipboard-write"
        title="Usable Chat"
      />
    </div>
  )
}
