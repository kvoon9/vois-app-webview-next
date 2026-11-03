<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Avatar from '~/components/Avatar.vue'
import { batteryIcon } from '~/utils/battery'

const props = withDefaults(
  defineProps<{
    avatar?: string | null
    name: string
    product?: string
    /** 0-100; 0 means the reading expired, so the row shows nothing. */
    battery?: number
  }>(),
  {
    avatar: null,
    product: '',
    battery: 0,
  },
)

defineEmits<{
  click: []
}>()

const { t } = useI18n({ useScope: 'global' })

const icon = computed(() => batteryIcon(props.battery))
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
      <span
        v-if="icon"
        class="ml-2 flex flex-none items-center space-x-1 text-small"
        :class="battery < 20 ? 'text-danger' : 'text-text-secondary'"
      >
        <span :class="icon" aria-hidden="true" />
        <span class="sr-only">{{ t('device.battery') }}</span>
        <span>{{ battery }}%</span>
      </span>
      <span class="row-chevron" aria-hidden="true" />
    </button>
  </li>
</template>
