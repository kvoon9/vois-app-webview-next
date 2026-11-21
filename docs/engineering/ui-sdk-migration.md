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

## 自研组件收编（第二轮）

策略：有 SDK 现成家族的直接换用，没有的保留手写。盘点结论是本文档记录时没有需要 Custom Parts 的场景，全部有现成组件覆盖。

| 组件 | 迁到 | 提交 | 删除的手写逻辑 |
| --- | --- | --- | --- |
| ToggleSwitch | Switch + SwitchThumb | d11dc26 | role/aria-checked/点击按钮，改为受控 presentational |
| Avatar | Avatar + AvatarImage + AvatarFallback | 1de99ed | loaded/failed 状态机、src watch、loading computed |
| ToastHost + useToast | createToaster + ToastRegion | 24fec67 | 单条替换 toast 实现；固定 id `app-toast` 是文档明文的等价复用语义 |
| ImageCropper | ImageCropper frame 模式 + cropImage | 9e9bc48 | 184 行指针/pinch 几何与 105 行工具，工具及其测试一并删除 |

保留手写（SDK 无对应家族）：AzIndexRail（字母 scrub 条，非数值 slider）、TrackPointPopup（地图卡片，非弹层语义）、PageHeader 等业务组合件。

实现要点：
- Toast：`duration <= 0` 的旧语义（永不自动关闭）映射为 `Infinity`；SDK 在 99+ 给区域设 `flex-direction: column`，加 `flex-row` 保持旧的横向居中；列表 reset 自写，因为 SDK 的规则在被丢弃的 layer 里。
- ImageCropper：SDK 只有 `data-error` 属性没有错误事件，用 MutationObserver 桥接回 `failed`，保住消费方「坏文件原样上传」的逃生通道。已知变化：透明源像素编码为黑（`cropImage` 无白色底层）；不透明照片无影响。
- 契约测试新增 26 条（5+8+5+8），含 switch 的 checkPattern 断言。

## 浏览器级验收（DevServer 3022，debug 账号，真实后端）

驱动方式按 verify-vois-webview 技能：ego-browser 共享会话，doctor 全绿（connected、30 次 /v2 成功、auth 200、158 条捕获事件零 error）。截图在 `/tmp/vois-shots/`。

已驱动并通过的界面：
- 设备列表与设备详情（Avatar 渲染）。
- 共享位置开关（SDK Switch 真实渲染，ON 态）。
- 复制设备号 → 绿色 toast（SDK ToastRegion/maxVisible=1）。
- 缴费充值确认弹窗（BaseModal，居中，320/375 双尺寸）。
- 解除绑定 danger 弹窗（BaseModal，danger tone）。
- 修改设备头像 → 文件上传 → ImageCropper frame 模式真实解码渲染（`createImageBitmap` 路径），圆形引导框与提示文案完整；未点确认，避免向生产写入头像。
- 好友翻译设置页的只读语言触发器（LanguagePickerDrawer 的 DrawerTrigger part 在真实引擎渲染正确，按设计禁用）。
- 登录页账号输入（SDK Combobox 渲染为 combobox 角色，可键入）。
- 轨迹页：进入即弹选择日期日历（42 格、选中态、未来日不可用，320/375）；确认后开轨迹点抽屉（17 行，时间与坐标，Escape 可关，320/375）。

独立视觉评审（评审代理对 14 张截图的裁决）：首轮 NOT CONFIRMED，命中一处 320×568 真实几何问题，日历底页横切页头且页脚被切。修复为底页 `max-h: calc(100vh-4rem)` 加高度 ≤640px 时的紧凑间距（`eda862f`），320 实测页头完整、页脚 12px 净空，375 逐像素不变，复审 PASS。另两条非阻断记录：缴费弹窗的产品名在产品名与描述各出现一次（数据本身如此，组件未改）；danger 弹窗的取消按钮带琥珀色焦点环（SDK 初始焦点落在首个可聚焦元素，环是应用既有 focus-visible 样式）。

未能驱动的界面及原因：
- LanguagePickerDrawer 的交互态只在群成员页（TranslationSettingModal），debug 账号没有群组；好友详情页里该组件按设计恒为禁用只读。行为由 5 条 jsdom 契约测试覆盖。
- 裁剪器的确认上传：会真实修改设备头像，未执行；编码路径由 8 条契约测试（mock 边界）覆盖。
- 夹具操作：为可达性临时把测试好友的翻译模式切换过，结束后已用 API 恢复到原始 skill=2。

## 未做（明确出范围）

- Custom Parts（createParts/usePrimitive/usePart）手写零件：本轮盘点后没有适用场景，全部行为都有现成组件覆盖。若后续出现 SDK 缺零件的交互再启用，方法论已存于记忆（ui-sdk-contract-testing）。
- docs 应用的 @nuxt/ui 仍带 reka-ui 传递依赖，不在本 lane。
- 真机（非快照）WebView 验收。快照探针已证功能，真机回归留给 release 流程。ImageCropper 的 `cropImage` 对 File 走 `createImageBitmap`（iOS WKWebView 15+），iOS 14 设备上会落到 failed 逃生通道（原样上传），值得真机确认。
