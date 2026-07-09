<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import PageHeader from '~/components/PageHeader.vue'

const { tm } = useI18n({ useScope: 'global' })

const problemTypes = computed(() => tm('report.types') as string[])
const selectedTypeIndex = shallowRef(0)
const description = shallowRef('')
</script>

<template>
  <div class="min-h-svh bg-surface text-text-primary">
    <PageHeader :title="$t('report.title')" />
    <main class="p-4">
      <form @submit.prevent>
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
          rows="6"
          class="input-field"
          :placeholder="$t('report.placeholder')"
        />
        <p class="text-right text-small text-text-secondary mt-2">{{ description.length }}/500</p>

        <button type="submit" class="btn-primary mt-6">{{ $t('report.report') }}</button>
      </form>
    </main>
  </div>
</template>
