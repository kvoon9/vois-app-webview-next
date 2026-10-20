<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import Avatar from '~/components/Avatar.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { parseRouteParamId } from '~/composables/useRouteParamId'
import { usePageBack } from '~/composables/usePageBack'
import { useToast } from '~/composables/useToast'
import {
  addEmergencyFriendContact,
  getEmergencyContacts,
  getFriends,
  type Friend,
} from '~/utils/device-api'

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const queryCache = useQueryCache()
const { goBack } = usePageBack()
const { showToast } = useToast()
const deviceId = computed(() => parseRouteParamId(route.params.id))

interface AddFriendData {
  friends: Friend[]
  existingIds: number[]
  friendsFull: boolean
}

async function load(): Promise<AddFriendData> {
  if (deviceId.value == null) throw new Error(t('device.invalidId'))
  // Native picks SOS friends from the account's address book, not the device's own list.
  const [friends, emergency] = await Promise.all([
    getFriends(),
    getEmergencyContacts(deviceId.value),
  ])
  // Friend slots only; phone entries carry userId 0 and must not match.
  const existingIds = emergency.contacts
    .filter((contact) => contact.type === 'friend')
    .map((contact) => contact.userId)
  const friendsFull =
    emergency.quota.friendMax > 0 && existingIds.length >= emergency.quota.friendMax
  return { friends, existingIds, friendsFull }
}

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'emergency-add-friend', deviceId.value],
  query: load,
})

const existingIds = computed(() => new Set(state.value.data?.existingIds ?? []))
const friendsFull = computed(() => state.value.data?.friendsFull ?? false)
// Filter over the account's address book; the SOS quota is checked on tap, as in the app.
const keyword = shallowRef('')
/** Native lists contacts by name in pinyin order, not by API order. */
function byName(left: Friend, right: Friend): number {
  return left.nick.localeCompare(right.nick, 'zh-Hans-CN')
}

const visibleFriends = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  const friends = [...(state.value.data?.friends ?? [])].sort(byName)
  if (!query) return friends
  return friends.filter(
    (friend) =>
      friend.nick.toLowerCase().includes(query) || friend.userNum.toLowerCase().includes(query),
  )
})

const addMutation = useMutation({
  mutation: (friendId: number) => {
    if (deviceId.value == null) throw new Error(t('device.invalidId'))
    return addEmergencyFriendContact(deviceId.value, friendId)
  },
})

async function addFriend(friendId: number): Promise<void> {
  if (existingIds.value.has(friendId) || addMutation.isLoading.value) return
  if (friendsFull.value) {
    showToast(t('device.emergencyFriendsFull'), { type: 'error' })
    return
  }
  try {
    await addMutation.mutateAsync(friendId)
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
    <PageHeader :title="t('device.emergencyPickFriend')" />

    <main class="p-4">
      <div class="relative">
        <span
          class="i-ph-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-lg text-text-secondary"
          aria-hidden="true"
        />
        <input
          v-model="keyword"
          type="search"
          class="w-full rounded-standard bg-surface-field py-3 pl-11 pr-4 text-body text-text-primary outline-none placeholder:text-text-secondary"
          :placeholder="t('device.contactSearchPlaceholder')"
          :aria-label="t('device.contactSearchPlaceholder')"
        />
      </div>

      <QueryState :status="state.status" :error="state.error" @retry="reload()">
        <template v-if="state.data">
          <p
            v-if="visibleFriends.length === 0"
            class="py-12 text-center text-body text-text-secondary"
          >
            {{ keyword.trim() ? t('device.noUsersFound') : t('device.noCandidates') }}
          </p>
          <ul v-else class="mt-4 overflow-hidden panel">
            <li v-for="friend in visibleFriends" :key="friend.userId">
              <button
                type="button"
                class="min-h-16 w-full flex items-center px-4 text-left disabled:opacity-50"
                :disabled="existingIds.has(friend.userId) || addMutation.isLoading.value"
                @click="addFriend(friend.userId)"
              >
                <Avatar :name="friend.nick" :src="friend.avatar" />
                <span class="ml-3 min-w-0 flex-1 truncate text-body">{{ friend.nick }}</span>
                <span
                  v-if="existingIds.has(friend.userId)"
                  class="ml-2 text-small text-text-secondary"
                >
                  {{ t('device.emergencyAlreadyAdded') }}
                </span>
              </button>
            </li>
          </ul>
        </template>
      </QueryState>
    </main>
  </div>
</template>
