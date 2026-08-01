# Team-Scoped Local Storage (implementation-ready)

Date: 2026-08-01

## 0. Problem

Switching teams on the same device (logging out and back in as a different team, or using
JoinSheet's "Continue as [team]" / "Join as a different team" flow) does not reset the app's local
state. A new team can see the previous team's in-progress form answers, swipe position, and
consent cache; logging back into an old team should — but currently only accidentally does, via
the same collision — resume where it left off.

Root cause: several localStorage keys are scoped only by `project/city/route(/locationId)`, with
no identity dimension for *who* the team is:

| Key owner | Current key shape |
|---|---|
| `formStorage.ts` (`buildFormStorageKey`) | `${project}/${city}/${route}/${locationId}/form` |
| `RoutePage.svelte` (swipe index) | `${project}/${city}/${route}` |
| `consentCache.ts` (`cacheKey`) | `${project}/${city}/${route}/consent` |
| `OptionsScreen.svelte` (`start_route` reset) | `${project}/${city}/${route}` — must match RoutePage's key |

Server-side storage is already correctly scoped: `form_submissions` and `consent_records` are
keyed by `(project_id, team_name, contact)` (`doc/architecture.md`). This is a client-cache
scoping bug only — no server-side data integrity problem exists.

Two other team-name-adjacent localStorage keys are **not** part of this bug and are unchanged by
this spec — they're login-form prefill convenience, not participant progress data:

- `JoinSheet.svelte`'s last-successfully-resolved hunt code (`LAST_HUNT_CODE_KEY`)
- `LoginPage.svelte` / `TeamSetupPage.svelte`'s remembered team name per project (`teamName:${project}`)

## 1. Scoping identity — two different grains, not one

A team name is unique per route — two different teams can never share one. So `teamName` +
`contact` does not distinguish "two teams that happen to collide"; it distinguishes **team
members within the same team** (relevant only to individual-login projects like `demo`, where
each person has their own account but can share a team name). That means route progress and
consent don't necessarily belong at the same grain, and — confirmed with the requester — they
don't:

- **Route progress (swipe position) and form answers are shared per team.** The team moves
  through the route together and fills out one shared set of answers, regardless of which
  member's device or login submitted it. Scoped by **`teamName` only** — deliberately *not*
  `contact`, so two members of the same team see the same shared progress, matching how
  shared-team-password projects (no per-person login at all) already work today.
- **Consent stays per person.** `consent_records` is already deliberately scoped by `(project_id,
  team_name, contact)` server-side — age-gate/consent is a personal attestation a teammate can't
  give on someone else's behalf (`doc/architecture.md`). The local consent-version cache mirrors
  that: scoped by **`teamName` + `contact`**.

Both are read from `$authStore.activeAuth` (kind `"participant"`) at the point of use, the same
way `ChallengeForm.svelte`'s `postFormSubmit` call and `OptionsScreen.svelte`'s `trackSelection`
already read `teamName`/`contact` today:

```ts
const auth = $authStore.activeAuth;
const teamName = auth?.kind === "participant" ? auth.teamName : "";
const contact = auth?.kind === "participant" ? (auth.contact ?? "") : "";
```

## 2. Key builder changes

**`formStorage.ts`** — gains `teamName: string` only:
```ts
buildFormStorageKey(project, city, route, locationId, teamName)
// → `${project}/${teamName}/${city}/${route ?? ""}/${locationId}/form`
```

**`consentCache.ts`** — gains `teamName: string, contact: string`:
```ts
cacheKey(project, city, route, teamName, contact)
// → `${project}/${teamName}/${contact}/${city}/${route}/consent`
```
`writeConsentCache`/`readConsentCache` both gain the same two trailing parameters and forward them.

**`locationFormLookup.ts`** — gains `teamName: string` only (forwards to `buildFormStorageKey`):
```ts
getLocationFormValue(project, city, route, locationId, fieldId, teamName)
```
Its only caller, `visibility.ts`'s cross-form reference resolution, needs `teamName` added to the
`formContext` shape it already receives:
```ts
formContext?: { project: string; city: string; route?: string; teamName: string };
```

**`completionStats.ts`** — gains `teamName: string` only:
```ts
computePhotosTaken(project, city, route, locationIds, teamName)
computeElapsedSinceFirstSubmission(project, city, route, locationIds, now, teamName)
```

No new shared "team scope" helper module — the two grains (team-only vs. team+contact) are
different enough per call site that a single combining helper would just hide which one applies
where; passing plain strings keeps that explicit.

## 3. Call site changes

No prop-threading through `RouteScreen`/`ChallengeCard` — each component that builds a
team-scoped key reads `$authStore.activeAuth` directly (a global store), the same way
`ChallengeForm.svelte` already does today for its `postFormSubmit` call.

- **`RoutePage.svelte`** — swipe-index key (see §4 for the sequencing fix this requires; `teamName`
  only), `computePhotosTaken`/`computeElapsedSinceFirstSubmission` calls (`teamName` only),
  `readConsentCache` call (`teamName` **and** `contact`). Gains an `authStore` import.
- **`ChallengeForm.svelte`** — its `storageKey` (see §4; `teamName` only), and adds `teamName` to
  the `formContext={{ project, city: cityId, route: routeId }}` object passed to `AppForm`.
  Already imports `authStore`.
- **`ConsentScreen.svelte`** — `writeConsentCache` call inside `handleSubmit` (`teamName` **and**
  `contact`). Gains a new `authStore` import (doesn't have one today).
- **`OptionsScreen.svelte`** — the `start_route` reset (`localStorage.removeItem(...)`) must build
  the identical key shape `RoutePage` uses for its swipe index (`teamName` only), so a "restart
  route" action clears the right team's saved position. Already imports `authStore` (used in
  `trackSelection`); reuse the same derivation in `handlePageSelect`.

## 4. Auth-resolution race — required fix, not a caveat

**The bug this would otherwise introduce.** `RoutePage.svelte` currently seeds `currentIndex`
synchronously at mount from a *not-yet-reactive* snapshot of `storageKey`
(`RoutePage.svelte:51-53`, deliberately `untrack`-wrapped to avoid a Svelte warning), and persists
it via an effect that fires on *any* change to `storageKey` or `currentIndex`
(`RoutePage.svelte:125-127`), not only user-driven swipes.

Once `storageKey` includes `teamName`, a hard reload straight into a mid-route URL exposes a real
race: `authStore.init()`'s `fetchAuthMe()` call is still in flight when `RoutePage` mounts (the
route guard in `authGuards.ts` already lets navigation through while `authLoading` is true —
existing behavior, unchanged here). At that instant `$authStore.activeAuth` is `null`, so the
initial seed reads an "empty-team" key (finds nothing, `currentIndex = 0`). When `fetchAuthMe()`
resolves a moment later, `storageKey` (made reactive/`$derived` on `$authStore`) recomputes to the
real team's key — and because the persistence effect fires on *that* key change too, it
immediately writes the stale `currentIndex = 0` into the **real team's key, overwriting their
actual saved progress.**

**Fix.** Don't touch team-scoped storage in `RoutePage` until identity is known:

- Add a `hasSeededIndex` flag (`$state(false)`).
- An effect gated on `!$authStore.authLoading && !hasSeededIndex` performs the one-time read
  (real saved index, or `0` if none) and sets `hasSeededIndex = true`.
- The persistence effect only writes when `hasSeededIndex` is `true` — so it cannot fire with the
  placeholder value before the real seed happens.

In the common case (normal in-app navigation: login → project → route), `authLoading` is already
`false` long before `RoutePage` mounts, so this resolves in the same tick and there's no visible
change in behavior. Only a cold hard-reload directly into a route URL sees a brief `currentIndex =
0` render before the effect corrects it once auth resolves — an acceptable momentary UI blip,
categorically different from silently destroying saved progress.

**`ChallengeForm.svelte`** has the same pattern (untracked one-time `storageKey` read at mount) but
lower stakes: no effect writes back on a `storageKey` change, so there's no overwrite risk — only a
transient risk that the *first* location visited right after a cold reload loads/saves under the
wrong (empty-team) bucket for that one location, until `{#key}`-driven remount (`RouteScreen.svelte`
remounts `ChallengeCard`/`ChallengeForm` on every index change) picks up the by-then-resolved
identity. Apply the same gating principle for consistency: don't compute `storageKey` (and thus
don't call `loadFormState`) until `!$authStore.authLoading`.

**Not gated, and don't need to be:**
- `ConsentScreen.svelte`'s `writeConsentCache` call only runs from `handleSubmit`, a user-triggered
  submit that necessarily happens well after auth has resolved.
- `RoutePage.svelte`'s `readConsentCache` call (consent-version staleness effect) is a pure read
  inside an effect that already re-runs reactively as its dependencies change and already fails
  open on any miss (documented behavior, `RoutePage.svelte:140-145`) — a transient empty-identity
  read just means one pass skips the staleness check, no different from today's documented
  network-failure fail-open path.

## 5. No migration

Clean cutover — confirmed. Anyone mid-hunt when this ships loses their in-progress local state
(forms, swipe position, consent cache) the next time they open the app: they resume from the start
of their route, previously-submitted forms don't show as pre-filled/complete client-side. Answers
already submitted to the server (`form_submissions`, `consent_records`) are untouched — this is a
client display/resume-position issue only, not data loss on the backend.

## 6. Testing

- `formStorage.test.ts`, `locationFormLookup.test.ts`, `completionStats.test.ts` — update call
  sites for the new `teamName` parameter; add a regression case proving two different team names
  against the same `project/city/route/locationId` don't collide, **and** a case proving the same
  team name with two different `contact`s (individual-login projects) *do* share the same form
  state — that's the intended shared-per-team behavior, not a bug.
- `consentCache.test.ts` — same, but with `teamName` **and** `contact`; add a case proving two
  members of the same team (same `teamName`, different `contact`) get independent consent caches.
- `RoutePage.test.ts` — new coverage for the auth-race fix: mounting with `authLoading: true` then
  transitioning to a resolved participant auth must not write the placeholder index over an
  existing saved value for that team.
- `ChallengeForm.test.ts`, `OptionsScreen.test.ts` — update mocked `authStore` state to include
  `teamName` where these components now read it directly.
- `ConsentScreen.test.ts` — gains an `authStore` mock it doesn't have today (`teamName` +
  `contact`).

## Acceptance criteria

- [ ] Logging in as a brand-new team name starts with empty form state, index 0, and no consent
      cache — regardless of what a previous team on the same device left behind.
- [ ] Logging back into a previously-used team name (same device) resumes exactly where that team
      left off: same swipe position, same submitted/in-progress form answers, same consent cache.
- [ ] Two different team members logged in under the *same* team name (individual-login `demo`
      project, distinguished only by `contact`) see the **same shared** route progress and form
      answers — this is intended, not a collision to prevent.
- [ ] Those same two team members get **independent** consent caches — each must personally see
      their own consent state, not their teammate's.
- [ ] A hard reload directly into a mid-route URL does not overwrite a team's saved swipe position
      with `0`.
- [ ] `OptionsScreen`'s "restart route" action clears the correct team's saved position, not a
      different team's or an orphaned key.
- [ ] Existing single-team flows (the common case — no team switching) are unaffected: no visible
      behavior change, no new flash/delay under normal in-app navigation.

## Open items / out of scope

- No migration path for local state that predates this change (§5) — accepted, not deferred.
- No changes to server-side storage — already correctly scoped.
- No change to the two convenience-only keys (`LAST_HUNT_CODE_KEY`, `teamName:${project}` login
  prefill) — not participant progress data, intentionally left global per device.
- **Known gap, explicitly out of scope: local storage is never reconciled against the server's
  latest submission across devices.** Verified while writing this spec: server-side "both answers
  recorded, last one counts" already works, but only for the organizer-facing results page
  (`resultsData.ts`'s `latestOf()`, grouped by `(routeId, locationId, teamName)` — already
  team-scoped, not contact-scoped, consistent with §1). There is no participant-facing path that
  does the same — `ChallengeForm.svelte` only ever reads its own device's `loadFormState()` at
  mount; nothing fetches "what has my team already submitted here" from the server. Two team
  members on two different devices (the expected shape for individual-login projects like `demo`)
  can silently diverge: if member A submits on device A, member B's device never learns about it —
  no prefilled answer, no "already submitted" indicator, no reconciliation. This is a pre-existing
  gap, not something this fix introduces, but it becomes materially more relevant once "shared
  per team, split across devices" is the confirmed model rather than an edge case. Needs a
  follow-up spec: likely a `GET` "my team's current submissions for this route" endpoint plus a
  reconciliation step in `ChallengeForm`/`RoutePage` on mount, reusing the same last-write-wins
  logic `resultsData.ts` already proves out.
