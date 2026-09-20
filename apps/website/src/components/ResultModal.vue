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
    ? 'bg-primary text-primary-text focus-visible:ring-primary/40'
    : 'bg-danger-soft text-danger-soft-text focus-visible:ring-danger-soft-text/40',
)
</script>

<template>
  <BaseModal :title="effectiveTitle" :confirm-text="effectiveConfirmText" @cancel="$emit('close')">
    <p>{{ message }}</p>
    <template #footer>
      <div class="flex">
        <button
          type="button"
          class="modal-action focus-visible:ring-2"
          :class="confirmButtonClass"
          @click="$emit('close')"
        >
          {{ effectiveConfirmText }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>
