<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import BaseModal from '~/components/BaseModal.vue'
import Avatar from '~/components/Avatar.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { useToast } from '~/composables/useToast'
import {
  addDeviceContacts,
  getDeviceContacts,
  getFriends,
  type Contact,
  type Friend,
} from '~/utils/device-api'

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
const queryCache = useQueryCache()
const { showToast } = useToast()
const selectedIds = shallowRef<number[]>([])
const confirmationOpen = shallowRef(false)
const deviceId = computed(() => routeNumber(route.params.id))

interface AddContactsData {
  friends: Friend[]
  contacts: Contact[]
}

async function load(): Promise<AddContactsData> {
  if (deviceId.value == null) throw new Error(t('device.invalidId'))
  const [friends, contacts] = await Promise.all([getFriends(), getDeviceContacts(deviceId.value)])
  return { friends, contacts }
}

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'contact-add', deviceId.value],
  query: load,
})

const existingIds = computed(
  () => new Set((state.value.data?.contacts ?? []).map((contact) => contact.userId)),
)
const selectableFriends = computed(() =>
  (state.value.data?.friends ?? []).filter((friend) => !existingIds.value.has(friend.userId)),
)
const selectedCount = computed(() => selectedIds.value.length)
const allSelected = computed(
  () =>
    selectableFriends.value.length > 0 &&
    selectableFriends.value.every((friend) => selectedIds.value.includes(friend.userId)),
)

const addMutation = useMutation({
  mutation: (contactIds: number[]) => {
    if (deviceId.value == null) throw new Error(t('device.invalidId'))
    return addDeviceContacts(deviceId.value, contactIds)
  },
})

function isSelected(userId: number): boolean {
  return selectedIds.value.includes(userId)
}

function isExisting(userId: number): boolean {
  return existingIds.value.has(userId)
}

function toggleFriend(friend: Friend): void {
  if (isExisting(friend.userId)) return
  selectedIds.value = isSelected(friend.userId)
    ? selectedIds.value.filter((id) => id !== friend.userId)
    : [...selectedIds.value, friend.userId]
}

function toggleAll(): void {
  selectedIds.value = allSelected.value
    ? []
    : selectableFriends.value.map((friend) => friend.userId)
}

async function submit(): Promise<void> {
  if (selectedIds.value.length === 0 || addMutation.isLoading.value) return
  try {
    await addMutation.mutateAsync(selectedIds.value)
    confirmationOpen.value = false
    await queryCache.invalidateQueries({ key: ['device-management', 'contacts'] })
    showToast(t('device.contactsAdded'))
    await router.push({ path: `/devices/${deviceId.value}/contacts`, query: route.query })
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}
</script>

<template>
  <div class="min-h-screen min-h-svh bg-surface text-text-primary">
    <PageHeader :title="t('device.addFromFriends')" />

    <main class="p-4">
      <QueryState :status="state.status" :error="state.error" @retry="reload()">
        <template v-if="state.data">
          <button
            type="button"
            class="min-h-12 w-full flex items-center justify-between border-b border-stroke py-3 text-left"
            :disabled="selectableFriends.length === 0"
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

          <p
            v-if="state.data.friends.length === 0"
            class="py-12 text-center text-body text-text-secondary"
          >
            {{ t('device.noCandidates') }}
          </p>
          <div
            v-else
            class="mt-2 divide-y divide-stroke border border-stroke rounded-standard bg-surface"
          >
            <button
              v-for="friend in state.data.friends"
              :key="friend.userId"
              type="button"
              class="min-h-16 w-full flex items-center px-4 text-left disabled:opacity-50"
              :disabled="isExisting(friend.userId)"
              @click="toggleFriend(friend)"
            >
              <Avatar
                :name="friend.nick"
                :src="friend.avatar"
                :online="friend.online"
                show-status
              />
              <span class="ml-3 min-w-0 flex-1">
                <span class="block truncate text-body">{{ friend.nick }}</span>
                <span class="mt-0.5 block truncate text-small text-text-secondary">{{
                  friend.userNum
                }}</span>
              </span>
              <span v-if="isExisting(friend.userId)" class="ml-2 text-small text-text-secondary">
                {{ t('device.alreadyContact') }}
              </span>
              <span
                v-else
                class="ml-3 h-5 w-5 flex items-center justify-center rounded-small border"
                :class="
                  isSelected(friend.userId)
                    ? 'border-primary bg-primary text-primary-text'
                    : 'border-stroke'
                "
                aria-hidden="true"
              >
                <span v-if="isSelected(friend.userId)">✓</span>
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
                : t('device.confirmAddContacts', { count: selectedCount })
            }}
          </button>
        </template>
      </QueryState>
    </main>

    <BaseModal
      v-if="confirmationOpen"
      :title="t('device.addContact')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="addMutation.isLoading.value ? t('device.saving') : t('modal.confirm')"
      :dismissible="!addMutation.isLoading.value"
      @cancel="confirmationOpen = false"
      @confirm="submit"
    >
      <p>{{ t('device.addContactsConfirm', { count: selectedCount }) }}</p>
    </BaseModal>
  </div>
</template>
