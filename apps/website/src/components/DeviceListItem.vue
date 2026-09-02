<script setup lang="ts">
import Avatar from '~/components/Avatar.vue'

withDefaults(
  defineProps<{
    avatar?: string | null
    imei?: string
    name: string
    online?: boolean
    product?: string
    userNum?: string
  }>(),
  {
    avatar: null,
    imei: '',
    online: undefined,
    product: '',
    userNum: '',
  },
)

defineEmits<{
  click: []
}>()
</script>

<template>
  <li class="card flex items-center" :class="{ 'opacity-60': online === false }">
    <button
      type="button"
      class="min-w-0 flex flex-1 items-center text-left"
      @click="$emit('click')"
    >
      <Avatar :name="name" :src="avatar" :online="online" :show-status="online !== undefined" />
      <span class="ml-3 min-w-0 flex-1">
        <span class="block truncate text-body font-medium">{{ name }}</span>
        <span v-if="product || imei" class="mt-0.5 block truncate text-small text-text-secondary">
          {{ product }}<template v-if="product && imei"> · </template
          ><template v-if="imei">IMEI {{ imei }}</template>
        </span>
        <span v-else-if="userNum" class="mt-0.5 block truncate text-small text-text-secondary">
          {{ userNum }}
        </span>
      </span>
      <span aria-hidden="true" class="ml-2 flex-none text-text-secondary">›</span>
    </button>
  </li>
</template>
