<script setup lang="ts">
const route = useRoute()

const { data: page } = await useAsyncData(`doc-${route.path}`, () =>
  queryCollection('docs').path(route.path).first(),
)

useSeoMeta({
  title: () =>
    page.value?.title ? `${page.value.title} · Vois WebView 文档` : 'Vois WebView 文档',
  description: () =>
    page.value?.description ??
    'Vois WebView 的接口、Native 契约、工程研究与真机对照文档。',
})

if (!page.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Page not found',
    fatal: true,
  })
}

const { data: surround } = await useAsyncData(`doc-${route.path}-surround`, () =>
  queryCollectionItemSurroundings('docs', route.path, {
    fields: ['title', 'description', 'path'],
  }),
)
</script>

<template>
  <UPage v-if="page">
    <template #right>
      <UContentToc v-if="page.body?.toc?.links?.length" :links="page.body.toc.links" />
    </template>

    <UPageBody>
      <ContentRenderer :value="page" />
      <template v-if="surround?.length">
        <USeparator />
        <UContentSurround :surround="surround" />
      </template>
    </UPageBody>
  </UPage>
</template>
