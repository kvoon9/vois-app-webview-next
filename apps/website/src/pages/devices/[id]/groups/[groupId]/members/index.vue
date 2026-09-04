<script setup lang="ts">
import { useQuery } from '@pinia/colada'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { getGroupMembers, type GroupMember } from '~/utils/device-api'
import { hideBrokenImage } from '~/utils/image'

type RouteParam = string | string[] | undefined
type MemberRole = GroupMember['role']

const route = useRoute()
const router = useRouter()
const { t } = useI18n({ useScope: 'global' })
const search = shallowRef('')

function routeNumber(value: RouteParam): number | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw || raw.trim() === '') return null
  const number = Number(raw)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

const deviceId = computed(() => routeNumber(route.params.id))
const groupId = computed(() => routeNumber(route.params.groupId))

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'group', 'members', groupId.value],
  query: () => {
    if (groupId.value == null) throw new Error(t('device.invalidGroup'))
    return getGroupMembers(groupId.value)
  },
})

const filteredMembers = computed(() => {
  const keyword = search.value.trim().toLocaleLowerCase()
  if (!keyword) return state.value.data ?? []
  return (state.value.data ?? []).filter((member) =>
    [member.nick, member.nickname, member.userNum, member.signature].some((value) =>
      value.toLocaleLowerCase().includes(keyword),
    ),
  )
})

const groupedMembers = computed<Record<MemberRole, GroupMember[]>>(() => ({
  owner: filteredMembers.value.filter((member) => member.role === 'owner'),
  admin: filteredMembers.value.filter((member) => member.role === 'admin'),
  member: filteredMembers.value.filter((member) => member.role === 'member'),
}))

function openMember(member: GroupMember): void {
  router.push({
    path: `/devices/${deviceId.value}/groups/${groupId.value}/members/${member.userId}`,
    query: route.query,
  })
}
</script>

<template>
  <div class="min-h-screen min-h-svh bg-surface text-text-primary">
    <PageHeader :title="t('device.members')" />
    <main class="p-4">
      <RouterLink
        :to="{
          path: `/devices/${deviceId}/groups/${groupId}/members/add`,
          query: route.query,
        }"
        class="min-h-12 w-full flex items-center justify-between rounded-standard border border-stroke bg-surface px-4 text-body"
      >
        <span>{{ t('device.addMember') }}</span>
        <span aria-hidden="true" class="text-text-secondary">›</span>
      </RouterLink>

      <label class="relative mt-4 block">
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
          :aria-label="t('device.clearSearch')"
          @click="search = ''"
        >
          ×
        </button>
      </label>

      <QueryState
        :status="state.status"
        :error="state.error"
        :empty="state.data?.length === 0"
        :empty-text="t('device.emptyMembers')"
        @retry="reload()"
      >
        <div
          v-if="filteredMembers.length === 0"
          class="py-12 text-center text-body text-text-secondary"
        >
          {{ t('device.noMatchingMembers') }}
        </div>
        <div v-else class="mt-5 space-y-5">
          <section v-for="section in ['owner', 'admin', 'member'] as const" :key="section">
            <template v-if="groupedMembers[section].length">
              <h2 class="mb-2 px-1 text-small font-medium text-text-secondary">
                {{ t(`device.roles.${section}`) }}
              </h2>
              <div
                class="divide-y divide-stroke overflow-hidden rounded-standard border border-stroke bg-surface"
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
                  <span class="ml-3 min-w-0 flex-1">
                    <span class="block truncate text-body">{{ member.nick }}</span>
                    <span class="mt-0.5 block truncate text-small text-text-secondary">
                      {{ member.nickname || member.userNum }}
                    </span>
                  </span>
                  <span class="ml-2 flex-none text-small text-text-secondary">{{
                    member.userNum
                  }}</span>
                  <span aria-hidden="true" class="ml-2 flex-none text-text-secondary">›</span>
                </button>
              </div>
            </template>
          </section>
        </div>
      </QueryState>
    </main>
  </div>
</template>
