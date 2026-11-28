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
release.mjs: gh run watch --exit-status  ->  gh release view <tag>
```

## Facts

- `apps/website/dist` uses relative asset paths (`base: './'`), so the zip works from any path; the workflow does not rewrite anything else.
- The GitHub Release body is written by `changelogithub@14` (a changelogen wrapper). It is the release page.
- Version bumps are recursive: root, `apps/*`, `packages/*`. All of them move together — a workspace where only some moved will not build.
- `bumpp` pushes by default. `--no-push` in `release.mjs` is the only way to keep a release local, and it also disables the workflow wait.
- `changelogithub` runs inside the workflow, so the GitHub Release is created by CI, not by `release.mjs`. The script only observes it.

## Manual equivalents

```sh
# bump only, no push
pnpm exec bumpp --recursive --release minor --yes --no-push

# what did the last release do?
gh run list --workflow release.yml --limit 5
gh run view <database-id> --log-failed          # when it failed
gh release view v0.12.0 --json url,assets,isDraft
```

## When the workflow fails

The tag is already pushed. Fix the cause on `main`, then either re-run the run (`gh run rerun <id>`) or move the tag:

1. Fix and commit the real change on `main`.
2. Delete and re-create the tag on the fixed commit:
   ```sh
   git push origin :refs/tags/v0.12.0
   git tag -f v0.12.0 && git push origin v0.12.0
   ```
