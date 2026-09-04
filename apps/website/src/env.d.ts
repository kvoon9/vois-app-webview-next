interface ImportMetaEnv {
  readonly VITE_APP_ID: string
  readonly VITE_APP_KEY: string
  readonly VITE_ACCESS_TOKEN?: string
  readonly VITE_AMAP_KEY?: string
  readonly VITE_AMAP_SECURITY_CODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
