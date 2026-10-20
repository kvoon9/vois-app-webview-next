<script setup lang="ts">
import { useMutation, useQueryCache } from '@pinia/colada'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { safeParse } from 'valibot'
import PageHeader from '~/components/PageHeader.vue'
import { parseRouteParamId } from '~/composables/useRouteParamId'
import { usePageBack } from '~/composables/usePageBack'
import { useToast } from '~/composables/useToast'
import { addEmergencyPhoneContact } from '~/utils/device-api'
import { MAX_NAME_LENGTH, nameSchema } from '~/utils/field-schema'

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const queryCache = useQueryCache()
const { goBack } = usePageBack()
const { showToast } = useToast()
const deviceId = computed(() => parseRouteParamId(route.params.id))
const phone = shallowRef('')
const name = shallowRef('')

const nameRules = computed(() =>
  nameSchema({
    required: t('validation.required'),
    tooLong: t('validation.nameTooLong', { max: MAX_NAME_LENGTH }),
    singleLine: t('validation.nameSingleLine'),
  }),
)

const addMutation = useMutation({
  mutation: (input: { name: string; phone: string }) => {
    if (deviceId.value == null) throw new Error(t('device.invalidId'))
    return addEmergencyPhoneContact(deviceId.value, input.name, input.phone)
  },
})

async function save(): Promise<void> {
  if (addMutation.isLoading.value) return
  const trimmedPhone = phone.value.trim()
  if (!/^\+?\d{5,15}$/.test(trimmedPhone)) {
    showToast(t('device.emergencyPhoneInvalid'), { type: 'error' })
    return
  }
  const trimmedName = safeParse(nameRules.value, name.value)
  if (!trimmedName.success) {
    showToast(trimmedName.issues[0].message, { type: 'error' })
    return
  }
  try {
    await addMutation.mutateAsync({ name: trimmedName.output, phone: trimmedPhone })
    await queryCache.invalidateQueries({ key: ['device-management', 'emergency-contacts'] })
    showToast(t('device.emergencyContactAdded'))
    goBack()
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="t('device.emergencyAddPhoneTitle')" />

    <main class="p-4">
      <section class="flex justify-center py-6">
        <span
          class="h-24 w-24 flex items-center justify-center rounded-large bg-surface-muted text-4xl text-text-secondary"
          aria-hidden="true"
        >
          <span class="i-ph-user" />
        </span>
      </section>

      <div class="space-y-3">
        <input
          v-model="phone"
          class="input-field"
          type="tel"
          inputmode="tel"
          maxlength="16"
          :placeholder="t('device.emergencyPhonePlaceholder')"
          :aria-label="t('device.emergencyPhonePlaceholder')"
          :disabled="addMutation.isLoading.value"
        />
        <input
          v-model="name"
          class="input-field"
          type="text"
          :maxlength="MAX_NAME_LENGTH"
          :placeholder="t('device.emergencyNamePlaceholder')"
          :aria-label="t('device.emergencyNamePlaceholder')"
          :disabled="addMutation.isLoading.value"
          @keyup.enter="save"
        />
      </div>

      <p class="mt-4 text-center text-small text-text-secondary">
        {{ t('device.emergencyTipNotify') }}
      </p>

      <button
        type="button"
        class="mt-6 btn-primary"
        :disabled="addMutation.isLoading.value"
        @click="save"
      >
        {{ addMutation.isLoading.value ? t('device.saving') : t('device.emergencySave') }}
      </button>
    </main>
  </div>
</template>
