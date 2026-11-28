---
description: '流量卡充值记录的支付/续费状态模型：接口码表、边界解析规则、页面渲染约定，以及有测试兜底的四条不变量。改状态映射或刷新 apipost 快照前先读这篇。'
---

# 流量卡充值记录的状态模型

`POST /v2/subuser/simcard-get-all-renew-order` 的每条记录带两个数字状态。码表的唯一来源是提交的 apipost 快照：`api-reference/weila-webapi/webapi/v2/subuser/simcard/simcard-get-all-renew-order.md`。本文只记录代码如何消费它，以及哪些不变量有测试兜底。

## 码表（2026-11-28 快照）

| 字段 | 码 | 含义 |
| --- | --- | --- |
| `status` | 0 | 未支付 |
| | 1 | 已支付 |
| | 2 | 已关闭 |
| | 3 | 交易单过期 |
| | 4 | 支付超时 |
| | 5 | 订单异常 |
| `charge_status` | 0 | 未充值 |
| | 1 | 已充值 |

## 边界解析

`parseRenewOrderState(status, chargeStatus)`（`apps/website/src/utils/device-api.ts`）在 `toRenewOrderRecord` 里把二元组解析成 `RenewOrderState`：`payment` 和 `charge` 两个子状态各自独立解析，页面分别渲染，不读原始数字。

| 输入 | 输出 |
| --- | --- |
| `status` 不在 0..5 | `payment = unknown`，保留原始码 |
| `charge_status` 不在 0/1 | `charge = unknown`，保留原始码 |
| 其余已记录码 | 对应单一状态；两个字段互不影响，同一条记录可以同时是「已关闭」和「已充值」 |

## 不变量

1. **两个字段独立渲染，页面不改写线上含义。** `charge_status = 1` 与任何支付状态组合都按原值显示：`(status 2, charge_status 1)` 渲染「已关闭」+「已充值」，与 `(status 1, charge_status 1)` 的「已支付」+「已充值」走同一条路径。
2. **未知码不会静默变成未支付。** 反例：后端新增 `status = 6` 时，旧实现显示「未支付」；现在显示「未知状态 6」并标红。`charge_status` 的域外码同理，标红的是续费状态行。
3. **解析对全部输入有定义。** 任意数字都不抛错，这是纯函数；边界只有 `toRenewOrderRecord` 一处。
4. **码表与快照一致。** `device-api.test.ts` 的 `keeps the payment status parser tied to the apipost snapshot` 读提交的 Markdown 快照，抽出说明列里的码，既与字面量比对，也要求每个码解析成已知状态。快照新增码而代码没跟上时，先红的是这条测试。

## 复核方式

```sh
cd apps/website && vp test
```

漂移测试的失败信息会直接指出要改的地方。改完状态映射后，按 `.agents/skills/api-diff/SKILL.md` 再拉一次线上契约，确认快照没过期。

## 边界

这套验证覆盖「接口码 → 页面状态」这一段纯映射，不覆盖服务端生命周期：订单何时从 0 走到 1 由后端决定，H5 只能如实呈现。`charge_status = 1` 而 `status ≠ 1` 是否属于后端合法状态仍需后端确认；页面不再标记异常，只按线上值分别渲染两个字段（见不变量 1）。
