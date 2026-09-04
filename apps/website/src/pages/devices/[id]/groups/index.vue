<script setup lang="ts">
import { useQuery } from '@pinia/colada'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import Avatar from '~/components/Avatar.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { getDeviceGroups, type Group } from '~/utils/device-api'

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const router = useRouter()
const deviceId = computed(() => {
  const value = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
})

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'groups', deviceId.value],
  query: () => {
    if (deviceId.value == null) throw new Error(t('device.invalidId'))
    return getDeviceGroups(deviceId.value)
  },
})

const createdGroups = computed(() => state.value.data?.filter((group) => group.createdByMe) ?? [])
const joinedGroups = computed(() => state.value.data?.filter((group) => !group.createdByMe) ?? [])

function openGroup(group: Group): void {
  if (deviceId.value != null) router.push(`/devices/${deviceId.value}/groups/${group.groupId}`)
}
</script>

<template>
  <div class="min-h-screen min-h-svh bg-surface text-text-primary">
    <PageHeader :title="t('device.groups')" />
    <main class="p-4">
      <nav class="space-y-3" :aria-label="t('device.addGroup')">
        <router-link
          :to="`/devices/${deviceId}/groups/add`"
          class="min-h-12 flex items-center justify-between rounded-standard border border-stroke bg-surface px-4 text-body"
        >
          <span>{{ t('device.addFromContacts') }}</span>
          <span aria-hidden="true" class="text-text-secondary">›</span>
        </router-link>
        <router-link
          :to="`/devices/${deviceId}/groups/search`"
          class="min-h-12 flex items-center justify-between rounded-standard border border-stroke bg-surface px-4 text-body"
        >
          <span>{{ t('device.searchGroups') }}</span>
          <span aria-hidden="true" class="text-text-secondary">›</span>
        </router-link>
      </nav>

      <QueryState
        :status="state.status"
        :error="state.error"
        :empty="state.data?.length === 0"
        :empty-text="t('device.emptyGroups')"
        @retry="reload()"
      >
        <section class="mt-6">
          <h2 class="mb-3 text-2nd-body font-semibold text-text-secondary">
            {{ t('device.createdGroups') }}
          </h2>
          <p
            v-if="createdGroups.length === 0"
            class="py-4 text-center text-2nd-body text-text-secondary"
          >
            {{ t('device.noMatchingGroups') }}
          </p>
          <ul v-else class="space-y-3">
            <li v-for="group in createdGroups" :key="`created-${group.groupId}`">
              <button
                type="button"
                class="card w-full flex items-center text-left"
                @click="openGroup(group)"
              >
                <Avatar :name="group.name" :src="group.avatar" />
                <span class="ml-3 min-w-0 flex-1">
                  <span class="block truncate text-body font-medium">{{ group.name }}</span>
                  <span class="mt-0.5 block truncate text-small text-text-secondary">{{
                    group.num
                  }}</span>
                </span>
                <span aria-hidden="true" class="ml-2 text-text-secondary">›</span>
              </button>
            </li>
          </ul>
        </section>

        <section class="mt-8">
          <h2 class="mb-3 text-2nd-body font-semibold text-text-secondary">
            {{ t('device.joinedGroups') }}
          </h2>
          <p
            v-if="joinedGroups.length === 0"
            class="py-4 text-center text-2nd-body text-text-secondary"
          >
            {{ t('device.noMatchingGroups') }}
          </p>
          <ul v-else class="space-y-3">
            <li v-for="group in joinedGroups" :key="`joined-${group.groupId}`">
              <button
                type="button"
                class="card w-full flex items-center text-left"
                @click="openGroup(group)"
              >
                <Avatar :name="group.name" :src="group.avatar" />
                <span class="ml-3 min-w-0 flex-1">
                  <span class="block truncate text-body font-medium">{{ group.name }}</span>
                  <span class="mt-0.5 block truncate text-small text-text-secondary">{{
                    group.num
                  }}</span>
                </span>
                <span aria-hidden="true" class="ml-2 text-text-secondary">›</span>
              </button>
            </li>
          </ul>
        </section>
      </QueryState>
    </main>
  </div>
</template>
