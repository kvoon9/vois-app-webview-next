<script setup lang="ts">
import { onMounted, shallowRef, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WebviewBridge } from '@vois/webview-bridge'
import PageHeader from '~/components/PageHeader.vue'
import { whenWebviewBridge } from '~/composables/useWebviewBridge'
import {
  LOCATION_MAX_TIME_MS,
  LOCATION_MIN_INTERVAL_MS,
  type BridgePermissionName,
  type GetPermissionsResponse,
} from '~/utils/bridge/location-bridge'

const { t } = useI18n({ useScope: 'global' })

/** Every group the native `get-permissions` handler knows (`WebPermissionBridge`). */
const GROUPS: BridgePermissionName[] = [
  'location',
  'background-location',
  'audio-recording',
  'camera',
  'nearby-devices',
  'notification',
]

interface CallLogEntry {
  id: number
  time: string
  protocol: string
  request: string
  response: string
}

interface StartLocationRequest {
  interval: number
  time: number
}

/** Per-group grant state from the latest answers; an absent key was never returned. */
const grants = shallowRef<Partial<Record<BridgePermissionName, boolean>>>({})
const querying = ref(false)
/** True while a start-location is out; native may hold it on the dialog for a long time. */
const waitingForStart = ref(false)
const log = shallowRef<CallLogEntry[]>([])

let nextLogId = 1

function pushLog(protocol: string, request: string, response: string): void {
  const entry: CallLogEntry = {
    id: nextLogId++,
    time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    protocol,
    request,
    response,
  }
  log.value = [entry, ...log.value].slice(0, 50)
}

/** The bridge promise never settles when native stays silent; race a short wait. */
function withBridge(): Promise<WebviewBridge | null> {
  return Promise.race([
    whenWebviewBridge(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 3_000)),
  ])
}

async function callPermissions(
  params: BridgePermissionName[],
): Promise<GetPermissionsResponse | null> {
  const bridge = await withBridge()
  if (!bridge) {
    pushLog('get-permissions', JSON.stringify({ params }), t('permissionTest.bridgeUnavailable'))
    return null
  }
  try {
    const response = await bridge.request('get-permissions', { params })
    pushLog('get-permissions', JSON.stringify({ params }), JSON.stringify(response))
    return response
  } catch (error) {
    pushLog('get-permissions', JSON.stringify({ params }), String(error))
    return null
  }
}

function absorbGrants(response: GetPermissionsResponse | null): void {
  if (response?.errcode === 0 && response.data) {
    grants.value = { ...grants.value, ...response.data }
  }
}

async function queryAll(): Promise<void> {
  querying.value = true
  absorbGrants(await callPermissions([]))
  querying.value = false
}

async function queryOne(name: BridgePermissionName): Promise<void> {
  absorbGrants(await callPermissions([name]))
}

/** Fires the location dialog chain on purpose: first ask, rationale, or the settings dialog. */
async function callStartLocation(): Promise<void> {
  const request: StartLocationRequest = {
    interval: LOCATION_MIN_INTERVAL_MS,
    time: LOCATION_MAX_TIME_MS,
  }
  waitingForStart.value = true
  const bridge = await withBridge()
  if (!bridge) {
    pushLog('start-location', JSON.stringify(request), t('permissionTest.bridgeUnavailable'))
    waitingForStart.value = false
    return
  }
  try {
    const response = await bridge.request('start-location', request)
    pushLog('start-location', JSON.stringify(request), JSON.stringify(response))
  } catch (error) {
    pushLog('start-location', JSON.stringify(request), String(error))
  }
  // A dialog-stranded call never answers; the flag only tracks the latest one.
  waitingForStart.value = false
}

async function callGetLocation(): Promise<void> {
  const bridge = await withBridge()
  if (!bridge) {
    pushLog('get-location', '{}', t('permissionTest.bridgeUnavailable'))
    return
  }
  try {
    const response = await bridge.request('get-location', {})
    pushLog('get-location', '{}', JSON.stringify(response))
  } catch (error) {
    pushLog('get-location', '{}', String(error))
  }
}

function grantLabel(name: BridgePermissionName): string {
  const granted = grants.value[name]
  if (granted === true) return t('permissionTest.granted')
  if (granted === false) return t('permissionTest.denied')
  return t('permissionTest.notReturned')
}

onMounted(() => {
  void queryAll()
})
</script>

<template>
  <div class="page">
    <PageHeader :title="t('permissionTest.title')" />
    <main class="space-y-6 p-4">
      <section class="space-y-3">
        <h2 class="section-title">{{ t('permissionTest.stateTitle') }}</h2>
        <button class="btn-secondary min-h-12 w-full" :disabled="querying" @click="queryAll()">
          {{ querying ? t('permissionTest.querying') : t('permissionTest.queryAll') }}
        </button>
        <ul class="panel">
          <li v-for="name in GROUPS" :key="name" class="panel-row min-h-12 text-body">
            <span class="font-mono text-2nd-body">{{ name }}</span>
            <span
              class="text-2nd-body"
              :class="{
                'text-primary': grants[name] === true,
                'text-danger': grants[name] === false,
                'text-text-secondary': grants[name] === undefined,
              }"
            >
              {{ grantLabel(name) }}
            </span>
          </li>
        </ul>
      </section>

      <section class="space-y-3">
        <h2 class="section-title">{{ t('permissionTest.singleTitle') }}</h2>
        <div class="flex flex-wrap">
          <button
            v-for="name in GROUPS"
            :key="name"
            class="chip chip-unselected mr-2 mb-2 font-mono"
            @click="queryOne(name)"
          >
            {{ name }}
          </button>
        </div>
      </section>

      <section class="space-y-3">
        <h2 class="section-title">{{ t('permissionTest.locationTitle') }}</h2>
        <button class="btn-secondary w-full" @click="callStartLocation()">
          {{
            waitingForStart ? t('permissionTest.waitingNative') : t('permissionTest.startLocation')
          }}
        </button>
        <button class="btn-secondary w-full" @click="callGetLocation()">
          {{ t('permissionTest.getLocation') }}
        </button>
        <p class="text-small text-text-secondary">{{ t('permissionTest.startHint') }}</p>
      </section>

      <section class="space-y-3">
        <h2 class="section-title">{{ t('permissionTest.logTitle') }}</h2>
        <p v-if="log.length === 0" class="text-2nd-body text-text-secondary">
          {{ t('permissionTest.logEmpty') }}
        </p>
        <ul v-else class="space-y-2">
          <li v-for="entry in log" :key="entry.id" class="card space-y-1">
            <p class="flex items-center text-small text-text-secondary">
              <span>{{ entry.time }}</span>
              <span class="ml-auto pl-3 font-mono">{{ entry.protocol }}</span>
            </p>
            <p class="break-all font-mono text-small">→ {{ entry.request }}</p>
            <p class="break-all font-mono text-small">← {{ entry.response }}</p>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>
