---
description: 'What the shipped Vois/Weila App promises the H5 bundle: layout of the contract reference and the reverse-engineering workflow.'
navigation: false
---

# native — H5 ↔ Native contract reference

What the shipped Vois/Weila App (`voistech.chat`) promises the H5 bundle in
`apps/website` — the WebView container, the `uniBridgeCall` protocol, page
params, in-app entry points and payment. Reverse-engineered from the packages
vendored in `vender/` (untracked, see below).

This repo is public, so `docs/native/` holds **first-party prose and
machine-readable facts**, never vendor code, keys, or the packages themselves:

- No pasted decompiled source. Claims cite `class#method` plus the artifact
  SHA-256 so anyone can re-derive them locally.
- No credentials or private keys. Public identifiers (package name, WeChat app
  id) are recorded because the contract carries them.
- The packages stay in `vender/` (git-ignored) and are never committed.

## Layout

```
docs/native/
├── index.json                  # artifact registry: identity, hash, docs, tooling
├── tools/
│   └── extract.mjs             # verify a vendored package + extract it for analysis
├── android/
│   ├── README.md               # method + checklist for a new Android package
│   └── v<versionName>+<versionCode>/
│       ├── README.md           # version overview, class map, known unknowns
│       ├── webview-container.md
│       ├── bridge-protocol.md
│       ├── page-params.md
│       ├── entry-points.md
│       ├── wechat-pay.md
│       ├── scan-routing.md
│       ├── inventory.json      # machine-readable contract, diff across versions
│       └── evidence.md         # per-claim provenance and confidence
└── ios/
    ├── README.md               # platform method + checklist, expected H5 contract
    └── v<versionName>+<buildNumber>/
        └── README.md           # version findings; deeper docs once verified
```

`inventory.json` is the diff surface: when a new package lands, the review
question is "what changed in this file", not "read everything again".

Version directories carry a `v` prefix on purpose: Nuxt Content strips a
leading `digits.` prefix from path slugs, so an unprefixed `5.0.4+504` would
render at `/native/android/0.4+504/`.

## Adding a version

1. Drop the package in `vender/` (never commit it) and note its filename.
2. `node docs/native/tools/extract.mjs <artifactId>` — verifies the recorded digest,
   then extracts manifest/resources and decompiles into `.tmp/rev/<artifactId>/`.
   For a quick look instead of a full extraction:

   ```sh
   node docs/native/tools/extract.mjs --web                 # H5-contract classes, ~1 min
   node docs/native/tools/extract.mjs --class <fqcn>        # one class, ~6s
   node docs/native/tools/extract.mjs <id> --verify-only    # hash check only
   ```

3. Work the platform checklist (`android/README.md`) and update the topic docs.
4. Copy the previous version's `inventory.json` to the new version directory and
   reconcile it; add the new entry to `docs/native/index.json` with the SHA-256.
5. Commit with a Conventional Commit, e.g.
   `docs(native): add android 5.1.0+601 contract`.

## Local setup (per machine)

Nothing here is committed; the project MCP entry in `.pi/mcp.json` finds it via
`$HOME` or an environment override.

```sh
brew install jadx openjdk                     # jadx 1.5.6+, JDK with javac
mkdir -p ~/.vois/tools && cd ~/.vois/tools
curl -sSLO https://github.com/1013503897/jadx-headless-mcp/releases/download/v0.7.1/jadx-headless-mcp-0.7.1-all.jar
shasum -a 256 jadx-headless-mcp-0.7.1-all.jar   # 6e5eacf5…ff75
mkdir -p ~/.vois/tools/rea && cd ~/.vois/tools/rea && npm init -y && npm i rea-agents@6.4.0
```

- `~/.vois/tools/rea/node_modules/.bin/rea` is the pinned REA launcher used by
  `.pi/mcp.json`; `npx` cannot be used inside this repo because its
  `devEngines.packageManager` requires pnpm.
- `REA_JADX_MCP_JAR` (default `~/.vois/tools/jadx-headless-mcp-0.7.1-all.jar`)
  enables REA's Android provider; `JAVA_HOME` (default: Homebrew `openjdk`) gives
  it a JDK with `javac`.
- `HOPPER_LAUNCHER_PATH` defaults to
  `~/Applications/Hopper Disassembler.app/Contents/MacOS/hopper` for native
  analysis; Hopper's free demo is enough (see the REA Hopper notes).
- Verify: `pi mcp list` should print `rea: connected, 170 tools (codemode, project)`.

## Ground rules for evidence

- Distinguish **observed** (read out of the package), **inferred** (deduced from
  observed code or from the H5 side), and **unknown**.
- Every observed claim carries a `class#member` pointer and the artifact
  id from `index.json`.
- Never record runtime behavior as observed in a package: static analysis does
  not execute anything. Runtime checks live in the WebView debug pipeline
  (`.tmp/vois-webview-debug/events.jsonl`) and are cited as such.
- This repository is public. Record identifiers the app passes to the H5 (keys,
  app ids) as `<redacted sha256:<12-hex prefix of the value>>` instead of the
  literal: the prefix still reveals a change between versions, the value does
  not leave the machine. The package itself stays untracked in `vender/`.
- When a version diverges, fix the contract docs in place and note the change in
  that version's `README.md`; superseded facts move to a "history" list rather
  than being deleted silently.

## Consumers in this repo

| Contract                  | H5 side                                                           |
| ------------------------- | ----------------------------------------------------------------- |
| `uniBridgeCall` transport | `@vois/webview-bridge` (`dist/index.mjs`)                         |
| `get-page-params`         | `apps/website/src/composables/usePageParams.ts`                   |
| `access-token`            | `apps/website/src/utils/bridge/client.ts`                         |
| `close-page`              | `apps/website/src/composables/usePageBack.ts`                     |
| `wechat-app-prepay`       | none yet — documented in `android/*/wechat-pay.md` for future use |
