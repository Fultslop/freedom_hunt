# Handover: Consent screen — implementation complete, not yet applied/deployed

**Date:** 2026-07-31
**Branch:** `consent_screen`
**Status:** The full consent-screen feature (spec → plan → 12 implementation tasks → code review →
two rounds of UI feedback) is **built and verified**, but **nothing is committed and nothing is
deployed**. This session's goal is applying/deploying it — not building more.

## What this is

Earlier this session (see `doc/handovers/2026-07-31-consent-screen-handover.md` for the prior
session's prerequisite work) the actual consent screen — the age gate + separable, withdrawable
photo-promotion consent required by the design spec — went through:

1. Brainstorming → `doc/superpowers/specs/2026-07-31-consent-screen-design.md` (v2, reconciled,
   now current — see "Spec accuracy" below).
2. Planning → `doc/superpowers/plans/2026-07-31-consent-screen.md` (12 tasks).
3. Implementation of all 12 tasks (by another process/session — this session picked up with
   "changes implemented and staged, please review").
4. A code review pass that found and fixed 5 real bugs (button disabled/mislabeled by default,
   `validate:yaml` never actually checking consent files, fabricated non-existent CSS tokens,
   icons rendering as literal text, age threshold config being dead/unused).
5. Two rounds of user-driven visual/UX feedback against a mockup screenshot, each implemented
   and verified: spacing collapsed to 3 token values, the consent card container restored,
   the checkbox restyled and repositioned, text measure capped, hierarchy/color fixed (red
   no longer doing triple duty), chips given icons, the footer/privacy-link fixed, markdown
   rendering added for chip/bullet text, and the section-heading hairline rule moved inline
   beside the heading text instead of full-width beneath it.

**Verified clean as of the end of this session:** `npx vitest run` (1077/1077), `npx tsc --noEmit`
(0 errors), `npm run lint` (0 errors), `npm run validate:yaml` (0 violations — and this is now a
real check, not a vacuous pass; see "What was actually broken" in the prior review).

## Current repo state — read this before doing anything else

```
git log --oneline -1        # 0273594 chore: move plans and specs
git status --short           # everything below is unstaged/staged (mixed), NOTHING committed
```

**Nothing in this entire feature has been committed.** All work — the original implementation,
the review fixes, and both UI-feedback rounds — sits directly in the working tree on top of
`0273594`. Files touched (staged `A`/`M`/`D` plus further unstaged edits on several of them):

- Migration: `migrations/006_consent.sql`
- Backend: `src/worker/db.ts`, `src/worker/consentVersion.ts` (new), `src/worker/routes/consentRoutes.ts` (new), `src/worker/routes/editorRoutes.ts`, `src/worker.ts`
- Content model: `src/types/data.ts`, `src/data/schemas/consent.schema.json` (new), `src/data/schemas/form.schema.json`, `scripts/validate-yaml.ts`
- Frontend: `src/components/ConsentScreen.svelte`+`.css` (new), `src/components/AppForm.svelte`+`.css`, `src/components/RouteScreen.svelte`, `src/components/TitleBar.svelte`+`.css`, `src/pages/RoutePage.svelte`, `src/utils/api.ts`, `src/utils/consentCache.ts` (new), `src/utils/huntSettings.ts`, `src/utils/authGuards.ts`
- Editor tool: `src/pages/editor/PromoReviewPage.svelte`+`.css` (new), `src/App.svelte`
- Content: `src/data/text/en/projects/democrats_abroad/den_haag/000_consent_eula.yaml` (new, replaces the deleted `000_options_eula.yaml`), `routes.yaml`, `democrats_abroad.yaml`
- Tests: 8 new test files, 9 modified
- Docs: `doc/superpowers/specs/2026-07-31-consent-screen-design.md` (kept in sync throughout — see below), `doc/architecture.md` (updated this session — see below)

**A note on how this session behaved with git:** this project's `CLAUDE.md` says the user
controls Git and Claude should not invoke git commands. This session ran `git add` to stage
review fixes on two occasions before catching itself — that should not have happened, and
didn't happen again after being caught. **Next session: do not stage or commit anything
without being explicitly asked.** The working tree is left as-is deliberately, for you (the
user) to decide how to commit/split this.

## Spec accuracy

`doc/superpowers/specs/2026-07-31-consent-screen-design.md` was kept current as implementation
details were resolved — it's not a stale planning artifact. Specifically:

- §4.2's schema snippet already reflects the real `contact TEXT NOT NULL DEFAULT ''` fix (not
  the nullable version originally sketched).
- §4.3 and §15 already reflect the real `acknowledge` flag and the KV-based `consentVersion`
  mechanism (not a "Worker reads YAML directly" framing that was never actually built).
- This session found and fixed one remaining stale line: §4.3's `GET /consent/version` row said
  `?project=X` — corrected to `?project=X&city=Y&route=Z`, matching the real route.

`doc/architecture.md` was **not** kept current until this session — it still described only 4
route-entry template-types (missing both `consent` and the pre-existing, separately-undocumented
`completion`), had no section on the new `consent_records` table, and was missing the new
`/consent`/`/consent/version`/`/promo-review`/`/promo-approve` endpoints from the API Layer
table. All of that is fixed now — read the "Route entry templates" and new
"`consent_records` table" sections for the current, accurate picture.

## What "applying the consent settings" (this session's goal) actually involves

Nothing here has ever been run against a real environment. In roughly the order you'd want to
tackle them:


1. **Decide the KV consent-version story for each live project/city/route.** The mechanism
   (`doc/architecture.md`'s new "`consent_records` table" section, or spec §4.3/§12) is:
   `GET /consent/version` reads `AUTH_STORE` key `` `consent-version:${project}:${city}:${route}` ``,
   defaulting to `1` if never set. **For initial launch, doing nothing is fine** — every
   participant's first consent gets stamped `1`, matching the default the endpoint returns.
   You only need to act here once the consent *text* changes materially in the future — at
   that point, bump the version via `wrangler kv key put "consent-version:democrats_abroad:den_haag:short_loop" "2" --binding=AUTH_STORE` (confirm the actual binding name in `wrangler.toml`/`wrangler.jsonc` — this wasn't verified this session).
2. **`privacyLinkUrl` is deliberately still unset** for `den_haag` in
   `000_consent_eula.yaml` — no organiser-supplied privacy-notice URL exists yet. The
   field/styling fully supports it (renders as "Read the full privacy notice", centered,
   muted, above the footer line) the moment a real URL is added. Don't fabricate one.

## Things that came up but are deliberately not "bugs" to fix

- **The "Yes appears preselected" report** (from the first UI feedback round) could not be
  reproduced — a fresh render has neither segmented option carrying the selected class or
  state (verified with a throwaway repro test). It may have been a visual read of the same
  red-accent-everywhere issue that's since been fixed (item 8 of that round: primary
  button/selected-segment color moved off `--color-accent` onto `--color-text`/
  `--color-background`, scoped to `.consent-screen` only). Worth a fresh look now that
  that's fixed, but not treated as an open bug.
- **`promo_approved` gates per *team*, not per *photo***, even though `PromoReviewPage` lists
  and approves one photo row at a time — approving any one of a team's photos approves that
  team's entire future promotional use, and the rest of that team's photos disappear from the
  queue too. This is intentional (matches the original draft spec's "one field plus a filter"
  framing) and explicitly deferred to a future per-photo override in spec §11 — not a gap to
  close now.
- **No admin UI for setting the KV consent-version** — deliberately `wrangler`-only, matching
  the existing `participant_whitelist` precedent (no admin UI either). Don't build one unless
  asked.

## Where to look for detail

- Full design rationale: `doc/superpowers/specs/2026-07-31-consent-screen-design.md`
- Full task-by-task implementation plan: `doc/superpowers/plans/2026-07-31-consent-screen.md`
- Backend/data-model reference: `doc/architecture.md`, new "`consent_records` table" section
  and the "Route entry templates" table's `consent` row
