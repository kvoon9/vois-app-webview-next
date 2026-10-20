<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import Avatar from '~/components/Avatar.vue'
import BaseModal from '~/components/BaseModal.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { parseRouteParamId } from '~/composables/useRouteParamId'
import { useToast } from '~/composables/useToast'
import {
  getEmergencyContacts,
  removeEmergencyContact,
  type EmergencyContact,
} from '~/utils/device-api'

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const router = useRouter()
const queryCache = useQueryCache()
const { showToast } = useToast()
const removing = shallowRef<EmergencyContact | null>(null)
const deviceId = computed(() => parseRouteParamId(route.params.id))

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

const removeMutation = useMutation({
  mutation: (target: EmergencyContact) => {
    if (deviceId.value == null) throw new Error(t('device.invalidId'))
    // SOS contacts carry no id; the server identifies them by number plus kind.
    return removeEmergencyContact(deviceId.value, target.number, target.type)
  },
})

/** Native keeps the entries tappable and explains the cap in a toast. */
function openAddFriend(): void {
  if (friendsFull.value) {
    showToast(t('device.emergencyFriendsLimit', { max: quota.value?.friendMax ?? 0 }), {
      type: 'error',
    })
    return
  }
  if (deviceId.value != null) {
    router.push(`/devices/${deviceId.value}/emergency-contacts/add-friend`)
  }
}

function openAddPhone(): void {
  if (phonesFull.value) {
    showToast(t('device.emergencyPhonesLimit', { max: quota.value?.phoneMax ?? 0 }), {
      type: 'error',
    })
    return
  }
  if (deviceId.value != null) {
    router.push(`/devices/${deviceId.value}/emergency-contacts/add-phone`)
  }
}

async function removeContact(): Promise<void> {
  if (!removing.value || removeMutation.isLoading.value) return
  try {
    await removeMutation.mutateAsync(removing.value)
    removing.value = null
    await queryCache.invalidateQueries({ key: ['device-management', 'emergency-contacts'] })
    showToast(t('device.emergencyContactRemoved'))
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}
</script>

<template>
  <div class="page">
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

          <ul class="mt-4 overflow-hidden panel">
            <li
              v-for="contact in contacts"
              :key="`${contact.type}-${contact.number}`"
              class="flex items-center"
            >
              <Avatar :name="contact.name" :src="contact.avatar" />
              <span class="ml-3 min-w-0 flex-1">
                <span class="block truncate text-body font-medium">{{ contact.name }}</span>
                <span class="mt-0.5 block truncate text-small text-text-secondary">
                  {{ contact.number }}
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
            <button type="button" class="min-h-14 w-full nav-item" @click="openAddFriend">
              <span>{{ t('device.emergencyAddFriend') }}</span>
              <span class="i-ph-plus text-2xl text-text-secondary" aria-hidden="true" />
            </button>
            <button type="button" class="min-h-14 w-full nav-item" @click="openAddPhone">
              <span>{{ t('device.emergencyAddPhone') }}</span>
              <span class="i-ph-plus text-2xl text-text-secondary" aria-hidden="true" />
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
      tone="danger"
      @cancel="removing = null"
      @confirm="removeContact"
    >
      <p>{{ t('device.emergencyContactRemoveConfirm', { name: removing.name }) }}</p>
    </BaseModal>
  </div>
</template>
