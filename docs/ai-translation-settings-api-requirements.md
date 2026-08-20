# AI 翻译设置：后端 API 需求

> 依据 `https://api.voischat.cn/aipay/index.html` 的移动端交互探索整理（2026-08-13）。
>
> 该页面是纯前端演示：浏览器仅请求了 `index.html`，所有数据和“设置成功/支付成功”均为本地模拟。因此下文是实现同等功能所需的 **API 契约建议**，不是现有生产接口清单。

## 1. 探索到的功能

### 账号

- 展示 VIP 等级、状态、到期时间与权益
- 展示精品翻译 Token 余额
- 展示 VIP 套餐并开通
- 展示 Token 套餐并充值

### 好友 AI 翻译

- 展示好友名称、微喇号和当前翻译设置
- 设置翻译模式：
  - `off`：关闭
  - `basic_zh_en`：中英互译
  - `premium_zh_en`：精品中英翻译
  - `premium_multi`：精品多国翻译，需选择源语言与目标语言

### 群组 AI 翻译

- 展示群名称、群号和当前翻译设置
- 群级设置支持与好友相同的 4 种模式
- 群翻译开启后，可查看成员并逐成员设置 `off` / `basic_zh_en`
- 群翻译关闭时不可进入成员设置

### 设备

- 展示绑定设备并进入该设备下的好友/群组翻译设置

## 2. 最小 API 集合

统一返回：

```json
{
  "errcode": 0,
  "errmsg": "ok",
  "data": {}
}
```

所有接口必须从鉴权上下文确定当前用户；不要接受客户端传入的用户 ID。

### 2.1 账号概览

```http
GET /v2/ai-translation/account
```

```json
{
  "errcode": 0,
  "errmsg": "ok",
  "data": {
    "membership": {
      "level": "V0",
      "status": "active",
      "expiresAt": null,
      "benefits": []
    },
    "tokenBalance": 15000
  }
}
```

用途：账号首页。`membership.status` 建议枚举 `active | expired | none`。

### 2.2 商品列表

```http
GET /v2/ai-translation/products?scene=vip
GET /v2/ai-translation/products?scene=token
```

```json
{
  "errcode": 0,
  "errmsg": "ok",
  "data": {
    "products": [
      {
        "id": "token_10000",
        "name": "10,000 Token",
        "priceFen": 990,
        "tokenAmount": 10000,
        "description": "约可翻译1000条语音或2000条文字"
      }
    ]
  }
}
```

商品名、权益、价格、赠品和有效期全部由后端返回，前端不硬编码。

### 2.3 创建支付订单

```http
POST /v2/ai-translation/orders
Idempotency-Key: <uuid>
Content-Type: application/json

{
  "scene": "token",
  "productId": "token_10000"
}
```

响应：

```json
{
  "errcode": 0,
  "errmsg": "ok",
  "data": {
    "orderId": "order_123",
    "amountFen": 990,
    "payment": {
      "provider": "wechat",
      "payload": {}
    }
  }
}
```

### 2.4 查询订单状态

```http
GET /v2/ai-translation/orders/{orderId}
```

```json
{
  "errcode": 0,
  "errmsg": "ok",
  "data": {
    "orderId": "order_123",
    "status": "paid",
    "paidAt": "2026-08-13T08:00:00Z"
  }
}
```

`status` 建议枚举 `pending | paid | closed | failed | refunded`。VIP、Token 和流量卡到账均以服务端支付回调为准，前端不能自行标记成功。

### 2.5 语言能力列表

```http
GET /v2/ai-translation/languages
```

```json
{
  "errcode": 0,
  "errmsg": "ok",
  "data": {
    "languages": [
      { "code": "zh-CN", "name": "中文", "flag": "🇨🇳" },
      { "code": "en-US", "name": "英语", "flag": "🇺🇸" }
    ],
    "allowedPairs": null
  }
}
```

演示页列出 30 种语言：`zh-CN`、`en-US`、`ja-JP`、`ko-KR`、`fr-FR`、`de-DE`、`es-ES`、`ru-RU`、`pt-BR`、`ar-SA`、`th-TH`、`vi-VN`、`it-IT`、`nl-NL`、`pl-PL`、`tr-TR`、`uk-UA`、`hi-IN`、`id-ID`、`ms-MY`、`sv-SE`、`da-DK`、`fi-FI`、`nb-NO`、`cs-CZ`、`el-GR`、`he-IL`、`ro-RO`、`hu-HU`、`bg-BG`。

### 2.6 好友列表

```http
GET /v2/ai-translation/friends?cursor={cursor}&limit=50
```

```json
{
  "errcode": 0,
  "errmsg": "ok",
  "data": {
    "items": [
      {
        "id": "friend_1",
        "name": "张三",
        "voisId": "00100001",
        "translation": {
          "mode": "premium_multi",
          "sourceLanguage": "ru-RU",
          "targetLanguage": "de-DE"
        }
      }
    ],
    "nextCursor": null
  }
}
```

### 2.7 更新好友翻译设置

```http
PUT /v2/ai-translation/friends/{friendId}/setting
Content-Type: application/json

{
  "mode": "premium_multi",
  "sourceLanguage": "ru-RU",
  "targetLanguage": "de-DE"
}
```

规则：只有 `premium_multi` 需要且允许语言对；源语言与目标语言不可相同。响应返回保存后的完整 `translation`。

### 2.8 群组列表

```http
GET /v2/ai-translation/groups?cursor={cursor}&limit=50
```

```json
{
  "errcode": 0,
  "errmsg": "ok",
  "data": {
    "items": [
      {
        "id": "group_1",
        "name": "项目讨论组",
        "voisId": "00200001",
        "translation": {
          "mode": "off",
          "sourceLanguage": null,
          "targetLanguage": null
        }
      }
    ],
    "nextCursor": null
  }
}
```

### 2.9 更新群组翻译设置

```http
PUT /v2/ai-translation/groups/{groupId}/setting
Content-Type: application/json

{
  "mode": "basic_zh_en",
  "sourceLanguage": null,
  "targetLanguage": null
}
```

请求体和校验规则与好友设置一致。

### 2.10 群成员列表

```http
GET /v2/ai-translation/groups/{groupId}/members?cursor={cursor}&limit=50
```

```json
{
  "errcode": 0,
  "errmsg": "ok",
  "data": {
    "items": [
      {
        "id": "member_1",
        "name": "张三",
        "voisId": "00100001",
        "mode": "basic_zh_en"
      }
    ],
    "nextCursor": null
  }
}
```

群组模式为 `off` 时返回业务错误，或返回明确的 `memberSettingsEnabled: false`；不要只依赖前端禁用入口。

### 2.11 更新群成员翻译设置

```http
PUT /v2/ai-translation/groups/{groupId}/members/{memberId}/setting
Content-Type: application/json

{
  "mode": "off"
}
```

成员设置按演示功能只需支持 `off | basic_zh_en`。

### 2.12 设备列表（已实现）

```http
POST /v2/account/get-smart-devices?appid=&et=&sign=&token=
```

无请求体，用户身份从 token 鉴权上下文确定。设备本质上是机主名下的微喇用户账号：

```json
{
  "errcode": 0,
  "errmsg": "请求成功",
  "data": {
    "devices": [
      {
        "user_id": 1254025,
        "user_num": "300000010187",
        "nick": "wl300000010187",
        "avatar": "https://cdn.voischat.cn/weila/avatar/user.png",
        "product": "CF02S",
        "imei": "866507071045100"
      }
    ]
  }
}
```

设备下的好友/群组翻译设置复用现有 `/v2/account/translate/*` 接口，把 `user_id` 换成设备的 `user_id` 即可。流量卡续费暂无接口支撑，首版不做。

## 3. 公共数据模型

```ts
type TranslationMode = 'off' | 'basic_zh_en' | 'premium_zh_en' | 'premium_multi'

interface TranslationSetting {
  mode: TranslationMode
  sourceLanguage: string | null
  targetLanguage: string | null
}
```

建议列表项同时返回后端生成的 `displayLabel` 或让前端统一映射模式，避免好友、群组、设备入口各写一套展示逻辑。

## 4. 后端必须处理的规则

- 校验 token 对请求中 `user_id` 的管辖权（本人或名下设备）；禁止仅凭 ID 读写他人配置。
- 校验 VIP/Token 权益是否允许 `premium_zh_en` 与 `premium_multi`。
- 校验语言代码和可用语言对，不信任客户端传值。
- 更新设置需幂等，并返回最终服务端状态。
- 列表支持分页、空状态和已删除对象。
- 商品价格由服务端计算；创建订单时忽略客户端金额。
- 支付订单使用幂等键；权益发放依赖支付平台回调并防止重复发放。
- 建议使用明确业务错误码：无权限、权益不足、Token 不足、非法语言对、群翻译未开启、订单状态异常。

## 5. 待产品/后端确认

1. ~~设置是账号级还是设备级？~~ 已确定：双入口并存。设备 = 机主名下用户账号，设备入口用设备 `user_id` 调同一组接口。
2. “中英互译”和“精品中英翻译”的计费及能力差异是什么？
3. 群成员配置是否只允许关闭/中英互译，还是也应支持精品多国语言？
4. 多国语言是否允许源/目标语言相同，以及是否支持所有 30×29 个方向？
5. Token 消耗单位、扣费时机和余额不足时的行为是什么？
6. 支付渠道、WebView 拉起支付协议及支付结果通知方式需要与原生端确认。
7. 是否需要搜索好友/群组、批量设置和修改审计记录？演示页未体现，首版可不做。
