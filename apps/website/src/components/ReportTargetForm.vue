<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import BaseModal from '~/components/BaseModal.vue'
import PageHeader from '~/components/PageHeader.vue'
import { weilaFetch } from '~/utils/api'

const props = defineProps<{
  target: 'user' | 'group'
}>()

const route = useRoute()
const { t, tm } = useI18n({ useScope: 'global' })

const reasons = computed(() => tm('reportTarget.reasons') as string[])
const selectedReasonIndex = shallowRef(0)
const content = shallowRef('')
const isSubmitting = shallowRef(false)
const modalMessage = shallowRef('')
const title = computed(() => t(`reportTarget.${props.target}.title`))
const targetId = computed(() => {
  const rawId = route.query.id
  if (typeof rawId !== 'string' || !/^[1-9]\d*$/.test(rawId)) return null

  const id = Number(rawId)
  return Number.isSafeInteger(id) ? id : null
})

async function handleSubmit(): Promise<void> {
  if (isSubmitting.value) return
  if (targetId.value === null) {
    modalMessage.value = t('reportTarget.invalidId')
    return
  }

  isSubmitting.value = true
  try {
    const response = await weilaFetch<void>(`/v2/feedback/report-${props.target}`, {
      body: {
        id: targetId.value,
        type: reasons.value[selectedReasonIndex.value],
        content: content.value.trim(),
      },
    })
    content.value = ''
    modalMessage.value = response.errmsg
  } catch (error) {
    modalMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="min-h-svh bg-surface text-text-primary">
    <PageHeader :title="title" />

    <main class="p-4">
      <form @submit.prevent="handleSubmit">
        <fieldset>
          <legend class="mb-3 text-2nd-body font-semibold">
            {{ $t('reportTarget.selectReasons') }}
          </legend>
          <div class="overflow-hidden rounded-standard bg-surface-field">
            <label
              v-for="(reason, index) in reasons"
              :key="reason"
              class="min-h-13 flex cursor-pointer items-center border border-transparent px-6 text-2nd-body"
              :class="index === selectedReasonIndex ? 'border-primary bg-surface-selected' : ''"
            >
              <input
                v-model="selectedReasonIndex"
                class="sr-only"
                type="radio"
                name="reason"
                :value="index"
              />
              {{ reason }}
            </label>
          </div>
        </fieldset>

        <label class="mt-8 mb-3 block text-2nd-body font-semibold" for="report-remark">
          {{ $t('reportTarget.remark') }}
        </label>
        <textarea
          id="report-remark"
          v-model="content"
          :maxlength="500"
          rows="5"
          class="input-field min-h-29 text-2nd-body"
          :placeholder="$t(`reportTarget.${target}.placeholder`)"
        />

        <button type="submit" class="btn-primary mt-4" :disabled="isSubmitting">
          {{ $t('reportTarget.submit') }}
        </button>
      </form>
    </main>

    <BaseModal
      v-if="modalMessage"
      :title="title"
      :cancel-text="$t('modal.cancel')"
      :confirm-text="$t('modal.confirm')"
      @cancel="modalMessage = ''"
      @confirm="modalMessage = ''"
    >
      {{ modalMessage }}
    </BaseModal>
  </div>
</template>
