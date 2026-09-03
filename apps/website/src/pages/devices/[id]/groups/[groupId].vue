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
  dissolveGroup as dissolveDeviceGroup,
  getGroupInfo,
  getGroupMembers,
  getMyCreatedGroups,
  leaveDeviceGroup,
  updateGroup,
  updateGroupSettings,
  type GroupInfo,
  type GroupMember,
  type GroupSettings,
} from '~/utils/device-api'
import { hideBrokenImage } from '~/utils/image'

const route = useRoute()
const router = useRouter()
const { t } = useI18n({ useScope: 'global' })
const queryCache = useQueryCache()
const { showToast } = useToast()

type RouteParam = string | string[] | undefined

const defaultGroupSettings: GroupSettings = {
  muted: false,
  shareLocation: false,
  broadcast: false,
  pinned: false,
}

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
const search = shallowRef('')
const leaveConfirmation = shallowRef(false)
const dissolveConfirmation = shallowRef(false)

async function load(): Promise<{
  group: GroupInfo
  members: GroupMember[]
  ownedGroupIds: number[]
}> {
  if (deviceId.value == null) throw new Error(t('error.description'))
  if (groupId.value == null) throw new Error(t('error.description'))

  const [group, members, ownedGroups] = await Promise.all([
    getGroupInfo(groupId.value),
    getGroupMembers(groupId.value),
    getMyCreatedGroups(),
  ])
  return { group, members, ownedGroupIds: ownedGroups.map((item) => item.groupId) }
}

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'group', groupId.value],
  query: load,
})

const group = computed(() => state.value.data?.group ?? null)
const members = computed(() => state.value.data?.members ?? [])
const totalMembers = computed(() => members.value.length)
const groupSettings = computed(() => group.value?.settings ?? defaultGroupSettings)

// The created-groups query identifies the current account for the owner-only action.
const isOwner = computed(
  () => state.value.data?.ownedGroupIds.includes(groupId.value ?? 0) ?? false,
)
const editingTitle = computed(() =>
  editing.value === 'name' ? t('device.groupNickname') : t('device.groupIntroduction'),
)
const filteredMembers = computed(() => {
  const keyword = search.value.trim().toLocaleLowerCase()
  if (!keyword) return members.value
  return members.value.filter((member) =>
    [member.nick, member.userNum, member.signature].some((value) =>
      value.toLocaleLowerCase().includes(keyword),
    ),
  )
})
const groupedMembers = computed(() => ({
  owner: filteredMembers.value.filter((member) => member.role === 'owner'),
  admin: filteredMembers.value.filter((member) => member.role === 'admin'),
  member: filteredMembers.value.filter((member) => member.role === 'member'),
}))

const updateMutation = useMutation({
  mutation: (input: { name?: string; intro?: string }) => {
    if (groupId.value == null) throw new Error(t('error.description'))
    return updateGroup(groupId.value, input)
  },
})

const settingsMutation = useMutation({
  mutation: (input: Partial<GroupSettings>) => {
    if (groupId.value == null) throw new Error(t('error.description'))
    return updateGroupSettings(groupId.value, input)
  },
})

const leaveMutation = useMutation({
  mutation: () => {
    if (deviceId.value == null) throw new Error(t('error.description'))
    if (groupId.value == null) throw new Error(t('error.description'))
    return leaveDeviceGroup(deviceId.value, groupId.value)
  },
})

const dissolveMutation = useMutation({
  mutation: () => {
    if (groupId.value == null) throw new Error(t('error.description'))
    return dissolveDeviceGroup(groupId.value)
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

async function toggleSetting(key: keyof GroupSettings): Promise<void> {
  if (settingsMutation.isLoading.value || !group.value) return

  const changes: Partial<GroupSettings> = { [key]: !groupSettings.value[key] }
  try {
    await settingsMutation.mutateAsync(changes)
    await queryCache.invalidateQueries({ key: ['device-management'] })
    await reload()
    showToast(t('device.groupSettingsUpdated'))
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}

function openMember(member: GroupMember): void {
  router.push({
    path: `/devices/${deviceId.value}/groups/${groupId.value}/members/${member.userId}`,
    query: route.query,
  })
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

async function dissolveGroup(): Promise<void> {
  if (!isOwner.value || dissolveMutation.isLoading.value) return

  try {
    await dissolveMutation.mutateAsync()
    dissolveConfirmation.value = false
    await queryCache.invalidateQueries({ key: ['device-management'] })
    showToast(t('device.groupDissolved'))
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
          <section class="border border-stroke rounded-standard bg-surface">
            <div class="flex flex-col items-center px-4 py-5 text-center">
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

            <div class="divide-y divide-stroke border-t border-stroke">
              <button
                type="button"
                class="min-h-14 w-full flex items-center justify-between px-4 py-3 text-left"
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
                class="min-h-14 w-full flex items-center justify-between px-4 py-3 text-left"
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
          </section>

          <section
            class="mt-4 divide-y divide-stroke border border-stroke rounded-standard bg-surface"
          >
            <div class="min-h-12 flex items-center justify-between px-4 text-body">
              <span>{{ t('device.muteNotifications') }}</span>
              <button
                type="button"
                role="switch"
                class="relative h-7 w-12 flex-none rounded-full disabled:opacity-50"
                :class="groupSettings.muted ? 'bg-primary' : 'bg-surface-muted'"
                :aria-checked="groupSettings.muted"
                :disabled="settingsMutation.isLoading.value"
                :aria-label="t('device.muteNotifications')"
                @click="toggleSetting('muted')"
              >
                <span
                  class="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
                  :class="groupSettings.muted ? 'right-0.5' : 'left-0.5'"
                />
              </button>
            </div>
            <div class="min-h-12 flex items-center justify-between px-4 text-body">
              <span>{{ t('device.shareLocation') }}</span>
              <button
                type="button"
                role="switch"
                class="relative h-7 w-12 flex-none rounded-full disabled:opacity-50"
                :class="groupSettings.shareLocation ? 'bg-primary' : 'bg-surface-muted'"
                :aria-checked="groupSettings.shareLocation"
                :disabled="settingsMutation.isLoading.value"
                :aria-label="t('device.shareLocation')"
                @click="toggleSetting('shareLocation')"
              >
                <span
                  class="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
                  :class="groupSettings.shareLocation ? 'right-0.5' : 'left-0.5'"
                />
              </button>
            </div>
            <div class="min-h-12 flex items-center justify-between px-4 text-body">
              <span>{{ t('device.voiceBroadcast') }}</span>
              <button
                type="button"
                role="switch"
                class="relative h-7 w-12 flex-none rounded-full disabled:opacity-50"
                :class="groupSettings.broadcast ? 'bg-primary' : 'bg-surface-muted'"
                :aria-checked="groupSettings.broadcast"
                :disabled="settingsMutation.isLoading.value"
                :aria-label="t('device.voiceBroadcast')"
                @click="toggleSetting('broadcast')"
              >
                <span
                  class="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
                  :class="groupSettings.broadcast ? 'right-0.5' : 'left-0.5'"
                />
              </button>
            </div>
            <div class="min-h-12 flex items-center justify-between px-4 text-body">
              <span>{{ t('device.stickOnTop') }}</span>
              <button
                type="button"
                role="switch"
                class="relative h-7 w-12 flex-none rounded-full disabled:opacity-50"
                :class="groupSettings.pinned ? 'bg-primary' : 'bg-surface-muted'"
                :aria-checked="groupSettings.pinned"
                :disabled="settingsMutation.isLoading.value"
                :aria-label="t('device.stickOnTop')"
                @click="toggleSetting('pinned')"
              >
                <span
                  class="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
                  :class="groupSettings.pinned ? 'right-0.5' : 'left-0.5'"
                />
              </button>
            </div>
          </section>

          <section class="mt-4">
            <div class="flex items-center justify-between px-1">
              <h2 class="text-body font-medium">
                {{ t('device.membersCount', { count: totalMembers }) }}
              </h2>
              <RouterLink
                :to="{
                  path: `/devices/${deviceId}/groups/${groupId}/members/add`,
                  query: route.query,
                }"
                class="text-body text-primary"
              >
                {{ t('device.addMember') }}
              </RouterLink>
            </div>

            <label class="relative mt-3 block">
              <span class="sr-only">{{ t('device.searchMembers') }}</span>
              <input
                v-model="search"
                type="search"
                class="input-field pr-10"
                :placeholder="t('device.searchMembers')"
              />
              <button
                v-if="search"
                type="button"
                class="absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 text-text-secondary"
                :aria-label="t('modal.close')"
                @click="search = ''"
              >
                ×
              </button>
            </label>

            <div
              v-if="filteredMembers.length === 0"
              class="py-12 text-center text-body text-text-secondary"
            >
              {{ t('device.noMatchingMembers') }}
            </div>
            <div v-else class="mt-4 space-y-4">
              <section v-for="section in ['owner', 'admin', 'member'] as const" :key="section">
                <template v-if="groupedMembers[section].length">
                  <h3 class="mb-2 px-1 text-small font-medium text-text-secondary">
                    {{ t(`device.roles.${section}`) }}
                  </h3>
                  <div
                    class="divide-y divide-stroke border border-stroke rounded-standard bg-surface"
                  >
                    <button
                      v-for="member in groupedMembers[section]"
                      :key="member.userId"
                      type="button"
                      class="min-h-16 w-full flex items-center px-4 text-left"
                      @click="openMember(member)"
                    >
                      <span
                        class="relative h-11 w-11 flex-none flex items-center justify-center overflow-hidden rounded-full bg-surface-muted text-text-secondary"
                      >
                        {{ member.nick.slice(0, 1) }}
                        <img
                          v-if="member.avatar"
                          :src="member.avatar"
                          alt=""
                          class="absolute inset-0 h-full w-full object-cover"
                          @error="hideBrokenImage"
                        />
                        <span
                          class="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface"
                          :class="member.online ? 'bg-primary' : 'bg-text-secondary'"
                          :aria-label="member.online ? t('device.online') : t('device.offline')"
                        />
                      </span>
                      <span class="min-w-0 ml-3 flex-1">
                        <span class="block truncate text-body">{{ member.nick }}</span>
                        <span class="mt-0.5 block truncate text-small text-text-secondary">{{
                          member.userNum
                        }}</span>
                      </span>
                      <span aria-hidden="true" class="ml-2 text-text-secondary">›</span>
                    </button>
                  </div>
                </template>
              </section>
            </div>
          </section>

          <div class="mt-8 space-y-3">
            <button
              type="button"
              class="w-full rounded-button border border-danger px-4 py-3 text-body text-danger disabled:opacity-50"
              :disabled="leaveMutation.isLoading.value"
              @click="leaveConfirmation = true"
            >
              {{ t('device.leaveGroup') }}
            </button>
            <button
              v-if="isOwner"
              type="button"
              class="w-full rounded-button border border-danger px-4 py-3 text-body text-danger disabled:opacity-50"
              :disabled="dissolveMutation.isLoading.value"
              @click="dissolveConfirmation = true"
            >
              {{ t('device.dissolveGroup') }}
            </button>
          </div>
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

    <BaseModal
      v-if="dissolveConfirmation"
      :title="t('device.dissolveGroup')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="dissolveMutation.isLoading.value ? t('device.saving') : t('modal.confirm')"
      :dismissible="!dissolveMutation.isLoading.value"
      @cancel="dissolveConfirmation = false"
      @confirm="dissolveGroup"
    >
      <p>{{ t('device.dissolveGroupConfirm', { name: group?.name ?? '' }) }}</p>
    </BaseModal>
  </div>
</template>
