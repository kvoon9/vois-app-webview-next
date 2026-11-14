---
name: maintain-lint-guards
description: 'Add or audit the build-time guards that stop unsupported CSS utilities from shipping. Use when a legacy-target regression traces to a utility an old WebView drops (a collapsed layout, a vanished declaration), when adding or reviewing a blocklist rule, or for a periodic audit of the banned utilities.'
---

# Maintain lint guards

Two layers enforce the Chrome 83 target.

| Layer            | Source                                             | Catches                                      | Visible failure                                     |
| ---------------- | -------------------------------------------------- | -------------------------------------------- | --------------------------------------------------- |
| UnoCSS blocklist | `apps/website/uno.config.ts` (`BLOCKED_UTILITIES`) | a utility the target cannot support          | the generator emits no CSS, so the class is a no-op |
| Source test      | `apps/website/src/utils/banned-utilities.test.ts`  | a banned utility in a `.vue` class attribute | `vp test` fails and names the file and class        |

`tools/oxlint/anti-slop/` guards TypeScript shapes. It cannot see Vue templates or generated CSS, so it is not the tool for utility bans.

A missing JavaScript API is not a blocklist rule. Add or extend a polyfill in `apps/website/src/polyfills.ts` instead, as the Chrome 92 `Object.hasOwn` gap did.

## Add a guard

1. **Find the first unsupported token.** Trace the symptom to the utility, not the component that rendered it. The target is Chrome 83. `gap` arrived in Chrome 84. `svh`, `dvh`, and `lvh` arrived in Chrome 108, and an older engine drops the whole declaration that uses one.
2. **Add one rule to `BLOCKED_UTILITIES`.** Match the raw utility string so arbitrary values count (`h-[calc(100svh-3.5rem)]`), not just bare classes. Give the rule a message that names the replacement.
3. **Sweep every usage.** Run `rg -n '<token>' apps/website/src apps/website/uno.config.ts`. Shortcuts count. Replace with a supported unit (`vh`, `screen`) or a pinned/fixed layout. If the layout must fill the page, reuse or add a named shortcut such as `map-viewport`; do not copy the class string.
4. **Fix shortcuts by hand.** A blocked token inside a shortcut is dropped at generation time, and the source test does not scan `uno.config.ts`.
5. **Add a direct contract case.** In `banned-utilities.test.ts`, assert `uno.isBlocked` for the exact class from the bug, the bare utility, and the allowed replacement. The scanner test covers real files. The direct case locks the matcher.
6. **Prove it red, then green.** Write the bad class into a temporary `.vue` under `apps/website/src/pages/`, run the test, capture the failure line, delete the probe, rerun. `vp check` alone is not proof.
7. **Check the artifact.** Run `vp run website#build`, then `rg -o '<banned token>' apps/website/dist/assets/*.css` must print nothing, and the replacement must appear.
8. **Run the gate.** `vp run ready` exits 0 on the committed tree.

## Upkeep pass

Run after an old-device bug, when the target browser floor changes, or on request.

- Read `BLOCKED_UTILITIES` and the direct cases in the test. Each rule needs a case that proves it fires and a case that proves the replacement passes.
- Sweep the app for each family the target gained late. A token that appears only in a comment is fine.
- Read the built CSS for every blocked family. A hit means a shortcut or safelist bypassed the rule.
- Delete rules the target now supports and move their tokens to the allowed cases.
- Keep the messages actionable. "Use X instead" beats "unsupported".

## Gotchas

- The source test scans `.vue` class attributes only. A class assembled in a `.ts` file is not caught there, but the blocklist still emits no CSS. Add a direct case or move the class into a template.
- The matcher sees the raw utility string. A sub-string rule can hit a filename inside `bg-[url(lvh.png)]`. Keep the loud false positive unless a tighter boundary still catches arbitrary values. A silent false negative collapses the layout.
- Variants are stripped before `isBlocked` in the test. Add a variant case only when the variant changes the utility.
- `BLOCKED_UTILITIES` is the source of truth. Do not copy the list into docs or into this skill.
