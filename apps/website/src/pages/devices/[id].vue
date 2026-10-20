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
import { copyToClipboard } from '~/utils/bridge/clipboard-bridge'
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

/** Copies through the shared path: the App's clipboard, then the web APIs, then a selection. */
async function copyDeviceNumber(): Promise<void> {
  const imei = device.value?.imei
  if (!imei) return
  if (await copyToClipboard(imei)) showToast(t('device.copied'))
  else showToast(t('device.copyFailed'), { type: 'error' })
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
    <PageHeader :title="t('device.detailTitle')" />
    <main class="p-4">
      <QueryState
        :status="state.status"
        :error="state.error"
        :empty="state.status === 'success' && !device"
        :empty-text="t('device.notFound')"
        @retry="reload()"
      >
        <template v-if="device">
          <section class="flex flex-col items-center pt-2 pb-4 text-center">
            <div class="relative">
              <button
                type="button"
                class="block rounded-full focus-visible:ring-2 focus-visible:ring-primary/40"
                :aria-label="t('device.changeDeviceAvatar')"
                @click="pickAvatar"
              >
                <Avatar :name="device.nick" :src="device.avatar" size="lg" />
              </button>
              <span
                class="pointer-events-none absolute right-0 bottom-0 flex h-6 w-6 items-center justify-center rounded-full bg-surface-elevated text-small text-text-secondary"
                aria-hidden="true"
              >
                <span class="i-ph-pencil-simple" />
              </span>
            </div>
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
            <p class="mt-1 text-small text-text-secondary">
              {{ t('device.activatedAt') }}: {{ device.activatedAt || t('device.notAvailable') }}
            </p>
          </section>

          <!-- Card 1: identity. Rows read "label: value" on one line, as the app does;
               py-1.5 keeps the 36px pitch that 16px text + 24px line leaves. -->
          <section class="mt-2 overflow-hidden panel">
            <div class="px-4 py-1.5 text-body">
              {{ t('device.model') }}: {{ device.product || t('device.notAvailable') }}
            </div>
            <div class="flex items-center px-4 py-1.5 text-body">
              <span class="min-w-0 truncate">
                {{ t('device.deviceNumber') }}: {{ device.imei || t('device.notAvailable') }}
              </span>
              <button
                v-if="device.imei"
                type="button"
                class="ml-2 flex-none text-small text-text-secondary focus-visible:ring-2 focus-visible:ring-primary/40"
                :aria-label="t('device.copyDeviceNumber')"
                @click="copyDeviceNumber"
              >
                {{ t('device.copy') }}
              </button>
            </div>
            <div class="px-4 py-1.5 text-body">
              {{ t('device.version') }}: {{ device.version || t('device.notAvailable') }}
            </div>
            <div class="px-4 py-1.5 text-body">
              {{ t('device.userNumber') }}: {{ device.userNum || t('device.notAvailable') }}
            </div>
            <template v-if="device.simCard">
              <div class="px-4 py-1.5 text-body">
                {{ t('device.iccid') }}: {{ device.simCard.iccid || t('device.notAvailable') }}
              </div>
              <div class="px-4 py-1.5 text-body">
                {{ t('device.expireAt') }}:
                {{ device.simCard.expiryDate || t('device.notAvailable') }}
              </div>
              <div v-if="device.simCard.recharge" class="px-4 py-1.5 text-body">
                {{ t('device.simCardState') }}:
                <span class="text-danger">{{ t('device.simCardNeedRecharge') }}</span>
              </div>
            </template>
            <RouterLink
              v-if="device.simCard"
              :to="`/devices/${deviceId}/recharge-records`"
              class="min-h-14 w-full panel-row text-body"
            >
              <span>{{ t('device.rechargeRecords') }}</span>
              <span class="row-chevron" aria-hidden="true" />
            </RouterLink>
            <RouterLink
              v-if="device.simCard?.recharge"
              to="/devices/recharge"
              class="min-h-14 w-full panel-row text-body"
            >
              <span>{{ t('device.rechargeDevices') }}</span>
              <span class="row-chevron" aria-hidden="true" />
            </RouterLink>
          </section>

          <!-- Card 2: management -->
          <div class="mt-3 overflow-hidden panel">
            <RouterLink
              :to="`/devices/${deviceId}/groups`"
              class="min-h-14 w-full panel-row text-body"
            >
              <span>{{ t('device.groups') }}</span>
              <span class="row-chevron" aria-hidden="true" />
            </RouterLink>
            <RouterLink
              :to="`/devices/${deviceId}/contacts`"
              class="min-h-14 w-full panel-row text-body"
            >
              <span>{{ t('device.contacts') }}</span>
              <span class="row-chevron" aria-hidden="true" />
            </RouterLink>
            <RouterLink
              :to="`/devices/${deviceId}/emergency-contacts`"
              class="min-h-14 w-full panel-row text-body"
            >
              <span>{{ t('device.emergencyContactSettings') }}</span>
              <span class="row-chevron" aria-hidden="true" />
            </RouterLink>
          </div>

          <!-- Card 3: position; the share switch leads, the rest navigate. -->
          <div class="mt-3 overflow-hidden panel">
            <div class="panel-row min-h-14">
              <span class="text-body">{{ t('device.locationShare') }}</span>
              <ToggleSwitch
                :checked="device.shareLocation"
                :aria-label="t('device.locationShare')"
                @change="onShareLocationChange"
              />
            </div>
            <RouterLink
              :to="`/devices/${deviceId}/location`"
              class="min-h-14 w-full panel-row text-body"
            >
              <span>{{ t('device.locationAndFence') }}</span>
              <span class="row-chevron" aria-hidden="true" />
            </RouterLink>
            <RouterLink
              :to="`/devices/${deviceId}/track`"
              class="min-h-14 w-full panel-row text-body"
            >
              <span>{{ t('device.trackRecords') }}</span>
              <span class="row-chevron" aria-hidden="true" />
            </RouterLink>
            <RouterLink
              :to="`/devices/${deviceId}/track-setting`"
              class="min-h-14 w-full panel-row text-body"
            >
              <span>{{ t('device.trackSetting') }}</span>
              <span class="row-chevron" aria-hidden="true" />
            </RouterLink>
            <RouterLink
              :to="`/devices/${deviceId}/reminders`"
              class="min-h-14 w-full panel-row text-body"
            >
              <span>{{ t('device.reminders') }}</span>
              <span class="row-chevron" aria-hidden="true" />
            </RouterLink>
          </div>

          <!-- Card 4: destructive action, its own card at the bottom. -->
          <div class="mt-3 overflow-hidden panel">
            <button
              type="button"
              class="min-h-14 w-full panel-row text-body text-danger focus-visible:ring-2 focus-visible:ring-primary/40"
              @click="unbindConfirm = true"
            >
              <span>{{ t('device.unbind') }}</span>
              <span class="row-chevron" aria-hidden="true" />
            </button>
          </div>
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
      :title="t('modal.tips')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="unbinding ? t('device.saving') : t('modal.ok')"
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
      :title="t('device.cropDeviceAvatar')"
      @cancel="avatarFile = null"
      @confirm="onCropConfirmed"
      @failed="onCropFailed"
    />
  </div>
</template>
