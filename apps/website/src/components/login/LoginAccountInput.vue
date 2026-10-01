<script setup lang="ts">
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxViewport,
} from 'reka-ui'
import { useI18n } from 'vue-i18n'

defineProps<{
  label: string
  accounts: string[]
  disabled: boolean
}>()

const account = defineModel<string>({ required: true })
const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <div>
    <label for="login-account" class="text-2nd-body">{{ label }}</label>
    <ComboboxRoot
      v-model="account"
      class="relative mt-2"
      :disabled="disabled"
      :reset-search-term-on-blur="false"
      :reset-search-term-on-select="false"
      ignore-filter
    >
      <ComboboxAnchor class="relative">
        <ComboboxInput
          id="login-account"
          v-model="account"
          inputmode="text"
          autocomplete="username"
          class="input-field pr-12"
          :placeholder="label"
        />
        <ComboboxTrigger
          v-if="accounts.length"
          type="button"
          class="absolute right-0 top-0 h-full w-12 flex items-center justify-center text-text-secondary"
          :aria-label="t('login.chooseAccount')"
        >
          <span class="i-ph-caret-down" aria-hidden="true" />
        </ComboboxTrigger>
      </ComboboxAnchor>
      <ComboboxContent
        v-if="accounts.length"
        class="absolute left-0 right-0 z-10 mt-1 rounded-standard bg-surface-elevated shadow-lg"
      >
        <ComboboxViewport class="max-h-60 overflow-y-auto p-1">
          <ComboboxItem
            v-for="name in accounts"
            :key="name"
            :value="name"
            class="cursor-pointer rounded-standard px-3 py-3 text-body outline-none data-[highlighted]:bg-surface-muted"
          >
            {{ name }}
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxRoot>
  </div>
</template>
