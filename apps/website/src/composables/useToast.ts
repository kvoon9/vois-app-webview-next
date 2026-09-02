import { shallowRef } from 'vue'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  message: string
  type: ToastType
}

export interface ToastOptions {
  duration?: number
  type?: ToastType
}

const defaultDuration = 3000
const toast = shallowRef<Toast | null>(null)
let dismissTimer: ReturnType<typeof setTimeout> | undefined
let nextId = 0

function clearDismissTimer(): void {
  if (dismissTimer !== undefined) {
    clearTimeout(dismissTimer)
    dismissTimer = undefined
  }
}

/** Show one short-lived application message. The latest message replaces the previous one. */
function showToast(message: string, options: ToastOptions = {}): void {
  clearDismissTimer()

  const id = ++nextId
  toast.value = {
    id,
    message,
    type: options.type ?? 'success',
  }

  const duration = options.duration ?? defaultDuration
  if (duration > 0) {
    dismissTimer = setTimeout(() => {
      if (toast.value?.id === id) dismissToast()
    }, duration)
  }
}

function dismissToast(): void {
  clearDismissTimer()
  toast.value = null
}

export function useToast() {
  return {
    toast,
    showToast,
    dismissToast,
  }
}
