<script setup lang="ts">
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from '~/components/BaseModal.vue'
import { useToast } from '~/composables/useToast'

const props = defineProps<{
  groupName: string
  /** Audit groups join via an application carrying a reason (`detail`). */
  needsAudit: boolean
  loading: boolean
}>()
const emit = defineEmits<{
  cancel: []
  confirm: [detail: string]
}>()

const { t } = useI18n({ useScope: 'global' })
const { showToast } = useToast()
const reason = shallowRef('')

function confirm(): void {
  if (props.loading) return
  if (props.needsAudit && reason.value.trim() === '') {
    showToast(t('device.applyReasonRequired'), { type: 'error' })
    return
  }
  emit('confirm', reason.value.trim())
}
</script>

<template>
  <BaseModal
    :title="t('device.confirmAddGroup')"
    :cancel-text="t('modal.cancel')"
    :confirm-text="loading ? t('device.saving') : t('modal.confirm')"
    :dismissible="!loading"
    @cancel="emit('cancel')"
    @confirm="confirm"
  >
    <p>{{ t('device.confirmAddGroupMessage', { group: groupName }) }}</p>
    <label v-if="needsAudit" class="mt-3 block text-body">
      {{ t('device.applyReason') }}
      <textarea
        v-model="reason"
        class="input-field mt-2 min-h-24"
        :placeholder="t('device.applyReasonPlaceholder')"
        :aria-label="t('device.applyReason')"
        :disabled="loading"
        rows="3"
      />
    </label>
  </BaseModal>
</template>
