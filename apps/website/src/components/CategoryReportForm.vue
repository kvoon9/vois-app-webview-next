<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { maxValue, minValue, number, object, pipe } from 'valibot'
import LabelEmojiPicker from '~/components/LabelEmojiPicker.vue'
import PageHeader from '~/components/PageHeader.vue'
import ResultModal from '~/components/ResultModal.vue'
import { useFormValidation } from '~/composables/useFormValidation'
import { useWebviewBridge } from '~/composables/useWebviewBridge'
import { isWebviewDebug } from '~/composables/useWebviewDebug'
import { weilaFetch } from '~/utils/api'
import { toChipOptions } from '~/utils/chip-options'
import { descriptionSchema, MAX_DESCRIPTION_LENGTH } from '~/utils/field-schema'

/**
 * Tells the server which form was filled in; controls the success message wording.
 * `content` in the body is the user-typed text; `type` is the chosen category label.
 */
const props = defineProps<{
  endpoint: string
  /**
   * Locale namespace whose `<namespace>.title`, `<namespace>.<sectionLabel>`, and
   * `<namespace>.<listKey>` strings drive the form; the list renders as chip choices.
   */
  i18nNamespace: 'feedback' | 'report'
  listKey: 'categories' | 'types'
  sectionLabelKey: 'category' | 'problemType'
  textareaLabelKey: 'yourFeedback' | 'whatHappened'
  placeholderKey: 'placeholder'
  submitKey: 'submit' | 'report'
  successFallbackKey?: 'successTitle'
}>()

const { t, tm } = useI18n({ useScope: 'global' })

interface ChipDecoration {
  emoji?: string
  icon?: string
}

const options = computed(() => toChipOptions(tm(`${props.i18nNamespace}.${props.listKey}`)))

/**
 * Decorations per list position, merged onto the locale strings. They live here
 * instead of the locale JSON because `locales.test.ts` keys off locale leaves,
 * which object entries break, and because 设备/账户 also appear in `report.types`:
 * a text-keyed map would decorate the wrong form's chips.
 */
const CATEGORY_DECORATIONS = {
  feedback: {
    categories: [
      { emoji: '💬' },
      { emoji: '🗨️' },
      { emoji: '📱' },
      { emoji: '🎨' },
      {},
      { icon: 'i-ph-user-circle' },
    ],
  },
} satisfies Record<string, Record<string, readonly ChipDecoration[]>>

const decorated = computed(() =>
  options.value.map((option, index) => {
    const decoration = CATEGORY_DECORATIONS[props.i18nNamespace]?.[props.listKey]?.[index] ?? {}
    return { ...option, ...decoration }
  }),
)

const schema = computed(() =>
  object({
    index: pipe(number(), minValue(0), maxValue(options.value.length - 1)),
    // The backend accepts an empty text, so there is no nonEmpty rule.
    content: descriptionSchema({
      tooLong: t('validation.descriptionTooLong', { max: MAX_DESCRIPTION_LENGTH }),
    }),
  }),
)

const { data, errors, resetErrors, validate, validateField } = useFormValidation(schema, {
  index: 0,
  content: '',
})

const isSubmitting = shallowRef(false)
const modal = shallowRef<{ type: 'success' | 'error'; message: string } | null>(null)

const debugMode = isWebviewDebug()
const emojiPickerOpen = shallowRef(false)

function insertEmoji(emoji: string): void {
  data.value.content += emoji
}

async function handleSubmit(): Promise<void> {
  if (isSubmitting.value) return

  const isValid = await validate()
  if (!isValid) return

  isSubmitting.value = true
  try {
    const response = await weilaFetch<void>(props.endpoint, {
      body: {
        // Only the display text goes to the backend; emoji/icon stay presentation.
        type: options.value[data.value.index]?.text,
        content: data.value.content.trim(),
      },
    })

    data.value.content = ''
    resetErrors()
    const fallback = props.successFallbackKey ? t(`modal.${props.successFallbackKey}`) : ''
    modal.value = { type: 'success', message: response.errmsg || fallback }
  } catch (error) {
    modal.value = {
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    }
  } finally {
    isSubmitting.value = false
  }
}

/** Success confirm dismisses the page via native bridge; error just closes the modal. */
function closeModal(): void {
  if (modal.value?.type === 'success') useWebviewBridge()?.send('close-page')
  modal.value = null
}
</script>

<template>
  <div class="page">
    <PageHeader :title="t(`${i18nNamespace}.title`)" />
    <main class="p-4 pb-28">
      <form novalidate @submit.prevent="handleSubmit">
        <section>
          <h2 class="section-title mb-4">{{ t(`${i18nNamespace}.${sectionLabelKey}`) }}</h2>
          <div class="space-y-3">
            <div v-for="i in Math.ceil(decorated.length / 2)" :key="i" class="flex">
              <button
                v-for="(option, offset) in decorated.slice((i - 1) * 2, i * 2)"
                :key="option.text"
                type="button"
                class="chip flex-1"
                :class="[
                  (i - 1) * 2 + offset === data.index ? 'chip-selected' : 'chip-unselected',
                  decorated.length % 2 === 0 || i * 2 <= decorated.length ? 'mr-3' : '',
                ]"
                @click="data.index = (i - 1) * 2 + offset"
              >
                <span v-if="option.emoji" class="mr-1" aria-hidden="true">{{ option.emoji }}</span>
                <span
                  v-else-if="option.icon"
                  class="mr-1 text-header"
                  :class="option.icon"
                  aria-hidden="true"
                />
                {{ option.text }}
              </button>
            </div>
          </div>
          <p v-if="errors.index" class="mt-2 text-small text-danger">
            {{ errors.index }}
          </p>
        </section>

        <section>
          <div class="mt-6 mb-4 flex items-center justify-between">
            <h2 class="section-title">{{ t(`${i18nNamespace}.${textareaLabelKey}`) }}</h2>
            <button
              v-if="debugMode"
              type="button"
              class="mr-1 text-header text-text-secondary"
              aria-label="Emoji picker"
              @click="emojiPickerOpen = true"
            >
              <span class="i-ph-smiley" aria-hidden="true" />
            </button>
          </div>
          <textarea
            v-model="data.content"
            :maxlength="MAX_DESCRIPTION_LENGTH"
            rows="6"
            class="input-field"
            :placeholder="t(`${i18nNamespace}.${placeholderKey}`)"
            @blur="validateField('content')"
          />
          <p class="text-right text-small text-text-secondary mt-2">
            {{ data.content.length }}/{{ MAX_DESCRIPTION_LENGTH }}
          </p>
          <p v-if="errors.content" class="mt-1 text-small text-danger">
            {{ errors.content }}
          </p>
        </section>

        <LabelEmojiPicker
          v-if="debugMode"
          :open="emojiPickerOpen"
          @select="insertEmoji"
          @close="emojiPickerOpen = false"
        />

        <footer
          class="fixed inset-x-0 bottom-0 bg-surface-elevated px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-3"
        >
          <button type="submit" class="btn-primary" :disabled="isSubmitting">
            {{ t(`${i18nNamespace}.${submitKey}`) }}
          </button>
        </footer>
      </form>
    </main>

    <ResultModal v-if="modal" :type="modal.type" :message="modal.message" @close="closeModal" />
  </div>
</template>
