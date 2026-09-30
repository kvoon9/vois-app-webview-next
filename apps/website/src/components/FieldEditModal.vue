<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { safeParse } from 'valibot'
import BaseModal from '~/components/BaseModal.vue'
import {
  descriptionSchema,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  nameSchema,
} from '~/utils/field-schema'

/**
 * One text field in a modal, under the shared name/description rules. The parent
 * owns the mutation and the query invalidation; this owns the value as it is
 * typed, the character limit, and the message for a value the rules reject.
 */
const props = withDefaults(
  defineProps<{
    /** Text to start from. Later changes to it do not refill a draft already open. */
    modelValue: string
    title: string
    /** `name` is one 16-character line; `description` wraps, allows line breaks, and takes 60. */
    kind: 'name' | 'description'
    /** Reject an empty value instead of saving it. */
    required?: boolean
    /** Keep a description on one line, the way the reminder content is entered. */
    multiline?: boolean
    placeholder?: string
    /** A save is on its way: the value is locked and the confirm button says so. */
    loading?: boolean
  }>(),
  { required: false, multiline: true, loading: false },
)

const emit = defineEmits<{
  cancel: []
  save: [value: string]
}>()

const { t } = useI18n({ useScope: 'global' })
const draft = shallowRef(props.modelValue)
const error = shallowRef('')

const limit = computed(() => (props.kind === 'name' ? MAX_NAME_LENGTH : MAX_DESCRIPTION_LENGTH))
/** Names never wrap; a description only when the caller leaves it multi-line. */
const singleLine = computed(() => props.kind === 'name' || !props.multiline)

const messages = computed(() => ({
  // Valibot's own i18n reads like debug output, so every rule message is ours.
  tooLong:
    props.kind === 'name'
      ? t('validation.nameTooLong', { max: MAX_NAME_LENGTH })
      : t('validation.descriptionTooLong', { max: MAX_DESCRIPTION_LENGTH }),
  singleLine: t('validation.nameSingleLine'),
  required: props.required ? t('validation.required') : undefined,
}))

const schema = computed(() => {
  const rules = messages.value
  return props.kind === 'description' ? descriptionSchema(rules) : nameSchema(rules)
})

/** Silence the message as soon as the value changes: it describes the value it saw. */
watch(draft, () => (error.value = ''), { flush: 'sync' })

function save(): void {
  if (props.loading) return

  const result = safeParse(schema.value, draft.value)
  if (!result.success) {
    error.value = result.issues[0].message
    return
  }

  error.value = ''
  emit('save', result.output)
}
</script>

<template>
  <BaseModal
    :title="title"
    :cancel-text="t('modal.cancel')"
    :confirm-text="loading ? t('device.saving') : t('modal.confirm')"
    :dismissible="!loading"
    @cancel="emit('cancel')"
    @confirm="save"
  >
    <textarea
      v-if="!singleLine"
      v-model="draft"
      class="input-field min-h-24"
      :maxlength="limit"
      :placeholder="placeholder"
      :aria-label="title"
      :disabled="loading"
      rows="3"
    />
    <input
      v-else
      v-model="draft"
      type="text"
      class="input-field"
      :maxlength="limit"
      :placeholder="placeholder"
      :aria-label="title"
      :disabled="loading"
      @keyup.enter="save"
    />
    <p class="mt-2 text-right text-small text-text-secondary">{{ draft.length }}/{{ limit }}</p>
    <p v-if="error" class="mt-1 text-small text-danger">{{ error }}</p>
  </BaseModal>
</template>
