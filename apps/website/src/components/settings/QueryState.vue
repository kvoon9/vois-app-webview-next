<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  status: 'pending' | 'error' | 'success'
  error?: Error | null
  empty?: boolean
  emptyText?: string
}>()

defineEmits<{
  retry: []
}>()

const errorMessage = computed(() => props.error?.message ?? '')
</script>

<template>
  <div v-if="status === 'pending'" class="py-12 text-center text-body text-text-secondary">
    {{ $t('translation.loading') }}
  </div>

  <div v-else-if="status === 'error'" class="py-12 text-center">
    <p class="text-body text-danger">{{ errorMessage }}</p>
    <button
      type="button"
      class="mt-4 rounded-small bg-primary px-4 py-2 text-primary-text"
      @click="$emit('retry')"
    >
      {{ $t('translation.retry') }}
    </button>
  </div>

  <p v-else-if="empty" class="py-12 text-center text-body text-text-secondary">
    {{ emptyText }}
  </p>

  <slot v-else />
</template>
