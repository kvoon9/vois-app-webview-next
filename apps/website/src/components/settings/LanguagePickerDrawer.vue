<script setup lang="ts">
import {
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHandle,
  DrawerOverlay,
  DrawerPortal,
  DrawerRoot,
  DrawerTitle,
  DrawerTrigger,
  DrawerViewport,
} from 'reka-ui'
import { useDocumentVisibility } from '@vueuse/core'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  createTranslationLanguageOptions,
  filterTranslationLanguageOptions,
} from '~/utils/translation-language'

const props = defineProps<{
  label: string
  languages: string[]
  title: string
}>()

const model = defineModel<string>({ required: true })
const { locale, t } = useI18n({ useScope: 'global' })
const documentVisibility = useDocumentVisibility()
const open = shallowRef(false)
const query = shallowRef('')

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
  <DrawerRoot v-model:open="open">
    <span class="block text-2nd-body font-medium">{{ label }}</span>
    <DrawerTrigger as-child>
      <button
        type="button"
        class="mt-2 min-h-14 w-full touch-manipulation flex items-center rounded-standard bg-surface-field px-4 text-left text-text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
        :aria-label="`${label}: ${selectedOption?.name ?? model}`"
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
        <svg
          class="ml-3 flex-none text-text-secondary"
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </DrawerTrigger>

    <DrawerPortal>
      <DrawerOverlay
        class="language-drawer-overlay fixed inset-0 z-drawer bg-black/35"
        :class="{ 'language-drawer-animated': animationsEnabled }"
      />
      <DrawerContent
        class="language-drawer fixed inset-x-0 bottom-0 z-drawer-content flex flex-col overflow-hidden rounded-t-[20px] bg-surface text-text-primary shadow-xl focus-visible:ring-2 focus-visible:ring-primary/40"
        :class="{ 'language-drawer-animated': animationsEnabled }"
      >
        <DrawerHandle class="mx-auto mt-2 h-1 w-8 flex-none rounded-full bg-stroke" />

        <header class="h-12 flex flex-none items-center border-b border-stroke px-4">
          <DrawerTitle class="min-w-0 flex-1 truncate text-header font-semibold">
            {{ title }}
          </DrawerTitle>
          <DrawerDescription class="sr-only">
            {{ t('translation.chooseLanguageDescription') }}
          </DrawerDescription>
          <DrawerClose as-child>
            <button
              type="button"
              class="ml-3 h-10 w-10 touch-manipulation flex flex-none items-center justify-center rounded-full bg-surface-muted text-text-secondary focus-visible:ring-2 focus-visible:ring-primary/40"
              :aria-label="t('modal.close')"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </DrawerClose>
        </header>

        <div class="flex-none px-3 py-2">
          <input
            v-model="query"
            type="search"
            name="translation-language-search"
            autocomplete="off"
            class="h-11 w-full rounded-standard bg-surface-field px-4 text-2nd-body text-text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
            :aria-label="t('translation.searchLanguages')"
            :placeholder="t('translation.searchLanguages')"
          />
        </div>

        <DrawerViewport class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <ul v-if="visibleOptions.length">
            <li v-for="option in visibleOptions" :key="option.code">
              <button
                type="button"
                class="min-h-14 w-full touch-manipulation flex items-center border-b border-stroke px-4 text-left focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
                :class="
                  option.code === model
                    ? 'bg-surface-selected'
                    : 'bg-surface active:bg-surface-muted'
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
        </DrawerViewport>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>

<style scoped>
.language-flag {
  font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
}

.language-drawer {
  --drawer-bleed: 48px;
  height: calc(min(68vh, 640px) + var(--drawer-bleed));
  max-height: calc(100vh - 24px + var(--drawer-bleed));
  margin-bottom: calc(-1 * var(--drawer-bleed));
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + var(--drawer-bleed));
  transform: translateY(var(--drawer-swipe-movement-y, 0px));
  transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
}

.language-drawer-animated.language-drawer[data-state='open'] {
  animation: language-drawer-in 300ms cubic-bezier(0.32, 0.72, 0, 1);
}

.language-drawer-animated.language-drawer[data-state='closed'] {
  animation: language-drawer-out 240ms ease-in;
}

.language-drawer[data-swiping] {
  animation: none;
  transition-duration: 0ms;
}

.language-drawer-animated.language-drawer-overlay[data-state='open'] {
  animation: language-drawer-overlay-in 200ms ease-out;
}

.language-drawer-animated.language-drawer-overlay[data-state='closed'] {
  animation: language-drawer-overlay-out 160ms ease-in;
}

@keyframes language-drawer-in {
  from {
    transform: translateY(calc(100% - var(--drawer-bleed)));
  }
}

@keyframes language-drawer-out {
  to {
    transform: translateY(calc(100% - var(--drawer-bleed)));
  }
}

@keyframes language-drawer-overlay-in {
  from {
    opacity: 0;
  }
}

@keyframes language-drawer-overlay-out {
  to {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .language-drawer,
  .language-drawer-overlay {
    animation-duration: 1ms !important;
    transition-duration: 1ms !important;
  }
}
</style>
