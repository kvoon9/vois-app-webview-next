<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { safeParse } from 'valibot'
import BaseModal from '~/components/BaseModal.vue'
import { useToast } from '~/composables/useToast'
import { descriptionSchema, MAX_DESCRIPTION_LENGTH } from '~/utils/field-schema'

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

const reasonRules = computed(() =>
  descriptionSchema({
    // An audit group asks for the reason; a direct join sends none.
    required: props.needsAudit ? t('validation.required') : undefined,
    tooLong: t('validation.descriptionTooLong', { max: MAX_DESCRIPTION_LENGTH }),
  }),
)

function confirm(): void {
  if (props.loading) return

  const detail = safeParse(reasonRules.value, reason.value)
  if (!detail.success) {
    showToast(detail.issues[0].message, { type: 'error' })
    return
  }

  emit('confirm', detail.output)
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
        :maxlength="MAX_DESCRIPTION_LENGTH"
        :placeholder="t('device.applyReasonPlaceholder')"
        :aria-label="t('device.applyReason')"
        :disabled="loading"
        rows="3"
      />
    </label>
  </BaseModal>
</template>
