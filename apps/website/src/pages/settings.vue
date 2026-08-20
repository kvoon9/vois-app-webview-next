<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
import PageHeader from '~/components/PageHeader.vue'
import { useAccountId } from '~/composables/useAccountId'

const route = useRoute()
const { accountQuery } = useAccountId()
</script>

<template>
  <RouterView v-if="route.name !== '/settings'" />
  <div v-else class="min-h-screen min-h-svh bg-surface text-text-primary">
    <PageHeader :title="$t('settings.title')" />

    <main class="p-4">
      <div class="space-y-3">
        <RouterLink
          v-for="item in ['friends', 'groups', 'devices']"
          :key="item"
          :to="{ path: `/settings/${item}`, query: accountQuery }"
          class="card min-h-16 w-full flex items-center justify-between text-left"
        >
          <span class="text-body font-medium">{{ $t(`settings.${item}`) }}</span>
          <span aria-hidden="true" class="text-text-secondary">›</span>
        </RouterLink>
      </div>
    </main>
  </div>
</template>
