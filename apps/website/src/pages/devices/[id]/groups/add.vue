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
import { getDeviceGroups, getManagerGroups, joinDeviceGroup, type Group } from '~/utils/device-api'

interface AddGroupsData {
  managerGroups: Group[]
  deviceGroups: Group[]
}

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const router = useRouter()
const queryCache = useQueryCache()
const { showToast } = useToast()
const keyword = shallowRef('')
const selected = shallowRef<Group | null>(null)
/** Groups whose join application was sent from this page; pending state is page-local. */
const appliedIds = shallowRef<Set<number>>(new Set())

const deviceId = computed(() => {
  const value = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
})

async function load(): Promise<AddGroupsData> {
  if (deviceId.value == null) throw new Error(t('device.invalidId'))
  const [managerGroups, deviceGroups] = await Promise.all([
    getManagerGroups(),
    getDeviceGroups(deviceId.value),
  ])
  return { managerGroups, deviceGroups }
}

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'group-add', deviceId.value],
  query: load,
})

const directGroups = computed(() =>
  filterGroups((state.value.data?.managerGroups ?? []).filter((group) => !group.isAudit)),
)
const auditGroups = computed(() =>
  filterGroups((state.value.data?.managerGroups ?? []).filter((group) => group.isAudit)),
)

const { mutateAsync: joinGroup, isLoading: joining } = useMutation({
  mutation: (input: { groupId: number; detail: string }) => {
    if (deviceId.value == null) throw new Error(t('device.invalidId'))
    return joinDeviceGroup(deviceId.value, input.groupId, input.detail || undefined)
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

function isDisabled(groupId: number): boolean {
  return isJoined(groupId) || appliedIds.value.has(groupId)
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
  <div class="page">
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
        :empty="state.data?.managerGroups.length === 0"
        :empty-text="t('device.emptyGroups')"
        @retry="reload()"
      >
        <section class="mt-6">
          <h2 class="mb-3 text-2nd-body font-semibold text-text-secondary">
            {{ t('device.directJoinGroups') }}
          </h2>
          <p
            v-if="directGroups.length === 0"
            class="py-4 text-center text-2nd-body text-text-secondary"
          >
            {{ t('device.noMatchingGroups') }}
          </p>
          <ul v-else class="space-y-3">
            <li v-for="group in directGroups" :key="`direct-${group.groupId}`">
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
                <span v-else aria-hidden="true" class="ml-2 text-text-secondary">›</span>
              </button>
            </li>
          </ul>
        </section>

        <section class="mt-8">
          <h2 class="mb-3 text-2nd-body font-semibold text-text-secondary">
            {{ t('device.auditJoinGroups') }}
          </h2>
          <p
            v-if="auditGroups.length === 0"
            class="py-4 text-center text-2nd-body text-text-secondary"
          >
            {{ t('device.noMatchingGroups') }}
          </p>
          <ul v-else class="space-y-3">
            <li v-for="group in auditGroups" :key="`audit-${group.groupId}`">
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
                <span v-else aria-hidden="true" class="ml-2 text-text-secondary">›</span>
              </button>
            </li>
          </ul>
        </section>
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
