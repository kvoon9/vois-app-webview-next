<script setup lang="ts">
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'

const props = withDefaults(
  defineProps<{
    cancelText?: string
    confirmText?: string
    dismissible?: boolean
    title: string
  }>(),
  {
    cancelText: 'Cancel',
    confirmText: 'Confirm',
    dismissible: true,
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
          class="max-h-[calc(100vh-2rem)] w-full max-w-sm flex flex-col overflow-hidden rounded-large bg-surface text-text-primary shadow-xl"
          :aria-describedby="undefined"
          @escape-key-down="preventDismiss"
          @pointer-down-outside="preventDismiss"
        >
          <DialogTitle class="flex-none p-4 text-header font-semibold">
            <slot name="header">{{ title }}</slot>
          </DialogTitle>
          <div class="min-h-0 overflow-y-auto p-4 text-body">
            <slot />
          </div>
          <footer class="flex-none p-4">
            <slot name="footer">
              <div class="flex justify-end space-x-3">
                <button
                  type="button"
                  class="rounded-small px-4 py-2 text-text-secondary focus-visible:ring-2 focus-visible:ring-primary/40"
                  @click="$emit('cancel')"
                >
                  {{ cancelText }}
                </button>
                <button
                  type="button"
                  class="rounded-small bg-primary px-4 py-2 text-primary-text focus-visible:ring-2 focus-visible:ring-primary/40"
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
