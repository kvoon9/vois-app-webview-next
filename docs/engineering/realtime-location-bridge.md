---
description: '实时位置的桥接实现：网页怎么向 App 订阅设备位置、App 怎么把位置推给网页，四个改动点的示例代码和验证步骤。'
---

# 实时位置：桥接方案

> 2026-10-15 更新：最终落地方案改为 H5 轮询（见 `docs/native/android/v5.0.8+508/location-bridge.md`），本文的事件推送设计未采用，保留作参考。
>
> 2026-10-15。背景见 `docs/device-management-feasibility.md` 第 2 节：App 自己的「查看位置」页面能秒级刷新，是因为位置数据走 App 的私有长连接，网页接不进去。想让网页也有这个效果，得让 App 订阅位置、转手推给网页。这篇是具体做法和验证步骤，还没开工。

## 要做的事

网页告诉 App「我要看 1254040 这台设备的位置」，App 开始订阅；之后每来一个新位置就转发给网页；网页离开时说「不看了」，App 停止订阅。一共就三条消息：

```
网页 → App：subscribe-device-location    {"user_id": 1254040}
App  → 网页：device-location             {"userId": 1254040, "lat": 22.63, ...}   ← 会来很多次
网页 → App：unsubscribe-device-location  {"user_id": 1254040}
```

前两个名字是新加的协议。改动落在四个地方：`@vois/webview-bridge`（网页和 App 之间传话的库）、安卓 App、iOS App、website 的页面。

## 先把数据约定好

订阅和退订的应答只有「收到了」一个意思，位置数据不走这里，走下面的 `device-location`。每次一个位置，内容是：

```json
{
  "userId": 1254040,
  "lat": 22.6305,
  "lng": 114.0668,
  "accuracy": 30,
  "type": 0,
  "ts": 1791954483,
  "address": "深圳市南山区…"
}
```

`accuracy` 是精度，单位米。`type` 是坐标系：0 是高德用的 gcj02，1 是 GPS 的 wgs84，网页画图前要判断（和轨迹接口的约定一致）。`ts` 是秒级时间戳。`address` 可有可无。

几条行为规则，都是防出事的：

- 重复订阅同一台设备，App 直接再应一声「好」，不会订两遍；换设备时先把旧的退掉再订新的。
- 网页会在离开页面、切到后台时退订，回到前台再订一次。如果用户直接把 WebView 关了、网页来不及说话，App 在页面销毁时自己停掉订阅——这条是防止订阅泄漏的关键，双端都要做。
- 位置多久来一次由设备自己的上报档位决定（就是轨迹设置里那个省电档），App 原样转发，不攒也不改。
- 数据统一转成 JSON 字符串再传（两个平台的通道都只方便传字符串）。

## bridge 包加什么

`@vois/webview-bridge` 现在只会「网页问、App 答」，不会「App 主动说」。加一个监听接口 `onBridgeEvent`，把两个平台各自的原生通道接到它下面。

协议注册追加两条：

```ts
// src/vois.ts
export interface DeviceLocationSubscribe {
  user_id: number
}

export interface DeviceLocationFrame {
  userId: number
  lat: number
  lng: number
  /** 米 */
  accuracy: number
  /** 0 是 gcj02（高德），1 是 wgs84（GPS），同轨迹接口的约定 */
  type: number
  /** 秒级时间戳 */
  ts: number
  address?: string
}

export interface VoisAppProtocolMap {
  // …现有 close-page / get-page-params / wechat-app-prepay 三条不动
  'subscribe-device-location': { data: DeviceLocationSubscribe; response: BridgeAck }
  'unsubscribe-device-location': { data: DeviceLocationSubscribe; response: BridgeAck }
}
```

监听接口的实现：

```ts
// src/bridge/events.ts（新文件）
type Handler = (data: unknown) => void
const listeners = new Map<string, Set<Handler>>()

/**
 * App 主动发消息给网页的统一入口。安卓由包里的 registerHandler 转发进来；
 * iOS 由 App 直接调用。参数永远是一段 JSON 字符串。
 */
;(window as any).__voisBridgeEmit = (type: string, raw: string): void => {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return // 格式不对就丢掉这一条，不能让一条坏数据把页面搞挂
  }
  listeners.get(type)?.forEach((fn) => fn(data))
}

export function onBridgeEvent<T>(type: string, handler: (data: T) => void): () => void {
  const set = listeners.get(type) ?? new Set()
  set.add(handler)
  listeners.set(type, set)
  return () => set.delete(handler) // 返回的函数用来取消监听
}
```

```ts
// src/bridge/android.ts 的 finish() 里，init 之后挂一次
bridge.registerHandler?.('device-location', (data: string) => {
  ;(window as any).__voisBridgeEmit('device-location', String(data))
})
```

为什么安卓用 `registerHandler`：App 用的 lzyzsd JsBridge 这个库本来就支持双向的命名调用——网页调 `registerHandler(name, fn)` 注册，Java 侧调 `webView.callHandler(name, data)` 就能触发。现有的 `uniBridgeCall`（网页发请求给 App）用的是它「网页问 App」的方向，事件只是反过来用，不用引任何新东西。iOS 没有这套机制，约定 App 用 `evaluateJavaScript` 调 `window.__voisBridgeEmit`，这个函数由包安装好，名字写进约定。

顺手再做一件小事：DevServer 的调试日志（`events.jsonl`）现在只记「网页问 App」这个方向，给 `device-location` 也加一条记录（在 website 的 `mirrored()` 那里加），后面用浏览器自动化验证就靠它。

## 安卓怎么做

App 里已经有完整的实时位置能力——它自己的「查看位置」页面（`HardwareCheckLocationActivity`）就是调 `ShareLocationManager` 拿数据的。我们要做的只是把这条数据接到桥上，照着微信支付那个桥功能（`WechatPayHelper`）的样子写一个 helper：

```java
// BridgeType.java 追加
String SUBSCRIBE_DEVICE_LOCATION = "subscribe-device-location";
String UNSUBSCRIBE_DEVICE_LOCATION = "unsubscribe-device-location";

// DeviceLocationBridgeHelper.java（新文件）
public class DeviceLocationBridgeHelper {
    private final BridgeWebView webView;
    private final Gson gson = new Gson();
    @Nullable private Integer userId;
    private LiveData<List<UserRealtimeLocation>> locationSource;

    private final Observer<List<UserRealtimeLocation>> frameObserver = locations -> {
        if (locations == null || userId == null) return;
        for (UserRealtimeLocation item : locations) {
            if (item.getUserId() != userId) continue;
            LocationInfo info = item.getLocationInfo();
            if (info == null) continue;
            // App → 网页：lzyzsd 的命名通道，data 是 JSON 字符串
            webView.callHandler("device-location", gson.toJson(toFrame(item, info)), null);
        }
    };

    /** 订阅：和 App 自己的位置页同一条链路 */
    public JsBridgeHandler createSubscribeHandler(VoisActivity activity) {
        return (type, params, callback) -> {
            int uid = params.get("user_id").getAsInt();
            if (userId == null || userId != uid) {
                unsubscribe();
                userId = uid;
                // 单聊会话键："1_" + 用户 ID，和 HardwareCheckLocationActivity 一致
                String sessionKey = SessionKeyBuilder.getSessionKey(uid, 1);
                ShareLocationManager lm = VIMManager.instance().getShareLocation();
                lm.startLocationRealTime(sessionKey);
                locationSource = lm.getSessionShareLocations(sessionKey);
                locationSource.observe(activity, frameObserver);
            }
            BridgeResponseBuilder.respond(callback, type, 0, "ok");
        };
    }

    /** 退订，换设备时也用它清理 */
    public void unsubscribe() {
        if (userId == null) return;
        ShareLocationManager lm = VIMManager.instance().getShareLocation();
        lm.stopLocationRealTime(SessionKeyBuilder.getSessionKey(userId, 1));
        if (locationSource != null) locationSource.removeObserver(frameObserver);
        userId = null;
        locationSource = null;
    }
}

// VoisWebActivity 挂载（和 wechat-app-prepay 并排）
jsBridgeHandlerMap.put(BridgeType.SUBSCRIBE_DEVICE_LOCATION, locationHelper.createSubscribeHandler(this));
jsBridgeHandlerMap.put(BridgeType.UNSUBSCRIBE_DEVICE_LOCATION, (type, params, cb) -> {
    locationHelper.unsubscribe();
    BridgeResponseBuilder.respond(cb, type, 0, "ok");
});
// Activity 的 onDestroy() 里调一次 locationHelper.unsubscribe()
// —— WebView 被直接关掉、网页来不及退订时，靠这里收尾
```

`toFrame` 把 `LocationInfo`（经纬度、精度、地址、时间）拍平成上面约定的字段。`ShareLocationManager` 自带日志（`startLocationRealTime#sessionKey`、`stopLocationRealTime`），真机联调看 logcat 就够了。

## iOS 怎么做

iOS 和安卓共用 WLSDK（vender 里的 iOS 包里有 `WLSDK.framework`），实时位置的能力是一样的，具体函数名要 iOS 同事确认后对齐。下面是示意代码：

```swift
// uniBridgeCall 的分发处追加两个 case
case "subscribe-device-location":
    let uid = body["user_id"].intValue
    locationStreamer.subscribe(userId: uid) { [weak self] frame in
        guard let self, let json = try? JSONEncoder().encode(frame) else { return }
        let raw = String(data: json, encoding: .utf8) ?? ""
        // App → 网页：调包里安装好的统一入口
        webView.evaluateJavaScript(
            "window.__voisBridgeEmit && window.__voisBridgeEmit('device-location', '\(raw)')"
        )
    }
    reply(["errcode": 0, "errmsg": "ok"])

case "unsubscribe-device-location":
    locationStreamer.unsubscribe()
    reply(["errcode": 0, "errmsg": "ok"])

// locationStreamer：包一层 WLSDK 的实时位置订阅（对应安卓的 ShareLocationManager），
// 页面销毁（deinit）时退订，等价于安卓 onDestroy 的收尾
```

有个坑提前说：JSON 塞进 JavaScript 字符串里要转义，地址是中文的时候最容易出问题。约定 App 在转发前做一次转义、包在解析前解回来。联调第一天先拿一个带中文地址的位置试一遍。

## 网页怎么做

写一个 `useDeviceRealtimeLocation`，页面只管用：

```ts
// src/composables/useDeviceRealtimeLocation.ts
const frameSchema = object({
  userId: number(), lat: number(), lng: number(),
  accuracy: number(), type: number(), ts: number(),
  address: optional(string()),
})

export function useDeviceRealtimeLocation(deviceId: MaybeRefOrGetter<number | undefined>) {
  const frame = shallowRef<DeviceLocationFrame | null>(null)
  const live = ref(false)

  async function subscribe(id: number) {
    const bridge = await whenWebviewBridge()   // 现有的等待逻辑，外面有超时保护
    await bridge.request('subscribe-device-location', { user_id: id })
    live.value = true
  }

  async function unsubscribe(id: number) {
    live.value = false
    frame.value = null
    await whenWebviewBridge().then((b) => b.request('unsubscribe-device-location', { user_id: id }))
  }

  // 收到位置：先校验格式，再丢掉比上一次旧的
  onBridgeEvent<DeviceLocationFrame>('device-location', (raw) => {
    const parsed = safeParse(frameSchema, raw)
    if (!parsed.success) return
    if (frame.value && parsed.output.ts <= frame.value.ts) return
    frame.value = parsed.output
  })

  // 页面挂载、回到前台就订阅；离开、切后台、组件销毁就退订
  const id = toRef(() => toValue(deviceId))
  watchEffect(() => { if (id.value != null && document.visibilityState === 'visible') subscribe(id.value) })
  useEventListener(document, 'visibilitychange', () => {
    if (id.value == null) return
    document.visibilityState === 'hidden' ? unsubscribe(id.value) : subscribe(id.value)
  })
  onScopeDispose(() => { if (id.value != null) unsubscribe(id.value) })

  return { frame, live }
}
```

`location.vue` 接法：有实时位置就让红点跟着动，没有就显示「最近位置」（当天轨迹的最后一个点），地图和标点用现成的 `MapCanvas`。`live` 为真时标题旁边挂个「实时」小标。坐标是 wgs84（`type === 1`）时要先转成高德的 gcj02 再画。

DevServer 上没有 App 也能开发：调试服务器模式下（`isWebviewDebug()` 且桥没就绪时）用假位置——围绕一个中心点转圈，三秒一个，二十行代码。这样浏览器自动化就能把整个流程跑完。

## 怎么验证

从便宜到贵，四步。

**第一步：单元测试（不用 App，CI 就跑）。** bridge 包在 jsdom 里模拟两个入口——Android 路径触发 `registerHandler` 回调、iOS 路径直接调 `window.__voisBridgeEmit`——验证分发、坏数据不抛错、取消监听后不再收。网页这边 mock 掉桥，把订阅、退订、切前后台、格式不对拒收、旧位置丢弃、假位置模式都测到。

**第二步：浏览器自动化（不用 App）。** 起 DevServer（3021），`doctor.mjs` 确认实例健康，用 ego-browser 打开某台设备的位置页：

- 假位置开着：红点持续移动，隔几秒截两张图，位置不一样；
- 调试日志（`events.jsonl`）里能看到订阅请求和一条条位置记录；
- 切走标签页再回来：日志里出现「退订 → 再订阅」的顺序；
- 把假位置关掉：页面落到「最近位置」，不白屏不报错。

**第三步：安卓真机。** 用 debug 包装 DevServer 地址（或用标题栏切端口的机制进 3021），logcat 过滤 `startLocationRealTime|uniBridgeCall|stopLocationRealTime`：

- 进位置页：logcat 出现 `startLocationRealTime#sessionKey: 1_<uid>`，红点开始动。开发者选项里配一个「模拟位置」应用，拖着走最快；
- 正常退出页面：logcat 出现 `stopLocationRealTime`；
- **不正常退出**（直接杀掉 WebView）：Activity 销毁的收尾照常执行，logcat 里仍有 stop——这步是防订阅泄漏的，必测；
- 设备离线或弱网：没有新位置，页面停在「等待定位」的状态，不报错；
- 顺手把三条老协议（关页面、拿启动参数、微信支付）各走一遍，确认没被改坏。

**第四步：iOS 真机。** 同样的步骤，多验两项：带中文地址的位置（转义那事）、页面销毁时的收尾。

最后把这个约定写进 `docs/native/`（现在放桥协议文档的地方）。网页里的格式校验就是约定的「活文档」——哪端改了字段没打招呼，网页会直接拒收、落到「最近位置」，测试一眼就能看出来。

## 大概多少活

- bridge 包：半天到一天
- 安卓：一天到一天半
- iOS：一到两天（要等 WLSDK 函数名确认）
- 网页：一天
- 双端联调：半天到一天

风险就两条：iOS 的函数名还没确认；中文地址的转义是双端最容易踩的坑。其他的（电量、频率）都由设备上报档位决定，网页和 App 只是转发，不添负担。
