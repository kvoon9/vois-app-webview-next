interface HasOwnObject {
  hasOwnProperty: (key: PropertyKey) => boolean
}

interface ObjectApi {
  hasOwn?: (target: HasOwnObject, key: PropertyKey) => boolean
  defineProperty: typeof Object.defineProperty
}

// Android WebView Chrome 92 (App 5.0.8 on Android 10) has no Object.hasOwn,
// and reka-ui calls it when a dialog mounts. Define it before the app mounts.
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
