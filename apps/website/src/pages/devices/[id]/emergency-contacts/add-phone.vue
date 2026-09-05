<script setup lang="ts">
import { useMutation, useQueryCache } from '@pinia/colada'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '~/components/PageHeader.vue'
import { useToast } from '~/composables/useToast'
import { addEmergencyPhone } from '~/utils/device-api'

type RouteParam = string | string[] | undefined

function routeNumber(value: RouteParam): number | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw || raw.trim() === '') return null
  const number = Number(raw)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const router = useRouter()
const queryCache = useQueryCache()
const { showToast } = useToast()
const deviceId = computed(() => routeNumber(route.params.id))
const phone = shallowRef('')
const name = shallowRef('')

const addMutation = useMutation({
  mutation: (input: { name: string; phone: string }) => {
    if (deviceId.value == null) throw new Error(t('device.invalidId'))
    return addEmergencyPhone(deviceId.value, input.name, input.phone)
  },
})

function validPhone(value: string): boolean {
  return /^\+?\d{5,15}$/.test(value)
}

async function save(): Promise<void> {
  if (addMutation.isLoading.value) return
  const trimmedPhone = phone.value.trim()
  const trimmedName = name.value.trim()
  if (!validPhone(trimmedPhone)) {
    showToast(t('device.emergencyPhoneInvalid'), { type: 'error' })
    return
  }
  if (trimmedName === '') {
    showToast(t('device.emergencyNameRequired'), { type: 'error' })
    return
  }
  try {
    await addMutation.mutateAsync({ name: trimmedName, phone: trimmedPhone })
    await queryCache.invalidateQueries({ key: ['device-management', 'emergency-contacts'] })
    showToast(t('device.emergencyContactAdded'))
    await router.push({
      path: `/devices/${deviceId.value}/emergency-contacts`,
      query: route.query,
    })
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}
</script>

<template>
  <div class="min-h-screen min-h-svh bg-surface text-text-primary">
    <PageHeader :title="t('device.emergencyAddPhoneTitle')" />

    <main class="p-4">
      <section class="flex justify-center py-6">
        <span
          class="flex h-20 w-20 items-center justify-center rounded-standard bg-surface-muted text-3xl text-text-secondary"
          aria-hidden="true"
        >
          👤
        </span>
      </section>

      <section class="overflow-hidden rounded-standard border border-stroke bg-surface">
        <label class="flex items-center border-b border-stroke px-4 py-3">
          <span class="text-lg text-text-secondary" aria-hidden="true">📱</span>
          <input
            v-model="phone"
            class="ml-3 min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-text-secondary"
            type="tel"
            inputmode="tel"
            maxlength="16"
            :placeholder="t('device.emergencyPhonePlaceholder')"
            :disabled="addMutation.isLoading.value"
          />
        </label>
        <label class="flex items-center px-4 py-3">
          <span class="text-lg text-text-secondary" aria-hidden="true">👤</span>
          <input
            v-model="name"
            class="ml-3 min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-text-secondary"
            type="text"
            maxlength="64"
            :placeholder="t('device.emergencyNamePlaceholder')"
            :disabled="addMutation.isLoading.value"
            @keyup.enter="save"
          />
        </label>
      </section>

      <button
        type="button"
        class="min-h-14 mt-4 w-full bg-surface text-header font-medium disabled:opacity-50"
        :disabled="addMutation.isLoading.value"
        @click="save"
      >
        {{ addMutation.isLoading.value ? t('device.saving') : t('device.emergencySave') }}
      </button>

      <p class="mt-4 text-center text-small text-text-secondary">
        {{ t('device.emergencyTipNotify') }}
      </p>
    </main>
  </div>
</template>
