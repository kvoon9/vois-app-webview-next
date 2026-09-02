<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import BaseModal from '~/components/BaseModal.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { useToast } from '~/composables/useToast'
import { getGroupMembers, removeGroupMember, type GroupMember } from '~/utils/device-api'
import { hideBrokenImage } from '~/utils/image'

const route = useRoute()
const router = useRouter()
const { t } = useI18n({ useScope: 'global' })
const queryCache = useQueryCache()
const { showToast } = useToast()
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
const memberId = computed(() => routeNumber(route.params.memberId))

async function load(): Promise<GroupMember> {
  if (deviceId.value == null) throw new Error(t('error.description'))
  if (groupId.value == null) throw new Error(t('error.description'))
  if (memberId.value == null) throw new Error(t('error.description'))
  const member = (await getGroupMembers(groupId.value)).find(
    (item) => item.userId === memberId.value,
  )
  if (!member) throw new Error(t('device.noMatchingMembers'))
  return member
}

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'group', 'member', groupId.value, memberId.value],
  query: load,
})
const member = computed(() => state.value.data ?? null)
const canRemove = computed(() => member.value?.role !== 'owner')

const removeMutation = useMutation({
  mutation: () => {
    if (groupId.value == null) throw new Error(t('error.description'))
    if (memberId.value == null) throw new Error(t('error.description'))
    return removeGroupMember(groupId.value, memberId.value)
  },
})

async function removeMember(): Promise<void> {
  if (!canRemove.value || removeMutation.isLoading.value) return
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
</script>

<template>
  <div class="min-h-screen min-h-svh bg-surface text-text-primary">
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
              <span
                class="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-surface"
                :class="member.online ? 'bg-primary' : 'bg-text-secondary'"
                :aria-label="member.online ? t('device.online') : t('device.offline')"
              />
            </span>
            <h2 class="mt-3 text-header font-semibold">{{ member.nick }}</h2>
            <p class="mt-1 text-small text-text-secondary">{{ member.userNum }}</p>
          </div>

          <div class="mt-4 divide-y divide-stroke border border-stroke rounded-standard bg-surface">
            <div class="min-h-14 px-4 py-3">
              <p class="text-small text-text-secondary">
                {{ t('device.groupNickname') }}
              </p>
              <p class="mt-1 text-body">{{ member.nick }}</p>
            </div>
            <div class="min-h-14 px-4 py-3">
              <p class="text-small text-text-secondary">
                {{ t('device.signature') }}
              </p>
              <p class="mt-1 text-body">{{ member.signature || t('error.description') }}</p>
            </div>
          </div>

          <button
            v-if="canRemove"
            type="button"
            class="mt-8 w-full rounded-button border border-danger px-4 py-3 text-body text-danger disabled:opacity-50"
            :disabled="removeMutation.isLoading.value"
            @click="confirmationOpen = true"
          >
            {{ t('device.removeMember') }}
          </button>
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
  </div>
</template>
