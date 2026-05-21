"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { X, Clock, Coffee, CheckCircle } from "lucide-react"

export type ToastType = "info" | "break" | "complete"

const MAX_VISIBLE_TOASTS = 5
const DISMISS_MS = 5000

interface Toast {
  id: string
  message: string
  type: ToastType
}

/** A65: Use a Set to prevent duplicate listeners in StrictMode/hot-reload. */
let toastListeners = new Set<(toast: Toast) => void>()

let counter = 0
function generateId(): string {
  return `t${++counter}-${Date.now().toString(36)}`
}

// eslint-disable-next-line react-refresh/only-export-components
export function showToast(message: string, type: ToastType = "info") {
  const toast: Toast = { id: generateId(), message, type }
  toastListeners.forEach((listener) => listener(toast))
}

export default function NotificationToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  // A66: track which toasts are being hovered to pause auto-dismiss
  const hoveredRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const listener = (toast: Toast) => {
      setToasts((prev) => {
        // A67: Cap queue at MAX_VISIBLE_TOASTS, evict oldest
        const next = [...prev, toast]
        if (next.length > MAX_VISIBLE_TOASTS) {
          return next.slice(next.length - MAX_VISIBLE_TOASTS)
        }
        return next
      })
    }
    toastListeners.add(listener)
    return () => {
      toastListeners.delete(listener)
    }
  }, [])

  // A66: Pause timer on hover — each toast gets its own timeout managed here
  useEffect(() => {
    if (toasts.length === 0) return
    const timers = new Map<string, ReturnType<typeof setTimeout>>()

    function startTimer(id: string) {
      if (hoveredRef.current.has(id)) return // paused
      timers.set(id, setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, DISMISS_MS))
    }

    function stopTimer(id: string) {
      const existing = timers.get(id)
      if (existing) clearTimeout(existing)
    }

    // Start timers for all visible toasts
    for (const t of toasts) {
      if (!timers.has(t.id)) startTimer(t.id)
    }

    return () => {
      for (const t of timers.values()) clearTimeout(t)
    }
  }, [toasts.length])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          // A66: pause auto-dismiss on hover
          onMouseEnter={() => { hoveredRef.current.add(toast.id) }}
          onMouseLeave={() => { hoveredRef.current.delete(toast.id) }}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-in slide-in-from-bottom-2 fade-in duration-300 ${
            toast.type === "break"
              ? "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100"
              : toast.type === "complete"
              ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100"
              : "bg-card border-border text-foreground"
          }`}
        >
          {toast.type === "break" ? (
            <Coffee className="w-5 h-5 text-amber-500 flex-shrink-0" />
          ) : toast.type === "complete" ? (
            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          ) : (
            <Clock className="w-5 h-5 text-primary flex-shrink-0" />
          )}
          <p className="text-sm font-medium flex-1">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-1 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
