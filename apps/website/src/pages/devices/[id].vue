<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { computed, shallowRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import Avatar from '~/components/Avatar.vue'
import BaseModal from '~/components/BaseModal.vue'
import FieldEditModal from '~/components/FieldEditModal.vue'
import ImageCropper from '~/components/ImageCropper.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import ToggleSwitch from '~/components/ToggleSwitch.vue'
import { usePageBack } from '~/composables/usePageBack'
import { parseRouteParamId } from '~/composables/useRouteParamId'
import { useToast } from '~/composables/useToast'
import { weilaUpload } from '~/utils/api'
import {
  getDeviceDetail,
  unbindDevice,
  updateDeviceAvatar,
  updateDeviceNick,
  updateDeviceShareLocation,
  type Device,
} from '~/utils/device-api'

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const { goBack } = usePageBack()
const queryCache = useQueryCache()
const { showToast } = useToast()
const editing = shallowRef(false)
const nick = shallowRef('')
const unbindConfirm = shallowRef(false)

const deviceId = computed(() => parseRouteParamId(route.params.id))

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'device', deviceId.value],
  query: () => {
    if (deviceId.value == null) throw new Error(t('device.invalidDevice'))
    return getDeviceDetail(deviceId.value)
  },
})

const device = computed<Device | null>(() => state.value.data ?? null)

const { mutateAsync: saveNick, isLoading: savingName } = useMutation({
  mutation: (value: { deviceId: number; nick: string }) =>
    updateDeviceNick(value.deviceId, value.nick),
})

const { mutateAsync: saveShareLocation } = useMutation({
  mutation: (value: { deviceId: number; shareLocation: boolean }) =>
    updateDeviceShareLocation(value.deviceId, value.shareLocation),
})

const { mutateAsync: unbind, isLoading: unbinding } = useMutation({
  mutation: (value: number) => unbindDevice(value),
})

function startEditing(): void {
  if (!device.value) return
  nick.value = device.value.nick
  editing.value = true
}

async function saveName(value: string): Promise<void> {
  if (deviceId.value == null || savingName.value) return
  try {
    await saveNick({ deviceId: deviceId.value, nick: value })
    editing.value = false
    await queryCache.invalidateQueries({ key: ['device-management'] })
    showToast(t('device.updated'))
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}

async function onShareLocationChange(): Promise<void> {
  const current = device.value
  if (!current || deviceId.value == null) return
  const next = !current.shareLocation
  try {
    await saveShareLocation({ deviceId: deviceId.value, shareLocation: next })
    await queryCache.invalidateQueries({ key: ['device-management', 'device'] })
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}

async function confirmUnbind(): Promise<void> {
  if (deviceId.value == null || unbinding.value) return
  try {
    await unbind(deviceId.value)
    unbindConfirm.value = false
    await queryCache.invalidateQueries({ key: ['device-management'] })
    showToast(t('device.unbindSuccess'))
    goBack()
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}

async function copyDeviceNumber(): Promise<void> {
  if (!device.value?.imei) return
  try {
    await navigator.clipboard.writeText(device.value.imei)
    showToast(t('device.copied'))
  } catch {
    showToast(t('device.copyFailed'), { type: 'error' })
  }
}

const avatarInput = useTemplateRef<HTMLInputElement>('avatarInput')
const avatarFile = shallowRef<File | null>(null)
const avatarUploading = shallowRef(false)

function pickAvatar(): void {
  if (!avatarUploading.value) avatarInput.value?.click()
}

function onAvatarChange(event: Event): void {
  const input = event.currentTarget
  if (!(input instanceof HTMLInputElement)) return
  avatarFile.value = input.files?.[0] ?? null
  // Cleared so that picking the same file twice still fires a change event
  input.value = ''
}

async function uploadAvatar(file: Blob, fileName: string): Promise<void> {
  if (deviceId.value == null || avatarUploading.value) return
  avatarFile.value = null
  avatarUploading.value = true
  try {
    const url = await weilaUpload(file, fileName)
    await updateDeviceAvatar(deviceId.value, url)
    await queryCache.invalidateQueries({ key: ['device-management'] })
    showToast(t('device.updated'))
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  } finally {
    avatarUploading.value = false
  }
}

function onCropConfirmed(blob: Blob): void {
  void uploadAvatar(blob, 'avatar.jpg')
}

/** A file the WebView cannot decode still uploads, exactly as it did before cropping. */
function onCropFailed(): void {
  const file = avatarFile.value
  if (file) void uploadAvatar(file, file.name)
}
</script>

<template>
  <RouterView v-if="route.name !== '/devices/[id]'" />
  <div v-else class="page">
    <PageHeader :title="device?.nick ?? t('device.title')" />
    <main class="p-4">
      <QueryState
        :status="state.status"
        :error="state.error"
        :empty="state.status === 'success' && !device"
        :empty-text="t('device.notFound')"
        @retry="reload()"
      >
        <template v-if="device">
          <section class="flex flex-col items-center py-4 text-center">
            <button
              type="button"
              class="rounded-full focus-visible:ring-2 focus-visible:ring-primary/40"
              :aria-label="t('device.changeAvatar')"
              @click="pickAvatar"
            >
              <Avatar :name="device.nick" :src="device.avatar" size="lg" />
            </button>
            <input
              ref="avatarInput"
              type="file"
              accept="image/*"
              class="hidden"
              @change="onAvatarChange"
            />
            <div class="mt-3 flex items-center">
              <h2 class="text-header font-semibold">{{ device.nick }}</h2>
              <button
                type="button"
                class="icon-button ml-2 p-2 focus-visible:ring-2 focus-visible:ring-primary/40"
                :aria-label="t('device.editName')"
                @click="startEditing"
              >
                <span class="i-ph-pencil-simple" aria-hidden="true" />
              </button>
            </div>
          </section>

          <dl class="mt-2 overflow-hidden panel">
            <div class="flex items-center justify-between px-4 py-3">
              <dt class="text-2nd-body text-text-secondary">{{ t('device.activatedAt') }}</dt>
              <dd class="ml-4 text-right text-2nd-body">
                {{ device.activatedAt || t('device.notAvailable') }}
              </dd>
            </div>
            <div class="flex items-center justify-between px-4 py-3">
              <dt class="text-2nd-body text-text-secondary">{{ t('device.model') }}</dt>
              <dd class="ml-4 text-right text-2nd-body">
                {{ device.product || t('device.notAvailable') }}
              </dd>
            </div>
            <div class="flex items-center justify-between px-4 py-3">
              <dt class="text-2nd-body text-text-secondary">{{ t('device.deviceNumber') }}</dt>
              <dd class="ml-4 flex min-w-0 items-center text-right text-2nd-body">
                <span class="truncate">{{ device.imei || t('device.notAvailable') }}</span>
                <button
                  v-if="device.imei"
                  type="button"
                  class="icon-button ml-2 p-1 focus-visible:ring-2 focus-visible:ring-primary/40"
                  :aria-label="t('device.copyDeviceNumber')"
                  @click="copyDeviceNumber"
                >
                  <span class="i-ph-copy" aria-hidden="true" />
                </button>
              </dd>
            </div>
            <div class="flex items-center justify-between px-4 py-3">
              <dt class="text-2nd-body text-text-secondary">{{ t('device.version') }}</dt>
              <dd class="ml-4 text-right text-2nd-body">
                {{ device.version || t('device.notAvailable') }}
              </dd>
            </div>
            <div class="flex items-center justify-between px-4 py-3">
              <dt class="text-2nd-body text-text-secondary">{{ t('device.userNumber') }}</dt>
              <dd class="ml-4 text-right text-2nd-body">
                {{ device.userNum || t('device.notAvailable') }}
              </dd>
            </div>
          </dl>

          <section v-if="device.simCard" class="mt-4">
            <h2 class="section-title mb-4">{{ t('device.simCard') }}</h2>
            <dl class="overflow-hidden panel">
              <div class="flex items-center justify-between px-4 py-3">
                <dt class="text-2nd-body text-text-secondary">{{ t('device.iccid') }}</dt>
                <dd class="ml-4 text-right text-2nd-body">
                  {{ device.simCard.iccid || t('device.notAvailable') }}
                </dd>
              </div>
              <div class="flex items-center justify-between px-4 py-3">
                <dt class="text-2nd-body text-text-secondary">{{ t('device.expireAt') }}</dt>
                <dd class="ml-4 text-right text-2nd-body">
                  {{ device.simCard.expiryDate || t('device.notAvailable') }}
                </dd>
              </div>
              <div
                v-if="device.simCard.recharge"
                class="flex items-center justify-between px-4 py-3"
              >
                <dt class="text-2nd-body text-text-secondary">{{ t('device.simCardState') }}</dt>
                <dd class="ml-4 text-right text-2nd-body text-danger">
                  {{ t('device.simCardNeedRecharge') }}
                </dd>
              </div>
            </dl>
          </section>

          <div class="mt-3 flex min-h-12 items-center justify-between px-4 panel">
            <span class="text-2nd-body">{{ t('device.locationShare') }}</span>
            <ToggleSwitch
              :checked="device.shareLocation"
              :aria-label="t('device.locationShare')"
              @change="onShareLocationChange"
            />
          </div>

          <nav class="mt-3">
            <RouterLink :to="`/devices/${deviceId}/location`" class="min-h-12 w-full nav-item">
              <span>{{ t('device.locationAndFence') }}</span>
              <span class="row-chevron" aria-hidden="true" />
            </RouterLink>
            <RouterLink :to="`/devices/${deviceId}/track`" class="mt-1 min-h-12 w-full nav-item">
              <span>{{ t('device.trackRecords') }}</span>
              <span class="row-chevron" aria-hidden="true" />
            </RouterLink>
            <RouterLink
              :to="`/devices/${deviceId}/track-setting`"
              class="mt-1 min-h-12 w-full nav-item"
            >
              <span>{{ t('device.trackSetting') }}</span>
              <span class="row-chevron" aria-hidden="true" />
            </RouterLink>
            <RouterLink :to="`/devices/${deviceId}/groups`" class="mt-1 min-h-12 w-full nav-item">
              <span>{{ t('device.groups') }}</span>
              <span class="row-chevron" aria-hidden="true" />
            </RouterLink>
            <RouterLink :to="`/devices/${deviceId}/contacts`" class="mt-1 min-h-12 w-full nav-item">
              <span>{{ t('device.contacts') }}</span>
              <span class="row-chevron" aria-hidden="true" />
            </RouterLink>
            <RouterLink
              :to="`/devices/${deviceId}/emergency-contacts`"
              class="mt-1 min-h-12 w-full nav-item"
            >
              <span>{{ t('device.emergencyContactSettings') }}</span>
              <span class="row-chevron" aria-hidden="true" />
            </RouterLink>
            <RouterLink
              v-if="device.simCard?.recharge"
              to="/devices/recharge"
              class="mt-1 min-h-12 w-full nav-item"
            >
              <span>{{ t('device.rechargeDevices') }}</span>
              <span class="row-chevron" aria-hidden="true" />
            </RouterLink>
            <RouterLink
              v-if="device.simCard"
              :to="`/devices/${deviceId}/recharge-records`"
              class="mt-1 min-h-12 w-full nav-item"
            >
              <span>{{ t('device.rechargeRecords') }}</span>
              <span class="row-chevron" aria-hidden="true" />
            </RouterLink>
            <RouterLink
              :to="`/devices/${deviceId}/reminders`"
              class="mt-1 min-h-12 w-full nav-item"
            >
              <span>{{ t('device.reminders') }}</span>
              <span class="row-chevron" aria-hidden="true" />
            </RouterLink>
          </nav>

          <button
            type="button"
            class="mt-4 min-h-12 w-full rounded-large border border-danger/40 px-4 text-body text-danger focus-visible:ring-2 focus-visible:ring-primary/40"
            @click="unbindConfirm = true"
          >
            {{ t('device.unbind') }}
          </button>
        </template>
      </QueryState>
    </main>

    <FieldEditModal
      v-if="editing"
      :title="t('device.editName')"
      :model-value="nick"
      kind="name"
      required
      :loading="savingName"
      @cancel="editing = false"
      @save="saveName"
    />

    <BaseModal
      v-if="unbindConfirm"
      :title="t('device.unbind')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="unbinding ? t('device.saving') : t('modal.confirm')"
      :dismissible="!unbinding"
      tone="danger"
      @cancel="unbindConfirm = false"
      @confirm="confirmUnbind"
    >
      <p>{{ t('device.unbindConfirmMessage', { name: device?.nick ?? '' }) }}</p>
    </BaseModal>

    <ImageCropper
      v-if="avatarFile"
      :file="avatarFile"
      @cancel="avatarFile = null"
      @confirm="onCropConfirmed"
      @failed="onCropFailed"
    />
  </div>
</template>
