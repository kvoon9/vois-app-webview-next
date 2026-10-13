# native — H5 ↔ Native contract reference

What the shipped Vois/Weila App (`voistech.chat`) promises the H5 bundle in
`apps/website` — the WebView container, the `uniBridgeCall` protocol, page
params, in-app entry points and payment. Reverse-engineered from the packages
vendored in `vender/` (untracked, see below).

This repo is public, so `native/` holds **first-party prose and
machine-readable facts**, never vendor code, keys, or the packages themselves:

- No pasted decompiled source. Claims cite `class#method` plus the artifact
  SHA-256 so anyone can re-derive them locally.
- No credentials or private keys. Public identifiers (package name, WeChat app
  id) are recorded because the contract carries them.
- The packages stay in `vender/` (git-ignored) and are never committed.

## Layout

```
native/
├── index.json                  # artifact registry: identity, hash, docs, tooling
├── tools/
│   └── extract.mjs             # verify a vendored package + extract it for analysis
├── android/
│   ├── README.md               # method + checklist for a new Android package
│   └── <versionName>+<versionCode>/
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
    └── README.md               # what is known/expected on iOS, none verified yet
```

`inventory.json` is the diff surface: when a new package lands, the review
question is "what changed in this file", not "read everything again".

## Adding a version

1. Drop the package in `vender/` (never commit it) and note its filename.
2. `node native/tools/extract.mjs <path-to-package>` — verifies the SHA-256
   against `index.json` when present, then extracts manifest/resources and
   decompiles into `.tmp/rev/<artifactId>/`.
3. Work the platform checklist (`android/README.md`) and update the topic docs.
4. Copy the previous version's `inventory.json` to the new version directory and
   reconcile it; add the new entry to `native/index.json` with the SHA-256.
5. Commit with a Conventional Commit, e.g.
   `docs(native): add android 5.1.0+601 contract`.

## Ground rules for evidence

- Distinguish **observed** (read out of the package), **inferred** (deduced from
  observed code or from the H5 side), and **unknown**.
- Every observed claim carries a `class#member` pointer and the artifact
  id from `index.json`.
- Never record runtime behavior as observed in a package: static analysis does
  not execute anything. Runtime checks live in the WebView debug pipeline
  (`.tmp/vois-webview-debug/events.jsonl`) and are cited as such.
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
