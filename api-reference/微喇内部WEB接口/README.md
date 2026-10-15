---
title: 微喇内部WEB接口
description: ApiPost 分享文档的 Markdown 快照
---

# 微喇内部WEB接口

> 来源：`https://docs.apipost.net/docs/detail/6d697c60e879000`  ·  拉取于 2026-10-15

共 44 个接口，由 `vp run docs:apipost` 生成，请勿手改。

- **WEBAPI**
  - **v2**
    - **subuser管理**
      - **管理员**
        - [获取管理员所有好友信息](./WEBAPI/v2/subuser管理/管理员/获取管理员所有好友信息.md) `POST` `http://localhost/v2/subuser/manager-get-all-friend`
        - [获取管理员所有群组信息](./WEBAPI/v2/subuser管理/管理员/获取管理员所有群组信息.md) `POST` `http://localhost/v2/subuser/manager-get-all-group`
        - [获取管理员所有设备信息](./WEBAPI/v2/subuser管理/管理员/获取管理员所有设备信息.md) `POST` `http://localhost/v2/subuser/manager-get-all-device`
      - **轨迹**
        - [获取轨迹](./WEBAPI/v2/subuser管理/轨迹/获取轨迹.md) `POST` `http://localhost/v2/subuser/track-get`
        - [获取轨迹上报模式](./WEBAPI/v2/subuser管理/轨迹/获取轨迹上报模式.md) `POST` `http://localhost/v2/subuser/track-get-mode`
        - [设置轨迹上报模式](./WEBAPI/v2/subuser管理/轨迹/设置轨迹上报模式.md) `POST` `http://localhost/v2/subuser/track-set-mode`
      - **好友**
        - [获取所有好友](./WEBAPI/v2/subuser管理/好友/获取所有好友.md) `POST` `http://localhost/v2/subuser/friend-get-all`
        - [删除好友](./WEBAPI/v2/subuser管理/好友/删除好友.md) `POST` `http://localhost/v2/subuser/friend-delete`
        - [搜索用户](./WEBAPI/v2/subuser管理/好友/搜索用户.md) `POST` `http://localhost/v2/subuser/friend-search-user`
        - [添加好友申请](./WEBAPI/v2/subuser管理/好友/添加好友申请.md) `POST` `http://localhost/v2/subuser/friend-invite`
        - [修改好友备注](./WEBAPI/v2/subuser管理/好友/修改好友备注.md) `POST` `http://localhost/v2/subuser/friend-change-remark`
      - **紧急联系人**
        - [获取紧急联系人信息](./WEBAPI/v2/subuser管理/紧急联系人/获取紧急联系人信息.md) `POST` `http://localhost/v2/subuser/emergency-contact-get`
        - [删除紧急联系人](./WEBAPI/v2/subuser管理/紧急联系人/删除紧急联系人.md) `POST` `http://localhost/v2/subuser/emergency-contact-delete`
        - [添加电话紧急联系人](./WEBAPI/v2/subuser管理/紧急联系人/添加电话紧急联系人.md) `POST` `http://localhost/v2/subuser/emergency-contact-add-phone`
        - [添加好友紧急联系人](./WEBAPI/v2/subuser管理/紧急联系人/添加好友紧急联系人.md) `POST` `http://localhost/v2/subuser/emergency-contact-add-friend`
      - **流量卡**
        - [获取所有流量卡续费记录](./WEBAPI/v2/subuser管理/流量卡/获取所有流量卡续费记录.md) `POST` `http://localhost/v2/subuser/simcard-get-all-renew-order`
        - [获取所有需要续费流量卡](./WEBAPI/v2/subuser管理/流量卡/获取所有需要续费流量卡.md) `POST` `http://localhost/v2/subuser/simcard-get-all-need-renew`
        - [流量卡创建续费订单](./WEBAPI/v2/subuser管理/流量卡/流量卡创建续费订单.md) `POST` `http://localhost/v2/subuser/simcard-create-renew-order`
      - **群组**
        - [获取所有群组](./WEBAPI/v2/subuser管理/群组/获取所有群组.md) `POST` `http://localhost/v2/subuser/group-get-all`
        - [加入群组](./WEBAPI/v2/subuser管理/群组/加入群组.md) `POST` `http://localhost/v2/subuser/group-join`
        - [群成员获取所有成员信息](./WEBAPI/v2/subuser管理/群组/群成员获取所有成员信息.md) `POST` `http://localhost/v2/subuser/group-member-get-all`
        - [群成员删除](./WEBAPI/v2/subuser管理/群组/群成员删除.md) `POST` `http://localhost/v2/subuser/group-member-delete`
        - [群成员修改群昵称](./WEBAPI/v2/subuser管理/群组/群成员修改群昵称.md) `POST` `http://localhost/v2/subuser/group-member-change-remark`
        - [群成员邀请](./WEBAPI/v2/subuser管理/群组/群成员邀请.md) `POST` `http://localhost/v2/subuser/group-member-invite`
        - [群申请待审核信息](./WEBAPI/v2/subuser管理/群组/群申请待审核信息.md) `POST` `http://localhost/v2/subuser/group-get-all-join-audit`
        - [群申请审核](./WEBAPI/v2/subuser管理/群组/群申请审核.md) `POST` `http://localhost/v2/subuser/group-join-audit`
        - [搜索群组](./WEBAPI/v2/subuser管理/群组/搜索群组.md) `POST` `http://localhost/v2/subuser/group-search`
        - [退群](./WEBAPI/v2/subuser管理/群组/退群.md) `POST` `http://localhost/v2/subuser/group-exit`
        - [修改群名](./WEBAPI/v2/subuser管理/群组/修改群名.md) `POST` `http://localhost/v2/subuser/group-change-name`
        - [修改群头像](./WEBAPI/v2/subuser管理/群组/修改群头像.md) `POST` `http://localhost/v2/subuser/group-change-avatar`
        - [修改群主](./WEBAPI/v2/subuser管理/群组/修改群主.md) `POST` `http://localhost/v2/subuser/group-change-owner`
      - **设备**
        - [获取设备信息](./WEBAPI/v2/subuser管理/设备/获取设备信息.md) `POST` `http://localhost/v2/subuser/device-get-detail`
        - [解绑设备](./WEBAPI/v2/subuser管理/设备/解绑设备.md) `POST` `http://localhost/v2/subuser/device-unbind`
        - [修改昵称](./WEBAPI/v2/subuser管理/设备/修改昵称.md) `POST` `http://localhost/v2/subuser/device-change-nick`
        - [修改头像](./WEBAPI/v2/subuser管理/设备/修改头像.md) `POST` `http://localhost/v2/subuser/device-change-avatar`
        - [修改位置共享开关](./WEBAPI/v2/subuser管理/设备/修改位置共享开关.md) `POST` `http://localhost/v2/subuser/device-change-location-share`
      - **提醒**
        - [获取所有提醒](./WEBAPI/v2/subuser管理/提醒/获取所有提醒.md) `POST` `http://localhost/v2/subuser/reminder-get-all`
        - [获取提醒信息](./WEBAPI/v2/subuser管理/提醒/获取提醒信息.md) `POST` `http://localhost/v2/subuser/reminder-get`
        - [删除提醒](./WEBAPI/v2/subuser管理/提醒/删除提醒.md) `POST` `http://localhost/v2/subuser/reminder-delete`
        - [添加提醒](./WEBAPI/v2/subuser管理/提醒/添加提醒.md) `POST` `http://localhost/v2/subuser/reminder-add`
        - [修改提醒](./WEBAPI/v2/subuser管理/提醒/修改提醒.md) `POST` `http://localhost/v2/subuser/reminder-change`
      - **围栏**
        - [获取围栏信息](./WEBAPI/v2/subuser管理/围栏/获取围栏信息.md) `POST` `http://localhost/v2/subuser/geofence-get`
        - [删除围栏](./WEBAPI/v2/subuser管理/围栏/删除围栏.md) `POST` `http://localhost/v2/subuser/geofence-delete`
        - [设置围栏](./WEBAPI/v2/subuser管理/围栏/设置围栏.md) `POST` `http://localhost/v2/subuser/geofence-set`
