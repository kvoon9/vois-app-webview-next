<script setup lang="ts">
import { useCounter } from '@vueuse/core'

const { count, inc } = useCounter()
</script>

<template>
  <button
    type="button"
    class="font-mono inline-flex rounded-[5px] text-[#aa3bff] dark:text-[#c084fc] bg-[rgba(170,59,255,0.1)] dark:bg-[rgba(192,132,252,0.15)] border-2 border-transparent transition-[border-color] duration-300 mb-6 text-base px-[10px] py-[5px] hover:border-[rgba(170,59,255,0.5)] dark:hover:border-[rgba(192,132,252,0.5)] focus-visible:outline-2 focus-visible:outline-[#aa3bff] dark:focus-visible:outline-[#c084fc] focus-visible:outline-offset-2"
    @click="inc()"
  >
    Count is {{ count }}
  </button>
</template>
