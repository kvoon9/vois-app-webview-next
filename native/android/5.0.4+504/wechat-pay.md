# WeChat payment — `wechat-app-prepay`

Provenance: `com.voistech.chat.ui.web.WechatPayHelper`,
`com.voistech.chat.ui.web.bridge.BridgeCallbackManager`,
`com.voistech.chat.ui.web.bridge.BridgeType` in artifact `android-5.0.4+504`.
The H5 side does not call this yet; the page params `wxpay-appid` and
`pay-method` tell a page what the App can do.

## Request

```json
{
  "type": "wechat-app-prepay",
  "data": {
    "partnerid": "…",
    "prepayid": "…",
    "noncestr": "…",
    "timestamp": "…",
    "sign": "…",
    "extdata": "…"
  }
}
```

| Field       | Required | Notes                                           |
| ----------- | -------- | ----------------------------------------------- |
| `partnerid` | yes      | WeChat merchant id                              |
| `prepayid`  | yes      | Also the correlation key of the pending payment |
| `noncestr`  | yes      |                                                 |
| `timestamp` | yes      |                                                 |
| `sign`      | yes      |                                                 |
| `extdata`   | no       | Passed through to WeChat                        |

Missing required fields answer immediately with `errcode: -1` and
`errmsg: "Missing: <comma-separated names>"`.

The App signs nothing: it forwards the fields to the WeChat OpenSDK as an app
payment (`appId` from `SysConstant.WX_APP_ID`, `packageValue = "Sign=WXPay"`).
The values must therefore be produced for **app pay**, not JSAPI, even though the
same WeChat app id is exposed as `wxpay-appid` for a possible JSAPI path.

## Responses

Immediate failure (`sendReq` refused, e.g. WeChat missing or too old):

```json
{
  "type": "wechat-app-prepay",
  "errcode": -1,
  "errmsg": "Failed to send payment request (maybe WeChat not installed or version too low)",
  "data": {}
}
```

Deferred result, sent when WeChat returns to the App:

```json
{
  "type": "wechat-app-prepay",
  "errcode": 0,
  "errmsg": "",
  "data": {
    "wxpaycode": 0,
    "prepayId": "…",
    "extdata": "…",
    "wxtransaction": "…",
    "wxopenId": "…"
  }
}
```

| Field                                              | Meaning                                                                                  |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `errcode`                                          | `0` only when WeChat reported `errCode == 0`, otherwise `-1`                             |
| `errmsg`                                           | WeChat's `errStr`, empty when absent                                                     |
| `wxpaycode`                                        | Raw WeChat `errCode`, always present (so `0` here plus `errcode: 0` is the success pair) |
| `prepayId`, `extdata`, `wxtransaction`, `wxopenId` | Included only when non-empty                                                             |

## Ordering rules

- **One answer per request**, and for a deferred result that means the H5 callback
  can fire long after the request — after the user has been through WeChat. A
  page must survive the round trip (the activity pauses but is not destroyed) and
  re-check its own state on the response; it may also get the answer while a
  different route is displayed.
- A pending payment is keyed by `prepayid`. A second request with the same
  `prepayid` replaces the first: the earlier callback is answered immediately
  with `errcode: -1`, `errmsg: "Duplicate request overridden"`.
- Pending callbacks live on the WebView activity and are cleared when it is
  destroyed — a page closed mid-payment never gets an answer.
- Nothing in the App polls WeChat: the result arrives through the App's
  `WXPayEntryActivity` event bus, so a payment finished outside the App (e.g.
  WeChat re-launched later) is not reported to a page that is gone.

## Open questions

- Whether a later version supports `extdata` round trips or refunds is unverified.
- JSAPI/H5 pay inside this WebView is not implemented by the App in this
  artifact; only app pay is available through the bridge.
