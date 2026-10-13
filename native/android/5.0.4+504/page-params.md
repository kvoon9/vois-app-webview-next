# Page params — `get-page-params`

Provenance: `com.voistech.chat.ui.base.VoisActivity#getWebApiDefaultQueryParams`,
`#getWebThemeMode`, `#getWebLang`, `#convertToStandardLang`, `#loginId`, `#getToken`,
`com.voistech.chat.ui.web.VoisWebActivity#registerBridgeHandlers`,
`com.voistech.chat.ui.config.ConfigManager` in artifact `android-5.0.4+504`.

## How the answer is built

1. Start from the app-wide defaults (`getWebApiDefaultQueryParams`).
2. If the page was launched with a `WebParam`, overlay its extra query params —
   the launch params win over defaults for the same key.
3. Filter by the request's `params` array: absent, `null` or empty returns all
   keys; otherwise only the requested keys that exist in the pool, in request
   order. Unknown keys are omitted, never echoed as empty.
4. Every value is serialized as a string.

Requests are served per call — there is no caching, no push, and no awareness of
the H5 route beyond what the page asked for. A page that needs fresh values after
an account switch must ask again.

## Keys

| Key            | Source                                                                      | Observed value                   |
| -------------- | --------------------------------------------------------------------------- | -------------------------------- |
| `access-token` | `IAccount#getToken()` — the IM account token of the App's signed-in account | opaque                           |
| `login-id`     | `ConfigManager#getLoginId()` — persisted int, default `0`                   | `"441"`                          |
| `theme`        | `VoisActivity#getWebThemeMode()`                                            | `light` / `dark`                 |
| `lang`         | `VoisActivity#getWebLang()`                                                 | `zh-CN` / `zh-TW` / `en`         |
| `device-type`  | literal                                                                     | `android`                        |
| `pkg-name`     | `applicationId`                                                             | `com.voistech.chat`              |
| `wxpay-appid`  | `SysConstant.WX_APP_ID` (public WeChat app id)                              | `<redacted sha256:bf93fa384618>` |
| `pay-method`   | WeChat OpenSDK `ConstantsAPI.Token.WX_TOKEN_PLATFORMID_VALUE`               | `wechat`                         |

Mappings behind `theme` and `lang`:

- Theme mode is persisted as an int: `0` → `light`, `1` → `dark`, anything else
  (the default `2`) follows the system — night UI mode → `dark`, otherwise
  `light`.
- Language is persisted as `zh` / `zh-rTW` / `en`; the bridge normalizes `zh` to
  `zh-CN` and `zh-rTW` to `zh-TW`. When nothing is persisted, the system locale
  decides: Chinese + country `TW` → `zh-TW`, Chinese → `zh-CN`, otherwise `en`.
  Values outside this set pass through unchanged.

`access-token` is the account token the App itself uses; the H5 has no second
token source on this path. `login-id` is the App's own account id, not any
H5-side selection — an explicitly selected H5 account (dev/debug only) cannot be
communicated to native through this call.

The `wxpay-appid` value is deliberately not recorded here: this repository is
public, so identifiers are stored as `<redacted sha256:<12-hex prefix>>`, which
still detects a change between versions. Read the real value from the package
(`SysConstant.WX_APP_ID`) or at runtime from `get-page-params`.

## Launch-time merging

When a page is opened with `WebParam.useDefaults` (the default), the App appends
its default params to the launch URL before loading it, keeping keys the URL
already carries:

- URL without a fragment: query params are appended normally.
- URL with a fragment (this repo uses hash routing): params are appended to the
  **fragment's** query, after the fragment path — e.g.
  `https://host/vois-app-webview-next/#/help?lang=en` stays on `/help` and gains
  the missing defaults next to `lang=en`.

So the same values can arrive twice: once in the URL query and once through
`get-page-params`. The H5 treats the bridge answer as authoritative for the
keys it requests (see `apps/website/src/composables/usePageParams.ts`).

## Request/response examples

```json
{ "type": "get-page-params", "data": { "params": ["access-token"] } }
```

```json
{
  "type": "get-page-params",
  "errcode": 0,
  "errmsg": "",
  "data": { "access-token": "…" }
}
```

A request without `params` returns the whole pool, which includes the account
token — prefer asking for exactly the keys the page needs.

## Open questions

- Whether a future version adds keys (or drops `pay-method`) is unverified; the
  `BridgeType`/param diff across packages is the check.
- Release-build behavior is assumed identical (these code paths are not gated on
  `BuildConfig.DEBUG`), but that has not been observed for a release package.
