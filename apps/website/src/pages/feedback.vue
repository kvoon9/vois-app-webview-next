<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from '~/components/BaseModal.vue'
import PageHeader from '~/components/PageHeader.vue'
import { weilaFetch } from '~/utils/api'

const { tm } = useI18n({ useScope: 'global' })

const categories = computed(() => tm('feedback.categories') as string[])
const selectedCategoryIndex = shallowRef(0)
const feedbackText = shallowRef('')
const isSubmitting = shallowRef(false)
const modalMessage = shallowRef('')
const maxLength = 500

async function handleSubmit(): Promise<void> {
  if (isSubmitting.value) return

  isSubmitting.value = true
  try {
    const response = await weilaFetch<void>('/v2/feedback/submit-feedback', {
      body: {
        type: categories.value[selectedCategoryIndex.value],
        content: feedbackText.value.trim(),
      },
    })
    feedbackText.value = ''
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
    <PageHeader :title="$t('feedback.title')" />
    <main class="p-4">
      <form @submit.prevent="handleSubmit">
        <section>
          <h2 class="section-title mb-4">{{ $t('feedback.category') }}</h2>
          <div class="space-y-3">
            <div v-for="i in Math.ceil(categories.length / 2)" :key="i" class="flex">
              <button
                v-for="(category, offset) in categories.slice((i - 1) * 2, i * 2)"
                :key="category"
                type="button"
                class="chip flex-1"
                :class="[
                  (i - 1) * 2 + offset === selectedCategoryIndex
                    ? 'chip-selected'
                    : 'chip-unselected',
                  categories.length % 2 === 0 || i * 2 <= categories.length ? 'mr-3' : '',
                ]"
                @click="selectedCategoryIndex = (i - 1) * 2 + offset"
              >
                {{ category }}
              </button>
            </div>
          </div>
        </section>

        <section>
          <h2 class="section-title mt-6 mb-4">{{ $t('feedback.yourFeedback') }}</h2>
          <textarea
            v-model="feedbackText"
            :maxlength="maxLength"
            required
            rows="6"
            class="input-field"
            :placeholder="$t('feedback.placeholder')"
          />
          <p class="text-right text-small text-text-secondary mt-2">
            {{ feedbackText.length }}/{{ maxLength }}
          </p>
        </section>

        <button type="submit" class="btn-primary mt-6" :disabled="isSubmitting">
          {{ $t('feedback.submit') }}
        </button>
      </form>
    </main>

    <BaseModal
      v-if="modalMessage"
      :title="$t('feedback.title')"
      :cancel-text="$t('modal.cancel')"
      :confirm-text="$t('modal.confirm')"
      @cancel="modalMessage = ''"
      @confirm="modalMessage = ''"
    >
      {{ modalMessage }}
    </BaseModal>
  </div>
</template>
