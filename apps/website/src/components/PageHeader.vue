<script setup lang="ts">
import { useRouter } from 'vue-router'

defineProps<{
  title: string
}>()

const router = useRouter()
</script>

<template>
  <header
    class="sticky top-0 z-10 h-14 flex items-center justify-center border-b border-stroke bg-surface"
  >
    <button
      type="button"
      class="absolute left-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11"
      aria-label="Back"
      @click="router.back()"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="text-text-primary"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
    </button>
    <h1 class="page-title">{{ title }}</h1>
  </header>
</template>
