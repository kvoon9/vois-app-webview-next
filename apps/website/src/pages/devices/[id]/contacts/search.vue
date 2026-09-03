<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import BaseModal from '~/components/BaseModal.vue'
import Avatar from '~/components/Avatar.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { useToast } from '~/composables/useToast'
import {
  addDeviceContacts,
  getDeviceContacts,
  searchUsers,
  type Contact,
  type Friend,
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
const deviceId = computed(() => routeNumber(route.params.id))
const keyword = shallowRef('')
const searchedKeyword = shallowRef('')
const selected = shallowRef<Friend | null>(null)

interface SearchData {
  users: Friend[]
  contacts: Contact[]
}

async function load(): Promise<SearchData> {
  if (deviceId.value == null) throw new Error(t('device.invalidId'))
  const [users, contacts] = await Promise.all([
    searchedKeyword.value ? searchUsers(searchedKeyword.value) : Promise.resolve([]),
    getDeviceContacts(deviceId.value),
  ])
  return { users, contacts }
}

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'contact-search', deviceId.value, searchedKeyword.value],
  query: load,
})

const results = computed(() => state.value.data?.users ?? [])
const existingIds = computed(
  () => new Set((state.value.data?.contacts ?? []).map((contact) => contact.userId)),
)

const addMutation = useMutation({
  mutation: (contactId: number) => {
    if (deviceId.value == null) throw new Error(t('device.invalidId'))
    return addDeviceContacts(deviceId.value, [contactId])
  },
})

function isExisting(userId: number): boolean {
  return existingIds.value.has(userId)
}

function search(): void {
  searchedKeyword.value = keyword.value.trim()
}

function choose(user: Friend): void {
  if (!isExisting(user.userId)) selected.value = user
}

async function confirmAdd(): Promise<void> {
  if (!selected.value || addMutation.isLoading.value) return
  const user = selected.value
  try {
    await addMutation.mutateAsync(user.userId)
    selected.value = null
    await queryCache.invalidateQueries({ key: ['device-management', 'contacts'] })
    await queryCache.invalidateQueries({ key: ['device-management', 'contact-search'] })
    showToast(t('device.contactsAdded'))
    await router.push({ path: `/devices/${deviceId.value}/contacts`, query: route.query })
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}
</script>

<template>
  <div class="min-h-screen min-h-svh bg-surface text-text-primary">
    <PageHeader :title="t('device.searchContacts')" />

    <main class="p-4">
      <form class="flex items-center" @submit.prevent="search">
        <input
          v-model="keyword"
          type="search"
          class="input-field min-w-0 flex-1"
          :placeholder="t('device.contactNumberPlaceholder')"
          :aria-label="t('device.contactNumberPlaceholder')"
        />
        <button type="submit" class="ml-3 h-12 rounded-button bg-primary px-4 text-primary-text">
          {{ t('device.search') }}
        </button>
      </form>

      <QueryState
        :status="state.status"
        :error="state.error"
        :empty="searchedKeyword.length > 0 && results.length === 0"
        :empty-text="t('device.noSearchResults')"
        @retry="reload()"
      >
        <p
          v-if="searchedKeyword.length === 0"
          class="py-12 text-center text-body text-text-secondary"
        >
          {{ t('device.enterContactNumber') }}
        </p>
        <ul v-else class="mt-6 space-y-3">
          <li v-for="user in results" :key="user.userId">
            <button
              type="button"
              class="card w-full flex items-center text-left disabled:opacity-50"
              :disabled="isExisting(user.userId)"
              @click="choose(user)"
            >
              <Avatar :name="user.nick" :src="user.avatar" :online="user.online" show-status />
              <span class="ml-3 min-w-0 flex-1">
                <span class="block truncate text-body font-medium">{{ user.nick }}</span>
                <span class="mt-0.5 block truncate text-small text-text-secondary">{{
                  user.userNum
                }}</span>
              </span>
              <span
                v-if="isExisting(user.userId)"
                class="ml-2 flex-none text-small text-text-secondary"
              >
                {{ t('device.alreadyContact') }}
              </span>
              <span v-else aria-hidden="true" class="ml-2 text-text-secondary">›</span>
            </button>
          </li>
        </ul>
      </QueryState>
    </main>

    <BaseModal
      v-if="selected"
      :title="t('device.addContact')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="addMutation.isLoading.value ? t('device.saving') : t('modal.confirm')"
      :dismissible="!addMutation.isLoading.value"
      @cancel="selected = null"
      @confirm="confirmAdd"
    >
      <p>{{ t('device.addContactConfirm', { name: selected.nick }) }}</p>
    </BaseModal>
  </div>
</template>
