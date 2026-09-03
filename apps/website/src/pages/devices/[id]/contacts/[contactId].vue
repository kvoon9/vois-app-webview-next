<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import BaseModal from '~/components/BaseModal.vue'
import Avatar from '~/components/Avatar.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { useToast } from '~/composables/useToast'
import {
  clearDeviceMessages,
  getDeviceContacts,
  removeDeviceContact,
  updateDeviceContactSettings,
  type Contact,
  type ContactSettings,
} from '~/utils/device-api'

type RouteParam = string | string[] | undefined

type SettingName = keyof ContactSettings

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
const contactId = computed(() => routeNumber(route.params.contactId))
const editingRemark = shallowRef(false)
const remark = shallowRef('')
const removeConfirmation = shallowRef(false)
const settings = shallowRef<ContactSettings>({
  muted: false,
  shareLocation: false,
  broadcast: false,
  pinned: false,
})

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'contact', deviceId.value, contactId.value],
  query: async (): Promise<Contact> => {
    if (deviceId.value == null || contactId.value == null)
      throw new Error(t('device.invalidContact'))
    const contact = (await getDeviceContacts(deviceId.value)).find(
      (item) => item.userId === contactId.value,
    )
    if (!contact) throw new Error(t('device.contactNotFound'))
    return contact
  },
})

const contact = computed<Contact | null>(() => state.value.data ?? null)

watch(
  contact,
  (value) => {
    if (!value) return
    remark.value = value.remark
    settings.value = { ...value.settings }
  },
  { immediate: true },
)

const updateMutation = useMutation({
  mutation: (input: Partial<ContactSettings> & { remark?: string }) => {
    if (deviceId.value == null || contactId.value == null) {
      throw new Error(t('device.invalidContact'))
    }
    return updateDeviceContactSettings(deviceId.value, contactId.value, input)
  },
})

const clearMutation = useMutation({
  mutation: () => {
    if (deviceId.value == null || contactId.value == null) {
      throw new Error(t('device.invalidContact'))
    }
    return clearDeviceMessages(deviceId.value, contactId.value)
  },
})

const removeMutation = useMutation({
  mutation: () => {
    if (deviceId.value == null || contactId.value == null) {
      throw new Error(t('device.invalidContact'))
    }
    return removeDeviceContact(deviceId.value, contactId.value)
  },
})

const settingItems = computed(() => [
  { key: 'muted' as const, label: t('device.muteNotifications') },
  { key: 'shareLocation' as const, label: t('device.shareLocation') },
  { key: 'broadcast' as const, label: t('device.broadcast') },
  { key: 'pinned' as const, label: t('device.stickOnTop') },
])

function openRemarkEditor(): void {
  if (!contact.value) return
  remark.value = contact.value.remark
  editingRemark.value = true
}

async function saveRemark(): Promise<void> {
  if (!editingRemark.value || updateMutation.isLoading.value) return
  try {
    await updateMutation.mutateAsync({ remark: remark.value.trim() })
    editingRemark.value = false
    await queryCache.invalidateQueries({ key: ['device-management', 'contact'] })
    showToast(t('device.contactUpdated'))
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}

async function toggleSetting(key: SettingName): Promise<void> {
  if (updateMutation.isLoading.value || !contact.value) return
  const previous = settings.value[key]
  settings.value = { ...settings.value, [key]: !previous }
  try {
    await updateMutation.mutateAsync({ [key]: !previous })
    await queryCache.invalidateQueries({ key: ['device-management', 'contact'] })
    showToast(t('device.contactSettingsUpdated'))
  } catch (error) {
    settings.value = { ...settings.value, [key]: previous }
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}

async function clearMessages(): Promise<void> {
  if (clearMutation.isLoading.value) return
  try {
    await clearMutation.mutateAsync()
    showToast(t('device.messagesCleared'))
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}

async function removeContact(): Promise<void> {
  if (removeMutation.isLoading.value) return
  try {
    await removeMutation.mutateAsync()
    removeConfirmation.value = false
    await queryCache.invalidateQueries({ key: ['device-management', 'contacts'] })
    showToast(t('device.contactRemoved'))
    await router.push({ path: `/devices/${deviceId.value}/contacts`, query: route.query })
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}
</script>

<template>
  <div class="min-h-screen min-h-svh bg-surface text-text-primary">
    <PageHeader :title="contact?.nick ?? t('device.contactDetail')" />

    <main class="p-4">
      <QueryState :status="state.status" :error="state.error" @retry="reload()">
        <template v-if="contact">
          <section class="flex flex-col items-center py-4 text-center">
            <Avatar
              :name="contact.nick"
              :src="contact.avatar"
              :online="contact.online"
              show-status
              size="lg"
            />
            <h2 class="mt-3 text-header font-semibold">{{ contact.nick }}</h2>
            <p class="mt-1 text-small text-text-secondary">{{ contact.userNum }}</p>
          </section>

          <dl class="mt-2 overflow-hidden rounded-standard border border-stroke bg-surface">
            <div class="flex items-center justify-between border-b border-stroke px-4 py-3">
              <dt class="text-2nd-body text-text-secondary">{{ t('device.registeredAt') }}</dt>
              <dd class="ml-4 text-right text-2nd-body">
                {{ contact.registeredAt || t('device.notAvailable') }}
              </dd>
            </div>
            <div class="px-4 py-3">
              <dt class="text-2nd-body text-text-secondary">{{ t('device.signature') }}</dt>
              <dd class="mt-1 text-2nd-body">
                {{ contact.signature || t('device.notAvailable') }}
              </dd>
            </div>
          </dl>

          <section class="mt-4 overflow-hidden rounded-standard border border-stroke bg-surface">
            <button
              v-for="item in settingItems"
              :key="item.key"
              type="button"
              role="switch"
              class="min-h-14 w-full flex items-center justify-between border-b border-stroke px-4 text-left last:border-b-0 disabled:opacity-50"
              :aria-checked="settings[item.key]"
              :disabled="updateMutation.isLoading.value"
              @click="toggleSetting(item.key)"
            >
              <span class="text-body">{{ item.label }}</span>
              <span
                class="relative h-6 w-10 rounded-full transition-colors"
                :class="settings[item.key] ? 'bg-primary' : 'bg-stroke'"
                aria-hidden="true"
              >
                <span
                  class="absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform"
                  :class="settings[item.key] ? 'translate-x-5' : 'translate-x-1'"
                />
              </span>
            </button>
          </section>

          <section class="mt-4 overflow-hidden rounded-standard border border-stroke bg-surface">
            <button
              type="button"
              class="min-h-14 w-full flex items-center justify-between px-4 text-left"
              @click="openRemarkEditor"
            >
              <span class="min-w-0">
                <span class="block text-body">{{ t('device.remark') }}</span>
                <span class="mt-0.5 block truncate text-small text-text-secondary">
                  {{ contact.remark || t('device.remarkPlaceholder') }}
                </span>
              </span>
              <span aria-hidden="true" class="ml-3 flex-none text-text-secondary">›</span>
            </button>
            <button
              type="button"
              class="min-h-14 w-full flex items-center justify-between border-t border-stroke px-4 text-left disabled:opacity-50"
              :disabled="clearMutation.isLoading.value"
              @click="clearMessages"
            >
              <span class="text-body">{{ t('device.clearMessages') }}</span>
              <span aria-hidden="true" class="ml-3 flex-none text-text-secondary">›</span>
            </button>
            <RouterLink
              :to="{ path: '/report-user', query: { id: String(contact.userId) } }"
              class="min-h-14 flex items-center justify-between border-t border-stroke px-4 text-body text-danger"
            >
              <span>{{ t('profile.report') }}</span>
              <span aria-hidden="true" class="ml-3 flex-none text-text-secondary">›</span>
            </RouterLink>
          </section>

          <button
            type="button"
            class="mt-8 w-full rounded-button border border-danger px-4 py-3 text-body text-danger disabled:opacity-50"
            :disabled="removeMutation.isLoading.value"
            @click="removeConfirmation = true"
          >
            {{ t('device.removeContact') }}
          </button>
        </template>
      </QueryState>
    </main>

    <BaseModal
      v-if="editingRemark"
      :title="t('device.editRemark')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="updateMutation.isLoading.value ? t('device.saving') : t('modal.confirm')"
      :dismissible="!updateMutation.isLoading.value"
      @cancel="editingRemark = false"
      @confirm="saveRemark"
    >
      <label class="block text-body" for="contact-remark">
        {{ t('device.remark') }}
        <input
          id="contact-remark"
          v-model="remark"
          class="input-field mt-2"
          type="text"
          maxlength="64"
          :placeholder="t('device.remarkPlaceholder')"
          :disabled="updateMutation.isLoading.value"
          @keyup.enter="saveRemark"
        />
      </label>
    </BaseModal>

    <BaseModal
      v-if="removeConfirmation"
      :title="t('device.removeContact')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="removeMutation.isLoading.value ? t('device.saving') : t('modal.confirm')"
      :dismissible="!removeMutation.isLoading.value"
      @cancel="removeConfirmation = false"
      @confirm="removeContact"
    >
      <p>{{ t('device.removeContactConfirm', { name: contact?.nick ?? '' }) }}</p>
    </BaseModal>
  </div>
</template>
