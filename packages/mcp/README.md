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
`api` redact credential keys (`token`, `access-token`, `password`, ...) and
credential query parameters before anything is formatted.

## Finding the server

`status` probes ports in order: `--port` overrides, then `$VOIS_DEBUG_PORTS`,
then `3021` (dev), `5173` (debug preview), `8080` (production preview). Start a
server the usual way:

```sh
cd apps/website && vp dev --host --port 3021
```

## Configuration

| Variable                                                                 | Default                                                               | Purpose                       |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------- | ----------------------------- |
| `VOIS_DEBUG_PORTS`                                                       | `3021,5173,8080`                                                      | Probe list                    |
| `VOIS_DEBUG_EVENTS_FILE`                                                 | `apps/website/.tmp/vois-webview-debug/events.jsonl`                   | Capture to read               |
| `VOIS_API_BASE`                                                          | `https://api.voischat.cn`                                             | API origin for the `api` tool |
| `VOIS_APP_ID` / `VOIS_APP_KEY`                                           | `VITE_*` from the env or `~/.vois/.env`, then the app's built-in pair | API signing                   |
| `VOIS_DEBUG_ACCOUNT` / `VOIS_DEBUG_PASSWORD` / `VOIS_DEBUG_COUNTRY_CODE` | the throwaway debug account from `@vois/webview-bridge`               | Fixed account for `login`     |

`--events-file <path>` overrides the capture location from the CLI.

## Development

```sh
vp test    # unit tests (all server exchanges run against injected fetches)
vp run build
```
