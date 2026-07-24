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
import { useFormValidation } from '~/composables/useFormValidation'
import { weilaFetch } from '~/utils/api'

const { t, tm } = useI18n({ useScope: 'global' })

const problemTypes = computed(() => Object.values(tm('report.types')) as string[])

const schema = object({
  typeIndex: pipe(number(), minValue(0), maxValue(problemTypes.value.length - 1)),
  content: pipe(
    string(),
    trim(),
    nonEmpty(() => t('validation.required')),
    maxLength(500),
  ),
})

const { data, errors, resetErrors, validate, validateField } = useFormValidation(schema, {
  typeIndex: 0,
  content: '',
})

const isSubmitting = shallowRef(false)
const modal = shallowRef<{ type: 'success' | 'error'; message: string } | null>(null)
const maxContentLength = 500

async function handleSubmit(): Promise<void> {
  if (isSubmitting.value) return

  const isValid = await validate()
  if (!isValid) return

  isSubmitting.value = true
  try {
    const response = await weilaFetch<void>('/v2/feedback/report-problem', {
      body: {
        type: problemTypes.value[data.value.typeIndex],
        content: data.value.content,
      },
    })
    data.value.content = ''
    resetErrors()
    modal.value = { type: 'success', message: response.errmsg || t('modal.successTitle') }
  } catch (error) {
    modal.value = {
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="min-h-svh bg-surface text-text-primary">
    <PageHeader :title="$t('report.title')" />
    <main class="p-4">
      <form novalidate @submit.prevent="handleSubmit">
        <section>
          <h2 class="section-title mb-4">{{ $t('report.problemType') }}</h2>
          <div class="space-y-3">
            <div v-for="i in Math.ceil(problemTypes.length / 2)" :key="i" class="flex">
              <button
                v-for="(type, offset) in problemTypes.slice((i - 1) * 2, i * 2)"
                :key="type"
                type="button"
                class="chip flex-1"
                :class="[
                  (i - 1) * 2 + offset === data.typeIndex ? 'chip-selected' : 'chip-unselected',
                  problemTypes.length % 2 === 0 || i * 2 <= problemTypes.length ? 'mr-3' : '',
                ]"
                @click="data.typeIndex = (i - 1) * 2 + offset"
              >
                {{ type }}
              </button>
            </div>
          </div>
          <p v-if="errors.typeIndex" class="mt-2 text-small text-danger">
            {{ errors.typeIndex }}
          </p>
        </section>

        <section>
          <h2 class="section-title mt-6 mb-4">{{ $t('report.whatHappened') }}</h2>
          <textarea
            id="report-description"
            v-model="data.content"
            :maxlength="maxContentLength"
            rows="6"
            class="input-field"
            :placeholder="$t('report.placeholder')"
            @blur="validateField('content')"
          />
          <p class="text-right text-small text-text-secondary mt-2">
            {{ data.content.length }}/{{ maxContentLength }}
          </p>
          <p v-if="errors.content" class="mt-1 text-small text-danger">
            {{ errors.content }}
          </p>
        </section>

        <button type="submit" class="btn-primary mt-6" :disabled="isSubmitting">
          {{ $t('report.report') }}
        </button>
      </form>
    </main>

    <ResultModal v-if="modal" :type="modal.type" :message="modal.message" @close="modal = null" />
  </div>
</template>
