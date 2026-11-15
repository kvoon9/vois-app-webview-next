import { homedir } from 'node:os'
import { join } from 'node:path'
import { defineConfig, loadEnv } from 'vite-plus'
import { transformWithEsbuild, type Plugin } from 'vite-plus'
import vue from '@vitejs/plugin-vue'
import unocss from 'unocss/vite'
import legacy from '@vitejs/plugin-legacy'
import VueRouter from 'vue-router/vite'
import vueDevtools from 'vite-plugin-vue-devtools'
import { voisBridgeAuth } from '@vois/webview-bridge/vite'
import { captureDebugClient } from './plugins/capture-debug-client.ts'
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

/**
 * Vite+ does not apply `build.target` to JS syntax, so the production build
 * downlevels every final chunk itself. Chunks are transformed before hashing.
 */
function downlevelChunks(target: string): Plugin {
  return {
    name: 'vois-downlevel-chunks',
    enforce: 'post',
    async renderChunk(code, chunk) {
      const result = await transformWithEsbuild(code, chunk.fileName, {
        target,
        minify: true,
      })
      return { code: result.code, map: null }
    },
  }
}

/** Machine-global config directory; every worktree shares one `.env`. */
const voisConfigDir = join(homedir(), '.vois')

export default defineConfig(async ({ isPreview, command, mode }) => {
  const env = loadEnv(mode, voisConfigDir, 'VITE_')
  // All /v2 traffic goes to the real backend; the local mock server is gone.
  const apiTarget = env.VITE_API_TARGET || 'https://api.voischat.cn'
  // Production targets Chrome 70. VOIS_CHROME_TARGET exists to re-measure the
  // runtime floor (the verified lower bound is 64; 63 is blocked by the legacy
  // polyfills' `\p{Emoji}` regex), not to change what ships.
  const chromeTarget = process.env.VOIS_CHROME_TARGET || 'chrome 70'
  const chromeEsbuildTarget = chromeTarget.replace(/\s+/g, '')

  // Fail loudly instead of shipping a bundle where appid/sign silently become
  // "undefined" (errcode 31). CI supplies both as secrets.
  if (command === 'build') {
    if (!env.VITE_APP_ID || !env.VITE_APP_KEY) {
      throw new Error(
        `VITE_APP_ID and VITE_APP_KEY are required for build; set them in ${join(voisConfigDir, '.env')} (see .env.example)`,
      )
    }
  }

  const debugPreview = process.argv.includes('--debug')
  // The capture client reuses the debug plugin's route and record format, so it
  // is only registered when that plugin resolved.
  const webviewDebug = await webviewDebugPlugin(debugPreview)

  return {
    base: './',
    // Match the JS floor so Lightning CSS lowers unsupported properties too.
    build: {
      target: chromeEsbuildTarget,
      cssTarget: chromeEsbuildTarget,
    },
    // One `.env` for every worktree, so nothing is copied into a fresh checkout. CI has
    // no such directory and injects the same names through `process.env`, which `loadEnv`
    // merges over the files.
    envDir: voisConfigDir,
    server: {
      host: true,
      port: 3021,
      forwardConsole: true,
      proxy: {
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
        '/v2': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    plugins: [
      ...(isPreview ? [vconsoleDev()] : []),
      // Mints the debug account's access token over the gateway its API hands out;
      // the bridge's own WebSocket login cannot, and its tokens answer `31 授权失效`.
      voisBridgeAuth(),
      ...(webviewDebug ? [captureDebugClient({ preview: debugPreview })] : []),
      webviewDebug,
      vueDevtools(),
      VueRouter({ dts: 'src/route-map.d.ts' }),
      vue(),
      unocss(),
      legacy({
        targets: [chromeTarget],
        modernTargets: [chromeTarget],
        modernPolyfills: true,
      }),
      ...(chromeTarget === 'chrome 83' ? [] : [downlevelChunks(chromeEsbuildTarget)]),
    ],
    resolve: {
      alias: {
        '~/': '/src/',
      },
    },
  }
})
