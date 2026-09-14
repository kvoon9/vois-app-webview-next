<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { useFileDialog } from '@vueuse/core'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import BaseModal from '~/components/BaseModal.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { useToast } from '~/composables/useToast'
import { weilaUpload } from '~/utils/api'
import {
  getDeviceGroups,
  getGroupInfo,
  getGroupMembers,
  leaveDeviceGroup,
  updateGroupAvatar,
  updateGroupIntro,
  updateGroupName,
  updateGroupSettings,
  updateMyGroupNickname,
  type GroupSettings,
} from '~/utils/device-api'
import { hideBrokenImage } from '~/utils/image'

type RouteParam = string | string[] | undefined
type EditableField = 'name' | 'intro' | 'nickname'

interface GroupDetail {
  groupId: number
  num: string
  name: string
  avatar: string
  isCreator: boolean
  memberCount: number
  myNickname: string
  intro: string
  createdAt: string
  settings: GroupSettings
  /** False when the group info endpoint is unreachable; gates the settings block. */
  infoAvailable: boolean
}

const route = useRoute()
const router = useRouter()
const { t } = useI18n({ useScope: 'global' })
const queryCache = useQueryCache()
const { showToast } = useToast()

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
const editing = shallowRef<EditableField | null>(null)
const editValue = shallowRef('')
const exitConfirmation = shallowRef(false)

async function load(): Promise<GroupDetail> {
  if (deviceId.value == null || groupId.value == null) throw new Error(t('error.description'))
  const [groups, members, info] = await Promise.all([
    getDeviceGroups(deviceId.value),
    getGroupMembers(deviceId.value, groupId.value),
    // Tolerated failure: the group info endpoint is not live yet, so intro,
    // created_at and settings fall back to their empty defaults below.
    getGroupInfo(groupId.value).catch(() => null),
  ])
  const group = groups.find((item) => item.groupId === groupId.value)
  if (!group) throw new Error(t('device.invalidGroup'))
  return {
    groupId: group.groupId,
    num: group.num,
    name: group.name,
    avatar: group.avatar,
    isCreator: group.isCreator,
    memberCount: members.length,
    myNickname: members.find((member) => member.userId === deviceId.value)?.nickname ?? '',
    intro: info?.intro ?? '',
    createdAt: info?.createdAt ?? '',
    settings: info?.settings ?? defaultGroupSettings,
    infoAvailable: info !== null,
  }
}

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'group', groupId.value],
  query: load,
})

const group = computed(() => state.value.data ?? null)
const groupSettings = computed(() => group.value?.settings ?? defaultGroupSettings)
const isOwner = computed(() => group.value?.isCreator ?? false)
const editingTitle = computed(() => {
  if (editing.value === 'name') return t('device.groupName')
  if (editing.value === 'intro') return t('device.groupIntroduction')
  return t('device.groupNickname')
})
const myNickname = computed(() => group.value?.myNickname || t('device.groupNicknameUnset'))

const nameMutation = useMutation({
  mutation: (name: string) => {
    if (deviceId.value == null || groupId.value == null) throw new Error(t('error.description'))
    return updateGroupName(deviceId.value, groupId.value, name)
  },
})

const introMutation = useMutation({
  mutation: (intro: string) => {
    if (groupId.value == null) throw new Error(t('error.description'))
    return updateGroupIntro(groupId.value, intro)
  },
})

const nicknameMutation = useMutation({
  mutation: (nickname: string) => {
    if (deviceId.value == null || groupId.value == null) throw new Error(t('error.description'))
    return updateMyGroupNickname(deviceId.value, groupId.value, nickname)
  },
})

const settingsMutation = useMutation({
  mutation: (input: Partial<GroupSettings>) => {
    if (groupId.value == null) throw new Error(t('error.description'))
    return updateGroupSettings(groupId.value, input)
  },
})

/** Owner exit dissolves the group server-side; one endpoint serves both roles. */
const exitMutation = useMutation({
  mutation: () => {
    if (deviceId.value == null || groupId.value == null) {
      throw new Error(t('error.description'))
    }
    return leaveDeviceGroup(deviceId.value, groupId.value)
  },
})

const avatarUploading = shallowRef(false)
const { open: openAvatarPicker, onChange: onAvatarPicked } = useFileDialog({
  accept: 'image/*',
  reset: true,
})

onAvatarPicked(async (files) => {
  const file = files?.[0]
  if (!file || deviceId.value == null || groupId.value == null || avatarUploading.value) return
  avatarUploading.value = true
  try {
    const url = await weilaUpload(file, file.name)
    await updateGroupAvatar(deviceId.value, groupId.value, url)
    await queryCache.invalidateQueries({ key: ['device-management'] })
    await reload()
    showToast(t('device.groupUpdated'))
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  } finally {
    avatarUploading.value = false
  }
})

function pickAvatar(): void {
  if (isOwner.value && !avatarUploading.value) openAvatarPicker()
}

const savingEdit = computed(
  () =>
    nameMutation.isLoading.value ||
    introMutation.isLoading.value ||
    nicknameMutation.isLoading.value,
)

function openEditor(kind: EditableField): void {
  const current = group.value
  if (!current) return
  if (kind === 'intro' && (!isOwner.value || !current.infoAvailable)) return
  if (kind === 'name' && !isOwner.value) return
  editing.value = kind
  editValue.value =
    kind === 'name' ? current.name : kind === 'intro' ? current.intro : current.myNickname
}

function closeEditor(): void {
  if (!savingEdit.value) editing.value = null
}

async function saveGroupField(): Promise<void> {
  if (!editing.value) return
  const value = editValue.value.trim()
  if (editing.value === 'name' && value === '') {
    showToast(t('device.groupNameRequired'), { type: 'error' })
    return
  }
  if (editing.value === 'nickname' && value === '') {
    showToast(t('device.groupNicknameRequired'), { type: 'error' })
    return
  }

  try {
    if (editing.value === 'name') await nameMutation.mutateAsync(value)
    else if (editing.value === 'intro') await introMutation.mutateAsync(value)
    else await nicknameMutation.mutateAsync(value)
    editing.value = null
    await queryCache.invalidateQueries({ key: ['device-management'] })
    await reload()
    showToast(t('device.groupUpdated'))
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}

async function toggleSetting(key: keyof GroupSettings): Promise<void> {
  if (settingsMutation.isLoading.value || !group.value?.infoAvailable) return
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

async function exitGroup(): Promise<void> {
  if (exitMutation.isLoading.value) return
  const wasOwner = isOwner.value
  try {
    await exitMutation.mutateAsync()
    exitConfirmation.value = false
    showToast(wasOwner ? t('device.groupDissolved') : t('device.groupLeft'))
    // Navigate away before invalidating: refetching this page's query after the
    // exit would fail (the device is no longer a member) and show a bogus error.
    await router.push({ path: `/devices/${deviceId.value}/groups`, query: route.query })
    queryCache.invalidateQueries({ key: ['device-management'] })
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}
</script>

<template>
  <RouterView v-if="route.name !== '/devices/[id]/groups/[groupId]'" />
  <div v-else class="page">
    <PageHeader :title="group?.name ?? t('device.groupDetail')" />

    <main class="p-4">
      <QueryState :status="state.status" :error="state.error" @retry="reload()">
        <template v-if="group">
          <section class="overflow-hidden rounded-standard bg-surface-elevated">
            <div class="flex flex-col items-center px-4 py-5 text-center">
              <button
                type="button"
                class="relative h-20 w-20 flex items-center justify-center overflow-hidden rounded-full bg-surface-muted text-2xl text-text-secondary disabled:cursor-default"
                :class="avatarUploading ? 'opacity-50' : ''"
                :disabled="!isOwner || avatarUploading"
                :aria-label="isOwner ? t('device.changeAvatar') : undefined"
                @click="pickAvatar"
              >
                {{ group.name.slice(0, 1) }}
                <img
                  v-if="group.avatar"
                  :src="group.avatar"
                  alt=""
                  class="absolute inset-0 h-full w-full object-cover"
                  @error="hideBrokenImage"
                />
              </button>
              <span
                v-if="isOwner"
                class="pointer-events-none -mt-6 ml-14 h-7 w-7 flex items-center justify-center rounded-full bg-primary text-primary-text text-small"
                aria-hidden="true"
              >
                <span class="i-ph-pencil-simple" />
              </span>
              <h2 class="mt-3 text-header font-semibold">{{ group.name }}</h2>
              <p class="mt-1 text-small text-text-secondary">
                {{ t('device.groupNumber', { number: group.num }) }}
              </p>
              <p v-show="false" class="mt-1 text-small text-text-secondary">
                {{ t('device.createdAt', { date: group.createdAt || t('device.notAvailable') }) }}
              </p>
            </div>

            <div>
              <button
                v-if="isOwner"
                type="button"
                class="panel-row min-h-14 w-full py-3 text-left"
                @click="openEditor('name')"
              >
                <span>
                  <span class="block text-body">{{ t('device.groupName') }}</span>
                  <span class="mt-0.5 block text-small text-text-secondary">{{ group.name }}</span>
                </span>
                <span class="row-chevron" aria-hidden="true" />
              </button>
              <div v-else class="panel-row min-h-14 py-3">
                <span>
                  <span class="block text-body">{{ t('device.groupName') }}</span>
                  <span class="mt-0.5 block text-small text-text-secondary">{{ group.name }}</span>
                </span>
              </div>

              <button
                v-show="false"
                v-if="isOwner && group.infoAvailable"
                type="button"
                class="panel-row min-h-14 w-full py-3 text-left"
                @click="openEditor('intro')"
              >
                <span class="min-w-0">
                  <span class="block text-body">{{ t('device.groupIntroduction') }}</span>
                  <span class="mt-0.5 block truncate text-small text-text-secondary">
                    {{ group.intro || t('device.notAvailable') }}
                  </span>
                </span>
                <span class="row-chevron" aria-hidden="true" />
              </button>
              <div v-show="false" v-else class="panel-row min-h-14 py-3">
                <span class="min-w-0">
                  <span class="block text-body">{{ t('device.groupIntroduction') }}</span>
                  <span class="mt-0.5 block truncate text-small text-text-secondary">
                    {{ group.intro || t('device.notAvailable') }}
                  </span>
                </span>
              </div>

              <button
                type="button"
                class="panel-row min-h-14 w-full py-3 text-left"
                @click="openEditor('nickname')"
              >
                <span>
                  <span class="block text-body">{{ t('device.groupNickname') }}</span>
                  <span class="mt-0.5 block text-small text-text-secondary">{{ myNickname }}</span>
                </span>
                <span class="row-chevron" aria-hidden="true" />
              </button>
            </div>
          </section>

          <section v-show="false" class="mt-4 panel">
            <div class="panel-row min-h-12 text-body">
              <span>{{ t('device.muteNotifications') }}</span>
              <button
                type="button"
                role="switch"
                class="relative h-7 w-12 flex-none rounded-full disabled:opacity-50"
                :class="groupSettings.muted ? 'bg-primary' : 'bg-fill'"
                :aria-checked="groupSettings.muted"
                :disabled="settingsMutation.isLoading.value || !group.infoAvailable"
                :aria-label="t('device.muteNotifications')"
                @click="toggleSetting('muted')"
              >
                <span
                  class="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
                  :class="groupSettings.muted ? 'right-0.5' : 'left-0.5'"
                />
              </button>
            </div>
            <div class="panel-row min-h-12 text-body">
              <span>{{ t('device.shareLocation') }}</span>
              <button
                type="button"
                role="switch"
                class="relative h-7 w-12 flex-none rounded-full disabled:opacity-50"
                :class="groupSettings.shareLocation ? 'bg-primary' : 'bg-fill'"
                :aria-checked="groupSettings.shareLocation"
                :disabled="settingsMutation.isLoading.value || !group.infoAvailable"
                :aria-label="t('device.shareLocation')"
                @click="toggleSetting('shareLocation')"
              >
                <span
                  class="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
                  :class="groupSettings.shareLocation ? 'right-0.5' : 'left-0.5'"
                />
              </button>
            </div>
            <div class="panel-row min-h-12 text-body">
              <span>{{ t('device.voiceBroadcast') }}</span>
              <button
                type="button"
                role="switch"
                class="relative h-7 w-12 flex-none rounded-full disabled:opacity-50"
                :class="groupSettings.broadcast ? 'bg-primary' : 'bg-fill'"
                :aria-checked="groupSettings.broadcast"
                :disabled="settingsMutation.isLoading.value || !group.infoAvailable"
                :aria-label="t('device.voiceBroadcast')"
                @click="toggleSetting('broadcast')"
              >
                <span
                  class="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
                  :class="groupSettings.broadcast ? 'right-0.5' : 'left-0.5'"
                />
              </button>
            </div>
            <div class="panel-row min-h-12 text-body">
              <span>{{ t('device.stickOnTop') }}</span>
              <button
                type="button"
                role="switch"
                class="relative h-7 w-12 flex-none rounded-full disabled:opacity-50"
                :class="groupSettings.pinned ? 'bg-primary' : 'bg-fill'"
                :aria-checked="groupSettings.pinned"
                :disabled="settingsMutation.isLoading.value || !group.infoAvailable"
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

          <RouterLink
            :to="{
              path: `/devices/${deviceId}/groups/${groupId}/members`,
              query: route.query,
            }"
            class="mt-4 min-h-14 w-full nav-item"
          >
            <span>{{ t('device.membersCount', { count: group.memberCount }) }}</span>
            <span class="row-chevron" aria-hidden="true" />
          </RouterLink>

          <div class="mt-8 space-y-3">
            <button
              type="button"
              class="btn-danger"
              :disabled="exitMutation.isLoading.value"
              @click="exitConfirmation = true"
            >
              {{ isOwner ? t('device.dissolveGroup') : t('device.leaveGroup') }}
            </button>
          </div>
        </template>
      </QueryState>
    </main>

    <BaseModal
      v-if="editing"
      :title="editingTitle"
      :cancel-text="t('modal.cancel')"
      :confirm-text="savingEdit ? t('device.saving') : t('modal.confirm')"
      :dismissible="!savingEdit"
      @cancel="closeEditor"
      @confirm="saveGroupField"
    >
      <label class="block text-body">
        {{ editingTitle }}
        <textarea
          v-model="editValue"
          class="input-field mt-2 min-h-24"
          :aria-label="editingTitle"
          :disabled="savingEdit"
          rows="3"
        />
      </label>
    </BaseModal>

    <BaseModal
      v-if="exitConfirmation"
      :title="isOwner ? t('device.dissolveGroup') : t('device.leaveGroup')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="exitMutation.isLoading.value ? t('device.saving') : t('modal.confirm')"
      :dismissible="!exitMutation.isLoading.value"
      @cancel="exitConfirmation = false"
      @confirm="exitGroup"
    >
      <p>
        {{
          isOwner
            ? t('device.dissolveGroupConfirm', { name: group?.name ?? '' })
            : t('device.leaveGroupConfirm', { name: group?.name ?? '' })
        }}
      </p>
    </BaseModal>
  </div>
</template>
