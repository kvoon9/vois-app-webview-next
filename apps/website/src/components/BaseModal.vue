<script setup lang="ts">
import { Dialog, DialogBackdrop, DialogContent, DialogTitle } from '@ui-sdk/vue/dialog'

withDefaults(
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
  // The SDK refuses Escape and outside presses while not dismissible, so any close here is a cancel.
  if (!open) emit('cancel')
}
</script>

<template>
  <Dialog :open="true" :dismissible="dismissible" @update:open="handleOpenChange">
    <DialogBackdrop class="fixed inset-0 bg-black/50" />

    <DialogContent
      class="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-sm max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden rounded-large bg-surface-dialog text-text-primary shadow-xl"
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
              @click="emit('cancel')"
            >
              {{ cancelText }}
            </button>
            <button
              type="button"
              class="modal-action focus-visible:ring-2"
              :class="
                tone === 'danger'
                  ? 'bg-danger-soft text-danger-soft-text focus-visible:ring-danger-soft-text/40'
                  : 'bg-primary text-primary-text focus-visible:ring-primary/40'
              "
              @click="emit('confirm')"
            >
              {{ confirmText }}
            </button>
          </div>
        </slot>
      </footer>
    </DialogContent>
  </Dialog>
</template>
