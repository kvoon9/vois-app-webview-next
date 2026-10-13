---
description: 'Every native → H5 launch URL with its query params.'
navigation: 
  title: 'Entry points'
---

# Native → H5 entry points

Provenance: `com.voistech.chat.config.UrlConstant` and every
`VoisWebActivity.WebParam.Builder()` call site in artifact `android-5.0.4+504`.
"Repo route" is the matching page in `apps/website/src/pages`.

## This repository's H5

Production base: `https://api.voischat.cn/vois-app-webview-next/` (hash routing).

| Opened from                   | URL constant                     | Path                                  | Extra query params                                                    | Repo route                                     |
| ----------------------------- | -------------------------------- | ------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------- |
| Profile → help                | `HELP_URL`                       | `/help`                               | `device-model`, `device-manufacturer`, `device-product`, `device-sdk` | `/help`                                        |
| Profile → (debug "vip")       | `USER_WEB_SETTING`               | `/settings`                           | —                                                                     | `/settings`                                    |
| Session → translation         | `USER_TRANSLATE_SETTING_URL`     | `/settings/friends/multi-translation` | `friend-id`, `friend-type`, `friend-skill`                            | `/settings/friends/multi-translation`          |
| User info                     | `REPORT_USER_URL`                | `/report-user`                        | `id`                                                                  | `/report-user`                                 |
| Member info                   | `REPORT_USER_URL`                | `/report-user`                        | `id`                                                                  | `/report-user`                                 |
| Group info                    | `REPORT_GROUP_URL`               | `/report-group`                       | `id`                                                                  | `/report-group`                                |
| Sub-hardware settings         | `SUB_HARDWARE_GROUP_SETTING_URL` | `/devices/groups`                     | `hardware-id`                                                         | **no match** — see below                       |
| System message review         | server-provided `webUrl`         | any                                   | —                                                                     | depends on payload                             |
| Debug entry (debug builds)    | hard-coded                       | dev server root                       | —                                                                     | `/`                                            |
| Scanned `/shared/qrcode…` URL | scanned URL                      | `/shared/qrcode/…`                    | copied from the scanned URL                                           | `/shared/qrcode/bluetooth-ai-translate-active` |

Notes:

- `USER_TRANSLATE_SETTING_URL` has both branches in code: release →
  `https://api.voischat.cn/vois-app-webview-next/#/settings/friends/multi-translation`,
  debug → `http://192.168.1.87:5173/#/settings/friends/multi-translation`.
  It is the only entry point with an observed release value.
- `SUB_HARDWARE_GROUP_SETTING_URL` is the debug host
  `http://192.168.1.87:5173/#/devices/groups` in this build, and this repo has no
  `/devices/groups` route (its device groups live under `/devices/[id]/groups/`).
  Treat the release URL as unknown and the route as broken until a release
  package or the native caller confirms it.
- All of these open the **bridged** activity with defaults merged, so their
  pages see the full page-param pool in addition to the listed params.

## Other web surfaces opened by the App

| Opened from                                | URL                                                                           | Container   | Repo route    |
| ------------------------------------------ | ----------------------------------------------------------------------------- | ----------- | ------------- |
| Account / teen mode → ID verify            | `https://api.voischat.cn/idverify/`                                           | bridged     | not this repo |
| BLE kit info → link settings               | `http://ham.ikd001.cn:2182`                                                   | bridged     | not this repo |
| About → MIIT filing                        | `https://beian.miit.gov.cn/`                                                  | bridge-less | —             |
| About/privacy → personal licence / privacy | `https://api.voischat.cn/common/android-next/personal/license/`, `…/privacy/` | bridge-less | —             |

Declared in `UrlConstant` but with **no call site found** in this artifact (other
flavors or modules may use them): `WEB_MAP_URL` and the fence/send/taxi/track
variants (`https://web.weila.hk:9000/…`), `DRIVER_WEB_PATH`
(`/taxi_manage/#/driver-center`), `WEILA_OUTDOOR_MAP`
(`https://demoui.weila.hk/two-steps/#/`), `GO_GUIDE`
(`http://guide.weila.hk/index.html`), `BBS_BASE_URL`, and the share/pay/QR
helpers (`ACCESS_SHARE_*`, `SHARE_URL_PREFIX`, `ACCESS_USER_DOMAIN`,
`WEILA_LICENSE_URL`, `WEILA_PRIVACY_URL`).

## Short-link and share prefixes

| Prefix                                                                  | Meaning                                                              |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `https://user.weila.hk/share/qrcode/u/<base64>`                         | user QR code (scanned by the App)                                    |
| `https://user.weila.hk/share/qrcode/g/<base64>`                         | group QR code                                                        |
| `https://user.weila.hk/share/home?type=user&num=…` / `?type=group&id=…` | share page (scanned by the App)                                      |
| `https://api.voischat.cn/vois-app-webview-next/#/shared/qrcode…`        | H5 page whose fragment makes a scanned URL open the App H5 container |

## Open questions

- Release values for every entry point other than the translation setting.
- Whether `#/devices/groups` ever existed as a route, or the native caller
  changed shape after this build.
- Entry points added by later native versions (the diff of `UrlConstant` and the
  `WebParam.Builder` call sites is the check).
