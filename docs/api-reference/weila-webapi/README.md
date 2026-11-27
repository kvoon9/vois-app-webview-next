---
title: 微喇WEB接口
description: ApiPost 分享文档的 Markdown 快照
---

# 微喇WEB接口

> 来源：`https://docs.apipost.net/docs/detail/6d697c60e879000`  ·  拉取于 2026-11-16

共 44 个接口，由 `vp run docs:apipost` 生成，请勿手改。

- **WEBAPI**
  - **v2**
    - **subuser管理**
      - **管理员**
        - [获取管理员所有好友信息](/api-reference/weila-webapi/webapi/v2/subuser/manager/manager-get-all-friend) `POST` `http://localhost/v2/subuser/manager-get-all-friend`
        - [获取管理员所有群组信息](/api-reference/weila-webapi/webapi/v2/subuser/manager/manager-get-all-group) `POST` `http://localhost/v2/subuser/manager-get-all-group`
        - [获取管理员所有设备信息](/api-reference/weila-webapi/webapi/v2/subuser/manager/manager-get-all-device) `POST` `http://localhost/v2/subuser/manager-get-all-device`
      - **轨迹**
        - [获取轨迹](/api-reference/weila-webapi/webapi/v2/subuser/track/track-get) `POST` `http://localhost/v2/subuser/track-get`
        - [获取轨迹上报模式](/api-reference/weila-webapi/webapi/v2/subuser/track/track-get-mode) `POST` `http://localhost/v2/subuser/track-get-mode`
        - [设置轨迹上报模式](/api-reference/weila-webapi/webapi/v2/subuser/track/track-set-mode) `POST` `http://localhost/v2/subuser/track-set-mode`
      - **好友**
        - [获取所有好友](/api-reference/weila-webapi/webapi/v2/subuser/friend/friend-get-all) `POST` `http://localhost/v2/subuser/friend-get-all`
        - [删除好友](/api-reference/weila-webapi/webapi/v2/subuser/friend/friend-delete) `POST` `http://localhost/v2/subuser/friend-delete`
        - [搜索用户](/api-reference/weila-webapi/webapi/v2/subuser/friend/friend-search-user) `POST` `http://localhost/v2/subuser/friend-search-user`
        - [添加好友申请](/api-reference/weila-webapi/webapi/v2/subuser/friend/friend-invite) `POST` `http://localhost/v2/subuser/friend-invite`
        - [修改好友备注](/api-reference/weila-webapi/webapi/v2/subuser/friend/friend-change-remark) `POST` `http://localhost/v2/subuser/friend-change-remark`
      - **紧急联系人**
        - [获取紧急联系人信息](/api-reference/weila-webapi/webapi/v2/subuser/emergency-contact/emergency-contact-get) `POST` `http://localhost/v2/subuser/emergency-contact-get`
        - [删除紧急联系人](/api-reference/weila-webapi/webapi/v2/subuser/emergency-contact/emergency-contact-delete) `POST` `http://localhost/v2/subuser/emergency-contact-delete`
        - [添加电话紧急联系人](/api-reference/weila-webapi/webapi/v2/subuser/emergency-contact/emergency-contact-add-phone) `POST` `http://localhost/v2/subuser/emergency-contact-add-phone`
        - [添加好友紧急联系人](/api-reference/weila-webapi/webapi/v2/subuser/emergency-contact/emergency-contact-add-friend) `POST` `http://localhost/v2/subuser/emergency-contact-add-friend`
      - **流量卡**
        - [获取所有流量卡续费记录](/api-reference/weila-webapi/webapi/v2/subuser/simcard/simcard-get-all-renew-order) `POST` `http://localhost/v2/subuser/simcard-get-all-renew-order`
        - [获取所有需要续费流量卡](/api-reference/weila-webapi/webapi/v2/subuser/simcard/simcard-get-all-need-renew) `POST` `http://localhost/v2/subuser/simcard-get-all-need-renew`
        - [流量卡创建续费订单](/api-reference/weila-webapi/webapi/v2/subuser/simcard/simcard-create-renew-order) `POST` `http://localhost/v2/subuser/simcard-create-renew-order`
      - **群组**
        - [获取所有群组](/api-reference/weila-webapi/webapi/v2/subuser/group/group-get-all) `POST` `http://localhost/v2/subuser/group-get-all`
        - [加入群组](/api-reference/weila-webapi/webapi/v2/subuser/group/group-join) `POST` `http://localhost/v2/subuser/group-join`
        - [群成员获取所有成员信息](/api-reference/weila-webapi/webapi/v2/subuser/group/group-member-get-all) `POST` `http://localhost/v2/subuser/group-member-get-all`
        - [群成员删除](/api-reference/weila-webapi/webapi/v2/subuser/group/group-member-delete) `POST` `http://localhost/v2/subuser/group-member-delete`
        - [群成员修改群昵称](/api-reference/weila-webapi/webapi/v2/subuser/group/group-member-change-remark) `POST` `http://localhost/v2/subuser/group-member-change-remark`
        - [群成员邀请](/api-reference/weila-webapi/webapi/v2/subuser/group/group-member-invite) `POST` `http://localhost/v2/subuser/group-member-invite`
        - [群申请待审核信息](/api-reference/weila-webapi/webapi/v2/subuser/group/group-get-all-join-audit) `POST` `http://localhost/v2/subuser/group-get-all-join-audit`
        - [群申请审核](/api-reference/weila-webapi/webapi/v2/subuser/group/group-join-audit) `POST` `http://localhost/v2/subuser/group-join-audit`
        - [搜索群组](/api-reference/weila-webapi/webapi/v2/subuser/group/group-search) `POST` `http://localhost/v2/subuser/group-search`
        - [退群](/api-reference/weila-webapi/webapi/v2/subuser/group/group-exit) `POST` `http://localhost/v2/subuser/group-exit`
        - [修改群名](/api-reference/weila-webapi/webapi/v2/subuser/group/group-change-name) `POST` `http://localhost/v2/subuser/group-change-name`
        - [修改群头像](/api-reference/weila-webapi/webapi/v2/subuser/group/group-change-avatar) `POST` `http://localhost/v2/subuser/group-change-avatar`
        - [修改群主](/api-reference/weila-webapi/webapi/v2/subuser/group/group-change-owner) `POST` `http://localhost/v2/subuser/group-change-owner`
      - **设备**
        - [获取设备信息](/api-reference/weila-webapi/webapi/v2/subuser/device/device-get-detail) `POST` `http://localhost/v2/subuser/device-get-detail`
        - [解绑设备](/api-reference/weila-webapi/webapi/v2/subuser/device/device-unbind) `POST` `http://localhost/v2/subuser/device-unbind`
        - [修改昵称](/api-reference/weila-webapi/webapi/v2/subuser/device/device-change-nick) `POST` `http://localhost/v2/subuser/device-change-nick`
        - [修改头像](/api-reference/weila-webapi/webapi/v2/subuser/device/device-change-avatar) `POST` `http://localhost/v2/subuser/device-change-avatar`
        - [修改位置共享开关](/api-reference/weila-webapi/webapi/v2/subuser/device/device-change-location-share) `POST` `http://localhost/v2/subuser/device-change-location-share`
      - **提醒**
        - [获取所有提醒](/api-reference/weila-webapi/webapi/v2/subuser/reminder/reminder-get-all) `POST` `http://localhost/v2/subuser/reminder-get-all`
        - [获取提醒信息](/api-reference/weila-webapi/webapi/v2/subuser/reminder/reminder-get) `POST` `http://localhost/v2/subuser/reminder-get`
        - [删除提醒](/api-reference/weila-webapi/webapi/v2/subuser/reminder/reminder-delete) `POST` `http://localhost/v2/subuser/reminder-delete`
        - [添加提醒](/api-reference/weila-webapi/webapi/v2/subuser/reminder/reminder-add) `POST` `http://localhost/v2/subuser/reminder-add`
        - [修改提醒](/api-reference/weila-webapi/webapi/v2/subuser/reminder/reminder-change) `POST` `http://localhost/v2/subuser/reminder-change`
      - **围栏**
        - [获取围栏信息](/api-reference/weila-webapi/webapi/v2/subuser/geofence/geofence-get) `POST` `http://localhost/v2/subuser/geofence-get`
        - [删除围栏](/api-reference/weila-webapi/webapi/v2/subuser/geofence/geofence-delete) `POST` `http://localhost/v2/subuser/geofence-delete`
        - [设置围栏](/api-reference/weila-webapi/webapi/v2/subuser/geofence/geofence-set) `POST` `http://localhost/v2/subuser/geofence-set`
