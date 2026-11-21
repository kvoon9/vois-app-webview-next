import { createToaster } from '@ui-sdk/vue/toast'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastOptions {
  duration?: number
  type?: ToastType
}

const defaultDuration = 3000
const toastId = 'app-toast'

/** The app's single toast queue; ToastHost renders it once at the root. */
export const toaster = createToaster({ duration: defaultDuration })

/** Show one short-lived application message. The latest message replaces the previous one. */
function showToast(message: string, options: ToastOptions = {}): void {
  const duration = options.duration ?? defaultDuration
  toaster(message, {
    id: toastId,
    type: options.type ?? 'success',
    // The old API treated a non-positive duration as "never auto-close".
    duration: duration > 0 ? duration : Number.POSITIVE_INFINITY,
  })
}

export function useToast() {
  return {
    showToast,
    dismissToast: () => toaster.dismiss(),
  }
}
