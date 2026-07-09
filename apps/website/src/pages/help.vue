<script setup lang="ts">
import { shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '~/components/PageHeader.vue'

const router = useRouter()

const questions = [
  'How do I connect my hardware device?',
  'Can I use the app without hardware devices?',
  'How do I create a new channel?',
  'How do I manage my privacy settings?',
  'What devices are compatible with the app?',
]

const expandedIndex = shallowRef<number | null>(null)

function toggleQuestion(index: number) {
  expandedIndex.value = expandedIndex.value === index ? null : index
}

function navigateTo(path: string) {
  router.push(path)
}
</script>

<template>
  <div class="min-h-svh bg-surface text-text-primary">
    <PageHeader title="Help" />
    <main class="p-4">
      <h2 class="section-title mb-4">Frequently asked questions</h2>
      <div class="space-y-3">
        <button
          v-for="(question, index) in questions"
          :key="index"
          type="button"
          class="card w-full flex items-center justify-between text-left"
          @click="toggleQuestion(index)"
        >
          <span class="text-body pr-4">{{ question }}</span>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            class="flex-shrink-0 transition-transform duration-200"
            :class="{ 'rotate-90': expandedIndex === index }"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M9 18L15 12L9 6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>

      <h2 class="section-title mt-8 mb-4">Contact us</h2>
      <div class="space-y-3">
        <button
          type="button"
          class="card w-full flex items-center justify-between text-left"
          @click="navigateTo('/feedback')"
        >
          <span class="text-body">Submit a feedback</span>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M18 13V19C18 19.5304 17.7893 20.0391 17.4142 20.4142C17.0391 20.7893 16.5304 21 16 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V8C3 7.46957 3.21071 6.96086 3.58579 6.58579C3.96086 6.21071 4.46957 6 5 6H11"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M15 3H21V9"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M10 14L21 3"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          class="card w-full flex items-center justify-between text-left"
          @click="navigateTo('/report')"
        >
          <span class="text-body">Report a problem</span>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M18 13V19C18 19.5304 17.7893 20.0391 17.4142 20.4142C17.0391 20.7893 16.5304 21 16 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V8C3 7.46957 3.21071 6.96086 3.58579 6.58579C3.96086 6.21071 4.46957 6 5 6H11"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M15 3H21V9"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M10 14L21 3"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
    </main>
  </div>
</template>
