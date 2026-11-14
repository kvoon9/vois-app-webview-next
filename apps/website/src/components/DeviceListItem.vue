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
    <button
      type="button"
      class="w-full rounded-standard bg-surface-online px-3 py-3 flex items-center text-left"
      @click="$emit('click')"
    >
      <Avatar :name="name" :src="avatar" />
      <span class="ml-3 min-w-0 flex-1">
        <span class="block truncate text-2nd-body font-medium">{{ name }}</span>
        <span class="mt-0.5 flex items-center text-small text-text-secondary">
          <span v-if="product" class="truncate">{{ product }}</span>
          <span
            v-if="icon"
            class="ml-2 flex flex-none items-center space-x-1"
            :class="battery < 20 ? 'text-danger' : undefined"
          >
            <span :class="icon" aria-hidden="true" />
            <span class="sr-only">{{ t('device.battery') }}</span>
            <span>{{ battery }}%</span>
          </span>
        </span>
      </span>
    </button>
  </li>
</template>
