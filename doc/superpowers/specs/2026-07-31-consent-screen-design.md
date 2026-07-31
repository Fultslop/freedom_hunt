# Consent Screen — "Before you begin"

Date: 2026-07-31
Status: **design approved, ready for an implementation plan.** This supersedes the original
user-authored draft (same content is preserved below where it was already correct — layout,
copy, callouts, acceptance checklist) — sections 2.2, 4, 5, 6 are rewritten to match the real
codebase, and four new sections (12–15) cover the backend, resume/versioning mechanism,
testing, and open implementation-time verification items that the original draft didn't
address. See `doc/handovers/2026-07-31-consent-screen-handover.md` for how this reconciliation
happened (the mismatches it found are now folded in below, not left as a separate list).

Version: v2 (reconciled). Original: v1.0, pasted by the user, GDPR/UX framing unchanged.
Scope: **one full-stack spec** — screen + backend record + versioning + withdrawal menu +
human photo-approval review, as one unit (explicit user decision, not split into UI/backend
specs).

Reworks the existing pre-hunt screen shown once per route. Adds photo-permission consent
and an age gate, and separates acknowledgement from consent.

---

## 1. Why this is a rework and not a tweak

The current screen has one button recording two different things: that the participant read
the safety notes, and that the organiser may use their photos in marketing. Those cannot be
bundled.

Under GDPR, consent for promotional use must be freely given, specific, unambiguous, and
separable. In practice that means:

- a **separate checkbox, unticked by default** — pre-ticked boxes are not consent;
- **optional** — the hunt must behave identically if declined; if permission were a
  condition of playing it would not be freely given;
- **withdrawable as easily as it was given** — so it needs a permanent home (§6);
- **recorded with context** — what was agreed, which version of the text, and when (§4).

Two caveats before implementing:

- This is not legal advice. The organiser very likely has existing photo-release wording
  from their own events; prefer theirs over new language and have them review the screen.
- **The 16 threshold in §3 is the Netherlands' GDPR Article 8 figure.** It varies across the
  EU between 13 and 16. It is a per-project config value, not a constant (§3).

---

## 2. Layout

Mobile-first, single column constrained to `--content-max` and centred at every width.

```
┌──────────────────────────────────────┐
│ ←  Short loop                     ☰  │  existing TitleBar
├──────────────────────────────────────┤
│  Before you begin                    │  h1, sentence case, LEFT aligned
│  A few things to know before you      │  intro, --color-text-secondary
│  head out.                            │
│                                      │
│  ▣ 2.4 km   ▣ ~2 hours  ▣ Steps &     │  chips — what rules someone out
│                          cobbles      │
│                                      │
│  STAY SAFE ─────────────────────────  │  --font-map caps + hairline rule
│  ▣ Watch traffic, especially at …     │  icon + text rows, not bullet dots
│  ▣ Self-paced. Take breaks, and …     │
│  ▣ You'll need a data connection …    │
│  ▣ In an emergency, call 112.         │
│                                      │
│  ABOUT YOUR PHOTOS ─────────────────  │
│  ▣ Other teams can see your photos …  │
│  ▣ Don't photograph people who …      │
│                                      │
│  PHOTO PERMISSION ──────────────────  │
│  Is everyone in your team 16 or over? │
│  [   Yes   ] [   No   ]               │  segmented, 44px, nothing preselected
│  ┌────────────────────────────────┐  │
│  │ ☐  The organisers may use my    │  │  bordered card = visually separable
│  │    photos and videos to promote │  │
│  │    future hunts.                │  │
│  │                                 │  │
│  │    Optional — the hunt works    │  │
│  │    either way. Change it any    │  │
│  │    time under Photo permissions │  │
│  │    in the menu.                 │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  I understand — start the hunt   │  │  WideButton, primary
│  └────────────────────────────────┘  │
│  Read the full privacy notice         │  link, not inline legal text
│  Questions during the hunt? …         │  organiser contact
└──────────────────────────────────────┘
```

### 2.1 Fixes against the current implementation

| Problem | Fix |
|---|---|
| Nothing respects `--content-max`; body text and the button run the full viewport width | Constrain and centre the column. This alone fixes most of how the screen reads. |
| Centred heading over left-aligned bullets | Left-align everything. One alignment for a text screen. |
| Full-width `--color-error` red primary button | Use the theme's primary `WideButton`. In `GWC`, red is both the brand accent *and* `--color-error`; a red bar on a screen about safety and permissions reads as danger rather than as a way forward. Navy is still brand, and red stays semantic for real errors. |
| One flat list of four equal bullets | Two sections with `--font-map` caps headings and a hairline rule, plus a third for permission. |
| No indication of what the route physically demands | Chips row above the safety copy. |
| Bullet dots | One `lucide-svelte` icon per row — a category cue that survives a glance in sunlight, which matters more here than on a desk-bound consent page. |
| `I understand` records both acknowledgement and consent | Checkbox carries the permission; button carries the acknowledgement only. |

### 2.2 Components and implementation shape (reconciled)

**The current screen is not an `AppForm`.** Today's pre-hunt screen is
`src/data/text/en/projects/democrats_abroad/den_haag/000_options_eula.yaml`
(`template-type: options`, rendered by `OptionsScreen.svelte`) — a static markdown body plus
one tracked button. This is a **template-type swap**, not a component tweak:

- New `template-type: consent`, file pattern `NNN_consent_<slug>.yaml`, own JSON Schema
  (`consent.schema.json`) alongside `text.schema.json`/`splash.schema.json`/`options.schema.json`.
- New `ConsentScreen.svelte` (dispatched from `RouteScreen.svelte` like the other templates),
  wrapping `AppForm` with the same `formContext` prop `ChallengeForm` already passes, so the
  age→checkbox `isVisible` condition (bare-id, same-form reference) works without any new
  plumbing.
- Fields, in order: `section` (×3 headings — Stay safe / About your photos / Photo
  permission), `radio` with a new `variant: segmented` on the age question, `boolean` for the
  promo checkbox (gated by `isVisible`), a new `note` pseudo-field type for the declined-state
  block (gated by the inverse condition).
- `WideButton` primary for "I understand — start the hunt" — always enabled, never a
  checkpoint gate on forward navigation (nothing today blocks forward nav on this screen, and
  per §10's acceptance checklist nothing should).
- `000_checkpoint_eula.yaml` (`re-entry: { blocked_after_exit: true }`) stays immediately
  after the consent screen in the route's location list, unchanged — it already makes the
  screen "shown once per route" today via backward-nav blocking + `RoutePage`'s resume
  position, and needs no changes for the acknowledgement behavior itself (see §12 for the
  *re-prompt* case, which does need something new).

**Two small `AppForm` additions, YAML-first, worth their own tight mini-round before this
plan** (no prior art in the codebase for either):

`variant: segmented` on `radio`:

```yaml
- id: all_sixteen_plus
  type: radio
  variant: segmented
  label: Is everyone in your team 16 or over?
  options: ["Yes", "No"]
```

Renders as a two-option 44px segmented control instead of individual radio inputs; same
underlying `bind:group`-equivalent semantics on `values[id]` as plain `radio` — purely a
rendering variant, no new value shape.

`note` field type (a `section`-shaped pseudo-field rendered as body copy instead of a
heading):

```yaml
- type: note
  label: We won't use your photos for promotion.
  subtext: >
    Your photos still appear in this hunt's gallery for other teams.
    A parent or guardian can give promotional permission by contacting the organiser.
  isVisible:
    initially: conditional
    condition: { source: all_sixteen_plus, operator: "=", value: "No" }
```

No `id` (produces no value, like `section`), renders as prose rather than a heading.

Uses existing tokens only. `--font-map` (condensed face, from the landing-flow token set) is
the one dependency; if it isn't in the theme yet, fall back to the theme body font at
`--font-size-xs` with `letter-spacing: .2em` and uppercase, and the section rules still work.
No new colour tokens. No image assets.

---

## 3. Age gate

Nothing currently prevents minors from joining a hunt, so assume they will. A checkbox
tapped by a fourteen-year-old grants a permission worth nothing, and a child's photo on a
public promotional page is the one failure mode here with real consequences.

- **Ask one boolean: "Is everyone in your team 16 or over?"**
- **Do not collect ages or dates of birth.** Self-declaration is the accepted standard for a
  service like this; collecting DOBs to be more rigorous makes the data-protection position
  worse, not better.
- **Nothing is preselected, and neither answer gates the primary button.** The question
  decides whether to *offer* the permission, not whether the hunt can be played.
- **The threshold is `project.consent_age_threshold` in `<projectId>.yaml`**, following the
  existing free-form `project.<key>: value` pattern (`project.form_required` etc., read via
  `getHuntSettings()` in `src/utils/huntSettings.ts`) — default `16` if a project omits it.

| Answer | Consent block renders |
|---|---|
| `yes` | The promotional-use checkbox, unticked, plus the optional/withdrawal note |
| `no` | A statement instead of a control (the new `note` field): photos will **not** be used for promotion; they still appear in this hunt's gallery for other teams; a parent or guardian can grant promotional permission via the organiser |
| unanswered | Neither — show the question only |

The `no` state must not read as a dead end or a reprimand. Confirm what *will* still happen
alongside what won't, and name the route for a guardian who does want to grant permission. A
state that only says "denied" makes people wonder what they've broken.

Switching the answer from `yes` to `no` clears any ticked consent — it does not preserve it
hidden. (This is already `isVisible`'s existing behavior: a field that goes hidden has its
stored value cleared, per `src/utils/visibility.ts`/`AppForm.svelte`'s hidden-field `$effect`.)

---

## 4. What to record (reconciled)

**No backend exists for this today.** `form_submissions` (D1) is per-location,
per-route-position, has no unique participant key and no version column — not suitable as-is
(confirmed against `migrations/003_form_submissions.sql`). This needs a new table and new
Worker routes.

### 4.1 Identity key

`(project_id, team_name, contact)` — the same tuple `form_submissions` already scopes by,
reused rather than inventing a new participant-ID concept:

- **Shared-team-password projects** (e.g. `den_haag`): `contact` is optional free text, often
  null or shared across the whole team. Consent here is conceptually **team-level** — the age
  question is phrased "is everyone in *your team* 16 or over," matching a single shared
  login. This is correct, not a limitation.
- **Individual-login projects** (`demo`-style, `participant_accounts`): `contact` defaults to
  the account's own email at signup (`authRoutes.ts`: `resolvedContact = contact || normalEmail`)
  and is carried through on every login — never empty, and unique per person even if two
  people on the same team share a `team_name`. The same key resolves to **per-individual**
  identity automatically here, with no special-casing.

### 4.2 Schema

New migration `006_consent.sql`:

```sql
CREATE TABLE IF NOT EXISTS consent_records (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL,
  team_name         TEXT NOT NULL,
  contact           TEXT NOT NULL DEFAULT '',
  all_sixteen_plus  INTEGER NOT NULL,             -- 0/1
  promo_consent     INTEGER NOT NULL,             -- 0/1; server forces 0 when all_sixteen_plus = 0
  promo_approved    INTEGER NOT NULL DEFAULT 0,   -- human-set (§5), independent of participant consent
  consent_version   INTEGER NOT NULL,             -- server-stamped, never client-supplied (§4.3)
  acknowledged_at   INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  UNIQUE (project_id, team_name, contact)
);
```

`db.ts` gets `upsertConsent(db, key, values)` — the **first upsert in this codebase**
(`INSERT ... ON CONFLICT(project_id, team_name, contact) DO UPDATE SET ...`; every existing
write in `db.ts` is a plain `INSERT`, or a separate guarded `UPDATE` for revoke-style flows).
`promo_consent` is forced to `0` server-side whenever `all_sixteen_plus` is `0`, regardless of
what the client sends — enforced in the upsert function itself, not only in the UI, per the
original draft's explicit requirement.

`localStorage` caches the last-written `{consentVersion, allSixteenPlus, promoConsent}` under
`${project}/${city}/${route}/consent` purely to avoid an extra fetch on every screen visit —
**it is a cache, not the source of truth.** If it's cleared and the screen is shown again, the
write updates the existing D1 row (matched by the identity key), never creates a second one.

### 4.3 Routes

New `src/worker/routes/consentRoutes.ts`:

| Route | Auth | Body / Query | Behavior |
|---|---|---|---|
| `POST /consent` | participant token | `{allSixteenPlus, promoConsent, acknowledge}` | Upserts by identity key. With `acknowledge: true` (consent screen), `consent_version` and `acknowledged_at`/`updated_at` are **always server-stamped** from the KV-backed version (§15) — the client never supplies `consentVersion`. With `acknowledge: false` (Photo permissions withdrawal, §6) the existing `consent_version` is preserved and only `promo_consent`/`updated_at` change. The `acknowledge: false` path never calls `getConsentVersion()`, so it works without `city`/`route` context. |
| `GET /consent` | participant token | — | Returns this participant's current record, or `null`. Used by the "Photo permissions" menu (§6) and by `RoutePage` at mount to decide whether the screen has already been acknowledged at the current version. |
| `GET /consent/version` | none (public) | `?project=X&city=Y&route=Z` | Returns `{consentVersion: number}`, the current KV-stored value for that project/city/route (default `1` if never set). Cheap, unauthenticated, polled by `RoutePage` on every navigation step (§12). |

`promo_approved` is never writable through `POST /consent` — only through the review flow in
§5.

---

## 5. `promoApproved` — the actual safety net (reconciled: in scope, minimal review UI)

Consent grants permission; it does not stop a specific bad photo going out.

**Add a `promoApproved` flag set by a human, and require it before any photo is used
promotionally, regardless of what the participant ticked.** This spec includes both the data
model (§4.2's `promo_approved` column) and a minimal review surface:

New editor page `src/pages/editor/PromoReviewPage.svelte`
(`/editor/:project/:city/promo-review`, gated by the existing organizer-capability guard in
`authGuards.ts`, same pattern as other editor pages). Lists photos where the owning team's
`consent_records.promo_consent = 1` and `promo_approved = 0`, joining `photos` to
`consent_records` on `(project_id, team_name, contact)` — the same key used everywhere else.
Each row shows the existing `thumb` variant (`GET /photos/:id/thumb`) with a single **Approve**
button, calling a new `POST /promo-approve` route (editor-role auth) that sets
`promo_approved = 1` for that photo's team. Deliberately minimal: no bulk actions, no
rejection/undo state — an unapproved photo simply never surfaces as promotable, so there is
nothing to "reject." This is a human review gate, not a workflow tool.

Two related choices, at content-authoring time rather than here:

- **Any challenge that asks for people in frame should be completable without faces.** "Your
  team's shoes on the step" scores the same as a group selfie. This removes most of the
  problem at source and costs nothing.
- A photo-removal route is needed anyway for erasure requests — state it rather than leaving
  people to guess. (Out of scope for this spec — flagging for a future one.)

---

## 6. Withdrawal (reconciled)

Add **Photo permissions** to the `☰` menu, available at all times, showing the current
setting with a control to change it.

`TitleBar.svelte` gains a new `menuView === "photo-permissions"` branch, following the existing
root/submenu structure (`Profile` / `Themes` / `Text Size` are literal `{#if menuView === "..."}`
branches keyed off `let menuView = $state<string | null>(null)`). Unlike `Themes`/`Text Size`
(both purely local-store toggles, no network call), this is the **first submenu that does a
real round trip**:

- On open, an `$effect` calls a new `fetchConsent()` (`src/utils/api.ts`, same shape as
  existing `fetchAuthMe()`/`postLogin()`) → `GET /consent`.
- If `allSixteenPlus` is `false` on the current record, render the declined-state copy instead
  of a control (mirrors §3's `no` branch) — promo consent can't exist without the age
  confirmation, so there's nothing to toggle.
- Otherwise render the current `promoConsent` value with a toggle that auto-saves via a new
  `postConsentUpdate()` → the **same** `POST /consent` upsert the screen itself uses. This
  updates `promo_consent`/`updated_at` on the same row; it never touches `consent_version`,
  which only the consent screen itself bumps (by virtue of the server always stamping its
  current value on every `POST /consent`, screen or menu alike).

This is a requirement, not a nicety: withdrawal has to be as easy as granting, and a screen
shown once per route cannot serve that. The note under the checkbox (§8 copy) names this
location at the moment consent is given, so the participant learns the exit as they enter.

Reachable for every participant regardless of whether `contact` is set — the same
`(project, team_name, contact)` identity risk already exists identically for
`form_submissions` today and isn't a new risk introduced by this feature.

---

## 7. Callouts — final list

Included, in this order:

1. **Route demands** — distance, duration, terrain. Above the safety copy, because these are
   what rule someone out, and they belong here rather than at stop four.
2. **Traffic awareness.**
3. **Self-paced; skip anything you'd rather not do.**
4. **Data connection needed** for clues and uploads — also covers roaming cost for
   participants on foreign SIMs.
5. **Emergency number 112.** Trivial to add; occasionally the most useful text in the app.
6. **Gallery visibility** — other teams can see your photos. Distinct from promotional use,
   and currently stated nowhere.
7. **Don't photograph people who haven't agreed, and never children outside your own group.**
   Participants photograph bystanders and their checkbox cannot consent on a stranger's
   behalf. This protects the organiser more than anything else on the screen.
8. **Organiser contact** for during the event. On a live outdoor activity, a way to reach a
   human is worth more than a liability clause.
9. **Link to the full privacy notice** — layered disclosure: short summary at the point of
   collection, detail one tap away. This is also what Article 13 expects.

Deliberately **not** included: extended liability language. The self-paced line already does
the useful work; a paragraph of disclaimer nobody reads does not.

Consider, if the project uses location: a line stating what GPS is used for and whether it is
stored. Only include it if the hunt actually requests location permission.

---

## 8. Copy

Sentence case. Active voice. Errors and refusals say what happened and what to do next.

| Key | Copy |
|---|---|
| Heading | `Before you begin` |
| Intro | `A few things to know before you head out. This takes a minute, then you're off.` |
| Section 1 | `Stay safe` |
| Section 2 | `About your photos` |
| Section 3 | `Photo permission` |
| Chips | `2.4 km` · `~2 hours` · `Steps & cobbles` (from project data) |
| Safety 1 | `Watch traffic, especially at crossings and on tram tracks.` |
| Safety 2 | `Self-paced. Take breaks, and skip any challenge you'd rather not do.` |
| Safety 3 | `You'll need a data connection for clues and photo uploads.` |
| Safety 4 | `In an emergency, call 112.` |
| Photos 1 | `Other teams can see your photos in this hunt's gallery.` |
| Photos 2 | `Don't photograph people who haven't agreed — and never children outside your own group.` |
| Age question | `Is everyone in your team 16 or over?` |
| Age options | `Yes` / `No` |
| Consent label | `The organisers may use my photos and videos to promote future hunts.` |
| Consent note | `Optional — the hunt works either way. Change it any time under Photo permissions in the menu.` |
| Declined heading | `We won't use your photos for promotion.` |
| Declined body | `Your photos still appear in this hunt's gallery for other teams. A parent or guardian can give promotional permission by contacting the organiser.` |
| Primary button | `I understand — start the hunt` |
| Privacy link | `Read the full privacy notice` |
| Footer | `Questions during the hunt? Contact your organiser.` |

`I understand` on its own is both vague and — now that the checkbox carries the permission —
inaccurate. Name what happens.

Replace the consent label with the organiser's own release wording if one exists.

---

## 9. Length and the fold

At 320px the column runs roughly 750px tall, so the primary button sits below the fold.

**Accept the scroll. Do not stick the button to the bottom.** A sticky "start the hunt" on a
screen whose purpose is to be read invites skipping, and the consent card is exactly what
would get scrolled past. If it must fit one viewport, cut bullets rather than shrinking type
— the data-connection and self-paced lines can merge.

---

## 10. Acceptance checklist

- [ ] Column respects `--content-max` and centres at 320px, 390px, 768px, 1440px.
- [ ] Consent checkbox is unticked on first render and never pre-selected.
- [ ] Age question has nothing preselected.
- [ ] Primary button is enabled regardless of the age answer or the checkbox state.
- [ ] Declining, or leaving the age question unanswered, does not block the hunt.
- [ ] Answering `no` hides the checkbox and clears any prior tick.
- [ ] `promoConsent: true` cannot be persisted when `allSixteenPlus` is false — enforced in
      `upsertConsent()` server-side, not just in the UI.
- [ ] Clearing `localStorage` and re-acknowledging updates one `consent_records` row rather
      than creating a second (verified via the `UNIQUE(project_id, team_name, contact)`
      constraint + upsert).
- [ ] `consent_version` is always server-stamped from `GET /consent/version`'s source, never
      accepted from the client in `POST /consent`.
- [ ] Raising the deployed `consentVersion` re-prompts participants with an older recorded
      version, including **mid-route** (§12), not only at route start.
- [ ] Photo permissions is reachable from the `☰` menu at any time and reflects the stored
      value; changing it updates the same record without altering `consent_version`.
- [ ] `promo_approved` can only be set via `PromoReviewPage`'s `POST /promo-approve` —
      confirmed unreachable from the participant-facing `POST /consent`.
- [ ] Checkbox row and each segmented option clear 44px; the checkbox label is clickable.
- [ ] Screen reader: age question is a labelled radio group; the consent note is wired via
      `aria-describedby`; switching the age answer announces the change via
      `aria-live="polite"`.
- [ ] Renders correctly in all three themes; red is not the primary button colour in any of
      them.
- [ ] `data-fontsize` at `small`, `medium`, `large` — no clipped or overlapping text.
- [ ] No hardcoded hex in component CSS; no new runtime dependency; no image assets.
- [ ] The age threshold reads from `project.consent_age_threshold`, not a hardcoded 16.

---

## 11. Deferred

**Per-photo permission.** Blanket consent at the door is legally adequate but coarse. Once
the gallery is mature, let participants mark individual photos as "don't use publicly" —
that is what people actually want after taking a picture they didn't expect to. This turns
`promoConsent` from a per-participant flag into a per-photo override, so keep the field name
and storage shape free of assumptions that would block it.

**Guardian consent flow.** If promotional photos of under-16s ever become worth the effort,
this needs a verified guardian route. Out of scope; the `no` state in §3 is the correct v1.0
answer.

**Photo-removal / erasure route** (§5) — needed eventually, not designed here.

**Bulk approve / reject in `PromoReviewPage`** — start with the minimal approve-only list;
revisit if the review queue grows large enough that one-by-one becomes a real burden.

---

## 12. Resume position & `consentVersion` staleness (new)

`RoutePage` has no concept of "this earlier screen's content went stale" today — it just
resumes at the `localStorage`-persisted `currentIndex`
(`` `${project}/${city}/${route}` `` key, read once at mount, written on every change,
`RoutePage.svelte`). Making §4's version-based re-prompt actually work, **including
mid-route**, needs new logic:

- On successful `POST /consent`, cache `{consentVersion, allSixteenPlus, promoConsent}` in
  `localStorage` under `${project}/${city}/${route}/consent` (a read-cache only, per §4.2).
- `RoutePage` gains an `$effect` keyed on `currentIndex` (fires on every navigation step, not
  just at mount) that polls `GET /consent/version?project=X` and compares it against the
  cached version. On a mismatch, it overrides the pending `currentIndex` to the consent
  screen's index before the swipe/render completes — the same shape as the existing
  `mountNormalizeAttempted` correction that redirects a mount landing exactly on a checkpoint
  (`RoutePage.svelte`), just triggered by staleness instead of "landed on a checkpoint."
- **Why this needs a network check at all, not just a client-bundled comparison:** this app's
  content is a static build with no live CMS — an already-open tab is running the bundle from
  whenever it loaded, and cannot learn about a version bump on its own. The Worker, however,
  is redeployed alongside the frontend, so it always knows the current value even when a
  participant's open tab doesn't. `GET /consent/version` is the bridge.
- **First-time consent** (no server record at all) needs no new logic — the existing
  `000_checkpoint_eula.yaml` (`blocked_after_exit`) plus a fresh participant's `currentIndex`
  of `0` already puts them at the consent screen.
- **Accepted trade-off:** one lightweight `GET` per navigation step while inside a route. The
  existing "you'll need a data connection" copy (§7, safety callout 3) already sets this
  expectation; this is a new steady background request, though, not a one-off upload, and is
  worth calling out explicitly rather than treating as free.
- **Failure mode:** if `GET /consent/version` fails (offline mid-route), treat it as *not
  stale* — fail open, don't force a spurious redirect from a network blip. The check re-runs
  on the next successful poll.

---

## 13. Error handling

- `POST /consent` failing (network error) shows a toast ("Couldn't save — check your
  connection") but, per §10's acceptance checklist, **does not block** the primary
  button/navigation. Unlike the old screen's `trackSelection()` (a genuinely best-effort,
  fire-and-forget tracking call), this write is the actual legal consent record, so it isn't
  treated as disposable: the locally-cached answer is retried automatically the next time
  `RoutePage` mounts, until the server confirms it.
- `GET /consent/version` failing: see §12's fail-open behavior.
- `POST /promo-approve` failing (editor UI): standard toast + retry, no special handling —
  this is an internal tool, not participant-facing.

---

## 14. Testing

- `upsertConsent()` / `consentRoutes.ts` — unit tests mirroring the existing
  `formSubmitRoute.test.ts` pattern: auth requirement, upsert-not-duplicate behavior via the
  `UNIQUE` constraint, `promo_consent` forced to `0` when `all_sixteen_plus` is `0`,
  `consent_version` always server-stamped regardless of request body.
- `ConsentScreen.svelte` — renders all field types incl. new `note` and `radio
  variant: segmented`; age→checkbox `isVisible` wiring end-to-end (reusing the existing
  `evaluateVisibility` resolver, no new visibility logic needed here).
- `RoutePage`'s staleness `$effect` — fake timers + mocked `fetch`, following existing
  `RoutePage.test.ts` conventions: stale version redirects mid-route; fresh version doesn't;
  a failed version fetch doesn't redirect.
- `TitleBar`'s new `photo-permissions` submenu — fetch-on-open, toggle-and-save, declined-state
  rendering when `allSixteenPlus` is `false`.
- `PromoReviewPage` — lists only `promo_consent = 1 AND promo_approved = 0` photos; Approve
  flips exactly one row.

---

## 15. Open implementation-time verification (not a design fork)

- **Where the Worker reads the "current" `consentVersion` from.** **Resolved in Task 3:**
  the Worker does **not** read YAML. The version lives in the `AUTH_STORE` KV namespace under
  `consent-version:<project>/<city>/<route>` (helper `src/worker/consentVersion.ts`,
  `getConsentVersion()`, default `1` when absent). `POST /consent?city&route` stamps that KV
  value as the record's `consent_version` when `acknowledge: true`; the "Photo permissions"
  withdrawal path calls with `acknowledge: false`, which preserves the existing
  `consent_version` (and never touches `getConsentVersion`). Bumping the deployed consent text
  is therefore a KV write plus a YAML change — the KV value is the server-side source of truth
  for staleness, decoupled from what the client bundle ships.
