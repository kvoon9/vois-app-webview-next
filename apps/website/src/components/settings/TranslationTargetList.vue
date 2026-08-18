<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { TranslationTarget, TranslationTargetKind } from '~/utils/translation-api'
import { translationLanguageName } from '~/utils/translation-language'

const props = withDefaults(
  defineProps<{
    items: TranslationTarget[]
    kind: TranslationTargetKind
    memberOnly?: boolean
  }>(),
  { memberOnly: false },
)

const emit = defineEmits<{
  edit: [item: TranslationTarget]
  open: [item: TranslationTarget]
}>()

const { locale, t } = useI18n({ useScope: 'global' })

function statusLabel(item: TranslationTarget): string {
  const languagePair =
    item.source && item.target
      ? `${translationLanguageName(item.source, locale.value)} → ${translationLanguageName(item.target, locale.value)}`
      : ''

  if (props.memberOnly && languagePair) return languagePair
  if (item.skill === 0) return t('translation.skills.off')
  if (item.skill === 1) return t('translation.skills.basic')
  if (languagePair) return languagePair
  return t(item.skill === 2 ? 'translation.skills.premiumZhEn' : 'translation.skills.premiumMulti')
}

function hideBrokenImage(event: Event): void {
  const image = event.currentTarget
  if (image instanceof HTMLImageElement) image.hidden = true
}
</script>

<template>
  <ul class="space-y-3">
    <li v-for="item in items" :key="item.id" class="card flex items-center">
      <button
        v-if="!memberOnly"
        type="button"
        class="min-w-0 flex flex-1 items-center text-left"
        @click="emit('open', item)"
      >
        <span
          class="relative h-11 w-11 flex flex-none items-center justify-center overflow-hidden rounded-full bg-surface-muted text-header text-text-secondary"
        >
          {{ item.name.slice(0, 1) }}
          <img
            v-if="item.avatar"
            :src="item.avatar"
            alt=""
            class="absolute inset-0 h-full w-full object-cover"
            @error="hideBrokenImage"
          />
        </span>
        <span class="ml-3 min-w-0 flex-1">
          <span class="block truncate text-body font-medium">{{ item.name }}</span>
          <span v-if="item.number" class="block truncate text-small text-text-secondary">
            {{ item.number }}
          </span>
        </span>
        <span class="ml-3 max-w-28 flex-none text-right text-small text-text-secondary">
          <span class="line-clamp-2">{{ statusLabel(item) }}</span>
        </span>
        <span aria-hidden="true" class="ml-1 flex-none text-text-secondary">›</span>
      </button>

      <template v-else>
        <div class="min-w-0 flex flex-1 items-center">
          <span
            class="relative h-11 w-11 flex flex-none items-center justify-center overflow-hidden rounded-full bg-surface-muted text-header text-text-secondary"
          >
            {{ item.name.slice(0, 1) }}
            <img
              v-if="item.avatar"
              :src="item.avatar"
              alt=""
              class="absolute inset-0 h-full w-full object-cover"
              @error="hideBrokenImage"
            />
          </span>
          <span class="ml-3 min-w-0 flex-1">
            <span class="block truncate text-body font-medium">{{ item.name }}</span>
            <span v-if="item.number" class="block truncate text-small text-text-secondary">
              {{ item.number }}
            </span>
          </span>
        </div>

        <button
          type="button"
          class="ml-3 min-h-11 max-w-30 flex-none rounded-small bg-surface-muted px-3 text-small text-text-secondary"
          :aria-label="$t('translation.editSetting', { name: item.name })"
          @click="emit('edit', item)"
        >
          <span class="line-clamp-2">{{ statusLabel(item) }}</span>
        </button>
      </template>
    </li>
  </ul>
</template>
