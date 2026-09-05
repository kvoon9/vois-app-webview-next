<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import Avatar from '~/components/Avatar.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { useToast } from '~/composables/useToast'
import { addEmergencyFriends, getEmergencyContacts, getFriends } from '~/utils/device-api'

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

async function load() {
  if (deviceId.value == null) throw new Error(t('device.invalidId'))
  const [friends, emergency] = await Promise.all([
    getFriends(),
    getEmergencyContacts(deviceId.value),
  ])
  return { friends, existingIds: emergency.contacts.map((contact) => contact.userId) }
}

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'emergency-add-friend', deviceId.value],
  query: load,
})

const existingIds = computed(() => new Set(state.value.data?.existingIds ?? []))

const addMutation = useMutation({
  mutation: (userId: number) => {
    if (deviceId.value == null) throw new Error(t('device.invalidId'))
    return addEmergencyFriends(deviceId.value, [userId])
  },
})

async function addFriend(userId: number): Promise<void> {
  if (existingIds.value.has(userId) || addMutation.isLoading.value) return
  try {
    await addMutation.mutateAsync(userId)
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
          <ul v-else class="overflow-hidden rounded-standard border border-stroke bg-surface">
            <li v-for="friend in state.data.friends" :key="friend.userId">
              <button
                type="button"
                class="min-h-16 w-full flex items-center border-b border-stroke px-4 text-left last:border-b-0 disabled:opacity-50"
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
