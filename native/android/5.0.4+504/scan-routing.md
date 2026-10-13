# Scan routing — which QR payloads become H5 pages

Provenance: `com.voistech.chat.ui.scan.ScanRouter#handleScanResult`,
`ScanHelper#parseCodeType`, `#isSharedQrcodeWebView`, `#toBrowserUrl` in artifact
`android-5.0.4+504`.

The scanner classifies a payload into a `CodeType` before routing:

| Type            | Payload shape                                                                                          | Action                                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 user          | `https://user.weila.hk/share/qrcode/u/<base64>`, or `https://user.weila.hk/share/home?type=user&num=…` | native user profile                                                                                                                                                                    |
| 2 group         | `https://user.weila.hk/share/qrcode/g/<base64>`, or `…/share/home?type=group&id=…`                     | native group info                                                                                                                                                                      |
| 3 company       | base64 of a JSON object containing `key`                                                               | server lookup (`/v1/taxi/client/get-org-qrcode-info`), then opens the returned URL in the **bridged** H5 container with defaults                                                       |
| 4 hardware bind | URI path exactly `/v2/qrcode/ext-bind` with `vercode` (optional `product`, `imei`)                     | native hardware binding                                                                                                                                                                |
| 5 web           | `http`/`https` URI whose **fragment path** is `/shared/qrcode` or starts with `/shared/qrcode/`        | opens the scanned URL in the bridged H5 container                                                                                                                                      |
| 0 unknown       | anything else                                                                                          | if it looks like a URL (`http*`/`market:` scheme, or a bare domain matching `^[a-z0-9]+(\.[a-z0-9-]+)+…$`) it opens in the **system browser**, otherwise the text is shown in a dialog |

Type 5 is the one that matters for this repo:

- The rule looks at the **fragment**, not the path:
  `https://<host>/<any>#/shared/qrcode/…` matches, while
  `https://<host>/shared/qrcode` (path) does not.
- The container is `VoisWebActivity` with `noDefaults()`: the scanned URL's own
  query params are copied (outer query first, then the fragment's query) and the
  app-wide page params are **not** merged into the URL. `get-page-params` still
  returns them when asked.
- Because the fragment carries the route, a scanned link must be a valid SPA
  deep link for the page to render; the App does not rewrite it.

Current H5 side: `apps/website/src/pages/shared/qrcode/…` implements these pages
(today one route, `bluetooth-ai-translate-active`).

## Open questions

- Whether later versions add fragment paths to the match (e.g. share landing
  pages) or broaden the `/shared/qrcode` rule.
- The company flow depends on a server response; its URL shape is not observable
  from the package alone.
