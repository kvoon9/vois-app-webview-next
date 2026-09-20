<script setup lang="ts">
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'

const props = withDefaults(
  defineProps<{
    cancelText?: string
    confirmText?: string
    dismissible?: boolean
    title: string
    /**
     * Paint for the confirm action. `danger` marks the actions that cannot be
     * undone, so the colour carries the consequence, not the button order.
     */
    tone?: 'primary' | 'danger'
  }>(),
  {
    cancelText: 'Cancel',
    confirmText: 'Confirm',
    dismissible: true,
    tone: 'primary',
  },
)

const emit = defineEmits<{
  cancel: []
  confirm: []
}>()

function handleOpenChange(open: boolean): void {
  if (!open && props.dismissible) emit('cancel')
}

function preventDismiss(event: Event): void {
  if (!props.dismissible) event.preventDefault()
}
</script>

<template>
  <DialogRoot :open="true" @update:open="handleOpenChange">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-modal flex items-center justify-center overflow-y-auto bg-black/50 p-4"
      >
        <DialogContent
          class="max-h-[calc(100vh-2rem)] w-full max-w-sm flex flex-col overflow-hidden rounded-large bg-surface-elevated text-text-primary shadow-xl"
          :aria-describedby="undefined"
          @escape-key-down="preventDismiss"
          @pointer-down-outside="preventDismiss"
        >
          <DialogTitle class="flex-none px-5 pb-4 pt-6 text-center text-header font-semibold">
            <slot name="header">{{ title }}</slot>
          </DialogTitle>
          <div class="min-h-0 overflow-y-auto px-5 text-body">
            <slot />
          </div>
          <footer class="flex-none p-5">
            <slot name="footer">
              <div class="flex space-x-3">
                <button
                  type="button"
                  class="modal-action bg-surface-field text-text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                  @click="$emit('cancel')"
                >
                  {{ cancelText }}
                </button>
                <button
                  type="button"
                  class="modal-action focus-visible:ring-2"
                  :class="
                    tone === 'danger'
                      ? 'bg-danger text-danger-text focus-visible:ring-danger/40'
                      : 'bg-primary text-primary-text focus-visible:ring-primary/40'
                  "
                  @click="$emit('confirm')"
                >
                  {{ confirmText }}
                </button>
              </div>
            </slot>
          </footer>
        </DialogContent>
      </DialogOverlay>
    </DialogPortal>
  </DialogRoot>
</template>
