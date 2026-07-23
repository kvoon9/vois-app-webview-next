<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from '~/components/BaseModal.vue'
import PageHeader from '~/components/PageHeader.vue'
import { weilaFetch } from '~/utils/api'

const { tm } = useI18n({ useScope: 'global' })

const problemTypes = computed(() => tm('report.types') as string[])
const selectedTypeIndex = shallowRef(0)
const description = shallowRef('')
const isSubmitting = shallowRef(false)
const modalMessage = shallowRef('')

async function handleSubmit(): Promise<void> {
  if (isSubmitting.value) return

  isSubmitting.value = true
  try {
    const response = await weilaFetch<void>('/v2/feedback/report-problem', {
      body: {
        type: problemTypes.value[selectedTypeIndex.value],
        content: description.value.trim(),
      },
    })
    description.value = ''
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
    <PageHeader :title="$t('report.title')" />
    <main class="p-4">
      <form @submit.prevent="handleSubmit">
        <h2 class="section-title mb-4">{{ $t('report.problemType') }}</h2>
        <div class="space-y-3">
          <div v-for="i in Math.ceil(problemTypes.length / 2)" :key="i" class="flex">
            <button
              v-for="(type, offset) in problemTypes.slice((i - 1) * 2, i * 2)"
              :key="type"
              type="button"
              class="chip flex-1"
              :class="[
                (i - 1) * 2 + offset === selectedTypeIndex ? 'chip-selected' : 'chip-unselected',
                problemTypes.length % 2 === 0 || i * 2 <= problemTypes.length ? 'mr-3' : '',
              ]"
              @click="selectedTypeIndex = (i - 1) * 2 + offset"
            >
              {{ type }}
            </button>
          </div>
        </div>

        <h2 class="section-title mt-6 mb-4">{{ $t('report.whatHappened') }}</h2>
        <textarea
          v-model="description"
          :maxlength="500"
          required
          rows="6"
          class="input-field"
          :placeholder="$t('report.placeholder')"
        />
        <p class="text-right text-small text-text-secondary mt-2">{{ description.length }}/500</p>

        <button type="submit" class="btn-primary mt-6" :disabled="isSubmitting">
          {{ $t('report.report') }}
        </button>
      </form>
    </main>

    <BaseModal
      v-if="modalMessage"
      :title="$t('report.title')"
      :cancel-text="$t('modal.cancel')"
      :confirm-text="$t('modal.confirm')"
      @cancel="modalMessage = ''"
      @confirm="modalMessage = ''"
    >
      {{ modalMessage }}
    </BaseModal>
  </div>
</template>
