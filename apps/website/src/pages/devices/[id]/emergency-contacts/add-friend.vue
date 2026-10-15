<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { computed } from 'vue'
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
  getDeviceFriends,
  getEmergencyContacts,
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
  const [friends, emergency] = await Promise.all([
    getDeviceFriends(deviceId.value),
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
      <QueryState :status="state.status" :error="state.error" @retry="reload()">
        <template v-if="state.data">
          <p
            v-if="state.data.friends.length === 0"
            class="py-12 text-center text-body text-text-secondary"
          >
            {{ t('device.noCandidates') }}
          </p>
          <ul v-else class="overflow-hidden panel">
            <li v-for="friend in state.data.friends" :key="friend.userId">
              <button
                type="button"
                class="min-h-16 w-full flex items-center px-4 text-left disabled:opacity-50"
                :disabled="existingIds.has(friend.userId) || addMutation.isLoading.value"
                @click="addFriend(friend.userId)"
              >
                <Avatar
                  :name="friend.nick"
                  :src="friend.avatar"
                  :online="friend.online"
                  show-status
                />
                <span class="ml-3 min-w-0 flex-1">
                  <span class="block truncate text-body">{{ friend.nick }}</span>
                  <span class="mt-0.5 block truncate text-small text-text-secondary">
                    {{ friend.userNum }}
                  </span>
                </span>
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
