<script setup lang="ts">
import Avatar from '~/components/Avatar.vue'

withDefaults(
  defineProps<{
    avatar?: string | null
    name: string
    product?: string
  }>(),
  {
    avatar: null,
    product: '',
  },
)

defineEmits<{
  click: []
}>()
</script>

<template>
  <li>
    <!-- The button owns the card fill so the whole row is the tap target. -->
    <button type="button" class="w-full card flex items-center text-left" @click="$emit('click')">
      <Avatar :name="name" :src="avatar" />
      <span class="ml-3 min-w-0 flex-1">
        <span class="block truncate text-body font-medium">{{ name }}</span>
        <span v-if="product" class="mt-0.5 block truncate text-small text-text-secondary">
          {{ product }}
        </span>
      </span>
      <span class="row-chevron" aria-hidden="true" />
    </button>
  </li>
</template>
