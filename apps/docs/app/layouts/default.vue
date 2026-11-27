<script setup lang="ts">
const { data: navigation } = await useAsyncData('docs-navigation', () =>
  queryCollectionNavigation('docs'),
)
const { open: searchOpen } = useContentSearch()
const { status: searchStatus, search: searchDocs, init: initSearch } = useSearchCollection(
  'docs',
  { immediate: false },
)
const { displayNavigation, searchNavigation, searchLinks } = useDocsNavigation(navigation)

watch(searchOpen, (open) => {
  if (open) initSearch()
})
</script>

<template>
  <div>
    <UHeader title="Vois WebView 文档" to="/">
      <template #left>
        <NuxtLink to="/" class="flex items-center space-x-2 text-highlighted">
          <UIcon name="i-lucide-book-open" class="size-5 text-primary" />
          <span class="font-semibold">
            <span class="min-[360px]:hidden">Vois 文档</span>
            <span class="hidden min-[360px]:inline">Vois WebView 文档</span>
          </span>
        </NuxtLink>
      </template>

      <template #right>
        <UContentSearchButton :collapsed="false" label="搜索文档" class="hidden sm:inline-flex" />
        <UContentSearchButton label="搜索文档" class="sm:hidden" />
        <UColorModeButton />
        <UButton
          to="https://github.com/kvoon9/vois-app-webview-next"
          target="_blank"
          icon="i-lucide-github"
          color="neutral"
          variant="ghost"
          aria-label="GitHub"
          class="hidden sm:inline-flex"
        />
      </template>

      <template #body>
        <div class="max-h-[calc(100vh-4rem)] overflow-y-auto p-4">
          <DocsNavigation :key="$route.path" :navigation="displayNavigation" />
          <div class="mt-6 border-t border-default pt-4">
            <UButton
              to="https://github.com/kvoon9/vois-app-webview-next"
              target="_blank"
              icon="i-lucide-github"
              label="GitHub 仓库"
              color="neutral"
              variant="ghost"
              block
            />
          </div>
        </div>
      </template>
    </UHeader>

    <UMain>
      <UContainer>
        <UPage>
          <template #left>
            <UPageAside>
              <DocsNavigation :key="$route.path" :navigation="displayNavigation" />
            </UPageAside>
          </template>
          <slot />
        </UPage>
      </UContainer>
    </UMain>

    <UContentSearch
      :search="searchDocs"
      :search-status="searchStatus"
      :navigation="searchNavigation"
      :links="searchLinks"
      placeholder="搜索文档、接口、字段…"
    />
  </div>
</template>
