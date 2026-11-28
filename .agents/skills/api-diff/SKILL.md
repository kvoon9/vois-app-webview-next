---
name: api-diff
description: 'Compare the live ApiPost share contract with the committed snapshot and report what changed, run before changing an endpoint type or status enum, after the backend announces a change, before a release, or when a field meaning looks stale.'
---

# API diff

`api-reference/weila-webapi/_raw.json` is a snapshot of the team's ApiPost share. The server changes without the snapshot, so types and status meanings drift silently. This command shows that drift in one run.

## When to run

Run it before changing an endpoint's types or a status enum, after the backend announces a change, before a release, or when a field's meaning looks stale.

## Run it

```sh
vp run docs:apipost:diff
```

Exit 0 means the live share matches the snapshot. Exit 1 means differences, printed below. Exit 2 means the pull or the snapshot read failed.

- `--base <dir>` compares against another snapshot directory. The default is the snapshot directory for the share's project title, currently `api-reference/weila-webapi`.
- `--diff-examples` also compares example values. Leave it off unless the values matter, because rotating `et`, `appid`, and token values would otherwise show up as changes.

The command pulls the live share, compares in memory, and never writes under `api-reference/` or anywhere else.

## Read the output

Changed endpoints come first. Each block starts with `origin`, `name`, or `description` when those changed, then per-parameter lines. A parameter line names its scope: `request query`, `request body`, `request header`, `request restful`, or `response <example>`. A nested line shows `field: old -> new` for `field_type`, `description`, and `not_null`. Added and removed endpoints and parameters are marked as such.

An `origin` change is environmental, for example `http://localhost` to `https://api.voischat.cn`. Treat it as a host change, not a contract change.

## What to do next

1. `vp run docs:apipost` refreshes the snapshot and the Markdown pages.
2. Update the TypeScript types and any status registry the contract test in `apps/website/src/utils/device-api.test.ts` guards; for renewal orders that is `RENEW_ORDER_STATES` and `RENEW_CHARGE_STATUS_CODES` in `apps/website/src/utils/device-api.ts`.
3. Run `vp test`, then `vp run ready`.

## Limits

The command compares the documented contract in the share, not the server. Undocumented behavior and server-only changes stay invisible. Field order is not semantic, and example values are compared only with `--diff-examples`.
