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
import { getDeviceGroups, joinDeviceGroup, searchGroups, type Group } from '~/utils/device-api'

interface SearchData {
  groups: Group[]
  deviceGroups: Group[]
}

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const router = useRouter()
const queryCache = useQueryCache()
const { showToast } = useToast()
const keyword = shallowRef('')
const searchedKeyword = shallowRef('')
const selected = shallowRef<Group | null>(null)

const deviceId = computed(() => {
  const value = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
})

async function load(): Promise<SearchData> {
  if (deviceId.value == null) throw new Error(t('device.invalidId'))
  const [groups, deviceGroups] = await Promise.all([
    searchGroups(searchedKeyword.value),
    getDeviceGroups(deviceId.value),
  ])
  return { groups, deviceGroups }
}

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'group-search', deviceId.value, searchedKeyword.value],
  query: load,
})

const { mutateAsync: joinGroup, isLoading: joining } = useMutation({
  mutation: (groupId: number) => {
    if (deviceId.value == null) throw new Error(t('device.invalidId'))
    return joinDeviceGroup(deviceId.value, groupId)
  },
})

const results = computed(() => state.value.data?.groups ?? [])

function isJoined(groupId: number): boolean {
  return state.value.data?.deviceGroups.some((group) => group.groupId === groupId) ?? false
}

function search(): void {
  searchedKeyword.value = keyword.value.trim()
}

function choose(group: Group): void {
  if (!isJoined(group.groupId)) selected.value = group
}

async function confirmJoin(): Promise<void> {
  if (!selected.value || joining.value) return
  const group = selected.value
  try {
    await joinGroup(group.groupId)
    selected.value = null
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
  <div class="min-h-screen min-h-svh bg-surface text-text-primary">
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
          {{ t('device.enterGroupNumber') }}
        </p>
        <ul v-else class="mt-6 space-y-3">
          <li v-for="group in results" :key="group.groupId">
            <button
              type="button"
              class="card w-full flex items-center text-left disabled:opacity-50"
              :disabled="isJoined(group.groupId)"
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
              <span v-else aria-hidden="true" class="ml-2 text-text-secondary">›</span>
            </button>
          </li>
        </ul>
      </QueryState>
    </main>

    <BaseModal
      v-if="selected"
      :title="t('device.confirmAddGroup')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="joining ? t('device.saving') : t('modal.confirm')"
      @cancel="selected = null"
      @confirm="confirmJoin"
    >
      {{ t('device.confirmAddGroupMessage', { group: selected.name }) }}
    </BaseModal>
  </div>
</template>
