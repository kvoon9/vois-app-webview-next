<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { computed, shallowRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import Avatar from '~/components/Avatar.vue'
import BaseModal from '~/components/BaseModal.vue'
import FieldEditModal from '~/components/FieldEditModal.vue'
import IconEdit from '~/components/IconEdit.vue'
import ImageCropper from '~/components/ImageCropper.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import ToggleSwitch from '~/components/ToggleSwitch.vue'
import { usePageBack } from '~/composables/usePageBack'
import { usePageParams } from '~/composables/usePageParams'
import { parseRouteParamId } from '~/composables/useRouteParamId'
import { useToast } from '~/composables/useToast'
import { renewPayParams, useWechatRenewPayment } from '~/composables/useWechatRenewPayment'
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

const { params } = usePageParams(['pay-method', 'pkg-name', 'wxpay-appid'])
const payParams = computed(() => renewPayParams(params.value))
const payment = useWechatRenewPayment({
  payMethod: 'wechat',
  pkgName: () => payParams.value.pkgName,
  wxpayAppId: () => payParams.value.wxpayAppId,
  onPaid: () => reload(),
})

const payState = payment.state
/** Closing the paying dialog only hides it; the bridge result still lands. */
const payingHidden = shallowRef(false)
const creatingPayment = computed(() => payState.value.kind === 'creating')
const confirmingOrder = computed(() =>
  payState.value.kind === 'confirming' ? payState.value.order : null,
)
const payingOrder = computed(() => (payState.value.kind === 'paying' ? payState.value.order : null))
const successPayment = computed(() => (payState.value.kind === 'success' ? payState.value : null))
const failedPayment = computed(() => (payState.value.kind === 'failed' ? payState.value : null))
const failedTitle = computed(() =>
  failedPayment.value?.order === null ? t('device.orderFailed') : t('device.payStatusFailed'),
)

/** The wire carries fen; the payment dialog shows yuan. */
function formatAmount(amount: number): string {
  return `¥${(amount / 100).toFixed(2)}`
}

async function startRecharge(): Promise<void> {
  const iccid = device.value?.simCard?.iccid
  if (!iccid) return
  payingHidden.value = false
  await payment.start(iccid)
}

async function confirmPay(): Promise<void> {
  const order = confirmingOrder.value
  if (!order) return
  payingHidden.value = false
  await payment.payOrder(order)
}

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
    <PageHeader :title="t('device.detailTitle')" size="compact" />
    <main class="p-4">
      <QueryState
        :status="state.status"
        :error="state.error"
        :empty="state.status === 'success' && !device"
        :empty-text="t('device.notFound')"
        @retry="reload()"
      >
        <template v-if="device">
          <section class="flex flex-col items-center pb-4 text-center">
            <div class="relative">
              <button
                type="button"
                class="block rounded-full focus-visible:ring-2 focus-visible:ring-primary/40"
                :aria-label="t('device.changeDeviceAvatar')"
                @click="pickAvatar"
              >
                <Avatar :name="device.nick" :src="device.avatar" size="profile" />
              </button>
              <!-- Native draws the bare 16dp glyph at the corner, no disc. -->
              <IconEdit
                class="pointer-events-none absolute right-0 bottom-0 h-4 w-4 text-text-primary"
              />
            </div>
            <input
              ref="avatarInput"
              type="file"
              accept="image/*"
              class="hidden"
              @change="onAvatarChange"
            />
            <div class="mt-3 flex items-center">
              <h2 class="text-title-compact font-semibold">{{ device.nick }}</h2>
              <!-- Native's 48dp box around a 24dp glyph. -->
              <button
                type="button"
                class="icon-button h-12 w-12 p-3 focus-visible:ring-2 focus-visible:ring-primary/40"
                :aria-label="t('device.editName')"
                @click="startEditing"
              >
                <IconEdit class="h-6 w-6 text-text-primary" />
              </button>
            </div>
            <p class="mt-1 text-small text-text-secondary">
              {{ t('device.activatedAt') }}: {{ device.activatedAt || t('device.notAvailable') }}
            </p>
          </section>

          <!-- Card 1: identity. Rows read "label: value" on one line, as the app does;
               py-1.5 keeps the 36px pitch that 16px text + 24px line leaves. -->
          <section class="mt-2 overflow-hidden panel">
            <div class="flex items-center px-4 py-1.5 text-body">
              <span class="min-w-0 flex-1 truncate">
                {{ t('device.model') }}: {{ device.product || t('device.notAvailable') }}
              </span>
              <button
                v-if="device.simCard?.iccid"
                type="button"
                class="ml-3 -my-1.5 inline-flex min-h-9 flex-none items-center text-small text-primary focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
                :disabled="creatingPayment"
                @click="startRecharge"
              >
                {{ t('device.rechargeNow') }}
              </button>
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
            <div class="break-all px-4 py-1.5 text-body">
              {{ t('device.version') }}: {{ device.sdkVersion || t('device.notAvailable') }}
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
              v-if="device.emergencySupport"
              :to="`/devices/${deviceId}/emergency-contacts`"
              class="min-h-14 w-full panel-row text-body"
            >
              <span class="text-text-secondary">{{ t('device.emergencyContactSettings') }}</span>
              <span class="row-chevron" aria-hidden="true" />
            </RouterLink>
          </div>

          <!-- Card 3: position; the share switch leads, the rest navigate. -->
          <div
            v-if="device.locationSupport || device.reminderSupport"
            class="mt-3 overflow-hidden panel"
          >
            <template v-if="device.locationSupport">
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
            </template>
            <RouterLink
              v-if="device.reminderSupport"
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

    <BaseModal
      v-if="confirmingOrder"
      :title="t('device.confirmPay')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="t('device.payNow')"
      @cancel="payment.reset()"
      @confirm="confirmPay"
    >
      <div class="text-center">
        <p class="text-body font-medium">{{ confirmingOrder.productName }}</p>
        <p class="mt-1 text-small text-text-secondary">{{ confirmingOrder.productDesc }}</p>
        <p class="mt-4 text-small text-text-secondary">{{ t('device.payAmount') }}</p>
        <p class="mt-1 text-title font-semibold text-primary">
          {{ formatAmount(confirmingOrder.amount) }}
        </p>
      </div>
    </BaseModal>

    <BaseModal
      v-if="payingOrder && !payingHidden"
      :title="t('device.payStatusPaying')"
      @cancel="payingHidden = true"
    >
      <div class="text-center">
        <p class="text-body font-medium">{{ payingOrder.productName }}</p>
        <p class="mt-1 text-title font-semibold">{{ formatAmount(payingOrder.amount) }}</p>
      </div>
      <template #footer>
        <div class="space-y-3">
          <p class="text-center text-small text-text-secondary">{{ t('device.payingHint') }}</p>
          <button
            type="button"
            class="modal-action w-full bg-surface-field text-text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
            @click="payingHidden = true"
          >
            {{ t('modal.close') }}
          </button>
        </div>
      </template>
    </BaseModal>

    <BaseModal v-if="successPayment" :title="t('device.paySuccess')">
      <div class="text-center">
        <p class="text-body font-medium">{{ successPayment.order.productName }}</p>
        <p class="mt-1 text-title font-semibold">
          {{ formatAmount(successPayment.order.amount) }}
        </p>
        <p v-if="!successPayment.serverConfirmed" class="mt-3 text-small text-danger">
          {{ t('device.payUnconfirmed') }}
        </p>
      </div>
      <template #footer>
        <div class="flex">
          <button
            type="button"
            class="modal-action bg-primary text-primary-text focus-visible:ring-2 focus-visible:ring-primary/40"
            @click="payment.reset()"
          >
            {{ t('modal.ok') }}
          </button>
        </div>
      </template>
    </BaseModal>

    <BaseModal
      v-if="failedPayment"
      :title="failedTitle"
      :cancel-text="t('modal.close')"
      :confirm-text="failedPayment.canRetry ? t('device.payRetry') : t('modal.ok')"
      @cancel="payment.reset()"
      @confirm="failedPayment.canRetry ? payment.retry() : payment.reset()"
    >
      <p class="text-center text-body [text-wrap:balance]">{{ failedPayment.message }}</p>
      <template v-if="!failedPayment.canRetry" #footer>
        <div class="flex">
          <button
            type="button"
            class="modal-action bg-primary text-primary-text focus-visible:ring-2 focus-visible:ring-primary/40"
            @click="payment.reset()"
          >
            {{ t('modal.ok') }}
          </button>
        </div>
      </template>
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
