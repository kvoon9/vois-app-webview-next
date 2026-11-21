<script setup lang="ts">
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@ui-sdk/vue/combobox'
import { useI18n } from 'vue-i18n'

defineProps<{
  label: string
  accounts: string[]
  disabled: boolean
}>()

// Free text is the value, so the query binding carries both typing and selection.
const account = defineModel<string>({ required: true })
const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <div>
    <label for="login-account" class="text-2nd-body">{{ label }}</label>
    <Combobox v-model:query="account" :disabled="disabled" :filter="false" allow-custom-value>
      <div class="relative mt-2">
        <ComboboxInput
          id="login-account"
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
      </div>
      <ComboboxContent
        v-if="accounts.length"
        class="w-[var(--anchor-width)] rounded-standard bg-surface-elevated shadow-lg"
      >
        <ComboboxList class="max-h-60 overflow-y-auto p-1">
          <ComboboxItem
            v-for="name in accounts"
            :key="name"
            :value="name"
            class="cursor-pointer rounded-standard px-3 py-3 text-body outline-none data-[highlighted]:bg-surface-muted"
          >
            {{ name }}
          </ComboboxItem>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  </div>
</template>
