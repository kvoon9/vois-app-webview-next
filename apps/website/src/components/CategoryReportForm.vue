<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  maxLength,
  maxValue,
  minValue,
  nonEmpty,
  number,
  object,
  pipe,
  string,
  trim,
} from 'valibot'
import PageHeader from '~/components/PageHeader.vue'
import ResultModal from '~/components/ResultModal.vue'
import { MAX_REPORT_CONTENT_LENGTH } from '~/constants'
import { useFormValidation } from '~/composables/useFormValidation'
import { useWebviewBridge } from '~/composables/useWebviewBridge'
import { weilaFetch } from '~/utils/api'

/**
 * Tells the server which form was filled in; controls the success message wording.
 * `content` in the body is the user-typed text; `type` is the chosen category label.
 */
const props = defineProps<{
  endpoint: string
  /**
   * Locale namespace whose `<namespace>.title`, `<namespace>.<sectionLabel>`, and
   * `<namespace>.<listKey>` strings drive the form. The list is expected to be a
   * flat string array (so it is rendered as chip choices).
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

const items = computed(() => {
  // SAFETY: each `<namespace>.<listKey>` locale entry is a flat string array
  return Object.values(tm(`${props.i18nNamespace}.${props.listKey}`)) as string[]
})

const schema = object({
  index: pipe(number(), minValue(0), maxValue(items.value.length - 1)),
  content: pipe(
    string(),
    trim(),
    nonEmpty(() => t('validation.required')),
    maxLength(MAX_REPORT_CONTENT_LENGTH),
  ),
})

const { data, errors, resetErrors, validate, validateField } = useFormValidation(schema, {
  index: 0,
  content: '',
})

const isSubmitting = shallowRef(false)
const modal = shallowRef<{ type: 'success' | 'error'; message: string } | null>(null)

async function handleSubmit(): Promise<void> {
  if (isSubmitting.value) return

  const isValid = await validate()
  if (!isValid) return

  isSubmitting.value = true
  try {
    const response = await weilaFetch<void>(props.endpoint, {
      body: {
        type: items.value[data.value.index],
        content: data.value.content,
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
  <div class="min-h-svh bg-surface text-text-primary">
    <PageHeader :title="t(`${i18nNamespace}.title`)" />
    <main class="p-4">
      <form novalidate @submit.prevent="handleSubmit">
        <section>
          <h2 class="section-title mb-4">{{ t(`${i18nNamespace}.${sectionLabelKey}`) }}</h2>
          <div class="space-y-3">
            <div v-for="i in Math.ceil(items.length / 2)" :key="i" class="flex">
              <button
                v-for="(item, offset) in items.slice((i - 1) * 2, i * 2)"
                :key="item"
                type="button"
                class="chip flex-1"
                :class="[
                  (i - 1) * 2 + offset === data.index ? 'chip-selected' : 'chip-unselected',
                  items.length % 2 === 0 || i * 2 <= items.length ? 'mr-3' : '',
                ]"
                @click="data.index = (i - 1) * 2 + offset"
              >
                {{ item }}
              </button>
            </div>
          </div>
          <p v-if="errors.index" class="mt-2 text-small text-danger">
            {{ errors.index }}
          </p>
        </section>

        <section>
          <h2 class="section-title mt-6 mb-4">{{ t(`${i18nNamespace}.${textareaLabelKey}`) }}</h2>
          <textarea
            v-model="data.content"
            :maxlength="MAX_REPORT_CONTENT_LENGTH"
            rows="6"
            class="input-field"
            :placeholder="t(`${i18nNamespace}.${placeholderKey}`)"
            @blur="validateField('content')"
          />
          <p class="text-right text-small text-text-secondary mt-2">
            {{ data.content.length }}/{{ MAX_REPORT_CONTENT_LENGTH }}
          </p>
          <p v-if="errors.content" class="mt-1 text-small text-danger">
            {{ errors.content }}
          </p>
        </section>

        <button type="submit" class="btn-primary mt-6" :disabled="isSubmitting">
          {{ t(`${i18nNamespace}.${submitKey}`) }}
        </button>
      </form>
    </main>

    <ResultModal v-if="modal" :type="modal.type" :message="modal.message" @close="closeModal" />
  </div>
</template>
