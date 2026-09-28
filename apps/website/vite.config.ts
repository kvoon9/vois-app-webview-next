import { homedir } from 'node:os'
import { join } from 'node:path'
import { defineConfig, loadEnv } from 'vite-plus'
import vue from '@vitejs/plugin-vue'
import unocss from 'unocss/vite'
import legacy from '@vitejs/plugin-legacy'
import VueRouter from 'vue-router/vite'
import vueDevtools from 'vite-plugin-vue-devtools'
import { vconsoleDev } from './plugins/vconsole-dev.ts'

// The debug plugin is pnpm-linked from a sibling repo, so CI (and anyone who has
// not cloned it) has no resolvable copy. It only ever activates for serve/preview,
// so a missing copy disables it instead of breaking the build.
async function webviewDebugPlugin(preview: boolean) {
  try {
    const { voisWebviewDebug } = await import('vite-plugin-vois-webview-debug')
    return voisWebviewDebug({ preview })
  } catch {
    console.warn('[vite] vite-plugin-vois-webview-debug not installed; WebView debug disabled')
    return undefined
  }
}

/** Machine-global config directory; every worktree shares one `.env`. */
const voisConfigDir = join(homedir(), '.vois')

export default defineConfig(async ({ isPreview, command, mode }) => {
  const env = loadEnv(mode, voisConfigDir, 'VITE_')
  const apiTarget = env.VITE_API_TARGET || 'https://api.voischat.cn'
  // Group management went real first; everything else still targets the mock.
  const subuserApiTarget = env.VITE_SUBUSER_API_TARGET || 'https://api.voischat.cn'

  // Fail loudly instead of shipping a bundle where appid/sign silently become
  // "undefined" (errcode 31). CI supplies both as secrets.
  if (command === 'build') {
    if (!env.VITE_APP_ID || !env.VITE_APP_KEY) {
      throw new Error(
        `VITE_APP_ID and VITE_APP_KEY are required for build; set them in ${join(voisConfigDir, '.env')} (see .env.example)`,
      )
    }
  }

  return {
    base: './',
    // One `.env` for every worktree, so nothing is copied into a fresh checkout. CI has
    // no such directory and injects the same names through `process.env`, which `loadEnv`
    // merges over the files.
    envDir: voisConfigDir,
    server: {
      host: true,
      port: 3021,
      forwardConsole: true,
      proxy: {
        '/v2/subuser': {
          target: subuserApiTarget,
          changeOrigin: true,
        },
        '/v2': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: true,
      port: 5173,
      proxy: {
        '/v2/subuser': {
          target: subuserApiTarget,
          changeOrigin: true,
        },
        '/v2': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    plugins: [
      ...(isPreview ? [vconsoleDev()] : []),
      await webviewDebugPlugin(process.argv.includes('--debug')),
      vueDevtools(),
      VueRouter({ dts: 'src/route-map.d.ts' }),
      vue(),
      unocss(),
      legacy({
        targets: ['chrome 83'],
        modernTargets: ['chrome 83'],
        modernPolyfills: true,
      }),
    ],
    resolve: {
      alias: {
        '~/': '/src/',
      },
    },
  }
})
