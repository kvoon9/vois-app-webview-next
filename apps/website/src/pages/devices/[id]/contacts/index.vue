<script setup lang="ts">
import { useQuery } from '@pinia/colada'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import Avatar from '~/components/Avatar.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { getDeviceContacts, type Contact } from '~/utils/device-api'

type RouteParam = string | string[] | undefined

function routeNumber(value: RouteParam): number | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw || raw.trim() === '') return null
  const number = Number(raw)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const router = useRouter()
const deviceId = computed(() => routeNumber(route.params.id))

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'contacts', deviceId.value],
  query: () => {
    if (deviceId.value == null) throw new Error(t('device.invalidId'))
    return getDeviceContacts(deviceId.value)
  },
})

const contacts = computed(() => state.value.data ?? [])

function displayName(contact: Contact): string {
  return contact.remark.trim() || contact.nick
}

function openContact(contact: Contact): void {
  if (deviceId.value == null) return
  router.push({
    path: `/devices/${deviceId.value}/contacts/${contact.userId}`,
    query: route.query,
  })
}
</script>

<template>
  <div class="min-h-screen min-h-svh bg-surface text-text-primary">
    <PageHeader :title="t('device.contacts')" />

    <main class="p-4">
      <nav class="space-y-3" :aria-label="t('device.addContact')">
        <router-link
          :to="{ path: `/devices/${deviceId}/contacts/add`, query: route.query }"
          class="min-h-12 flex items-center justify-between rounded-standard border border-stroke bg-surface px-4 text-body"
        >
          <span>{{ t('device.addFromFriends') }}</span>
          <span aria-hidden="true" class="text-text-secondary">›</span>
        </router-link>
        <router-link
          :to="{ path: `/devices/${deviceId}/contacts/search`, query: route.query }"
          class="min-h-12 flex items-center justify-between rounded-standard border border-stroke bg-surface px-4 text-body"
        >
          <span>{{ t('device.searchContacts') }}</span>
          <span aria-hidden="true" class="text-text-secondary">›</span>
        </router-link>
      </nav>

      <h2 class="mt-6 mb-3 text-2nd-body font-semibold text-text-secondary">
        {{ t('device.addedContacts') }}
      </h2>
      <QueryState
        :status="state.status"
        :error="state.error"
        :empty="state.status === 'success' && contacts.length === 0"
        :empty-text="t('device.emptyContacts')"
        @retry="reload()"
      >
        <ul class="space-y-3">
          <li v-for="contact in contacts" :key="contact.userId" class="card">
            <button
              type="button"
              class="w-full flex items-center text-left"
              @click="openContact(contact)"
            >
              <Avatar
                :name="contact.nick"
                :src="contact.avatar"
                :online="contact.online"
                show-status
              />
              <span class="ml-3 min-w-0 flex-1">
                <span class="block truncate text-body font-medium">{{ displayName(contact) }}</span>
                <span class="mt-0.5 block truncate text-small text-text-secondary">
                  {{ contact.userNum }}
                </span>
              </span>
              <span aria-hidden="true" class="ml-2 flex-none text-text-secondary">›</span>
            </button>
          </li>
        </ul>
      </QueryState>
    </main>
  </div>
</template>
