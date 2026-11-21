interface HasOwnObject {
  hasOwnProperty: (key: PropertyKey) => boolean
}

interface ObjectApi {
  hasOwn?: (target: HasOwnObject, key: PropertyKey) => boolean
  defineProperty: typeof Object.defineProperty
}

// Android WebView Chrome 92 (App 5.0.8 on Android 10) has no Object.hasOwn,
// and the UI SDK kernel calls it when a primitive mounts. Define it before the app mounts.
// SAFETY: every supported engine has Object.defineProperty; only hasOwn is optional here.
const objectApi = Object as ObjectApi
if (objectApi.hasOwn === undefined) {
  objectApi.defineProperty(Object, 'hasOwn', {
    value: (target: HasOwnObject, key: PropertyKey) =>
      Object.prototype.hasOwnProperty.call(target, key),
    configurable: true,
    writable: true,
  })
}

// A string-keyed probe keeps TypeScript from assuming the modern DOM type while
// still asking the runtime engine what it actually has.
function hasBootApi(name: string): boolean {
  return name in window
}

// Chrome 70 is the production floor and lacks globalThis and queueMicrotask.
// Both must exist before any app module runs, so they live with the boot polyfills.
if (!hasBootApi('globalThis')) {
  Object.defineProperty(window, 'globalThis', {
    value: window,
    configurable: true,
    writable: true,
  })
}
if (!hasBootApi('queueMicrotask')) {
  window.queueMicrotask = (callback) => {
    void Promise.resolve().then(callback)
  }
}

// The UI SDK releases a closing popup only after Element.getAnimations
// (Chrome 84) resolves. An empty result ends that wait immediately; older
// engines skip exit animations instead of throwing. SAFETY: callers only
// iterate the returned array.
if (!('getAnimations' in Element.prototype)) {
  objectApi.defineProperty(Element.prototype, 'getAnimations', {
    value: () => [],
    configurable: true,
    writable: true,
  })
}

// The UI SDK watcher registry holds one WeakRef (Chrome 84) per mounted
// primitive; without it every mount logs a ReferenceError. A strong
// reference is equivalent: the registry pins the instance for the same
// lifetime. SAFETY: window is the global object, and globalThis is
// ensured above.
if (!hasBootApi('WeakRef')) {
  class StrongRefShim<T extends object> {
    private readonly held: T
    constructor(held: T) {
      this.held = held
    }
    deref(): T | undefined {
      return this.held
    }
  }
  objectApi.defineProperty(window, 'WeakRef', {
    value: StrongRefShim,
    configurable: true,
    writable: true,
  })
}

// Chrome 70 has AbortController natively; this keeps the measured Chrome 64
// floor working. Colada's query and the app's fetch wrapper both construct one,
// so the data queries never start without it.
interface AbortSignalLike extends EventTarget {
  aborted: boolean
  reason: Error | undefined
  throwIfAborted: () => void
}

class AbortSignalPolyfill extends EventTarget implements AbortSignalLike {
  aborted = false
  reason: Error | undefined

  throwIfAborted(): void {
    if (this.aborted) throw this.reason ?? new Error('Aborted')
  }
}

class AbortControllerPolyfill {
  readonly signal: AbortSignalLike = new AbortSignalPolyfill()

  abort(reason?: Error): void {
    if (this.signal.aborted) return
    this.signal.aborted = true
    this.signal.reason = reason
    this.signal.dispatchEvent(new Event('abort'))
  }
}

if (!hasBootApi('AbortController')) {
  Object.defineProperty(window, 'AbortController', {
    value: AbortControllerPolyfill,
    configurable: true,
    writable: true,
  })
  Object.defineProperty(window, 'AbortSignal', {
    value: AbortSignalPolyfill,
    configurable: true,
    writable: true,
  })
}
