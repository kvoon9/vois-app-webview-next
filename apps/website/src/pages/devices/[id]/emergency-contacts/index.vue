<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import Avatar from '~/components/Avatar.vue'
import BaseModal from '~/components/BaseModal.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { useToast } from '~/composables/useToast'
import {
  getEmergencyContacts,
  removeEmergencyContact,
  type EmergencyContact,
} from '~/utils/device-api'

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
const removing = shallowRef<EmergencyContact | null>(null)
const deviceId = computed(() => routeNumber(route.params.id))

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'emergency-contacts', deviceId.value],
  query: () => {
    if (deviceId.value == null) throw new Error(t('device.invalidId'))
    return getEmergencyContacts(deviceId.value)
  },
})

const contacts = computed(() => state.value.data?.contacts ?? [])
const quota = computed(() => state.value.data?.quota)
const friendCount = computed(() => contacts.value.filter((c) => c.type === 'friend').length)
const phoneCount = computed(() => contacts.value.filter((c) => c.type === 'phone').length)
const friendsFull = computed(
  () => quota.value != null && friendCount.value >= quota.value.friendMax,
)
const phonesFull = computed(() => quota.value != null && phoneCount.value >= quota.value.phoneMax)

function displayName(contact: EmergencyContact): string {
  return contact.nick || contact.name
}

function contactNumber(contact: EmergencyContact): string {
  return contact.userNum || contact.phone
}

const removeMutation = useMutation({
  mutation: (contactId: number) => {
    if (deviceId.value == null) throw new Error(t('device.invalidId'))
    return removeEmergencyContact(deviceId.value, contactId)
  },
})

function openAddFriend(): void {
  if (deviceId.value != null && !friendsFull.value) {
    router.push({
      path: `/devices/${deviceId.value}/emergency-contacts/add-friend`,
      query: route.query,
    })
  }
}

function openAddPhone(): void {
  if (deviceId.value != null && !phonesFull.value) {
    router.push({
      path: `/devices/${deviceId.value}/emergency-contacts/add-phone`,
      query: route.query,
    })
  }
}

async function removeContact(): Promise<void> {
  if (!removing.value || removeMutation.isLoading.value) return
  try {
    await removeMutation.mutateAsync(removing.value.contactId)
    removing.value = null
    await queryCache.invalidateQueries({ key: ['device-management', 'emergency-contacts'] })
    showToast(t('device.emergencyContactRemoved'))
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}
</script>

<template>
  <div class="min-h-screen min-h-svh bg-surface text-text-primary">
    <PageHeader :title="t('device.emergencyContactSettings')" />

    <main class="p-4">
      <QueryState :status="state.status" :error="state.error" @retry="reload()">
        <template v-if="state.data">
          <section class="card">
            <h2 class="text-header font-semibold">{{ t('device.emergencyTips') }}</h2>
            <ul class="mt-3 space-y-2 text-small text-text-secondary">
              <li>
                {{
                  t('device.emergencyTipQuota', {
                    friendMax: state.data.quota.friendMax,
                    phoneMax: state.data.quota.phoneMax,
                  })
                }}
              </li>
              <li>{{ t('device.emergencyTipNotify') }}</li>
              <li>
                {{ t('device.emergencyTipSos', { sos: state.data.quota.sosRemaining }) }}
              </li>
            </ul>
          </section>

          <ul class="mt-4 overflow-hidden rounded-standard border border-stroke bg-surface">
            <li
              v-for="contact in contacts"
              :key="contact.contactId"
              class="flex items-center border-b border-stroke px-4 py-3 last:border-b-0"
            >
              <Avatar :name="displayName(contact)" :src="contact.avatar" />
              <span class="ml-3 min-w-0 flex-1">
                <span class="block truncate text-body font-medium">{{ displayName(contact) }}</span>
                <span class="mt-0.5 block truncate text-small text-text-secondary">
                  {{ contactNumber(contact) }}
                </span>
              </span>
              <button
                type="button"
                class="ml-3 flex-none text-danger"
                :aria-label="t('device.emergencyContactRemove')"
                :disabled="removeMutation.isLoading.value"
                @click="removing = contact"
              >
                <span
                  class="flex h-6 w-6 items-center justify-center rounded-full border border-current"
                  aria-hidden="true"
                  >−</span
                >
              </button>
            </li>
          </ul>

          <nav class="mt-4 space-y-3" :aria-label="t('device.emergencyContactAdd')">
            <button
              type="button"
              class="min-h-14 w-full flex items-center justify-between rounded-standard border border-stroke bg-surface px-4 text-body disabled:opacity-50"
              :disabled="friendsFull"
              @click="openAddFriend"
            >
              <span>{{ t('device.emergencyAddFriend') }}</span>
              <span class="text-2xl leading-none text-text-secondary" aria-hidden="true">＋</span>
            </button>
            <button
              type="button"
              class="min-h-14 w-full flex items-center justify-between rounded-standard border border-stroke bg-surface px-4 text-body disabled:opacity-50"
              :disabled="phonesFull"
              @click="openAddPhone"
            >
              <span>{{ t('device.emergencyAddPhone') }}</span>
              <span class="text-2xl leading-none text-text-secondary" aria-hidden="true">＋</span>
            </button>
          </nav>
        </template>
      </QueryState>
    </main>

    <BaseModal
      v-if="removing"
      :title="t('device.emergencyContactRemove')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="removeMutation.isLoading.value ? t('device.saving') : t('modal.confirm')"
      :dismissible="!removeMutation.isLoading.value"
      @cancel="removing = null"
      @confirm="removeContact"
    >
      <p>{{ t('device.emergencyContactRemoveConfirm', { name: displayName(removing) }) }}</p>
    </BaseModal>
  </div>
</template>
