import { useState, useCallback } from 'react'

export type ToastVariant = 'default' | 'destructive' | 'success'

export interface ToastData {
  id: string
  title: string
  description?: string
  variant?: ToastVariant
}

let toastListeners: Array<(toasts: ToastData[]) => void> = []
let toastList: ToastData[] = []

function notify(toasts: ToastData[]) {
  toastList = toasts
  toastListeners.forEach(fn => fn(toasts))
}

export function toast(data: Omit<ToastData, 'id'>) {
  const id = Math.random().toString(36).slice(2)
  notify([...toastList, { ...data, id }])
  setTimeout(() => {
    notify(toastList.filter(t => t.id !== id))
  }, 4000)
}

export function useToastState() {
  const [toasts, setToasts] = useState<ToastData[]>(toastList)
  toastListeners = [setToasts]
  const dismiss = useCallback((id: string) => {
    notify(toastList.filter(t => t.id !== id))
  }, [])
  return { toasts, dismiss }
}
