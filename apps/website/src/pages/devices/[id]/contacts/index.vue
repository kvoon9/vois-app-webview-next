<script setup lang="ts">
import { useQuery } from '@pinia/colada'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { parseRouteParamId } from '~/composables/useRouteParamId'
import Avatar from '~/components/Avatar.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { getDeviceFriends, type Friend } from '~/utils/device-api'

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const router = useRouter()
const deviceId = computed(() => parseRouteParamId(route.params.id))

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'contacts', deviceId.value],
  query: () => {
    if (deviceId.value == null) throw new Error(t('device.invalidId'))
    return getDeviceFriends(deviceId.value)
  },
})

/** Native lists contacts by name in pinyin order, not by API order. */
const contacts = computed(() =>
  [...(state.value.data ?? [])].sort((left, right) =>
    left.nick.localeCompare(right.nick, 'zh-Hans-CN'),
  ),
)

function openContact(contact: Friend): void {
  if (deviceId.value == null) return
  router.push(`/devices/${deviceId.value}/contacts/${contact.userId}`)
}
</script>

<template>
  <div class="page">
    <PageHeader :title="t('device.contacts')" />

    <main class="p-4">
      <nav class="panel" :aria-label="t('device.addContact')">
        <router-link
          :to="`/devices/${deviceId}/contacts/add`"
          class="min-h-12 flex items-center justify-between px-4 text-body"
        >
          <span>{{ t('device.addFromFriends') }}</span>
          <span class="row-chevron" aria-hidden="true" />
        </router-link>
        <router-link
          :to="`/devices/${deviceId}/contacts/search`"
          class="min-h-12 flex items-center justify-between px-4 text-body"
        >
          <span>{{ t('device.searchContacts') }}</span>
          <span class="row-chevron" aria-hidden="true" />
        </router-link>
      </nav>

      <section class="mt-4 min-h-32 card">
        <h2 class="text-2nd-body font-semibold text-text-secondary">
          {{ t('device.addedContacts') }}
        </h2>
        <!-- The recording leaves the card blank; the copy stays for screen readers only. -->
        <p v-if="state.status === 'success' && contacts.length === 0" class="sr-only">
          {{ t('device.emptyContacts') }}
        </p>
        <QueryState :status="state.status" :error="state.error" @retry="reload()">
          <ul v-if="contacts.length > 0" class="mt-3 space-y-3">
            <li v-for="contact in contacts" :key="contact.userId">
              <button
                type="button"
                class="min-h-12 w-full flex items-center text-left"
                @click="openContact(contact)"
              >
                <Avatar :name="contact.nick" :src="contact.avatar" />
                <span class="ml-3 min-w-0 flex-1 truncate text-body font-medium">
                  {{ contact.nick }}
                </span>
                <span class="row-chevron" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </QueryState>
      </section>
    </main>
  </div>
</template>
