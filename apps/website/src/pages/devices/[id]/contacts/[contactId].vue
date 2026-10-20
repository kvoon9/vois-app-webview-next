<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import BaseModal from '~/components/BaseModal.vue'
import Avatar from '~/components/Avatar.vue'
import FieldEditModal from '~/components/FieldEditModal.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { parseRouteParamId } from '~/composables/useRouteParamId'
import { usePageBack } from '~/composables/usePageBack'
import { useToast } from '~/composables/useToast'
import {
  getDeviceFriends,
  removeDeviceFriend,
  updateFriendRemark,
  type Friend,
} from '~/utils/device-api'

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const queryCache = useQueryCache()
const { goBack } = usePageBack()
const { showToast } = useToast()
const deviceId = computed(() => parseRouteParamId(route.params.id))
const contactId = computed(() => parseRouteParamId(route.params.contactId))
const editingRemark = shallowRef(false)
const remark = shallowRef('')
const removeConfirmation = shallowRef(false)

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'contact', deviceId.value, contactId.value],
  query: async (): Promise<Friend> => {
    if (deviceId.value == null || contactId.value == null)
      throw new Error(t('device.invalidContact'))
    const friend = (await getDeviceFriends(deviceId.value)).find(
      (item) => item.userId === contactId.value,
    )
    if (!friend) throw new Error(t('device.contactNotFound'))
    return friend
  },
})

const contact = computed<Friend | null>(() => state.value.data ?? null)

const remarkMutation = useMutation({
  mutation: (value: string) => {
    if (deviceId.value == null || contactId.value == null) {
      throw new Error(t('device.invalidContact'))
    }
    return updateFriendRemark(deviceId.value, contactId.value, value)
  },
})

const removeMutation = useMutation({
  mutation: () => {
    if (deviceId.value == null || contactId.value == null) {
      throw new Error(t('device.invalidContact'))
    }
    return removeDeviceFriend(deviceId.value, contactId.value)
  },
})

function openRemarkEditor(): void {
  if (!contact.value) return
  // `nick` falls back to the remark, so edit the remark itself rather than the display name.
  remark.value = contact.value.remark ?? ''
  editingRemark.value = true
}

async function saveRemark(value: string): Promise<void> {
  if (!editingRemark.value || remarkMutation.isLoading.value) return
  try {
    await remarkMutation.mutateAsync(value)
    editingRemark.value = false
    await queryCache.invalidateQueries({ key: ['device-management', 'contact'] })
    await queryCache.invalidateQueries({ key: ['device-management', 'contacts'] })
    showToast(t('device.contactUpdated'))
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}

async function removeContact(): Promise<void> {
  if (removeMutation.isLoading.value) return
  try {
    await removeMutation.mutateAsync()
    removeConfirmation.value = false
    await queryCache.invalidateQueries({ key: ['device-management', 'contacts'] })
    showToast(t('device.contactRemoved'))
    goBack()
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="contact?.nick ?? t('device.contactDetail')" />

    <main class="p-4">
      <QueryState :status="state.status" :error="state.error" @retry="reload()">
        <template v-if="contact">
          <section class="flex flex-col items-center py-4 text-center">
            <Avatar :name="contact.nick" :src="contact.avatar" size="lg" />
            <h2 class="mt-3 text-header font-semibold">{{ contact.nick }}</h2>
            <p class="mt-1 text-small text-text-secondary">{{ contact.userNum }}</p>
          </section>

          <dl class="mt-2 overflow-hidden panel">
            <div class="flex items-center justify-between px-4 py-3">
              <dt class="text-2nd-body text-text-secondary">{{ t('device.registeredAt') }}</dt>
              <dd class="ml-4 text-right text-2nd-body">
                {{ contact.registeredAt || t('device.notAvailable') }}
              </dd>
            </div>
          </dl>

          <section class="mt-4 overflow-hidden panel">
            <button
              type="button"
              class="min-h-14 w-full flex items-center justify-between px-4 text-left"
              @click="openRemarkEditor"
            >
              <span class="min-w-0">
                <span class="block text-body">{{ t('device.remark') }}</span>
                <span class="mt-0.5 block truncate text-small text-text-secondary">
                  {{ contact.nick || t('device.remarkPlaceholder') }}
                </span>
              </span>
              <span class="row-chevron" aria-hidden="true" />
            </button>
            <RouterLink
              :to="{ path: '/report-user', query: { id: String(contact.userId) } }"
              class="min-h-14 flex items-center justify-between px-4 text-body text-danger"
            >
              <span>{{ t('profile.report') }}</span>
              <span class="row-chevron" aria-hidden="true" />
            </RouterLink>
          </section>

          <button
            type="button"
            class="mt-8 btn-danger"
            :disabled="removeMutation.isLoading.value"
            @click="removeConfirmation = true"
          >
            {{ t('device.removeContact') }}
          </button>
        </template>
      </QueryState>
    </main>

    <FieldEditModal
      v-if="editingRemark"
      :title="t('device.editRemark')"
      :model-value="remark"
      kind="name"
      :placeholder="t('device.remarkPlaceholder')"
      :loading="remarkMutation.isLoading.value"
      @cancel="editingRemark = false"
      @save="saveRemark"
    />

    <BaseModal
      v-if="removeConfirmation"
      :title="t('device.removeContact')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="removeMutation.isLoading.value ? t('device.saving') : t('modal.confirm')"
      :dismissible="!removeMutation.isLoading.value"
      tone="danger"
      @cancel="removeConfirmation = false"
      @confirm="removeContact"
    >
      <p>{{ t('device.removeContactConfirm', { name: contact?.nick ?? '' }) }}</p>
    </BaseModal>
  </div>
</template>
