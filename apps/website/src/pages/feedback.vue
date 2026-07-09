<script setup lang="ts">
import { shallowRef } from 'vue'
import PageHeader from '~/components/PageHeader.vue'

const categories = ['General', 'Chat', 'Device', 'Design', 'Connection', 'Account']
const selectedCategory = shallowRef('General')
const feedbackText = shallowRef('')
const maxLength = 500

function handleSubmit() {
  // No-op: form submission will be wired up later.
}
</script>

<template>
  <div class="min-h-svh bg-surface text-text-primary">
    <PageHeader title="Submit a feedback" />
    <main class="p-4">
      <form @submit.prevent="handleSubmit">
        <section>
          <h2 class="section-title mb-4">Category</h2>
          <div class="space-y-3">
            <div v-for="i in Math.ceil(categories.length / 2)" :key="i" class="flex">
              <button
                v-for="category in categories.slice((i - 1) * 2, i * 2)"
                :key="category"
                type="button"
                class="chip flex-1"
                :class="[
                  category === selectedCategory ? 'chip-selected' : 'chip-unselected',
                  categories.length % 2 === 0 || i * 2 <= categories.length ? 'mr-3' : '',
                ]"
                @click="selectedCategory = category"
              >
                {{ category }}
              </button>
            </div>
          </div>
        </section>

        <section>
          <h2 class="section-title mt-6 mb-4">Your feedback</h2>
          <textarea
            v-model="feedbackText"
            :maxlength="maxLength"
            rows="6"
            class="input-field"
            placeholder="Tell us what you think."
          />
          <p class="text-right text-small text-text-secondary mt-2">
            {{ feedbackText.length }}/{{ maxLength }}
          </p>
        </section>

        <button type="submit" class="btn-primary mt-6">Submit</button>
      </form>
    </main>
  </div>
</template>
