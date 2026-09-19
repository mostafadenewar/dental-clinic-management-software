import { useCallback, useRef, useState } from 'react'
import { CheckCircle, Info, Warning, WarningCircle, X } from '@phosphor-icons/react'
import { ToastContext, type ToastContextValue, type ToastItem, type ToastTone } from './toastStore'
import './toast.css'

interface ToastProviderProps {
  children: React.ReactNode
}

const TOAST_ICON: Record<ToastTone, React.ReactNode> = {
  success: <CheckCircle size={15} weight="fill" />,
  info: <Info size={15} weight="fill" />,
  warning: <Warning size={15} weight="fill" />,
  danger: <WarningCircle size={15} weight="fill" />,
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback<ToastContextValue['push']>(
    (message, opts) => {
      const id = nextId.current++
      const tone = opts?.tone ?? 'success'
      setToasts((prev) => [...prev, { id, message, tone, actionLabel: opts?.actionLabel, onAction: opts?.onAction }])
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 4200)
    },
    [],
  )

  return (
    <ToastContext.Provider value={{ push, dismiss }}>
      {children}
      <div className="toast-viewport" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`} role="status">
            <span className="toast-icon">{TOAST_ICON[t.tone]}</span>
            <span className="toast-msg">{t.message}</span>
            {t.actionLabel && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  t.onAction?.()
                  dismiss(t.id)
                }}
              >
                {t.actionLabel}
              </button>
            )}
            <button
              type="button"
              className="toast-dismiss"
              aria-label="Dismiss notification"
              onClick={() => dismiss(t.id)}
            >
              <X size={12} weight="bold" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}