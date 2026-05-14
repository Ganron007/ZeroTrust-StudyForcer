"use client"

import { useState, useEffect, useCallback } from "react"
import { X, Clock, Coffee, CheckCircle } from "lucide-react"

export type ToastType = "info" | "break" | "complete"

interface Toast {
  id: string
  message: string
  type: ToastType
}

let toastListeners: ((toast: Toast) => void)[] = []

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

// eslint-disable-next-line react-refresh/only-export-components
export function showToast(message: string, type: ToastType = "info") {
  const toast: Toast = { id: generateId(), message, type }
  toastListeners.forEach((listener) => listener(toast))
}

export default function NotificationToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const listener = (toast: Toast) => {
      setToasts((prev) => [...prev, toast])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id))
      }, 5000)
    }
    toastListeners.push(listener)
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener)
    }
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
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
          <p className="text-sm font-medium">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}