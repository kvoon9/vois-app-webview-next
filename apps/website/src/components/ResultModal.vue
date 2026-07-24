<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from '~/components/BaseModal.vue'

const props = withDefaults(
  defineProps<{
    type: 'success' | 'error'
    title?: string
    message: string
    confirmText?: string
  }>(),
  {
    type: 'success',
  },
)

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n({ useScope: 'global' })

const effectiveTitle = computed(() => {
  if (props.title) return props.title
  return props.type === 'success' ? t('modal.successTitle') : t('modal.errorTitle')
})

const effectiveConfirmText = computed(() => {
  if (props.confirmText) return props.confirmText
  return props.type === 'success' ? t('modal.ok') : t('modal.close')
})

const confirmButtonClass = computed(() =>
  props.type === 'success'
    ? 'rounded-small bg-primary px-4 py-2 text-primary-text'
    : 'rounded-small bg-danger px-4 py-2 text-danger-text',
)
</script>

<template>
  <BaseModal
    :title="effectiveTitle"
    :confirm-text="effectiveConfirmText"
    @cancel="$emit('close')"
    @confirm="$emit('close')"
  >
    <p>{{ message }}</p>
    <template #footer>
      <div class="flex justify-end">
        <button type="button" :class="confirmButtonClass" @click="$emit('close')">
          {{ effectiveConfirmText }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>
