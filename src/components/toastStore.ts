import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'info' | 'warning' | 'danger'

export interface ToastItem {
  id: number
  message: string
  tone: ToastTone
  actionLabel?: string
  onAction?: () => void
}

export interface ToastContextValue {
  push: (
    message: string,
    opts?: { tone?: ToastTone; actionLabel?: string; onAction?: () => void },
  ) => void
  dismiss: (id: number) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}