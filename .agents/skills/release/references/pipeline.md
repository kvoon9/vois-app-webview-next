# The release pipeline this skill drives

```
pnpm exec bumpp --recursive --release <type> --yes
        |
        +-- rewrites version in 6 package.json files
        +-- commit  chore: release vX.Y.Z
        +-- tag     vX.Y.Z
        +-- push    origin main + tags
                |
                v
.github/workflows/release.yml        (on: push tags v*)
        |
        +-- pnpm install --frozen-lockfile
        +-- vp run website#build          secrets: VITE_APP_ID, VITE_APP_KEY
        +-- zip apps/website/dist -> vois-app-webview-<tag>.zip
        +-- pnpm dlx changelogithub@14 --assets <zip>   -> GitHub Release
                |
                v
release.mjs: gh run watch --exit-status  ->  gh release view <tag>  ->  QQ notification
```

## Facts

- `apps/website/dist` uses relative asset paths (`base: './'`), so the zip works from any path; the workflow does not rewrite anything else.
- The GitHub Release body is written by `changelogithub@14` (a changelogen wrapper) and contains emoji, `<samp>` tags and `&nbsp;` entities. It is the release page, **not** the QQ message; the notification has its own format ([message-format.md](message-format.md)).
- Version bumps are recursive: root, `apps/{docs,mock-server,website}`, `packages/{mcp,utils}`. All six move together — a workspace where only some moved will not build.
- `bumpp` pushes by default. `--no-push` in `release.mjs` is the only way to keep a release local, and it also disables the workflow wait.
- `changelogithub` runs inside the workflow, so the GitHub Release is created by CI, not by `release.mjs`. The script only observes it.
- CI cannot send the QQ message: there is no QQ client on a GitHub runner. The notification always runs locally, after the release exists.

## Manual equivalents

```sh
# bump only, no push
pnpm exec bumpp --recursive --release minor --yes --no-push

# what did the last release do?
gh run list --workflow release.yml --limit 5
gh run view <database-id> --log-failed          # when it failed
gh release view v0.12.0 --json url,assets,isDraft

# the notification on its own (release already published)
node .pi/skills/release/scripts/notify-release.mjs --tag v0.12.0 --dry-run
```

## When the workflow fails

The tag is already pushed. Fix the cause on `main`, then either re-run the run (`gh run rerun <id>`) or move the tag:

1. Fix and commit the real change on `main`.
2. Delete and re-create the tag on the fixed commit:
   ```sh
   git push origin :refs/tags/v0.12.0
   git tag -f v0.12.0 && git push origin v0.12.0
   ```
3. Do not send the QQ notification until `gh release view v0.12.0` reports assets — a notification for a version that never shipped is worse than a late one.
