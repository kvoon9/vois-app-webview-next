<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import BaseModal from '~/components/BaseModal.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { useToast } from '~/composables/useToast'
import {
  getGroupInfo,
  getGroupMembers,
  leaveDeviceGroup,
  updateGroup,
  type GroupInfo,
  type GroupMember,
} from '~/utils/device-api'
import { hideBrokenImage } from '~/utils/image'

const route = useRoute()
const router = useRouter()
const { t } = useI18n({ useScope: 'global' })
const queryCache = useQueryCache()
const { showToast } = useToast()

type RouteParam = string | string[] | undefined

function routeNumber(value: RouteParam): number | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw || raw.trim() === '') return null
  const number = Number(raw)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

const deviceId = computed(() => routeNumber(route.params.id))
const groupId = computed(() => routeNumber(route.params.groupId))
const editing = shallowRef<'name' | 'intro' | null>(null)
const editValue = shallowRef('')
const leaveConfirmation = shallowRef(false)

async function load(): Promise<{ group: GroupInfo; members: GroupMember[] }> {
  if (deviceId.value == null) throw new Error(t('error.description'))
  if (groupId.value == null) throw new Error(t('error.description'))

  const [group, members] = await Promise.all([
    getGroupInfo(groupId.value),
    getGroupMembers(groupId.value),
  ])
  return { group, members }
}

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'group', groupId.value],
  query: load,
})

const group = computed(() => state.value.data?.group ?? null)
const members = computed(() => state.value.data?.members ?? [])
const displayedMembers = computed(() => members.value.slice(0, 5))
const editingTitle = computed(() =>
  editing.value === 'name' ? t('device.groupNickname') : t('device.groupIntroduction'),
)

const updateMutation = useMutation({
  mutation: (input: { name?: string; intro?: string }) => {
    if (groupId.value == null) throw new Error(t('error.description'))
    return updateGroup(groupId.value, input)
  },
})

const leaveMutation = useMutation({
  mutation: () => {
    if (deviceId.value == null) throw new Error(t('error.description'))
    if (groupId.value == null) throw new Error(t('error.description'))
    return leaveDeviceGroup(deviceId.value, groupId.value)
  },
})

function openEditor(kind: 'name' | 'intro'): void {
  const current = group.value
  if (!current) return
  editing.value = kind
  editValue.value = kind === 'name' ? current.name : current.intro
}

function closeEditor(): void {
  if (!updateMutation.isLoading.value) editing.value = null
}

async function saveGroupField(): Promise<void> {
  if (!editing.value || updateMutation.isLoading.value) return
  const value = editValue.value.trim()
  if (editing.value === 'name' && value === '') {
    showToast(t('device.groupNameRequired'), { type: 'error' })
    return
  }

  try {
    await updateMutation.mutateAsync(editing.value === 'name' ? { name: value } : { intro: value })
    editing.value = null
    await queryCache.invalidateQueries({ key: ['device-management'] })
    await reload()
    showToast(t('device.groupUpdated'))
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}

async function leaveGroup(): Promise<void> {
  if (leaveMutation.isLoading.value) return

  try {
    await leaveMutation.mutateAsync()
    leaveConfirmation.value = false
    await queryCache.invalidateQueries({ key: ['device-management'] })
    showToast(t('device.groupLeft'))
    await router.push({ path: `/devices/${deviceId.value}/groups`, query: route.query })
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}
</script>

<template>
  <RouterView v-if="route.name !== '/devices/[id]/groups/[groupId]'" />
  <div v-else class="min-h-screen min-h-svh bg-surface text-text-primary">
    <PageHeader :title="group?.name ?? t('device.groupDetail')" />

    <main class="p-4">
      <QueryState :status="state.status" :error="state.error" @retry="reload()">
        <template v-if="group">
          <div class="flex flex-col items-center py-3 text-center">
            <span
              class="relative h-20 w-20 flex items-center justify-center overflow-hidden rounded-full bg-surface-muted text-2xl text-text-secondary"
            >
              {{ group.name.slice(0, 1) }}
              <img
                v-if="group.avatar"
                :src="group.avatar"
                alt=""
                class="absolute inset-0 h-full w-full object-cover"
                @error="hideBrokenImage"
              />
            </span>
            <h2 class="mt-3 text-header font-semibold">{{ group.name }}</h2>
            <p class="mt-1 text-small text-text-secondary">
              {{ t('device.groupNumber', { number: group.num }) }}
            </p>
            <p class="mt-1 text-small text-text-secondary">
              {{ t('device.createdAt', { date: group.createdAt }) }}
            </p>
          </div>

          <div class="mt-4 divide-y divide-stroke border border-stroke rounded-standard bg-surface">
            <button
              type="button"
              class="min-h-14 w-full flex items-center justify-between px-4 text-left"
              @click="openEditor('name')"
            >
              <span>
                <span class="block text-body">{{ t('device.groupNickname') }}</span>
                <span class="mt-0.5 block text-small text-text-secondary">{{ group.name }}</span>
              </span>
              <span aria-hidden="true" class="ml-3 text-text-secondary">›</span>
            </button>
            <button
              type="button"
              class="min-h-14 w-full flex items-center justify-between px-4 text-left"
              @click="openEditor('intro')"
            >
              <span class="min-w-0">
                <span class="block text-body">{{ t('device.groupIntroduction') }}</span>
                <span class="mt-0.5 block truncate text-small text-text-secondary">
                  {{ group.intro || t('error.description') }}
                </span>
              </span>
              <span aria-hidden="true" class="ml-3 flex-none text-text-secondary">›</span>
            </button>
          </div>

          <div class="mt-4 border border-stroke rounded-standard bg-surface">
            <RouterLink
              :to="{
                path: `/devices/${deviceId}/groups/${groupId}/members`,
                query: route.query,
              }"
              class="min-h-14 flex items-center justify-between px-4 py-3"
            >
              <span class="text-body">{{
                t('device.membersCount', { count: group.memberCount })
              }}</span>
              <span aria-hidden="true" class="ml-3 text-text-secondary">›</span>
            </RouterLink>
            <div class="flex items-center px-4 pb-3">
              <span
                v-for="member in displayedMembers"
                :key="member.userId"
                class="relative mr-2 h-9 w-9 flex-none flex items-center justify-center overflow-hidden rounded-full bg-surface-muted text-small text-text-secondary"
              >
                {{ member.nick.slice(0, 1) }}
                <img
                  v-if="member.avatar"
                  :src="member.avatar"
                  alt=""
                  class="absolute inset-0 h-full w-full object-cover"
                  @error="hideBrokenImage"
                />
              </span>
              <RouterLink
                :to="{
                  path: `/devices/${deviceId}/groups/${groupId}/members/add`,
                  query: route.query,
                }"
                class="h-9 w-9 flex-none flex items-center justify-center rounded-full bg-surface-muted text-xl text-text-secondary"
                :aria-label="t('device.addMember')"
              >
                +
              </RouterLink>
            </div>
          </div>

          <button
            type="button"
            class="mt-8 w-full rounded-button border border-danger px-4 py-3 text-body text-danger disabled:opacity-50"
            :disabled="leaveMutation.isLoading.value"
            @click="leaveConfirmation = true"
          >
            {{ t('device.leaveGroup') }}
          </button>
        </template>
      </QueryState>
    </main>

    <BaseModal
      v-if="editing"
      :title="editingTitle"
      :cancel-text="t('modal.cancel')"
      :confirm-text="updateMutation.isLoading.value ? t('device.saving') : t('modal.confirm')"
      :dismissible="!updateMutation.isLoading.value"
      @cancel="closeEditor"
      @confirm="saveGroupField"
    >
      <label class="block text-body">
        {{ editingTitle }}
        <textarea
          v-model="editValue"
          class="input-field mt-2 min-h-24"
          :aria-label="editingTitle"
          :disabled="updateMutation.isLoading.value"
          rows="3"
        />
      </label>
    </BaseModal>

    <BaseModal
      v-if="leaveConfirmation"
      :title="t('device.leaveGroup')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="leaveMutation.isLoading.value ? t('device.saving') : t('modal.confirm')"
      :dismissible="!leaveMutation.isLoading.value"
      @cancel="leaveConfirmation = false"
      @confirm="leaveGroup"
    >
      <p>{{ t('device.leaveGroupConfirm', { name: group?.name ?? '' }) }}</p>
    </BaseModal>
  </div>
</template>
