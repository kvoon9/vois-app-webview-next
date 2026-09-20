<script setup lang="ts">
import { useQRCode } from '@vueuse/integrations/useQRCode'

const props = defineProps<{
  /** What the code encodes. */
  value: string
  /** Shown under the code so a sheet of them stays identifiable. */
  label: string
}>()

/** 512px keeps the code sharp when the card is scaled up on a desktop screen. */
const src = useQRCode(() => props.value, { width: 512, margin: 2 })
</script>

<template>
  <figure class="panel flex flex-col items-center p-3">
    <img :src="src" :alt="label" class="w-full h-auto" />
    <figcaption class="mt-2 w-full text-center text-small break-all text-text-secondary">
      {{ label }}
    </figcaption>
  </figure>
</template>
