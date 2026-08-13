import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type ToastTone = 'default' | 'success' | 'warning' | 'error'

type ToastItem = {
  id: string
  title: string
  message?: string
  tone: ToastTone
}

type ToastApi = {
  push: (toast: Omit<ToastItem, 'id' | 'tone'> & { tone?: ToastTone }) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback(
    (toast: Omit<ToastItem, 'id' | 'tone'> & { tone?: ToastTone }) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      const item: ToastItem = {
        id,
        title: toast.title,
        message: toast.message,
        tone: toast.tone ?? 'default',
      }
      setItems((prev) => [...prev, item].slice(-4))
      window.setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id))
      }, 3200)
    },
    [],
  )

  const api = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className="toast">
            <div>
              <div className="toast-title">{item.title}</div>
              {item.message ? <div className="toast-message">{item.message}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
