<script setup lang="ts">
import { Toast, ToastRegion, ToastTitle } from '@ui-sdk/vue/toast'
import { toaster, useToast } from '~/composables/useToast'

const { dismissToast } = useToast()
</script>

<template>
  <ToastRegion
    :toaster="toaster"
    :max-visible="1"
    side="bottom"
    align="center"
    class="pointer-events-none fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] z-modal flex flex-row justify-center"
  >
    <!-- The toast itself is the dismiss target: no close affordance to aim at. -->
    <Toast
      class="toast-pill pointer-events-auto flex max-w-sm cursor-pointer items-center rounded-standard px-4 py-3 text-left text-2nd-body shadow-lg"
      @click="dismissToast"
    >
      <ToastTitle class="min-w-0 flex-1" />
    </Toast>
  </ToastRegion>
</template>

<style scoped>
/*
 * The SDK's toast CSS lives in @layer ui-sdk, which Chrome < 99 drops.
 * Supply the list reset and cancel its centered `translate` (Chrome 104+).
 */
:deep([data-slot='toast-list']) {
  margin: 0;
  padding: 0;
  list-style: none;
}

[data-slot='toast-region'] {
  translate: none;
}

.toast-pill[data-type='success'] {
  background: var(--color-primary);
  color: var(--color-primary-text);
}

.toast-pill[data-type='error'] {
  background: var(--color-danger);
  color: var(--color-danger-text);
}

.toast-pill[data-type='info'] {
  background: var(--color-text-primary);
  color: var(--color-surface);
}
</style>
