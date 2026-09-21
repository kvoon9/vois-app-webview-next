# Intl polyfill 研究

> 2026-09-21。目标：让低端 Android 真机（ICU 数据被裁剪的 WebView）也能拿到正确的 Intl 输出。
> 文中所有体积都是本机实测（esbuild --minify --target=chrome83 + gzip -9 / brotli -q11）。

## 0. 结论

1. **根因不是“API 缺失”，而是“API 在、CLDR 数据被裁”**。ECMA-402 的 `fallback` 默认值是 `'code'`，数据查不到时 `Intl.DisplayNames.of('af')` 会原样吐回 `'af'`，不报错也不返回 `undefined`，所以 `?? code` 之类的兜底根本不会触发。
2. 这是 Android 已知问题（Chromium 1097432 / formatjs#1879），formatjs 已经把这段探测写进了自己的 polyfill：`new Intl.DisplayNames(['en'],{type:'region'}).of('CA') === 'CA'` 就是判断依据。
3. **现有代码只修了“构造函数不存在”那一半**：`Intl.DisplayNames` 存在但数据被裁时，`translationLanguageName('af-ZA','zh-CN')` 仍然返回 `af(ZA)`（已用 stub 跑 vitest 复现，见 1.2）。
4. `@vitejs/plugin-legacy` 的 `modernPolyfills: true` 帮不上忙：core-js 3.49 没有任何 Intl 模块。
5. 体积上，**只要覆盖“语言名/地区名”这一件事，静态表比 polyfill 便宜 30 倍**（3.1 KB gzip vs 96~173 KB gzip）。polyfill 值得上的前提是：之后还要用日期/数字/排序等通用 Intl 能力。
6. 如果决定上 polyfill，**先跑真机探针**（第 6 节）确认到底被裁了什么，再决定是只 DisplayNames 还是连 DateTimeFormat 一起。

| 方案                             | 成本（gzip / brotli） | 覆盖                                         | 什么时候选              |
| -------------------------------- | --------------------- | -------------------------------------------- | ----------------------- |
| B 静态表（扩到 zh-CN/zh-TW）     | 3.1 KB / —            | 只有 140 个语言码的名称                      | 只想修语言名显示        |
| C 只加探测 + 现有兜底            | ~0                    | 让坏机器退回英文表                           | 最小改动，先止血        |
| A formatjs DisplayNames + Locale | 173 KB / 91 KB        | DisplayNames 全类型 + Intl.Locale            | 想要通用 Intl、接受体积 |
| A+ formatjs DateTimeFormat       | 再 +221 KB / +107 KB  | 日历/日期（reka-ui Calendar 的月份、星期名） | 日期 UI 也要正确        |

## 1. 现场事实

### 1.1 症状与根因

真机照片里的 `af（ZA）` / `af (ZA)`：语言名和地区名都变成了 code 本身。

- `Intl.Locale` 只做子标签解析，是纯算法，**任何引擎都对**（所以国旗 emoji 一直正常）。
- `Intl.DisplayNames` 要查 CLDR 数据，**被裁了就会走 `fallback: 'code'`**。

formatjs#1879 记录的 Android 行为与我们的照片完全一致：

```js
new Intl.DisplayNames(['en'], { type: 'region' }).of('US') // "United States" ✅（只留了这一个）
new Intl.DisplayNames(['en'], { type: 'region' }).of('CA') // "CA"        ❌
new Intl.DisplayNames(['zh-Hant'], { type: 'region' }).of('US') // "United States"（请求中文也返回英文）
```

即：被裁的 ICU 里只剩极少数条目，其余一律回吐输入。**更新 WebView 未必能修**，因为数据来自该设备打包的那份 ICU 数据。

### 1.2 现有兜底没覆盖这条路径（已验证）

`apps/website/src/utils/translation-language.ts`：

```ts
const languageName =
  new Intl.DisplayNames([locale], { type: 'language' }).of(codeLocale.language) ?? code
const qualifier = displayLanguageQualifier(codeLocale, locale) // 里面同样只判 undefined
```

数据被裁时 `of()` 返回 `'af'`（truthy），`?? code` 不生效 → 直接进 `返回 "af(ZA)"`，英文表永远轮不到。

复现（临时 stub `Intl.DisplayNames.of(code) => code`，跑完已删除）：

```
✓ translationLanguageName('af-ZA', 'zh-CN') === 'af(ZA)'
```

现有 `translation-language.test.ts` 只覆盖 `withoutIntlMembers('DisplayNames' | 'Locale')`，也就是“构造函数不存在”这一半。

### 1.3 应用自己的 Intl 面（决定要补哪些）

| 位置                                                                                       | 用到                                               | 坏机器上的表现                  |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------- | ------------------------------- |
| `utils/translation-language.ts`                                                            | `Intl.Locale`、`Intl.DisplayNames`                 | code 原样显示                   |
| reka-ui `CalendarRoot` → `@internationalized/date` `DateFormatter` → `Intl.DateTimeFormat` | 月份/星期名、标题                                  | 一般退化成分英文（不崩）        |
| `@internationalized/date` `getLocalTimeZone()`                                             | `Intl.DateTimeFormat().resolvedOptions().timeZone` | 正常（时区来自系统，不靠 CLDR） |
| `toLocaleLowerCase()`                                                                      | 原生字符串方法                                     | 正常                            |

没有用到 `Intl.NumberFormat`，也没有 vue-i18n 的 `n()` / `d()`。

## 2. 怎么判断一台机器坏了

这就是 formatjs 内部用的那行判断，可以单独拿来用（几乎零成本）：

```ts
/** 数据被裁的引擎会把 code 原样吐回来，这就是判断依据。 */
function displayNamesBroken(locale: string): boolean {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of('CA') === 'CA'
  } catch {
    return true
  }
}
```

两个注意点：

- **按 UI 语言逐个检查**（en / zh-CN / zh-TW）。厂商可能只裁了非 en 的那几份，`zh-Hant` 请求可能返回英文而不是中文，用 `'en'` 探测会漏。
- 另一种写法是 `fallback: 'none'`（规范上数据缺失时返回 `undefined`），但实测样本少，`of('CA') === 'CA'` 有 formatjs 大量真机验证背书，优先用它。

## 3. 方案 A：formatjs polyfill

### 3.1 接入

```ts
// 顶层（main.ts 里放在其它 import 之前），顺序不能反：
import '@formatjs/intl-getcanonicallocales/polyfill.js'
import '@formatjs/intl-locale/polyfill.js'
import '@formatjs/intl-displaynames/polyfill.js'
import '@formatjs/intl-displaynames/locale-data/en.js'
import '@formatjs/intl-displaynames/locale-data/zh.js'
import '@formatjs/intl-displaynames/locale-data/zh-Hant.js'
```

- 后缀 `.js` 必须写：包 exports map 不接受无后缀子路径。
- **locale-data 必须排在 `polyfill.js` 之后**：数据文件的守卫是 `if (Intl.DisplayNames && typeof Intl.DisplayNames.__addLocaleData === 'function')`，原生（未 polyfill）的构造器没有 `__addLocaleData`，数据会被静默丢掉。
- `intl-locale` / `intl-getcanonicallocales` 不是可选装饰：DisplayNames polyfill 内部会**无守卫地** `new Intl.Locale(...).maximize()`（来自 `@formatjs/intl-localematcher`），只补 DisplayNames 在没有 `Intl.Locale` 的机器上会抛。

### 3.2 实测体积（en + zh + zh-Hant）

| 内容                                     | raw     | gzip   | brotli |
| ---------------------------------------- | ------- | ------ | ------ |
| 仅 3 份 locale-data（en/zh/zh-Hant）     | 363 KB  | 80 KB  | 31 KB  |
| DisplayNames + 3 份 locale-data          | 420 KB  | 96 KB  | 44 KB  |
| ＋ `intl-locale`（安全最小集）           | 657 KB  | 173 KB | 91 KB  |
| ＋ `intl-datetimeformat`（不含 tz 数据） | 1.06 MB | 221 KB | 107 KB |
| 参照：现在整个现代包                     | 831 KB  | 296 KB | —      |

locale-data 是纯数据（约 121 KB/语言），tree-shaking 摇不掉，占 e1 的 4/5。

### 3.3 auto 与 force

- `polyfill.js` 会自检：`!Intl.DisplayNames` 或 `of('CA') === 'CA'` 或 `of('arab') !== 'Arabic'` 才安装。
- **实测这个自检很激进**：健康的 Chrome 150 上 `of('arab')`（小写脚本码）返回 `'arab'`，于是 `hasScriptBug()` 为真 → polyfill 在正常机器上也照样接管原生实现。也就是说“只在坏机器上装”这件事 auto 模式做不到，字节反正都要发。
- `polyfill-force.js` 强制接管；既然 auto 已经会在正常机器上装，我们没必要用 force。
- 想让字节只落在坏机器上，只能用**自己的探测 + 动态 import**：

```ts
if (['en', 'zh-CN', 'zh-TW'].some(displayNamesBroken)) await import('~/intl-polyfill') // 只有这里 import polyfill + locale-data
```

代价：chunk 在首屏之前多一次网络往返（坏机器上首屏会等它），命中 CSS 顺序/竞态也更容易踩。

### 3.4 已验证：确实能修

用 agent-browser 伪造 Android 那种“`of()` 复读输入”的 `Intl.DisplayNames`，再加载 polyfill：

```json
{
  "polyfilled": true,
  "zh-CN": { "af": "南非荷兰语", "za": "南非", "ca": "加拿大" },
  "zh-Hant": { "af": "南非荷蘭文", "za": "南非", "ca": "加拿大" }
}
```

自检命中、原生被替换、中文名正确。

### 3.5 如果连 DateTimeFormat 一起补

- 必须先抓下原生时区再设置，否则默认时区是 **UTC**：

```ts
const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone // 先取
// …再装 polyfill…
Intl.DateTimeFormat.__setDefaultTimeZone(zone)
```

漏掉这步，`today(getLocalTimeZone())`（`pages/devices/[id]/track.vue`）在 UTC+8 的凌晨会算成前一天，是那种半夜才复现的 bug。

- 不引 `add-all-tz.js` 时只有本地时区可用；引了还要再加几十 KB。

## 4. 方案 B：静态表

现在的 `apps/website/src/i18n/language-names.ts` 只有英文（140 码，gzip 2.0 KB）。用有完整 ICU 的环境生成 zh-CN / zh-TW 两份（沿用 `translation-language.ts` 的 qualifier 规则）：

|                    | raw    | gzip   |
| ------------------ | ------ | ------ |
| 现有 en 表         | 4.6 KB | 2.0 KB |
| 新增 zh-CN + zh-TW | 5.5 KB | 3.1 KB |

生成脚本要点：`new Intl.DisplayNames([displayLocale], {type:'language'|'region'|'script'})`，zh 系先 `maximize()` 取 script，zh/ja/ko 不加空格——和运行时逻辑保持一致才能对拍。

优点：零运行时成本、离线可用、坏机器的输出和好机器完全一致。
缺点：只覆盖语言/地区/脚本名这一件事；后端语言列表变了要重新生成（文件头已经写了这条）。

## 5. 方案 C：保留 Intl，只加探测（最小改动）

不引入任何 polyfill，只做两件事：

1. 用第 2 节的 `displayNamesBroken()` 逐语言判断；
2. 判断为坏时直接走现有静态表（`intlLanguageName()` 里加一句 `if (displayNamesBroken(locale)) return null`，顺手把 `fallback: 'none'` 补上）。

改动约 10 行，成本 0 字节，立刻消掉 `af(ZA)`。但它修不好日历里的月份/星期名，也修不好以后新增的 Intl 用法。

## 6. 真机取样（决定 A 还是 B/C 的输入）

在真机 WebView 里跑（现有 `--debug` preview + vconsole 流程即可）：

```js
;(() => {
  const out = { ua: navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0], has: {} }
  for (const k of [
    'Locale',
    'DisplayNames',
    'DateTimeFormat',
    'RelativeTimeFormat',
    'NumberFormat',
    'PluralRules',
    'Collator',
  ])
    out.has[k] = typeof Intl[k]
  if (Intl.DisplayNames) {
    for (const loc of ['en', 'zh-CN', 'zh-TW']) {
      const dn = (type, code) => new Intl.DisplayNames([loc], { type }).of(code)
      out[`displayNames:${loc}`] = {
        langAf: dn('language', 'af'),
        regionCA: dn('region', 'CA'),
        regionZA: dn('region', 'ZA'),
        scriptHant: dn('script', 'Hant'),
        supported: Intl.DisplayNames.supportedLocalesOf([loc]),
      }
    }
  }
  out.dateTime = new Intl.DateTimeFormat('zh-CN', { month: 'long', weekday: 'long' }).format(
    new Date(2020, 0, 1),
  )
  out.number = new Intl.NumberFormat('zh-CN').format(1234567.89)
  out.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return out
})()
```

判读：

- `regionCA === 'CA'` 或 `scriptHant` 不是中文 → DisplayNames 被裁，polyfill / 静态表才有意义。
- `dateTime` 是英文月份 → 日历 UI 也退化了，要一起决定是否补 DateTimeFormat（+107 KB brotli）。
- `timeZone` 不是 `UTC` 且合法 → `getLocalTimeZone()` 没坏，第 3.5 节的坑可以绕开。

## 7. 决策建议

- **只关心语言名**：走 B + C。3 KB gzip 换掉 96~173 KB，坏机器的输出还和好机器一模一样。
- **想“以后 Intl 都不用管”**：走 A（`intl-locale` + `intl-displaynames` + 3 份 locale-data，91 KB brotli），并且先确认线上开了 brotli/gzip——没开压缩的话就是 657 KB。
- **还要修日历**：在 A 之上再加 DateTimeFormat，先跑第 6 节确认真机确实退化了再加。
- 三者的探测部分（第 2 节）都建议先落地：它是唯一能让“API 在、数据不在”进入兜底分支的东西，也是 polyfill 自己的判断依据。

## 8. 未验证 / 开放问题

- 真机 WebView 版本、被裁的具体范围（是否只剩 `US`，中文是否整体返回英文）没有实测数据，第 6 节的探针还没在真机上跑过。
- 生产静态服务器是否开 gzip/brotli 未知（本仓库的 `nginx.conf` 只有本地 preview，没有压缩配置）。
- 若用 `polyfill.js` auto 模式，正常机器也会被接管（见 3.3），对性能的实际影响没测；不想接受就得自己探测 + 动态 import。
- `@internationalized/date` 内部对 `Intl.DateTimeFormat` 有 formatter 缓存，polyfill 必须在它之前加载；只有选 DateTimeFormat 方案时才需要顾虑。

## 9. 已落地（2026-09-21）

走了第 3 节的方案 A，但用第 2 节的探测自己做门控，所以健康机器不会下载这个 chunk：

| 文件                                             | 作用                                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| `apps/website/src/i18n/intl-polyfill-needed.ts`  | 按 UI 语言逐个探测（language/region/script 三类都要查得出来）        |
| `apps/website/src/i18n/intl-polyfill.ts`         | formatjs 的 `intl-locale` + `intl-displaynames` + en/zh/zh-Hant 数据 |
| `apps/website/src/main.ts`                       | 探测为真时 `import()`，加载完再 mount；失败只记日志，不挡启动        |
| `apps/website/src/utils/translation-language.ts` | 改用 `fallback: 'none'`，引擎有 API 没数据时退回静态表               |

实测（Chrome 150，agent-browser 用 init script 伪造 Android 那种 `of()` 复读）：

|                                | 健康引擎        | 伪造的坏引擎                       |
| ------------------------------ | --------------- | ---------------------------------- |
| 是否请求 `intl-polyfill` chunk | 否              | 是（200）                          |
| `Intl.DisplayNames.polyfilled` | `false`（原生） | `true`（polyfill）                 |
| `of('af')` @ zh-CN             | 南非荷兰语      | 南非荷兰语，`zh-TW` 给出南非荷蘭文 |

chunk 体积：540 KB raw / 169 KB gzip / 89 KB brotli（现代包），legacy 包 540 KB。主包不受影响（207 KB / 62.8 KB gzip）。

顺带一个副作用：因为探测在下载之前，formatjs 那段激进的 `hasScriptBug` 自检在健康机器上根本不会执行（3.3 节）。

**没做**：DateTimeFormat（日历的月份/星期名）。等第 6 节的真机探针确认确实退化了再加，代价是再 +107 KB brotli 和 3.5 节的时区坑。
