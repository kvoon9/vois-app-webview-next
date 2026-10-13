---
description: 'WebView activities, settings, UA, the compat gate, file chooser, and error handling.'
navigation: 
  title: 'WebView container'
---

# WebView container

Provenance: `com.voistech.chat.ui.web.*` (activity, `BaseWebView`, `WebConfig`),
`res/layout/activity_session_web.xml`, `res/layout/activity_generic_web.xml` in
artifact `android-5.0.4+504`.

## Two containers

| Activity                 | Bridge | Layout flag               | Used for                                                   |
| ------------------------ | ------ | ------------------------- | ---------------------------------------------------------- |
| `VoisWebActivity`        | yes    | `app:useBridge="true"`    | this repo's H5, plus some third-party pages                |
| `GenericWebViewActivity` | no     | default (plain `WebView`) | static/licence pages, e.g. MIIT, privacy, personal licence |

`VoisWebActivity` takes its target as a parcelable `WebParam` (URL, optional fixed
title, extra query params, `useDefaults` flag) or a bare `EXTRA_URL` string; with
an empty URL it finishes immediately. `WebParam` query params are merged into the
URL as described in [page-params.md](/native/android/v5.0.4+504/page-params).

Title behavior: with a fixed title the bar is always shown; without one the bar
appears only once the page reports a non-empty title (`onReceivedTitle` /
`onPageFinished`).

## WebView compatibility gate

Before any page loads, `BaseWebView` builds a `CheckResult` and refuses to create
a WebView when it fails, showing a diagnostic view instead:

- `WebViewCompat.getCurrentWebViewPackage` must return a package
  (`ERR_NO_WEBVIEW` otherwise);
- WebView major version must be ≥ **45** (`ERR_VERSION_TOO_LOW`);
- on API ≥ 24 every entry of `WebConfig.REQUIRED_FEATURES` must be supported
  (`ERR_FEATURE_UNSUPPORTED`): `SERVICE_WORKER_BASIC_USAGE`, `PROXY_OVERRIDE`,
  `MULTI_PROCESS`, `POST_WEB_MESSAGE`, `RECEIVE_HTTP_ERROR`,
  `RECEIVE_WEB_RESOURCE_ERROR`, `WEB_RESOURCE_ERROR_GET_CODE`,
  `SAFE_BROWSING_ENABLE`.

The diagnostic view lists Android/device/WebView identity and the failing code,
with a close action that finishes the activity. Feature results are logged
individually when the build is debuggable.

## Settings applied to every page

| Setting                | Value                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------- |
| JavaScript             | enabled                                                                                 |
| DOM storage / database | enabled                                                                                 |
| File + content access  | enabled, including `allowFileAccessFromFileURLs` and `allowUniversalAccessFromFileURLs` |
| Mixed content          | compatibility mode (block nothing)                                                      |
| Cache mode             | no-cache, for the WebView and the service worker cache                                  |
| Media                  | playback without a user gesture                                                         |
| Geolocation            | enabled                                                                                 |
| Zoom                   | off (both built-in and display controls)                                                |
| User agent             | `… VoisChat/<versionName>` appended unless the UA already contains `VoisChat`           |

Remote debugging (`WebView.setWebContentsDebuggingEnabled`) follows
`BuildConfig.DEBUG`; this vendored artifact is a debug build, so
`chrome://inspect` works there and is expected to be off in release builds.

## Navigation and error handling

- Navigation never leaves the WebView: `shouldOverrideUrlLoading` loads the URL
  in place and returns `true`, in both the bridged and the plain client. `tel:`,
  `mailto:`, store links or custom schemes are **not** handed to the system; they
  would fail inside the WebView.
- Back press walks WebView history, then finishes the activity — no bridge
  round trip. Only `close-page` involves the H5.
- SSL errors are always cancelled (no "continue anyway" path) and the activity
  closes after the error dialog.
- A gone render process shows a refresh/cancel dialog; cancelling finishes.
- Page load errors only log.
- File chooser: `onShowFileChooser` is bridged to
  `ActivityResultContracts.StartActivityForResult` on the hosting
  `ComponentActivity`. A second concurrent request while one is pending is
  rejected with `null` (the page sees a cancelled pick).
- The activity pauses/resumes/destroys the WebView with its own lifecycle and
  clears the file-chooser callback on destroy.

## Implications for H5

- The page runs in a fully permissive WebView: no mixed-content blocking, file
  URL access, no zoom, no cache. Features that rely on the system browser
  (external links, app stores, `intent:` URLs) do not work here.
- The UA suffix is the only reliable way to detect this container besides the
  bridge itself; the H5 detection in `@vois/webview-bridge` uses platform UAs.
- Because the bridge script is injected on `onPageFinished`, an SPA that renders
  before `load` must keep waiting for the bridge instead of failing fast.
- The compat gate means the H5 can assume the features in `WebConfig` exist on a
  page that loaded at all.
