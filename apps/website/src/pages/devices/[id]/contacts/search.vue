<script setup lang="ts">
import { useMutation, useQuery } from '@pinia/colada'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import BaseModal from '~/components/BaseModal.vue'
import Avatar from '~/components/Avatar.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { parseRouteParamId } from '~/composables/useRouteParamId'
import { useToast } from '~/composables/useToast'
import {
  getDeviceFriends,
  inviteDeviceFriend,
  searchDeviceUsers,
  type Friend,
} from '~/utils/device-api'

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const { showToast } = useToast()
const deviceId = computed(() => parseRouteParamId(route.params.id))
const keyword = shallowRef('')
const searchedKeyword = shallowRef('')
const selected = shallowRef<Friend | null>(null)
/** Users whose friend application was sent from this page; approval state is page-local. */
const appliedIds = shallowRef<Set<number>>(new Set())

interface SearchData {
  users: Friend[]
  contacts: Friend[]
}

async function load(): Promise<SearchData> {
  if (deviceId.value == null) throw new Error(t('device.invalidId'))
  const [users, contacts] = await Promise.all([
    searchedKeyword.value
      ? searchDeviceUsers(deviceId.value, searchedKeyword.value)
      : Promise.resolve([]),
    getDeviceFriends(deviceId.value),
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

const inviteMutation = useMutation({
  mutation: (input: { inviteeId: number; detail: string }) => {
    if (deviceId.value == null) throw new Error(t('device.invalidId'))
    return inviteDeviceFriend(deviceId.value, input.inviteeId, input.detail)
  },
})

function search(): void {
  searchedKeyword.value = keyword.value.trim()
}

function rowState(user: Friend): 'added' | 'applied' | 'open' {
  if (existingIds.value.has(user.userId)) return 'added'
  if (appliedIds.value.has(user.userId)) return 'applied'
  return 'open'
}

function choose(user: Friend): void {
  if (rowState(user) === 'open') selected.value = user
}

async function confirmApply(): Promise<void> {
  if (!selected.value || inviteMutation.isLoading.value) return
  const user = selected.value
  try {
    await inviteMutation.mutateAsync({
      inviteeId: user.userId,
      detail: t('device.inviteDefaultMessage'),
    })
    selected.value = null
    appliedIds.value = new Set([...appliedIds.value, user.userId])
    showToast(t('device.applicationSent'))
  } catch (error) {
    selected.value = null
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}
</script>

<template>
  <div class="page">
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
        :empty-text="t('device.noUsersFound')"
        @retry="reload()"
      >
        <p
          v-if="searchedKeyword.length === 0"
          class="py-12 text-center text-body text-text-secondary"
        >
          {{ t('device.enterContactNumber') }}
        </p>
        <ul v-else class="mt-6 space-y-3">
          <li v-for="user in results" :key="user.userId" class="card">
            <div class="flex items-center">
              <Avatar :name="user.nick" :src="user.avatar" :online="user.online" show-status />
              <span class="ml-3 min-w-0 flex-1">
                <span class="block truncate text-body font-medium">{{ user.nick }}</span>
                <span class="mt-0.5 block truncate text-small text-text-secondary">{{
                  user.userNum
                }}</span>
              </span>
              <span
                v-if="rowState(user) === 'added'"
                class="ml-2 flex-none text-small text-text-secondary"
              >
                {{ t('device.alreadyContact') }}
              </span>
              <span
                v-else-if="rowState(user) === 'applied'"
                class="ml-2 flex-none text-small text-text-secondary"
              >
                {{ t('device.inviteApplied') }}
              </span>
              <button
                v-else
                type="button"
                class="ml-2 h-9 flex-none rounded-button bg-primary px-3 text-small text-primary-text"
                @click="choose(user)"
              >
                {{ t('device.applyAdd') }}
              </button>
            </div>
          </li>
        </ul>
      </QueryState>
    </main>

    <BaseModal
      v-if="selected"
      :title="t('device.addContact')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="inviteMutation.isLoading.value ? t('device.saving') : t('modal.confirm')"
      :dismissible="!inviteMutation.isLoading.value"
      @cancel="selected = null"
      @confirm="confirmApply"
    >
      <p>{{ t('device.addContactConfirm', { name: selected.nick }) }}</p>
    </BaseModal>
  </div>
</template>
