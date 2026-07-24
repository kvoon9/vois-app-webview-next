<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import {
  integer,
  maxLength,
  maxValue,
  minValue,
  nonEmpty,
  number,
  object,
  pipe,
  safeInteger,
  string,
  trim,
} from 'valibot'
import PageHeader from '~/components/PageHeader.vue'
import ResultModal from '~/components/ResultModal.vue'
import { useFormValidation } from '~/composables/useFormValidation'
import { weilaFetch } from '~/utils/api'

const props = defineProps<{
  target: 'user' | 'group'
}>()

const route = useRoute()
const { t, tm } = useI18n({ useScope: 'global' })

const reasons = computed(() => tm('reportTarget.reasons') as string[])

const title = computed(() => t(`reportTarget.${props.target}.title`))
const targetId = computed(() => {
  const rawId = route.query.id
  if (typeof rawId !== 'string' || !/^[1-9]\d*$/.test(rawId)) return null

  const id = Number(rawId)
  return Number.isSafeInteger(id) ? id : null
})

const schema = object({
  targetId: pipe(number(), integer(), minValue(1), safeInteger()),
  reasonIndex: pipe(number(), minValue(0), maxValue(reasons.value.length - 1)),
  content: pipe(string(), trim(), nonEmpty(), maxLength(500)),
})

const { data, errors, resetErrors, validate, validateField } = useFormValidation(schema, () => ({
  targetId: targetId.value ?? 0,
  reasonIndex: 0,
  content: '',
}))

const isSubmitting = shallowRef(false)
const modal = shallowRef<{ type: 'success' | 'error'; message: string } | null>(null)

async function handleSubmit(): Promise<void> {
  if (isSubmitting.value) return

  const isValid = await validate()
  if (!isValid) {
    if (errors.value.targetId) {
      modal.value = { type: 'error', message: t('reportTarget.invalidId') }
    }
    return
  }

  isSubmitting.value = true
  try {
    const response = await weilaFetch<void>(`/v2/feedback/report-${props.target}`, {
      body: {
        id: data.value.targetId,
        type: reasons.value[data.value.reasonIndex],
        content: data.value.content.trim(),
      },
    })
    data.value.content = ''
    resetErrors()
    modal.value = { type: 'success', message: response.errmsg }
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
    <PageHeader :title="title" />

    <main class="p-4">
      <form novalidate @submit.prevent="handleSubmit">
        <fieldset>
          <legend class="mb-3 text-2nd-body font-semibold">
            {{ $t('reportTarget.selectReasons') }}
          </legend>
          <div class="overflow-hidden rounded-standard bg-surface-field">
            <label
              v-for="(reason, index) in reasons"
              :key="reason"
              class="min-h-13 flex cursor-pointer items-center border border-transparent px-6 text-2nd-body"
              :class="index === data.reasonIndex ? 'border-primary bg-surface-selected' : ''"
            >
              <input
                v-model="data.reasonIndex"
                class="sr-only"
                type="radio"
                name="reason"
                :value="index"
                @blur="validateField('reasonIndex')"
              />
              {{ reason }}
            </label>
          </div>
          <p v-if="errors.reasonIndex" class="mt-2 text-small text-danger">
            {{ errors.reasonIndex }}
          </p>
        </fieldset>

        <label class="mt-8 mb-3 block text-2nd-body font-semibold" for="report-remark">
          {{ $t('reportTarget.remark') }}
        </label>
        <textarea
          id="report-remark"
          v-model="data.content"
          :maxlength="500"
          rows="5"
          class="input-field min-h-29 text-2nd-body"
          :placeholder="$t(`reportTarget.${target}.placeholder`)"
          @blur="validateField('content')"
        />
        <p v-if="errors.content" class="mt-2 text-small text-danger">
          {{ errors.content }}
        </p>

        <button type="submit" class="btn-primary mt-4" :disabled="isSubmitting">
          {{ $t('reportTarget.submit') }}
        </button>
      </form>
    </main>

    <ResultModal v-if="modal" :type="modal.type" :message="modal.message" @close="modal = null" />
  </div>
</template>
