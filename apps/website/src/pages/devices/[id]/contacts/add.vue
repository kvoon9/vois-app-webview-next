<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import BaseModal from '~/components/BaseModal.vue'
import Avatar from '~/components/Avatar.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { parseRouteParamId } from '~/composables/useRouteParamId'
import { usePageBack } from '~/composables/usePageBack'
import { useToast } from '~/composables/useToast'
import { MAX_DESCRIPTION_LENGTH } from '~/utils/field-schema'
import { getDeviceFriends, getFriends, inviteDeviceFriend, type Friend } from '~/utils/device-api'

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const queryCache = useQueryCache()
const { goBack } = usePageBack()
const { showToast } = useToast()
const selectedIds = shallowRef<number[]>([])
const confirmationOpen = shallowRef(false)
// Filter over the picked friends; the address book itself is small enough to filter locally.
const keyword = shallowRef('')
// Draft of the application message; refilled with the default each time the dialog opens.
const inviteMessage = shallowRef('')
const deviceId = computed(() => parseRouteParamId(route.params.id))

interface AddContactsData {
  friends: Friend[]
  contacts: Friend[]
}

async function load(): Promise<AddContactsData> {
  if (deviceId.value == null) throw new Error(t('device.invalidId'))
  const [friends, contacts] = await Promise.all([getFriends(), getDeviceFriends(deviceId.value)])
  return { friends, contacts }
}

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'contact-add', deviceId.value],
  query: load,
})

const existingIds = computed(
  () => new Set((state.value.data?.contacts ?? []).map((contact) => contact.userId)),
)
/** Native lists contacts by name in pinyin order, not by API order. */
function byName(left: Friend, right: Friend): number {
  return left.nick.localeCompare(right.nick, 'zh-Hans-CN')
}

const visibleFriends = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  const friends = [...(state.value.data?.friends ?? [])].sort(byName)
  if (!query) return friends
  return friends.filter(
    (friend) =>
      friend.nick.toLowerCase().includes(query) || friend.userNum.toLowerCase().includes(query),
  )
})
const selectableFriends = computed(() =>
  visibleFriends.value.filter((friend) => !existingIds.value.has(friend.userId)),
)
const selectedCount = computed(() => selectedIds.value.length)
const allSelected = computed(
  () =>
    selectableFriends.value.length > 0 &&
    selectableFriends.value.every((friend) => selectedIds.value.includes(friend.userId)),
)

const inviteMutation = useMutation({
  mutation: async (input: { inviteeIds: number[]; detail: string }) => {
    if (deviceId.value == null) throw new Error(t('device.invalidId'))
    // One application per picked friend, sent sequentially in list order.
    for (const inviteeId of input.inviteeIds) {
      await inviteDeviceFriend(deviceId.value, inviteeId, input.detail)
    }
  },
})

function toggleFriend(friend: Friend): void {
  if (existingIds.value.has(friend.userId)) return
  selectedIds.value = selectedIds.value.includes(friend.userId)
    ? selectedIds.value.filter((id) => id !== friend.userId)
    : [...selectedIds.value, friend.userId]
}

function toggleAll(): void {
  selectedIds.value = allSelected.value
    ? []
    : selectableFriends.value.map((friend) => friend.userId)
}

function openConfirmation(): void {
  inviteMessage.value = t('device.inviteDefaultMessage')
  confirmationOpen.value = true
}

async function submit(): Promise<void> {
  if (selectedIds.value.length === 0 || inviteMutation.isLoading.value) return
  const detail = inviteMessage.value.trim() || t('device.inviteDefaultMessage')
  try {
    await inviteMutation.mutateAsync({ inviteeIds: [...selectedIds.value], detail })
    confirmationOpen.value = false
    await queryCache.invalidateQueries({ key: ['device-management', 'contacts'] })
    showToast(t('device.applicationSent'))
    goBack()
  } catch (error) {
    confirmationOpen.value = false
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="t('device.addFromFriends')" />

    <main class="p-4">
      <div class="relative">
        <span
          class="i-ph-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-lg text-text-secondary"
          aria-hidden="true"
        />
        <input
          v-model="keyword"
          type="search"
          class="w-full rounded-standard bg-surface-field py-3 pl-11 pr-4 text-body text-text-primary outline-none placeholder:text-text-secondary"
          :placeholder="t('device.contactSearchPlaceholder')"
          :aria-label="t('device.contactSearchPlaceholder')"
        />
      </div>

      <QueryState :status="state.status" :error="state.error" @retry="reload()">
        <template v-if="state.data">
          <button
            type="button"
            class="mt-2 min-h-12 w-full flex items-center justify-between py-3 text-left"
            :aria-pressed="allSelected"
            :disabled="selectableFriends.length === 0"
            @click="toggleAll"
          >
            <span class="text-body">{{ t('device.selectAll') }}</span>
            <span
              class="checkbox"
              :class="allSelected ? 'checkbox-on' : 'checkbox-off'"
              aria-hidden="true"
            >
              <span v-if="allSelected" class="i-ph-check" />
            </span>
          </button>

          <p
            v-if="visibleFriends.length === 0"
            class="py-12 text-center text-body text-text-secondary"
          >
            {{ keyword.trim() ? t('device.noUsersFound') : t('device.noCandidates') }}
          </p>
          <div v-else class="mt-2 panel">
            <button
              v-for="friend in visibleFriends"
              :key="friend.userId"
              type="button"
              :aria-pressed="selectedIds.includes(friend.userId)"
              class="min-h-16 w-full flex items-center px-4 text-left disabled:opacity-50"
              :disabled="existingIds.has(friend.userId)"
              @click="toggleFriend(friend)"
            >
              <Avatar :name="friend.nick" :src="friend.avatar" />
              <span class="ml-3 min-w-0 flex-1 truncate text-body">{{ friend.nick }}</span>
              <span
                v-if="existingIds.has(friend.userId)"
                class="ml-2 text-small text-text-secondary"
              >
                {{ t('device.alreadyContact') }}
              </span>
              <span
                v-else
                class="checkbox ml-3"
                :class="selectedIds.includes(friend.userId) ? 'checkbox-on' : 'checkbox-off'"
                aria-hidden="true"
              >
                <span v-if="selectedIds.includes(friend.userId)" class="i-ph-check" />
              </span>
            </button>
          </div>

          <button
            type="button"
            class="btn-primary mt-6"
            :disabled="selectedCount === 0 || inviteMutation.isLoading.value"
            @click="openConfirmation"
          >
            {{ t('device.confirmAddContacts', { count: selectedCount }) }}
          </button>
        </template>
      </QueryState>
    </main>

    <BaseModal
      v-if="confirmationOpen"
      :title="t('device.addContact')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="inviteMutation.isLoading.value ? t('device.saving') : t('modal.confirm')"
      :dismissible="!inviteMutation.isLoading.value"
      @cancel="confirmationOpen = false"
      @confirm="submit"
    >
      <p>{{ t('device.addContactsConfirm', { count: selectedCount }) }}</p>
      <label class="mt-3 block text-body">
        {{ t('device.inviteReason') }}
        <textarea
          v-model="inviteMessage"
          class="input-field mt-2 min-h-24"
          :maxlength="MAX_DESCRIPTION_LENGTH"
          :placeholder="t('device.inviteReasonPlaceholder')"
          :aria-label="t('device.inviteReason')"
          :disabled="inviteMutation.isLoading.value"
          rows="3"
        />
      </label>
    </BaseModal>
  </div>
</template>
