<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import Avatar from '~/components/Avatar.vue'
import JoinGroupModal from '~/components/device/JoinGroupModal.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { useToast } from '~/composables/useToast'
import { getDeviceGroups, joinDeviceGroup, searchGroups, type Group } from '~/utils/device-api'

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const router = useRouter()
const queryCache = useQueryCache()
const { showToast } = useToast()
const keyword = shallowRef('')
const searchedKeyword = shallowRef('')
const selected = shallowRef<Group | null>(null)
/** Groups whose join application was sent from this page; pending state is page-local. */
const appliedIds = shallowRef<Set<number>>(new Set())

const deviceId = computed(() => {
  const value = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
})

async function loadResults(): Promise<Group[]> {
  if (deviceId.value == null) throw new Error(t('device.invalidId'))
  return searchGroups(deviceId.value, searchedKeyword.value)
}

async function loadJoined(): Promise<Group[]> {
  if (deviceId.value == null) throw new Error(t('device.invalidId'))
  return getDeviceGroups(deviceId.value)
}

// The backend matches the whole group number, and an empty `key` returns every
// group on the platform, so neither query runs before a search is submitted.
const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'group-search', deviceId.value, searchedKeyword.value],
  query: loadResults,
  enabled: () => searchedKeyword.value.length > 0,
})

const { state: joinedState } = useQuery({
  key: () => ['device-management', 'groups', deviceId.value],
  query: loadJoined,
  enabled: () => searchedKeyword.value.length > 0,
})

const { mutateAsync: joinGroup, isLoading: joining } = useMutation({
  mutation: (input: { groupId: number; detail: string }) => {
    if (deviceId.value == null) throw new Error(t('device.invalidId'))
    return joinDeviceGroup(deviceId.value, input.groupId, input.detail || undefined)
  },
})

const results = computed(() => state.value.data ?? [])

function isJoined(groupId: number): boolean {
  return joinedState.value.data?.some((group) => group.groupId === groupId) ?? false
}

function isDisabled(groupId: number): boolean {
  return isJoined(groupId) || appliedIds.value.has(groupId)
}

function search(): void {
  searchedKeyword.value = keyword.value.trim()
}

function choose(group: Group): void {
  if (!isDisabled(group.groupId)) selected.value = group
}

async function confirmJoin(detail: string): Promise<void> {
  if (!selected.value || joining.value) return
  const group = selected.value
  try {
    await joinGroup({ groupId: group.groupId, detail })
    selected.value = null
    if (group.isAudit) {
      appliedIds.value = new Set([...appliedIds.value, group.groupId])
      showToast(t('device.applicationSent'))
      return
    }
    await Promise.all([
      queryCache.invalidateQueries({ key: ['device-management', 'groups'] }),
      queryCache.invalidateQueries({ key: ['device-management', 'group-search'] }),
    ])
    showToast(t('device.groupAdded'))
    router.back()
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="t('device.searchGroups')" />
    <main class="p-4">
      <form class="flex items-center" @submit.prevent="search">
        <input
          v-model="keyword"
          type="search"
          class="input-field min-w-0 flex-1"
          :placeholder="t('device.groupNumberPlaceholder')"
          :aria-label="t('device.groupNumber')"
        />
        <button type="submit" class="ml-3 h-12 rounded-button bg-primary px-4 text-primary-text">
          {{ t('device.search') }}
        </button>
      </form>

      <p
        v-if="searchedKeyword.length === 0"
        class="py-12 text-center text-body text-text-secondary"
      >
        {{ t('device.enterGroupNumber') }}
      </p>

      <QueryState
        v-else
        :status="state.status"
        :error="state.error"
        :empty="results.length === 0"
        :empty-text="t('device.noSearchResults')"
        @retry="reload()"
      >
        <ul class="mt-6 space-y-3">
          <li v-for="group in results" :key="group.groupId">
            <button
              type="button"
              class="card w-full flex items-center text-left disabled:opacity-50"
              :disabled="isDisabled(group.groupId)"
              @click="choose(group)"
            >
              <Avatar :name="group.name" :src="group.avatar" />
              <span class="ml-3 min-w-0 flex-1">
                <span class="block truncate text-body font-medium">{{ group.name }}</span>
                <span class="mt-0.5 block truncate text-small text-text-secondary">{{
                  group.num
                }}</span>
              </span>
              <span
                v-if="isJoined(group.groupId)"
                class="ml-2 flex-none text-small text-text-secondary"
              >
                {{ t('device.alreadyJoined') }}
              </span>
              <span
                v-else-if="appliedIds.has(group.groupId)"
                class="ml-2 flex-none text-small text-text-secondary"
              >
                {{ t('device.pendingApproval') }}
              </span>
              <span v-else class="row-chevron" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </QueryState>
    </main>

    <JoinGroupModal
      v-if="selected"
      :group-name="selected.name"
      :needs-audit="selected.isAudit"
      :loading="joining"
      @cancel="selected = null"
      @confirm="confirmJoin"
    />
  </div>
</template>
