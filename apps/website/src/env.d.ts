interface ImportMetaEnv {
  readonly VITE_APP_ID: string
  readonly VITE_APP_KEY: string
  readonly VITE_ACCESS_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
