import type { ContentNavigationItem } from '@nuxt/content'
import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'

export interface DocsNavItem extends ContentNavigationItem {
  icon?: string
  badge?: string | number
  defaultOpen?: boolean
  children?: DocsNavItem[]
}

const API_INDEX = '/api-reference/weila-webapi/readme'

const SHORT_TITLES: Record<string, string> = {
  '/api/ai-translation-settings-api-requirements': 'AI 翻译设置',
  '/api/device-management-api-requirements': '设备管理 v2 接口',
  '/engineering/bridge-5.0.8-additions': 'App 5.0.8 桥接变更',
  '/engineering/bridge-token-redesign': 'Bridge 与 token 获取',
  '/engineering/intl-polyfill-research': 'Intl polyfill 研究',
  '/engineering/realtime-location-bridge': '实时定位 Bridge',
  '/engineering/mcp-debug-server': 'MCP 调试服务',
  '/parity/comparison-report-round4': '第 4 轮对比',
  '/parity/comparison-report-round5': '第 5 轮对比',
}

const flatten = (items: ContentNavigationItem[]): ContentNavigationItem[] =>
  items.flatMap((item) => [item, ...(item.children ? flatten(item.children) : [])])

const countLeaves = (items: ContentNavigationItem[] = []): number =>
  items.reduce(
    (count, item) => count + (item.children?.length ? countLeaves(item.children) : 1),
    0,
  )

export function useDocsNavigation(
  source: MaybeRefOrGetter<ContentNavigationItem[] | null | undefined>,
) {
  const route = useRoute()
  const currentPath = computed(() => route.path.replace(/\/+$/, '') || '/')

  const itemsByPath = computed(
    () => new Map(flatten(toValue(source) ?? []).map((item) => [item.path, item])),
  )

  const find = (path: string) => itemsByPath.value.get(path)

  const retitleChildren = (items?: ContentNavigationItem[]): DocsNavItem[] | undefined =>
    items?.map((item) => ({ ...item, title: SHORT_TITLES[item.path] ?? item.title }))

  const buildDisplayNavigation = (): DocsNavItem[] => {
    const api = find('/api-reference')
    const apiNeeds = find('/api')
    const native = find('/native')
    const engineering = find('/engineering')
    const parity = find('/parity')

    const items: Array<DocsNavItem | undefined> = [
      { title: '文档总览', path: '/', icon: 'i-lucide-house' },
      {
        title: 'API 参考',
        path: API_INDEX,
        icon: 'i-lucide-braces',
        badge: api ? String(countLeaves(api.children) - 1) : undefined,
      },
      apiNeeds
        ? {
            ...apiNeeds,
            title: 'API 需求',
            icon: 'i-lucide-list-checks',
            children: retitleChildren(apiNeeds.children),
          }
        : undefined,
      native ? { ...native, title: 'Native 契约', icon: 'i-lucide-smartphone' } : undefined,
      engineering
        ? {
            ...engineering,
            title: '工程研究',
            icon: 'i-lucide-flask-conical',
            children: retitleChildren(engineering.children),
          }
        : undefined,
      {
        title: '设备管理',
        path: '#device-management',
        icon: 'i-lucide-monitor-smartphone',
        children: [
          { title: '复刻可行性', path: '/device-management-feasibility' },
          { title: '现状与缺口', path: '/device-management-status' },
          { title: '首轮验证记录', path: '/device-management-verification' },
          { title: 'UI/UX 对齐清单', path: '/uiux-alignment-plan' },
        ],
      },
      parity
        ? {
            title: '真机对照',
            path: parity.path,
            icon: 'i-lucide-images',
            children: retitleChildren(parity.children),
          }
        : undefined,
    ]

    return items.filter((item): item is DocsNavItem => Boolean(item))
  }

  const containsPath = (item: DocsNavItem, path: string): boolean =>
    item.path === path || (item.children?.some((child) => containsPath(child, path)) ?? false)

  const withOpenState = (items: DocsNavItem[]): DocsNavItem[] =>
    items.map((item) => ({
      ...item,
      defaultOpen: containsPath(item, currentPath.value),
      children: item.children ? withOpenState(item.children) : undefined,
    }))

  const displayNavigation = computed(() => withOpenState(buildDisplayNavigation()))

  // Search results are grouped by navigation ancestors. The display tree keeps
  // the 44 endpoints out of the sidebar, but search still needs every path, so
  // flatten the API tree under one group to keep result prefixes short.
  const searchNavigation = computed<DocsNavItem[]>(() =>
    buildDisplayNavigation().map((item) => {
      if (item.path !== API_INDEX) return item
      const api = find('/api-reference')
      const endpoints = flatten(api?.children ?? [])
        .filter((leaf) => !leaf.children?.length)
        .map((leaf) => ({
          title: leaf.path === API_INDEX ? '接口总览' : leaf.title,
          path: leaf.path,
        }))
      return {
        title: 'API 参考',
        path: '#api-reference-search',
        icon: 'i-lucide-braces',
        children: endpoints,
      }
    }),
  )

  const searchLinks = [
    { label: '文档总览', icon: 'i-lucide-house', to: '/' },
    { label: 'API 参考', icon: 'i-lucide-braces', to: API_INDEX },
    { label: 'Native 契约', icon: 'i-lucide-smartphone', to: '/native/bridge-contract' },
  ]

  return { displayNavigation, searchNavigation, searchLinks }
}
