# The release notification format (fixed)

The QQ message has one shape. It was chosen against QQ's own editor behaviour, not for taste, and both `changelog.mjs` and any agent rewrite must produce exactly this.

```
vois-app-webview-next 已更新：https://github.com/kvoon9/vois-app-webview-next/releases/tag/v0.12.0
本次更新 9 项（v0.11.0 → v0.12.0）
新增：设备详情页支持修改备注名；设备列表分组折叠状态记住
修复：SIM 卡余额刷新后丢失；蓝牙配网偶发超时
文档：补充 Android H5 契约的返回码说明
有空可更新一下 @大宝
```

## Hard rules

| rule                                    | why                                                                                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No blank lines**                      | QQ's editor deletes whitespace-only lines when text is inserted, so a blank line silently collapses and the message reads as one run-on block. Verified against the rendered message. |
| **No markdown**                         | The bubble shows `**bold**`, `` `code` `` and `[text](url)` literally. The release URL is the only URL, and it sits on the title line.                                                |
| **No emoji**                            | This is a notification, not a changelog page. Emoji also eats the width that keeps lines short.                                                                                       |
| **One line per section**                | A section with six items is one line with `；` separators, never six lines.                                                                                                           |
| **Chinese section labels, fixed order** | `不兼容变更` → `新增` → `修复` → `优化` → `重构` → `文档` → `构建` → `其他`. Only sections with items appear.                                                                         |
| **≤ 6 items per section**               | Beyond six, write `等 N 项`. Keeps the line under a phone screen's width.                                                                                                             |
| **Fixed last line**                     | `有空可更新一下 @大宝`, on its own line, always. It is the call to action; `buildMessage()` appends it, so a `--notes-file` body must not add it again.                               |
| **Title line exactly once, first**      | `vois-app-webview-next 已更新：<release url>`. The URL comes from `gh release view <tag> --json url`, not from string building, unless the release does not exist yet.                |

## Line 2: the summary

`本次更新 N 项（<prev tag> → <tag>）`, where N is the number of commits after the release-commit and `chore`-noise filtering. For a first release, drop the range: `本次更新 N 项`.

If nothing user-facing changed, write `本次没有面向用户的变化` on line 2 and go straight to the call-to-action line — do not send an empty section.

## Items

- Rewrite each commit subject into Chinese. Keep proper nouns, API paths, product names, file paths and identifiers in English: `MCP 签名对改为从环境变量读取`, `docs 目录结构整理`, `Nuxt Content 文档站`.
- One clause per item, no trailing period, no commit hash, no PR number, no author.
- Drop the conventional-commit prefix (`feat:`, `fix(device):`) — the section label already says it. A scope worth keeping becomes a prefix: `设备详情：支持修改备注名`.
- User-visible behaviour change first; internal churn (`chore`, `style`, `test`) only when a user would notice. The `其他` section carries that remainder and is the first one to drop when the message runs long.
- Aim for ≤ 26 characters per item; that is roughly one phone line for two items.

## Before / after

Draft from commits (`changelog.mjs`, raw material):

```
本次更新 16 项（v0.10.1 → v0.11.0）
新增：docs：add Nuxt Content site for…；device：drive reminders and the S…
修复：mcp：read the signing pair fro…
文档：readme：link the docs site；consolidate scattered doc…；…
```

What gets sent (agent rewrite):

```
vois-app-webview-next 已更新：https://github.com/kvoon9/vois-app-webview-next/releases/tag/v0.11.0
本次更新 16 项（v0.10.1 → v0.11.0）
新增：文档站改用 Nuxt Content；设备提醒与 SIM 卡接入真实 v2 接口
修复：MCP 签名对改为从环境变量读取
文档：README 补充 Figma 设计链接；整理 docs 目录结构
构建：文档站部署到 Cloudflare Workers；引入 commitlint 校验
其他：Figma 工具换成 TemPad Dev；tempad-dev MCP 改为自安装
有空可更新一下 @大宝
```

## Why not changelogen

changelogen was the first implementation and was dropped after testing the real message:

1. Its section headings are emoji + English (`### 🚀 Enhancements`), and its markdown (`**scope:**`, `[hash](url)`, `<samp>`, contributor list) renders literally in a QQ bubble.
2. More decisively, its output is multi-paragraph. QQ drops whitespace-only lines, so the paragraphs collapse and every heading runs into the block above it.

The commit parser in `scripts/changelog.mjs` replaces it: git log → conventional-commit parse → fixed Chinese sections → the shape above.
