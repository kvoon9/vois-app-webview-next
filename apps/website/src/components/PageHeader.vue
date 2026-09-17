<script setup lang="ts">
import { computed, defineAsyncComponent, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import LanguageSwitcher from '~/components/LanguageSwitcher.vue'
import { isWebviewDebug } from '~/composables/useWebviewDebug'
import { usePageBack } from '~/composables/usePageBack'
import { browserClipboard, copyText } from '~/utils/clipboard'
import { previewPortHref } from '~/utils/preview-port'

// Debug-preview only. Loading it lazily keeps the dialog runtime out of the
// shared PageHeader chunk that every route pulls in.
const BaseModal = defineAsyncComponent(() => import('~/components/BaseModal.vue'))

const { t } = useI18n()

defineProps<{
  title: string
}>()

const { goBack } = usePageBack()

const portSwitchable = isWebviewDebug()
const portDialogOpen = shallowRef(false)
// Vue casts a `type="number"` model to a number, and to '' while the field is empty.
const portDraft = shallowRef<string | number>('')
// Read when the dialog opens and never updated after: a port switch replaces the page.
const currentUrl = shallowRef('')
const copyFailed = shallowRef<boolean | null>(null)

const targetHref = computed(() =>
  previewPortHref(String(portDraft.value), new URL(window.location.href)),
)

function openPortDialog(): void {
  portDraft.value = window.location.port
  currentUrl.value = window.location.href
  copyFailed.value = null
  portDialogOpen.value = true
}

function confirmPort(): void {
  if (targetHref.value !== null) window.location.replace(targetHref.value)
}

/**
 * Reports the result inside the dialog rather than through the toast host, whose
 * layer sits under the teleported overlay. Clipboard writes are blocked on the
 * plain-HTTP LAN preview the phone uses, so failure is expected here, not rare.
 */
async function copyCurrentUrl(): Promise<void> {
  copyFailed.value = !(await copyText(currentUrl.value, browserClipboard()))
}
</script>

<template>
  <header class="sticky top-0 z-10 h-14 flex items-center justify-center bg-surface">
    <button
      type="button"
      class="absolute left-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11"
      :aria-label="t('nav.back')"
      @click="goBack"
    >
      <span class="i-ph-arrow-left text-xl text-text-primary" aria-hidden="true" />
    </button>
    <button
      v-if="portSwitchable"
      type="button"
      class="page-title"
      aria-haspopup="dialog"
      @click="openPortDialog"
    >
      {{ title }}
    </button>
    <h1 v-else class="page-title">{{ title }}</h1>
    <slot name="action">
      <LanguageSwitcher class="absolute right-2 top-1/2 -translate-y-1/2" />
    </slot>

    <BaseModal
      v-if="portDialogOpen"
      :title="t('nav.switchPreviewPort')"
      @cancel="portDialogOpen = false"
    >
      <div class="mb-4">
        <p class="text-2nd-body text-text-secondary">{{ t('nav.currentUrl') }}</p>
        <div class="mt-2 flex items-start space-x-2">
          <p
            class="min-w-0 flex-1 break-all rounded-small bg-surface-field p-3 text-2nd-body select-text"
          >
            {{ currentUrl }}
          </p>
          <button
            type="button"
            class="icon-button h-11 w-11 bg-surface-field text-text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
            :aria-label="t('nav.copyLink')"
            @click="copyCurrentUrl"
          >
            <span class="i-ph-copy text-xl" aria-hidden="true" />
          </button>
        </div>
        <p
          v-if="copyFailed !== null"
          class="mt-2 text-small"
          :class="copyFailed ? 'text-danger' : 'text-text-secondary'"
          role="status"
        >
          {{ t(copyFailed ? 'nav.linkCopyFailed' : 'nav.linkCopied') }}
        </p>
      </div>
      <label class="block text-body">
        {{ t('nav.previewPort') }}
        <input
          v-model="portDraft"
          class="input-field mt-2"
          type="number"
          inputmode="numeric"
          min="1"
          max="65535"
          :aria-label="t('nav.previewPort')"
          @keyup.enter="confirmPort"
        />
      </label>
      <p v-if="targetHref === null" class="mt-2 text-small text-danger" role="alert">
        {{ t('nav.previewPortInvalid') }}
      </p>
      <template #footer>
        <div class="flex justify-end space-x-3">
          <button
            type="button"
            class="rounded-small px-4 py-2 text-text-secondary focus-visible:ring-2 focus-visible:ring-primary/40"
            @click="portDialogOpen = false"
          >
            {{ t('modal.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-small bg-primary px-4 py-2 text-primary-text focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
            :disabled="targetHref === null"
            @click="confirmPort"
          >
            {{ t('modal.confirm') }}
          </button>
        </div>
      </template>
    </BaseModal>
  </header>
</template>
