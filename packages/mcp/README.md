# mcp

MCP stdio server that exposes the WebView debug pipeline to coding agents. It
turns what `vite-plugin-vois-webview-debug` records (and what
`voisBridgeAuth` mints) into tools an agent can call: find the debug server,
read what pages did, switch the debug account, and speak to the `/v2` HTTP API
as the signed-in account.

The server is dependency-free at runtime apart from `valibot` and runs straight
from TypeScript on Node >= 22.18, so `pi mcp` can start it without a build:

```json
{
  "mcpServers": {
    "vois-debug": {
      "command": "node",
      "args": ["packages/mcp/src/cli.ts"]
    }
  }
}
```

## Tools

| Tool     | What it does                                                                       |
| -------- | ---------------------------------------------------------------------------------- |
| `status` | Probe ports for a live debug server; report event counts and session uptime.       |
| `events` | Read the JSONL capture, filter by type or text; every token is redacted.           |
| `login`  | Re-sign the fixed debug account, or switch the session to account/password.        |
| `token`  | Verify the mint pipeline; shows only the userId, token length, and SHA-256 prefix. |
| `api`    | Signed `/v2` call with the session token, exactly as `weilaFetch` builds it.       |

Secrets never come back: `login` and `token` withhold the token, `events` and
`api` redact credential keys (`token`, `access-token`, `access_token`, `password`,
...) and credential query parameters before anything is formatted.

## 端点

`/v2` is the only API version this repo speaks; `/v1` belongs to native signing
and is out of reach. The `api` tool takes any path and signs it like the page.

- Device management: `/v2/subuser/*` (devices, fence, track, friends, groups,
  emergency contacts, SIM cards)
- Reminders: `/v2/ext/rmdr/*` (get-all, add, change, delete)
- User and account: `/v2/user/get-my-user-info`, `/v2/account/*` (translation,
  smart devices, Bluetooth UUID)
- QR codes: `/v2/qrcode/*`
- Uploads: `/v2/common/upload-file` wants a multipart body, which the tool cannot
  send, so uploads have to go through the page.

Field-level contracts for `/v2/subuser/*` live in `api-reference/`, regenerated
from the team's ApiPost share. That share still documents the superseded
`/v2/subuser/reminder-*` endpoints (the app calls `/v2/ext/rmdr/*`) and has no
pages for the account, QR-code, user or upload groups above; those contracts
live in the app's `utils/*-api.ts` modules.

## Finding the server

`status` probes ports in order: `--port` overrides, then `$VOIS_DEBUG_PORTS`,
then `3021` (dev), `5173` (debug preview), `8080` (production preview). Start a
server the usual way:

```sh
cd apps/website && vp dev --host --port 3021
```

## Configuration

| Variable                                                                 | Default                                                           | Purpose                       |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------- | ----------------------------- |
| `VOIS_DEBUG_PORTS`                                                       | `3021,5173,8080`                                                  | Probe list                    |
| `VOIS_DEBUG_EVENTS_FILE`                                                 | `apps/website/.tmp/vois-webview-debug/events.jsonl`               | Capture to read               |
| `VITE_API_TARGET` (env or `~/.vois/.env`), then `VOIS_API_BASE`          | `https://api.voischat.cn`                                         | API origin for the `api` tool |
| `VOIS_APP_ID` / `VOIS_APP_KEY`                                           | `VITE_*` from the environment or `~/.vois/.env`; no built-in pair | API signing (`api`)           |
| `VOIS_DEBUG_ACCOUNT` / `VOIS_DEBUG_PASSWORD` / `VOIS_DEBUG_COUNTRY_CODE` | the throwaway debug account from `@vois/webview-bridge`           | Fixed account for `login`     |

`--events-file <path>` overrides the capture location from the CLI.

## Development

```sh
vp test    # unit tests (all server exchanges run against injected fetches)
vp run build
```
