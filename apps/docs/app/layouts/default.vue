<script setup lang="ts">
const { data: navigation } = await useAsyncData('docs-navigation', () =>
  queryCollectionNavigation('docs'),
)
</script>

<template>
  <div>
    <UHeader title="Vois WebView 文档">
      <template #right>
        <UButton
          to="https://github.com/kvoon9/vois-app-webview-next"
          target="_blank"
          icon="i-lucide-github"
          color="neutral"
          variant="ghost"
          aria-label="GitHub"
        />
      </template>
    </UHeader>

    <UMain>
      <UContainer>
        <UPage>
          <template #left>
            <UPageAside>
              <UContentNavigation v-if="navigation?.length" :navigation="navigation" />
            </UPageAside>
          </template>
          <slot />
        </UPage>
      </UContainer>
    </UMain>
  </div>
</template>
