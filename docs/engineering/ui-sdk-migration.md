# Vercel UI SDK 迁移决策记录

分支 `t3/vercel-ui-sdk-migration`，2026-11-21 至 2026-11-22。

## 目标

把 apps/website 的 reka-ui 界面层迁到 Vercel UI SDK（`@ui-sdk/vue`），遵循 SDK 官方文档约定，配形式化验证，保住 Chrome 70 生产地板。

## 前提检验（2026-11-21）

2026-11-15 的评估曾以 `inert`（Chrome 102+）为由否决迁移。本轮源码审计加真实引擎探针推翻了这个判断。

| 断言 | 证据 | 结论 |
| --- | --- | --- |
| `inert` 是阻断项 | core `modal.js` 直接赋属性，70 上是 expando 无异常；Tab 陷阱走独立 keydown 实现 | 推翻。静默降级，非崩溃 |
| `getAnimations` 未防护 | `presence.js` whenFinished 裸调，70 上 TypeError，弹层永久卡在 data-ending-style | 证实。五行 shim 解决 |
| `WeakRef` 缺口 | `watchers.js` 每次挂载 new WeakRef，70/83 各刷 6 条 ReferenceError | 新发现。强引用 shim 解决 |
| 日历 Intl 缺口 | SDK 对 Intl.Locale 有 try/catch 回退；应用已预载 @formatjs polyfill | 双重覆盖，非问题 |
| `@layer` CSS 丢弃 | 运行时注入样式包在 @layer ui-sdk，99 以下整块丢弃 | 证实。不引 web.css，自写无 layer 样式 |
| JS 内建缺口 | `.at`/`Object.hasOwn`/`replaceAll` 由 legacy core-js 管线覆盖 | 已有配置解决 |

探针产物在 `/tmp/ui-sdk-probe/`（app、driver、results）。反证组关掉 shim 后复现崩溃，证明 shim 承重。

## 关键决策

1. **精确锁版 0.1.0-beta.13 双包 + core override。** 上游 7 天 13 个 beta，beta.11 未发布但代码进了 beta.12。caret 范围会漂移，重复 core 副本破坏弹层锚点名（vercel-labs/ui#932）。
2. **两个 boot shim 进 polyfills.ts。** getAnimations 返回空数组（旧引擎跳过退场动画），WeakRef 用强引用（注册表本就钉住实例生命周期）。
3. **不引 web.css。** 它用 :has/oklch/light-dark/@layer，70 上几乎全丢。所需规则自写。
4. **居中配方实测。** `fixed inset-0 m-auto h-fit` 在真实 Chrome 70 上验证（h=100 精确收缩、top=250 居中）。Lightning CSS 把 inset-0 降级为四边写法。
5. **dismissible prop 替代 preventDefault 拦截。** SDK 原生支持，比手写事件拦截干净。
6. **装饰 grip 替代 DrawerHandle。** 文档明文：单 snap point 不用失效按钮。
7. **日历值类型对齐。** SDK 用 ISO 字符串，组件 props 本就是 ISO，@internationalized/date 从该组件移除（依赖保留，track.vue 仍用）。
8. **checkPattern 形式化验证。** SDK 自带 APG 检查器可在消费方 Vitest 跑，需复刻两个 jsdom 缺口补丁（popover UA display:none + getAnimations）。dialog/alertdialog/combobox/switch 等 15 种模式有覆盖；drawer/popover/toast/calendar 无，用手写行为断言。

## 迁移面与提交

| 组件 | 家族 | 提交 | 契约测试 |
| --- | --- | --- | --- |
| LanguagePickerDrawer | Drawer | 32bafe9 | 5 条 |
| TrackPointDrawer | Drawer | 1fa91fc | 7 条（含滚动双分支） |
| LoginAccountInput | Combobox | 6fa65dd | 7 条 |
| TrackCalendarModal | Dialog+Calendar | 855bf06 | 8 条（含 checkPattern） |
| BaseModal（19 消费方） | Dialog | 530e692 | 8 条（含 checkPattern） |

外部 API 全部冻结，消费方零改动。reka-ui 从 website 依赖移除（61d8298），lockfile 中仅剩 docs 应用 @nuxt/ui 的传递 peer。

## 验证

- `vp run ready` 退出码 0（check + test + build，committed tree）。
- 47 测试文件 445 条测试全过，其中 35 条是本次新增的契约测试。
- 真实 Chromium 70 全 app 扫描 PASS，入口 chunk 语法全净（nullish 0、optional chaining 0），截图与迁移前一致。
- bundle 对比（modern JS 逐 chunk gzip 求和）：基线 662,317 B → 迁移后 641,848 B，**净减 20,469 B（-3.1%）**。legacy JS 同口径 683,996 → 663,295（-20,701 B）。CSS 10,014 → 9,980 B。字节从页面 chunk 移入共享 create-parts（34.7 KB gzip），页面 chunk 显著变小（index 90.9→41.2 KB，login 46.3→20.3 KB，track 42.1→17.8 KB）。

## 工具链修复

- `VOIS_PREVIEW_PORT` 环境变量（6fcda8b）：机器上一条 ssh 隧道占用 8081，远端 screen-relay 抢答 debug 探测饿死扫描。换端口解决，隧道不动。
- `vp run` 的 FSPY 缓存层会吞子进程 stdout 并提前退出，扫描需直接跑 node 脚本或 `--no-cache`。

## 已知降级与边界

- Chrome 70–83：退场动画跳过（getAnimations shim 返回空）。功能完整。
- Chrome 70–101：inert 无行为，读屏虚拟光标可逃出背景。Tab 陷阱与 aria-modal 照常。与 reka-ui 现状同等，未倒退。
- 页面隐藏时的动画门控：SDK 无开关，但其驱动把动画起点推迟到首渲染帧，效果等价。搜索框淡入保留门控。
- WeakRef shim 是强引用：注册表本就钉住实例，无额外泄漏。

## 未做（明确出范围）

- 自研组件的 Custom Parts 重写（ToggleSwitch/ToastHost/Avatar）。用户提及但本轮聚焦 reka-ui 替换，Custom Parts 试点留待后续 lane。
- docs 应用的 @nuxt/ui 仍带 reka-ui 传递依赖，不在本 lane。
- 真机（非快照）WebView 验收。快照探针已证功能，真机回归留给 release 流程。
