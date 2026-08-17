<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
import PageHeader from '~/components/PageHeader.vue'

const route = useRoute()
</script>

<template>
  <RouterView v-if="route.name !== '/settings'" />
  <div v-else class="min-h-screen min-h-svh bg-surface text-text-primary">
    <PageHeader :title="$t('settings.title')" />

    <main class="p-4">
      <div class="space-y-3">
        <RouterLink
          v-for="item in ['friends', 'groups']"
          :key="item"
          :to="`/settings/${item}`"
          class="card min-h-16 w-full flex items-center justify-between text-left"
        >
          <span class="text-body font-medium">{{ $t(`settings.${item}`) }}</span>
          <span aria-hidden="true" class="text-text-secondary">›</span>
        </RouterLink>

        <button
          type="button"
          class="card min-h-16 w-full flex items-center justify-between text-left disabled:cursor-default"
          disabled
        >
          <span class="text-body font-medium">{{ $t('settings.devices') }}</span>
          <span class="rounded-small bg-surface-muted px-2 py-1 text-small text-text-secondary">
            {{ $t('settings.pending') }}
          </span>
        </button>
      </div>
    </main>
  </div>
</template>
