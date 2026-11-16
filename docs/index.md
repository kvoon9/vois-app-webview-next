---
title: 文档总览
description: Vois WebView 的接口、Native 契约、工程研究与真机对照文档的统一入口。
---

# Vois WebView 文档

本目录是仓库唯一的第一方文档源，`apps/docs` 用 Nuxt Content 直接渲染 `docs/` 下的 Markdown。

> 使用顶部搜索（`⌘K` / `Ctrl+K`）可直接查找接口、字段和文档标题。

## 接口

- [API 参考（ApiPost 快照）](/api-reference/weila-webapi/readme)：44 个 `/v2/subuser/*` 接口的字段级契约，由 `vp run docs:apipost` 生成。
- [设备管理接口需求（历史）](/api/device-management-api-requirements)：接口谈判记录，当前以 API 参考为准。
- [AI 翻译设置接口需求](/api/ai-translation-settings-api-requirements)

## Native 契约

- [H5 ↔ Native 契约总览](/native/bridge-contract)
- [Android 5.0.4 (504)](/native/android/v5.0.4+504/readme)
- [Android 5.0.8 (508) 定位扩展](/native/android/v5.0.8+508/location-bridge)
- [iOS 5.0.3 (1)](/native/ios/v5.0.3+1/readme)

## 工程研究

- [MCP 调试服务](/engineering/mcp-debug-server)
- [Bridge token 重构](/engineering/bridge-token-redesign)
- [Bridge 5.0.8 新增能力](/engineering/bridge-5.0.8-additions)
- [实时定位 Bridge](/engineering/realtime-location-bridge)
- [Intl polyfill 调研](/engineering/intl-polyfill-research)

## 状态与对照

- [设备管理现状](/device-management-status)
- [设备管理可行性](/device-management-feasibility)
- [设备管理验证](/device-management-verification)
- [UI/UX 对齐计划](/uiux-alignment-plan)
- [真机对照 Round 4](/parity/comparison-report-round4)
- [真机对照 Round 5](/parity/comparison-report-round5)
