<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import BaseModal from '~/components/BaseModal.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { useToast } from '~/composables/useToast'
import {
  getDeviceGroups,
  getGroupMembers,
  removeGroupMember,
  transferGroupOwner,
  type GroupMember,
} from '~/utils/device-api'
import { hideBrokenImage } from '~/utils/image'

const route = useRoute()
const router = useRouter()
const { t } = useI18n({ useScope: 'global' })
const queryCache = useQueryCache()
const { showToast } = useToast()
const confirmationOpen = shallowRef(false)
const transferConfirmationOpen = shallowRef(false)

type RouteParam = string | string[] | undefined

function routeNumber(value: RouteParam): number | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw || raw.trim() === '') return null
  const number = Number(raw)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

const deviceId = computed(() => routeNumber(route.params.id))
const groupId = computed(() => routeNumber(route.params.groupId))
const memberId = computed(() => routeNumber(route.params.memberId))

async function load(): Promise<{ member: GroupMember; isCreator: boolean }> {
  if (deviceId.value == null) throw new Error(t('error.description'))
  if (groupId.value == null) throw new Error(t('error.description'))
  if (memberId.value == null) throw new Error(t('error.description'))
  const [members, groups] = await Promise.all([
    getGroupMembers(deviceId.value, groupId.value),
    getDeviceGroups(deviceId.value),
  ])
  const member = members.find((item) => item.userId === memberId.value)
  if (!member) throw new Error(t('device.noMatchingMembers'))
  return {
    member,
    isCreator: groups.find((item) => item.groupId === groupId.value)?.isCreator ?? false,
  }
}

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'group', 'member', groupId.value, memberId.value],
  query: load,
})
const member = computed(() => state.value.data?.member ?? null)
/** Only the current owner (this device) manages members; never target itself. */
const canManage = computed(
  () =>
    (state.value.data?.isCreator ?? false) &&
    member.value != null &&
    member.value.userId !== deviceId.value,
)

const removeMutation = useMutation({
  mutation: () => {
    if (deviceId.value == null) throw new Error(t('error.description'))
    if (groupId.value == null) throw new Error(t('error.description'))
    if (memberId.value == null) throw new Error(t('error.description'))
    return removeGroupMember(deviceId.value, groupId.value, memberId.value)
  },
})

const transferMutation = useMutation({
  mutation: () => {
    if (deviceId.value == null) throw new Error(t('error.description'))
    if (groupId.value == null) throw new Error(t('error.description'))
    if (memberId.value == null) throw new Error(t('error.description'))
    return transferGroupOwner(deviceId.value, groupId.value, memberId.value)
  },
})

async function removeMember(): Promise<void> {
  if (!canManage.value || removeMutation.isLoading.value) return
  try {
    await removeMutation.mutateAsync()
    confirmationOpen.value = false
    showToast(t('device.memberRemoved'))
    await router.push({
      path: `/devices/${deviceId.value}/groups/${groupId.value}/members`,
      query: route.query,
    })
    await queryCache.invalidateQueries({ key: ['device-management'] })
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}

async function transferOwner(): Promise<void> {
  if (!canManage.value || transferMutation.isLoading.value) return
  try {
    await transferMutation.mutateAsync()
    transferConfirmationOpen.value = false
    await queryCache.invalidateQueries({ key: ['device-management'] })
    showToast(t('device.ownerTransferred'))
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
  <div class="page">
    <PageHeader :title="t('device.memberDetail')" />

    <main class="p-4">
      <QueryState :status="state.status" :error="state.error" @retry="reload()">
        <template v-if="member">
          <div class="flex flex-col items-center py-4 text-center">
            <span
              class="relative h-24 w-24 flex items-center justify-center overflow-hidden rounded-full bg-surface-muted text-3xl text-text-secondary"
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
            <h2 class="mt-3 text-header font-semibold">{{ member.nick }}</h2>
            <p class="mt-1 text-small text-text-secondary">{{ member.userNum }}</p>
          </div>

          <div class="mt-4 panel">
            <div class="min-h-14 px-4 py-3">
              <p class="text-small text-text-secondary">
                {{ t('device.groupNickname') }}
              </p>
              <p class="mt-1 text-body">{{ member.nickname || t('device.groupNicknameUnset') }}</p>
            </div>
          </div>

          <div v-if="canManage" class="mt-8 space-y-3">
            <button
              type="button"
              class="btn-secondary"
              :disabled="transferMutation.isLoading.value"
              @click="transferConfirmationOpen = true"
            >
              {{ t('device.transferOwner') }}
            </button>
            <button
              type="button"
              class="btn-danger"
              :disabled="removeMutation.isLoading.value"
              @click="confirmationOpen = true"
            >
              {{ t('device.removeMember') }}
            </button>
          </div>

          <RouterLink
            :to="{ path: '/report-user', query: { id: String(memberId) } }"
            class="mt-4 min-h-14 nav-item text-danger"
          >
            <span>{{ t('profile.report') }}</span>
            <span class="row-chevron" aria-hidden="true" />
          </RouterLink>
        </template>
      </QueryState>
    </main>

    <BaseModal
      v-if="confirmationOpen"
      :title="t('device.removeMember')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="removeMutation.isLoading.value ? t('device.saving') : t('modal.confirm')"
      :dismissible="!removeMutation.isLoading.value"
      @cancel="confirmationOpen = false"
      @confirm="removeMember"
    >
      <p>{{ t('device.removeMemberConfirm', { name: member?.nick ?? '' }) }}</p>
    </BaseModal>

    <BaseModal
      v-if="transferConfirmationOpen"
      :title="t('device.transferOwner')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="transferMutation.isLoading.value ? t('device.saving') : t('modal.confirm')"
      :dismissible="!transferMutation.isLoading.value"
      @cancel="transferConfirmationOpen = false"
      @confirm="transferOwner"
    >
      <p>{{ t('device.transferOwnerConfirm', { name: member?.nick ?? '' }) }}</p>
    </BaseModal>
  </div>
</template>
