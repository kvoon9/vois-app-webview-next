<script setup lang="ts">
import { shallowRef } from 'vue'
import PageHeader from '~/components/PageHeader.vue'

const selectedType = shallowRef('Audio')
const description = shallowRef('')

const problemTypes = ['Audio', 'Message', 'Device', 'Account', 'Connection', 'Other']
</script>

<template>
  <div class="min-h-svh bg-surface text-text-primary">
    <PageHeader title="Report a problem" />
    <main class="p-4">
      <form @submit.prevent>
        <h2 class="section-title mb-4">Problem type</h2>
        <div class="space-y-3">
          <div v-for="i in Math.ceil(problemTypes.length / 2)" :key="i" class="flex">
            <button
              v-for="type in problemTypes.slice((i - 1) * 2, i * 2)"
              :key="type"
              type="button"
              class="chip flex-1"
              :class="[
                selectedType === type ? 'chip-selected' : 'chip-unselected',
                problemTypes.length % 2 === 0 || i * 2 <= problemTypes.length ? 'mr-3' : '',
              ]"
              @click="selectedType = type"
            >
              {{ type }}
            </button>
          </div>
        </div>

        <h2 class="section-title mt-6 mb-4">What happened?</h2>
        <textarea
          v-model="description"
          :maxlength="500"
          rows="6"
          class="input-field"
          placeholder="Describe the problem."
        />
        <p class="text-right text-small text-text-secondary mt-2">{{ description.length }}/500</p>

        <button type="submit" class="btn-primary mt-6">Report</button>
      </form>
    </main>
  </div>
</template>
