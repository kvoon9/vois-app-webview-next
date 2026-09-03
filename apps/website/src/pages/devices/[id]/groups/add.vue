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
  getConnectedDevices,
  getDeviceGroups,
  getMyCreatedGroups,
  getMyJoinedGroups,
  joinDeviceGroup,
  type Group,
} from '~/utils/device-api'

interface AddGroupsData {
  created: Group[]
  joined: Group[]
  deviceGroups: Group[]
  deviceName: string
}

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const router = useRouter()
const queryCache = useQueryCache()
const { showToast } = useToast()
const keyword = shallowRef('')
const selected = shallowRef<Group | null>(null)

const deviceId = computed(() => {
  const value = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
})

async function load(): Promise<AddGroupsData> {
  if (deviceId.value == null) throw new Error(t('device.invalidId'))
  const [created, joined, deviceGroups, devices] = await Promise.all([
    getMyCreatedGroups(),
    getMyJoinedGroups(),
    getDeviceGroups(deviceId.value),
    getConnectedDevices(),
  ])
  return {
    created,
    joined,
    deviceGroups,
    deviceName: devices.find((device) => device.userId === deviceId.value)?.nick ?? '',
  }
}

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'group-add', deviceId.value],
  query: load,
})

const filteredCreated = computed(() => filterGroups(state.value.data?.created ?? []))
const filteredJoined = computed(() => filterGroups(state.value.data?.joined ?? []))

const { mutateAsync: joinGroup, isLoading: joining } = useMutation({
  mutation: (groupId: number) => {
    if (deviceId.value == null) throw new Error(t('device.invalidId'))
    return joinDeviceGroup(deviceId.value, groupId)
  },
})

function filterGroups(groups: Group[]): Group[] {
  const value = keyword.value.trim().toLocaleLowerCase()
  if (!value) return groups
  return groups.filter(
    (group) =>
      group.name.toLocaleLowerCase().includes(value) ||
      group.num.toLocaleLowerCase().includes(value),
  )
}

function isJoined(groupId: number): boolean {
  return state.value.data?.deviceGroups.some((group) => group.groupId === groupId) ?? false
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
      queryCache.invalidateQueries({ key: ['device-management', 'group-add'] }),
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
    <PageHeader :title="t('device.addFromContacts')" />
    <main class="p-4">
      <input
        v-model="keyword"
        type="search"
        class="input-field"
        :placeholder="t('device.filterGroups')"
        :aria-label="t('device.filterGroups')"
      />

      <QueryState
        :status="state.status"
        :error="state.error"
        :empty="state.data?.created.length === 0 && state.data?.joined.length === 0"
        :empty-text="t('device.emptyGroups')"
        @retry="reload()"
      >
        <section class="mt-6">
          <h2 class="mb-3 text-2nd-body font-semibold text-text-secondary">
            {{ t('device.myCreatedGroups') }}
          </h2>
          <p
            v-if="filteredCreated.length === 0"
            class="py-4 text-center text-2nd-body text-text-secondary"
          >
            {{ t('device.noMatchingGroups') }}
          </p>
          <ul v-else class="space-y-3">
            <li v-for="group in filteredCreated" :key="`created-${group.groupId}`">
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
        </section>

        <section class="mt-8">
          <h2 class="mb-3 text-2nd-body font-semibold text-text-secondary">
            {{ t('device.myJoinedGroups') }}
          </h2>
          <p
            v-if="filteredJoined.length === 0"
            class="py-4 text-center text-2nd-body text-text-secondary"
          >
            {{ t('device.noMatchingGroups') }}
          </p>
          <ul v-else class="space-y-3">
            <li v-for="group in filteredJoined" :key="`joined-${group.groupId}`">
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
        </section>
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
      {{
        t('device.confirmAddGroupMessage', {
          device: state.data.deviceName,
          group: selected.name,
        })
      }}
    </BaseModal>
  </div>
</template>
