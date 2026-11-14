# 真机 vs H5 对照 · 第 5 轮：紧急联系人与充值

2026-11-14。真机与 H5 都是 12679166 下的 CF03（`1683740` / `1468550` 同设备），两侧数据可直接对照。H5 为 `origin/main`（含 #19、#21）加本轮改动，375×812。

## 1. 紧急联系人设置

`native-emergency.png` ↔ `fixed-emergency.png`

| 项 | 原生 | H5 改前 | H5 改后 |
| --- | --- | --- | --- |
| 标题 | 18sp | 24px | 18px |
| 提示区 | 纯文本三行，无标题 | 「温馨提示」标题加白卡 | 纯文本三行 |
| 入口行高 | 54.1 | 48 | 56 |
| 已加入 | 无标题，空白卡 | 「已加入」可见标题 | 仅屏幕阅读器标题 |

剩余：原生提示行间距略大，卡片起始位置低约 8px；不构成结构差异。

## 2. 添加微喇联系人

`native-emergency-add-friend.png` ↔ `fixed-emergency-add-friend.png`

| 项 | 原生 | H5 改前 | H5 改后 |
| --- | --- | --- | --- |
| 标题 | 18sp | 24px | 18px |
| 搜索框 | 351×38（384 宽） | 343×48 | 343×38 |
| 行高 | 64 | 64 | 64 |
| 右侧索引 | A–Z | 无 | 无（列表仅 1 行） |

数据差异不是样式问题：H5 只列设备联系人，因为后端只接受设备好友作为 SOS 联系人（否则 `errcode 300`）；原生列出账号通讯录。H5 当前只有 1 个设备联系人，所以索引栏不会出现（少于 4 行隐藏）。

## 3. 添加电话联系人

`native-emergency-add-phone.png` ↔ `fixed-emergency-add-phone.png`

| 项 | 原生 | H5 改前 | H5 改后 |
| --- | --- | --- | --- |
| 标题 | 18sp | 24px | 18px |
| 输入框 | 约 48 高，间距 59.8 | 56 高 | 48 高，间距 60 |
| 提示文字 | 灰 12sp | 灰 12px | 一致 |
| 保存按钮 | 50 高，全宽绿底 | 48 高 | 一致 |

剩余：头像占位原生是方形图片，H5 是圆角方形的用户图标；垂直位置差约 10px。

## 4. 流量卡充值记录

`native-recharge-records.png` ↔ `h5-recharge-records.png`

原生每张订单卡有 7 个字段：名称（空）、金额（右对齐，29.00元）、时间、订单号、卡号、支付状态（未支付）、充值状态（未充值）。H5 是紧凑行：金额、状态、订单号、未到账，缺时间、卡号与两个状态标签；原生 3 条订单，H5 10+ 条（接口返回集合不同）。这是布局重写，未在本轮修改。

## 5. 待续费设备

`h5-recharge-list.png`。H5 设备行含名称、型号、微喇号、卡到期时间与「续费」。原生 tab 根页没有该入口（登录前见过的推送页头部才有「待续费设备」），本轮未取得原生对照。

## 6. 充值确认

`native-recharge-pay-dialog.png`。原生是模态框：标题「IOT流量卡续费1年」、商品总额 29.00 元（红色）、取消 / 支付。H5 的缴费入口走微信支付参数，浏览器里没有桥，未触发，以免创建新订单。

## 本轮已改

1. 三个紧急联系人子页标题 18px。
2. 紧急联系人页去掉「温馨提示」标题与提示卡，去掉「已加入」可见标题，入口行高 56。
3. 添加微喇联系人搜索框 38 高。
4. 添加电话联系人输入框 48 高。
## 截图

![紧急联系人设置](/parity/round5/native-emergency.png)

![紧急联系人设置 H5](/parity/round5/fixed-emergency.png)

![添加微喇联系人](/parity/round5/native-emergency-add-friend.png)

![添加微喇联系人 H5](/parity/round5/fixed-emergency-add-friend.png)

![添加电话联系人](/parity/round5/native-emergency-add-phone.png)

![添加电话联系人 H5](/parity/round5/fixed-emergency-add-phone.png)

![充值记录](/parity/round5/native-recharge-records.png)

![充值记录 H5](/parity/round5/h5-recharge-records.png)

![充值确认](/parity/round5/native-recharge-pay-dialog.png)
