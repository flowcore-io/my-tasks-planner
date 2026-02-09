import { createContext, useCallback, useContext, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

type ToastVariant = 'success' | 'error' | 'info'

interface ToastData {
  id: string
  title: string
  variant: ToastVariant
}

interface ToastContextValue {
  toast: (opts: { title: string; variant?: ToastVariant }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let toastId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback(({ title, variant = 'info' }: { title: string; variant?: ToastVariant }) => {
    const id = String(++toastId)
    setToasts(prev => {
      const next = [...prev, { id, title, variant }]
      // Keep max 5 toasts
      return next.length > 5 ? next.slice(next.length - 5) : next
    })
    setTimeout(() => removeToast(id), 3000)
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {createPortal(
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
          <AnimatePresence mode="popLayout">
            {toasts.map(t => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: 80, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 80, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium min-w-[240px] max-w-[360px] ${variantStyles[t.variant]}`}
              >
                <span className="flex-1">{t.title}</span>
                <button
                  onClick={() => removeToast(t.id)}
                  className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                >
                  <X size={14} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

const variantStyles: Record<ToastVariant, string> = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-gray-700 text-white',
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
