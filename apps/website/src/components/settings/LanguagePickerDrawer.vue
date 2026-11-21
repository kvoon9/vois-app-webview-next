<script setup lang="ts">
import {
  Drawer,
  DrawerBackdrop,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from '@ui-sdk/vue/drawer'
import { useDocumentVisibility } from '@vueuse/core'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { dismissSoftKeyboard } from '~/utils/soft-keyboard'
import {
  createTranslationLanguageOptions,
  filterTranslationLanguageOptions,
} from '~/utils/translation-language'

const props = defineProps<{
  disabled?: boolean
  label: string
  languages: string[]
  title: string
}>()

const model = defineModel<string>({ required: true })
const { locale, t } = useI18n({ useScope: 'global' })
const documentVisibility = useDocumentVisibility()
const open = shallowRef(false)
const query = shallowRef('')

// A hidden tab must not start the search fade before its first visible frame.
const animationsEnabled = computed(() => documentVisibility.value === 'visible')
const options = computed(() => createTranslationLanguageOptions(props.languages, locale.value))
const visibleOptions = computed(() => filterTranslationLanguageOptions(options.value, query.value))
const selectedOption = computed(() => options.value.find(({ code }) => code === model.value))

watch(open, (isOpen) => {
  if (isOpen) query.value = ''
})

function selectLanguage(code: string): void {
  model.value = code
  open.value = false
}
</script>

<template>
  <Drawer v-model:open="open">
    <span class="block text-2nd-body font-medium">{{ label }}</span>
    <DrawerTrigger
      class="mt-2 min-h-14 w-full touch-manipulation flex items-center rounded-standard bg-surface-field px-4 text-left text-text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
      :aria-label="`${label}: ${selectedOption?.name ?? model}`"
      :disabled="disabled"
    >
      <span class="language-flag w-5 flex-none text-header" aria-hidden="true">
        {{ selectedOption?.flag ?? '🌐' }}
      </span>
      <span class="ml-2 min-w-0 flex-1">
        <span class="block truncate text-2nd-body font-medium">
          {{ selectedOption?.name ?? model }}
        </span>
        <span class="block truncate text-small text-text-secondary">
          {{ selectedOption?.nativeName ?? model }}
        </span>
      </span>
      <span v-if="!disabled" class="row-chevron ml-3" aria-hidden="true" />
    </DrawerTrigger>

    <DrawerBackdrop class="fixed inset-0 bg-black/35" />

    <DrawerContent
      class="language-drawer relative flex flex-col rounded-t-[20px] bg-surface-elevated text-text-primary shadow-xl focus-visible:ring-2 focus-visible:ring-primary/40"
      :class="{ 'language-drawer-animated': animationsEnabled }"
    >
      <div
        data-slot="grip"
        class="mx-auto mt-2 h-1 w-8 flex-none rounded-full bg-fill"
        aria-hidden="true"
      />

      <header class="h-12 flex flex-none items-center px-4">
        <DrawerTitle class="min-w-0 flex-1 truncate text-header font-semibold">
          {{ title }}
        </DrawerTitle>
        <DrawerDescription class="sr-only">
          {{ t('translation.chooseLanguageDescription') }}
        </DrawerDescription>
        <DrawerClose
          class="ml-3 h-10 w-10 touch-manipulation flex flex-none items-center justify-center rounded-full bg-surface-muted text-text-secondary focus-visible:ring-2 focus-visible:ring-primary/40"
          :aria-label="t('modal.close')"
        >
          <span class="i-ph-x" aria-hidden="true" />
        </DrawerClose>
      </header>

      <div class="flex-none px-3 py-2">
        <input
          v-model="query"
          type="search"
          name="translation-language-search"
          autocomplete="off"
          class="language-search h-11 w-full rounded-standard bg-surface-input px-4 text-2nd-body text-text-primary outline-none opacity-75 focus-visible:opacity-100"
          :aria-label="t('translation.searchLanguages')"
          :placeholder="t('translation.searchLanguages')"
          @keydown.enter="dismissSoftKeyboard"
        />
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ul v-if="visibleOptions.length">
          <li v-for="option in visibleOptions" :key="option.code">
            <button
              type="button"
              class="min-h-14 w-full touch-manipulation flex items-center px-4 text-left focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
              :class="
                option.code === model ? 'bg-surface-selected' : 'bg-surface active:bg-surface-muted'
              "
              :aria-pressed="option.code === model"
              @click="selectLanguage(option.code)"
            >
              <span class="language-flag w-5 flex-none text-header" aria-hidden="true">
                {{ option.flag }}
              </span>
              <span class="ml-2 min-w-0 flex-1">
                <span class="block truncate text-2nd-body font-medium">{{ option.name }}</span>
                <span class="block truncate text-small text-text-secondary">
                  {{ option.nativeName }}
                </span>
              </span>
            </button>
          </li>
        </ul>
        <p
          v-else
          class="px-4 py-10 text-center text-2nd-body text-text-secondary"
          role="status"
          aria-live="polite"
        >
          {{ t('translation.noLanguagesFound') }}
        </p>
      </div>
    </DrawerContent>
  </Drawer>
</template>

<style scoped>
.language-flag {
  font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
}

.language-drawer {
  height: min(68vh, 640px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

/* Covers the page when overscroll lifts the sheet's bottom edge. */
.language-drawer::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  height: 48px;
  background: var(--color-surface-elevated);
}

.language-drawer-animated .language-search {
  transition: opacity 150ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .language-drawer-animated .language-search {
    transition: none;
  }
}
</style>
