<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useToast } from '~/composables/useToast'

const { t } = useI18n()
const { dismissToast, toast } = useToast()
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-4 bottom-4 z-modal flex justify-center"
    aria-live="polite"
    aria-atomic="true"
  >
    <div
      v-if="toast"
      :key="toast.id"
      class="pointer-events-auto flex max-w-sm items-center rounded-standard px-4 py-3 text-2nd-body shadow-lg"
      :class="{
        'bg-primary text-primary-text': toast.type === 'success',
        'bg-danger text-danger-text': toast.type === 'error',
        'bg-text-primary text-surface': toast.type === 'info',
      }"
      role="status"
    >
      <span class="min-w-0 flex-1">{{ toast.message }}</span>
      <button
        type="button"
        class="ml-3 flex-none rounded-small p-1 opacity-80 focus-visible:ring-2 focus-visible:ring-current"
        :aria-label="t('modal.close')"
        @click="dismissToast"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
</template>
