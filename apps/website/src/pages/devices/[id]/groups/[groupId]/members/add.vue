<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import BaseModal from '~/components/BaseModal.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { useToast } from '~/composables/useToast'
import {
  addGroupMembers,
  getConnectedDevices,
  getFriends,
  getGroupMembers,
  type Device,
  type Friend,
  type GroupMember,
} from '~/utils/device-api'
import { hideBrokenImage } from '~/utils/image'

type Candidate = Friend | Device

type CandidateTab = 'friends' | 'devices'

const route = useRoute()
const router = useRouter()
const { t } = useI18n({ useScope: 'global' })
const queryCache = useQueryCache()
const { showToast } = useToast()
const activeTab = shallowRef<CandidateTab>('friends')
const selectedIds = shallowRef<number[]>([])
const confirmationOpen = shallowRef(false)

type RouteParam = string | string[] | undefined

function routeNumber(value: RouteParam): number | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw || raw.trim() === '') return null
  const number = Number(raw)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

const deviceId = computed(() => routeNumber(route.params.id))
const groupId = computed(() => routeNumber(route.params.groupId))

async function load(): Promise<{
  friends: Friend[]
  devices: Device[]
  members: GroupMember[]
}> {
  if (deviceId.value == null) throw new Error(t('error.description'))
  if (groupId.value == null) throw new Error(t('error.description'))
  const [friends, devices, members] = await Promise.all([
    getFriends(),
    getConnectedDevices(),
    getGroupMembers(groupId.value),
  ])
  return { friends, devices, members }
}

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'group', 'add-members', groupId.value],
  query: load,
})

const existingIds = computed(
  () => new Set((state.value.data?.members ?? []).map((member) => member.userId)),
)
const candidates = computed<Candidate[]>(() =>
  activeTab.value === 'friends'
    ? (state.value.data?.friends ?? [])
    : (state.value.data?.devices ?? []),
)
const selectableIds = computed(() =>
  candidates.value
    .filter((candidate) => !existingIds.value.has(candidate.userId))
    .map((candidate) => candidate.userId),
)
const selectedCount = computed(() => selectedIds.value.length)
const allSelected = computed(
  () =>
    selectableIds.value.length > 0 &&
    selectableIds.value.every((id) => selectedIds.value.includes(id)),
)

const addMutation = useMutation({
  mutation: (memberIds: number[]) => {
    if (groupId.value == null) throw new Error(t('error.description'))
    return addGroupMembers(groupId.value, memberIds)
  },
})

function isSelected(id: number): boolean {
  return selectedIds.value.includes(id)
}

function isDisabled(candidate: Candidate): boolean {
  return existingIds.value.has(candidate.userId)
}

function setTab(tab: CandidateTab): void {
  activeTab.value = tab
}

function toggleCandidate(candidate: Candidate): void {
  if (isDisabled(candidate)) return
  selectedIds.value = isSelected(candidate.userId)
    ? selectedIds.value.filter((id) => id !== candidate.userId)
    : [...selectedIds.value, candidate.userId]
}

function toggleAll(): void {
  selectedIds.value = allSelected.value ? [] : [...selectableIds.value]
}

async function submit(): Promise<void> {
  if (!selectedIds.value.length || addMutation.isLoading.value) return
  confirmationOpen.value = false
  try {
    await addMutation.mutateAsync(selectedIds.value)
    await queryCache.invalidateQueries({ key: ['device-management'] })
    showToast(t('device.membersAdded'))
    await router.push({
      path: `/devices/${deviceId.value}/groups/${groupId.value}`,
      query: route.query,
    })
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}
</script>

<template>
  <div class="min-h-screen min-h-svh bg-surface text-text-primary">
    <PageHeader :title="t('device.addMember')" />

    <main class="p-4">
      <QueryState :status="state.status" :error="state.error" @retry="reload()">
        <template v-if="state.data">
          <div class="flex space-x-2" role="tablist" :aria-label="t('device.friends')">
            <button
              type="button"
              class="chip flex-1"
              :class="activeTab === 'friends' ? 'chip-selected' : 'chip-unselected'"
              :aria-selected="activeTab === 'friends'"
              role="tab"
              @click="setTab('friends')"
            >
              {{ t('device.friends') }}
            </button>
            <button
              type="button"
              class="chip flex-1"
              :class="activeTab === 'devices' ? 'chip-selected' : 'chip-unselected'"
              :aria-selected="activeTab === 'devices'"
              role="tab"
              @click="setTab('devices')"
            >
              {{ t('device.devices') }}
            </button>
          </div>

          <button
            type="button"
            class="mt-4 flex w-full items-center justify-between border-b border-stroke py-3 text-left"
            :disabled="selectableIds.length === 0"
            @click="toggleAll"
          >
            <span class="text-body">{{ t('device.selectAll') }}</span>
            <span
              class="h-5 w-5 flex items-center justify-center rounded-small border"
              :class="allSelected ? 'border-primary bg-primary text-primary-text' : 'border-stroke'"
              aria-hidden="true"
            >
              <span v-if="allSelected">✓</span>
            </span>
          </button>

          <p v-if="candidates.length === 0" class="py-12 text-center text-body text-text-secondary">
            {{ t('device.noCandidates') }}
          </p>
          <div
            v-else
            class="mt-2 divide-y divide-stroke border border-stroke rounded-standard bg-surface"
          >
            <button
              v-for="candidate in candidates"
              :key="candidate.userId"
              type="button"
              class="min-h-16 w-full flex items-center px-4 text-left disabled:opacity-50"
              :disabled="isDisabled(candidate)"
              @click="toggleCandidate(candidate)"
            >
              <span
                class="relative h-11 w-11 flex-none flex items-center justify-center overflow-hidden rounded-full bg-surface-muted text-text-secondary"
              >
                {{ candidate.nick.slice(0, 1) }}
                <img
                  v-if="candidate.avatar"
                  :src="candidate.avatar"
                  alt=""
                  class="absolute inset-0 h-full w-full object-cover"
                  @error="hideBrokenImage"
                />
              </span>
              <span class="min-w-0 ml-3 flex-1">
                <span class="block truncate text-body">{{ candidate.nick }}</span>
                <span class="mt-0.5 block truncate text-small text-text-secondary">{{
                  candidate.userNum
                }}</span>
              </span>
              <span v-if="isDisabled(candidate)" class="ml-2 text-small text-text-secondary">
                {{ t('device.alreadyMember') }}
              </span>
              <span
                v-else
                class="ml-3 h-5 w-5 flex items-center justify-center rounded-small border"
                :class="
                  isSelected(candidate.userId)
                    ? 'border-primary bg-primary text-primary-text'
                    : 'border-stroke'
                "
                aria-hidden="true"
              >
                <span v-if="isSelected(candidate.userId)">✓</span>
              </span>
            </button>
          </div>

          <button
            type="button"
            class="btn-primary mt-6"
            :disabled="selectedCount === 0 || addMutation.isLoading.value"
            @click="confirmationOpen = true"
          >
            {{
              addMutation.isLoading.value
                ? t('device.saving')
                : t('device.confirmAdd', { count: selectedCount })
            }}
          </button>
        </template>
      </QueryState>
    </main>

    <BaseModal
      v-if="confirmationOpen"
      :title="t('device.addMember')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="t('modal.confirm')"
      :dismissible="!addMutation.isLoading.value"
      @cancel="confirmationOpen = false"
      @confirm="submit"
    >
      <p>{{ t('device.addMembersConfirm', { count: selectedCount }) }}</p>
    </BaseModal>
  </div>
</template>
