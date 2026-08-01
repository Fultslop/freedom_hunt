# Consent Screen — EULA Delta (implementation-ready)

Date: 2026-08-01

Builds on the existing "Before you begin" consent screen (`template-type: consent`,
`ConsentScreen.svelte`, `consent.schema.json`, `ConsentEntry`). Rewrites the organiser-supplied
["Consent Screen — Delta"](../../devlog/_devlog.md) requirements doc against what's actually in
the codebase today, so nothing gets rebuilt that already exists and nothing gets skipped because
the spec assumed a different starting point.

Requirements, not implementation shape beyond what's needed to pin down the YAML/schema/type
contracts (per this project's YAML-first process).

---

## 0. Scope corrections — read this before implementing

Three things the original delta spec treats as gaps are already built. Do not re-implement them:

1. **Checkbox label and declined-state note are already per-route authored content.** Both are
   entries in `000_consent_eula.yaml`'s `fields[]` array today (`promo_consent`, `declined_note`).
   Only their *copy* changes (§2 below) — no new plumbing.
2. **`privacyLinkUrl` already exists** in `consent.schema.json` and is already rendered by
   `ConsentScreen.svelte` (`consent-screen__privacy` link, shown only when set). Den Haag's YAML
   simply never set it. §7 is a one-line content addition.
3. **Consent version is already scoped per route**, via KV key `consent-version:<project>:<city>:<route>`
   (`src/worker/consentVersion.ts`) and a client-side cache keyed the same way
   (`src/utils/consentCache.ts`, compared in `RoutePage.svelte`'s staleness effect). A version bump
   in one route/city does not affect another, today. See §3 — this changes what "consent version
   becomes per-route" actually requires of this delta.

## 1. Add: "Why we're asking" fold (reusing the existing `[+]` convention)

Reuse the storyline fold mechanism verbatim — `parseStoryline`/`StoryBlockRenderer`/`StoryFold`/
`Storyline.svelte` (`src/utils/storylineBlocks.ts`, `src/components/Storyline.svelte`) already
implement exactly this: collapsed by default, fold-open state in local `$state` (not persisted),
a keyboard-operable `<button aria-expanded>` toggle. No new component, no new `FormFieldType`.

**Data model.** `ConsentEntry` (`src/types/data.ts`) gains:

```ts
whyWereAsking?: string;   // markdown, authored with the "[+] <label>" fold syntax
```

**Authoring shape** — the `[+]` marker is the very first line, so nothing renders outside the
fold (the whole block is the collapsed content):

```yaml
whyWereAsking: |
  [+] Why we're asking

  Democrats Abroad Global Women's Caucus is running this event to get US citizens abroad
  registered and voting in the upcoming elections.

  We'd like you to celebrate the cultural and historic heritage of the city you live in —
  and to make photos or video we can share, so other Americans register to vote and request
  their 2026 ballot.

  We won't publish photos or video of minors. If a child appears in something we use, we
  block the image out.
```

**Rendering.** `ConsentScreen.svelte` renders `<Storyline text={entry.whyWereAsking} />`
directly above the `consent-screen__form` div (i.e. immediately before the `AppForm` block
containing the checkbox), so it reads as attached to the form rather than the photos bullet
section above it.

**Schema.** `whyWereAsking` is optional in `consent.schema.json` (not every future consent screen
necessarily has a promo checkbox needing justification) — required *by authoring convention*
wherever a promo-style checkbox exists, not by schema enforcement.

**Validation.** Generalize `checkStoryline` in `scripts/validate-yaml.ts` (currently hardcoded to
`data.storyline`) into a `checkStorylineField(filePath, fieldName)` helper; apply it to both
`storyline` (location files, unchanged behavior) and `whyWereAsking` (consent files). This catches
the retired `:::` fence syntax and (via the existing `splitFold` warning) a `[+]` marker with no
real label — `splitFold` defaults a blank label to `"Read the full story"`, so also add a check
that a consent file's `whyWereAsking`, if present, has a non-blank explicit label rather than
relying on that generic fallback.

## 2. Change: split the supplied paragraph — scope visible, context folded

**Checkbox label** (replaces `promo_consent`'s current label in `000_consent_eula.yaml`) —
open-ended phrasing cut, per the source spec's own recommendation and confirmed in review:

> The organisers may use my photos and videos on Democrats Abroad social media and in
> marketing — including posts that specifically promote Democratic candidates and the
> Democratic Party.

**Fold body** — the three paragraphs in §1 above, unchanged from the source spec.

**Single checkbox, not split into two permissions.** Confirmed in review: keep the existing
one-tick `promo_consent` field as-is (just the new label). Not splitting into separate
voter-registration/candidate-promotion permissions — smallest change, no `consent_records` schema
change, no migration, no second checkbox in the UI. (If this is revisited later, it's a new
`consent_records` column + `POST /consent` payload field + a second `boolean` field in `fields[]`
— out of scope here.)

**Source mapping** — unchanged from the original spec's §2.2 table; every clause of the supplied
paragraph still lands in either the checkbox label or the fold, nothing dropped. "(and CC)" still
dropped per the original spec's note (spell out the co-organiser by name in the fold if one needs
naming — not resolved here, no co-organiser name was supplied).

## 3. Consent version: stays KV-based, not moved to YAML

Confirmed in review. The original spec's §4/§5 imply moving `consentVersion` into per-route
authored YAML. Don't do this: KV lets an organiser bump the version (forcing re-consent) without a
code deploy — a deliberate existing design decision (`doc/architecture.md`, "Consent text
versioning is KV-based, not YAML-based") — and the per-route scoping outcome it's meant to achieve
already holds (§0.3). No code change in this section. §6's authoring guidance ("bump the consent
version on any material change") means running `wrangler kv key put`, not editing YAML — say so
explicitly in the authoring docs.

## 4. Change: minimum age becomes per-route

Confirmed in review. Currently `ageThreshold` is project-level
(`project.consent_age_threshold` → `HuntSettings.ageThreshold` → threaded `RoutePage` →
`RouteScreen` → `ConsentScreen` as a prop). Move it into the consent entry itself:

- `ConsentEntry` gains `minimumAge: number` (required).
- `consent.schema.json`: add `minimumAge` to `required` and `properties` (`type: integer`, sensible
  `minimum`, e.g. `1`).
- `ConsentScreen.svelte` uses `entry.minimumAge` for the `{{age_threshold}}` label/subtext
  interpolation instead of the `ageThreshold` prop. Drop the prop entirely (`ConsentScreen`,
  `RouteScreen`, both `RoutePage` call sites).
- Delete `project.consent_age_threshold` / `HuntSettings.ageThreshold`
  (`src/utils/huntSettings.ts`, `src/types/data.ts`, `democrats_abroad.yaml`'s
  `project.consent_age_threshold: 16` line, and the now-dead tests) — no fallback shim; nothing
  else reads it once this lands.
- `000_consent_eula.yaml` gets `minimumAge: 16`.

## 5. Change: consent content becomes per-route data — updated list

Supersedes the original spec's §3 bullet list given §0 and §3 above. The following are per-route
authored content in `NNN_consent_*.yaml` (✅ = already true today, no change needed):

| Item | Status |
|---|---|
| checkbox label (permission scope) | ✅ already per-route — copy changes only (§2) |
| fold summary + body (`whyWereAsking`) | **new** (§1) |
| declined-state heading and body | ✅ already per-route (`declined_note` field) |
| minimum age | **new** (§4) |
| consent version | **stays KV-based, not YAML** (§3) |
| safety / photos bullet sections | ✅ already per-route; **gains platform-default fallback** (§6) |

## 6. Change: safety/photos — platform defaults with per-route override

Only Den Haag has a consent screen today, but Oslo's location content already exists with none
yet, so this isn't purely hypothetical. To avoid building merge/append logic for a need that's
still speculative, use the simplest possible override semantics: **wholesale replace, no
item-level merge.**

**New file** `src/data/text/en/consent_defaults.yaml` (sibling to `application.yaml`, outside
`projects/` since it's platform-wide, not project-scoped):

```yaml
safety:
  heading: "Stay safe"
  items:
    - icon: AlertTriangle
      text: "Watch traffic, especially at crossings."
    - icon: Footprints
      text: "Self-paced. Take breaks, and skip any challenge you'd rather not do."
    - icon: Wifi
      text: "You'll need a data connection for clues and photo uploads."
    - icon: Phone
      text: "In an emergency, call **112**."
photos:
  heading: "About your photos"
  items:
    - icon: Eye
      text: "Other teams can see your photos in this hunt's gallery."
    - icon: ShieldAlert
      text: "**Don't photograph** people who haven't agreed — and never children outside your own group."
```

- `consent.schema.json`: `safety`/`photos` become **optional** (currently `required`).
- `RoutePage.svelte` loads `consent_defaults.yaml` once via `loadText` (same pattern as loading
  `huntSettings`/project meta today) and threads `safetyDefault`/`photosDefault` down through
  `RouteScreen` → `ConsentScreen` as props.
- `ConsentScreen.svelte`: `entry.safety ?? safetyDefault`, `entry.photos ?? photosDefault`. If a
  route omits the section, the default renders whole. If a route needs the defaults plus one
  route-specific line (a canal towpath, a long stair climb), the author copies the default items
  into their own `NNN_consent_*.yaml` and adds the extra one — full replace, not an append.
- **New schema** `src/data/schemas/consent-defaults.schema.json` (reuses the same `bulletSection`
  shape as `consent.schema.json`; `safety`/`photos` both required in *this* file, since it has
  nothing else to fall back to). `scripts/validate-yaml.ts` validates
  `src/data/text/en/consent_defaults.yaml` against it directly (fixed path, not a glob pattern
  like the `NNN_*` files).

## 7. Add: missing privacy link

`000_consent_eula.yaml` gets `privacyLinkUrl` set. **Placeholder for now** —
`https://example.org/TODO-privacy-notice` — must be swapped for the real URL before this ships;
flag it in the PR/handover so it isn't missed.

## 8. Add: validation

In `scripts/validate-yaml.ts`:

- `checkConsentFields` (existing, validates the inline `fields[]` array) — no change needed beyond
  what schema `required` already covers once §4's `minimumAge` is added to
  `consent.schema.json`'s `required` list.
- New `checkStorylineField` generalization (§1) applied to `whyWereAsking`.
- New `consent_defaults.yaml` single-file schema check (§6).
- **Cross-file check ("route with photo challenges must have a consent block") — dropped from
  scope.** Checked against real data before writing this: Oslo, `demo/new_york`, and
  `demo/paris` all already have `photo`/`video` form fields with no consent screen at all. An
  unconditional hard-fail rule would break CI for all three immediately. Confirmed with the
  requester: Oslo and the demo projects aren't public-facing, so they don't need to be covered —
  don't build this check now. Revisit if/when a public-facing project other than Den Haag needs a
  consent screen, at which point it can be a straight per-file existence check scoped to
  public-facing projects.
- **Runtime resilience**: `ConsentScreen.svelte` currently reads `entry.safety.heading`,
  `entry.photos.heading`, etc. without guards — a malformed entry that slipped past CI (or was
  hand-edited post-build in a way CI never saw) throws and takes down the whole screen. Add
  optional chaining and skip-if-missing rendering for `safety`/`photos`/`chips` sections
  (`whyWereAsking` already degrades safely — `Storyline` renders nothing for empty/undefined
  `text`), so a bad entry still shows a working checkbox/consent flow rather than a blank crash.

## 9. Add: authoring guidance

New content-docs guidance (not code) — where the project's other authoring notes live, likely
alongside `doc/architecture.md`'s Data Model section or a dedicated `doc/authoring.md` if one
exists:

- name the specific uses in the checkbox label; avoid open-ended phrasing like "and other purposes";
- the fold (`whyWereAsking`) is for context, the checkbox label is for scope — don't move scope
  facts into the fold to shorten the label;
- bump the consent version via `wrangler kv key put consent-version:<project>:<city>:<route> <n>`
  on any material change to the permission scope — **not** a YAML field;
- omit `safety`/`photos` to inherit the platform defaults in `consent_defaults.yaml`; to add one
  route-specific line, copy the defaults in and append — there's no partial-merge mechanism.

---

## Acceptance criteria (supersedes the original delta's list)

- [ ] The permission scope — including party and candidate promotion — is readable **without
      expanding the fold** (checkbox label copy from §2).
- [ ] Fold (`whyWereAsking`) is collapsed on load; its state is not persisted. *(already true of
      `StoryFold` — verify, don't rebuild.)*
- [ ] Checkbox label, declined text, and minimum age come from route data; consent version does
      **not** (stays KV, §3) — this is an intentional deviation from the original spec, documented
      above, not an oversight.
- [ ] Two routes with different consent versions re-prompt independently. *(already true — write a
      regression test if one doesn't already exist, don't build new mechanism.)*
- [ ] ~~A route with photo challenges and no consent block fails `validate:yaml`~~ — dropped from
      scope (§8); Oslo/demo are not public-facing, so they don't need to be included.
- [ ] Every clause of the supplied paragraph appears somewhere — label or fold — per the original
      §2.2 mapping; nothing is dropped.
- [ ] Privacy notice link is present (placeholder URL acceptable for this delta; real URL tracked
      as a follow-up).
- [ ] Fold toggle is keyboard-operable with expanded state exposed to assistive tech. *(already
      true of `StoryFold` — `aria-expanded`, real `<button>`.)*
- [ ] A consent entry omitting `safety`/`photos` renders the platform defaults from
      `consent_defaults.yaml`.
- [ ] A malformed consent entry (missing `safety`/`photos`/`chips`) degrades — checkbox/fold still
      render — rather than crashing the route.

## Open items before implementation starts

1. **Real privacy notice URL** — placeholder used in §7 until supplied.
2. Whether to split into two separate permissions (voter-reg vs. candidate/party promo) was
   explicitly deferred, not rejected outright — flagged here in case it resurfaces.
