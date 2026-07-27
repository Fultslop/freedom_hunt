# Route Checkpoints — Design

## Problem

Routes are currently a flat, linear list of entries with unrestricted swipe/prev/next navigation. There's no way to:

1. Permanently block backward navigation past a point in the route (e.g. once a participant accepts the EULA, they shouldn't be able to swipe back to it).
2. Softly (or hard-)gate forward progress on some condition — e.g. nudge participants to complete outstanding forms before reaching the end of the hunt.

Two concrete use cases drive this design:

- **EULA lock**: once viewed/accepted, the participant can never navigate back to it.
- **Pre-completion nudge**: before the completion splash/options screens, warn (but don't hard-block) participants who have outstanding forms.

## Concept: `checkpoint` route entries

A checkpoint is a new route-entry template type, authored as its own file (`NNN_checkpoint_<slug>.yaml`), listed by filename in `routes.yaml`'s `locations` array exactly like every other entry. It is never rendered as a screen and never becomes the "current" entry — it's a gate evaluated at the moment the participant tries to cross it, forward or backward.

```yaml
template-type: checkpoint
entry:
  requirements:
    - type: forms
      requires_all_forms_completed: true   # default false
      min_completed_forms: 0               # default 0; ignored if requires_all_forms_completed is true
      include_skipped: true                # default true — a skipped form counts as completed
      on_fail:
        message: "There are still forms waiting for answers, but you're welcome to call it a day"
        include_missing_forms: true        # default true
  skippable: true                          # default true — shows a Skip option on failure
  on_succeed:                              # optional confirm-before-proceeding dialog, shown only when requirements pass
    message: "Are you sure?"
    include_missing_forms: true
"re-entry": false   # shorthand for { blocked_after_exit: true } — installs the guard with defaults
```

A checkpoint file must define at least one of `entry` / `re-entry` (enforced by JSON schema) — an empty checkpoint is a no-op and almost certainly an authoring mistake.

### `entry` — forward-crossing gate

- `requirements`: an ordered, open-ended list of `RouteRequirement` objects. Evaluated one at a time; the first one that fails stops evaluation (short-circuit) and its `on_fail` is what's shown. Omitted/empty = always met.
- `skippable` (default `true`): whether the failure popup offers a "Skip" button that bypasses this crossing attempt entirely.
- `on_succeed`: optional confirmation dialog shown only when all requirements pass. Not shown after a Skip (skipping is already an affirmative "proceed anyway" — an extra confirmation immediately after would be redundant friction).

Two requirement types for v1, with room for more:

```ts
interface FormsRequirement {
  type: "forms";
  requires_all_forms_completed?: boolean; // default false
  min_completed_forms?: number;           // default 0; ignored when requires_all_forms_completed is true
  include_skipped?: boolean;              // default true
  on_fail: { message: string; include_missing_forms?: boolean }; // include_missing_forms default true
}

interface PeriodRequirement {
  type: "period";
  start?: { operator?: "<" | "<=" | "=" | ">" | ">="; date: string }; // operator default '>='
  end?: { operator?: "<" | "<=" | "=" | ">" | ">="; date: string };   // operator default '<='
  on_fail: { message: string; include_period?: boolean }; // include_period default true
}

type RouteRequirement = FormsRequirement | PeriodRequirement;
```

`forms` scope: **every location entry with a non-empty `challenge.form`, anywhere earlier in the route than this checkpoint** (not scoped to "since the last checkpoint" — the simplest reading, sufficient for both current use cases; routes with multiple sequential checkpoints needing segmented scope are an explicit non-goal for now).

`period` isn't used by either current use case but exists because the spec calls for "when the route can start" — a checkpoint placed as the very first route entry with a `period` requirement is a real, supported use of this.

### `re-entry` — backward-crossing gate

```ts
"re-entry"?: boolean | { blocked_after_exit?: boolean }; // default true when present
```

Deliberately flatter than `entry` — there is exactly one concern today (block or don't) and no failure UI (no `on_fail`, per the spec). If a future re-entry condition needs its own message/UI, that's the moment to promote it to a richer shape; doing it now would be speculative. `false` shorthand (used by the EULA example) means "install the guard with defaults" → `blocked_after_exit: true`.

**Confirmed polarity**: `blocked_after_exit: true` (default) blocks going back once the checkpoint has been passed forward. (The original spec text said "if FALSE the user cannot go back," which contradicted both the field name and the EULA example; treated as a typo.)

## Navigation model

The central invariant: **`currentIndex` (the array position already persisted to `localStorage` today) never points at a checkpoint entry.** This is what makes "checkpoints aren't tracked" true for free — if the app closes mid-crossing, the last-saved position is still the last real entry the participant was on, because the jump to the far side of a checkpoint only happens after its gate resolves.

New pure helpers, `src/utils/checkpointNav.ts`:

- `isCheckpointEntry(entry)`
- `nextNavigableIndex(entries, current)` / `prevNavigableIndex(entries, current)` — skip over checkpoint entries to the next/previous real entry
- `checkpointsBetween(entries, from, to)` — the checkpoint(s) that would be crossed by a jump from `from` to `to`

New requirement engine, `src/utils/routeRequirements.ts` — implements the "go through requirements one by one, `are_requirements_met` → act on the bool" shape directly: iterate a `RouteRequirement[]`, short-circuit on first failure, return which requirement failed so its `on_fail` renders. `forms` and `period` are independent evaluator functions behind one dispatcher; adding a third type is additive.

**Crossing forward** (Next button, swipe-left, or the options-screen "continue" target): compute the target navigable index, gather checkpoints between here and there, evaluate their `entry.requirements` in order.

- Failure → spring the card back exactly like today's `project.form_required` block already does, and surface the failing requirement's `on_fail.message` in a new `CheckpointGateModal` component (see below). Skip button shown only if `skippable` (default true).
- All requirements pass, `on_succeed` defined → the same `CheckpointGateModal`, in its confirm configuration (Cancel / Continue). Continue jumps to the target index; Cancel leaves `currentIndex` untouched.
- All requirements pass, no `on_succeed` → jump straight through, no UI.
- Skip → jump straight through, bypassing the rest of this crossing attempt.

**`CheckpointGateModal` — one new component for both outcomes.** An earlier draft of this design proposed reusing the existing `Toast` component (already used for the per-location `form_required` block) for the failure case, plus a separate new confirm modal for `on_succeed`. Rejected: `Toast` auto-dismisses after 4 seconds, which is harmless for the two *skippable* use cases in this spec but wrong in general — the schema allows `skippable: false`, and a hard-block message that silently vanishes after 4 seconds leaves the participant stuck with no visible reason and no reminder of what to fix. Since a new modal was already required for `on_succeed` anyway, reusing `Toast` wasn't actually saving a component — it was mixing two UI idioms (an ephemeral corner toast and a deliberate modal) for what is really one feature. `CheckpointGateModal` replaces both: a centered overlay that **never** auto-dismisses, taking a message plus a button configuration — (Go Back, optional Skip) for failure, (Cancel, Continue) for `on_succeed`.

**Crossing backward** (Prev button or swipe-right): if any checkpoint between the target and current index has an active `blocked_after_exit`, the crossing is refused silently (no popup — none is defined for re-entry). The Prev button's existing `{#if currentIndex > 0}` guard becomes `{#if currentIndex > earliestAllowedIndex}`; carousel mode's existing elastic-bounce-at-the-start behavior (already keyed on "no card behind me") fires at that boundary too, for free — same feel as hitting the real start of the route.

**On mount / whenever entries (re)load**: if `currentIndex` would resolve to a checkpoint (e.g. one is authored as the very first entry, gating route start by date), the same forward-crossing evaluation runs immediately, before anything renders.

### Defense in depth

The "checkpoint is never current" invariant is enforced by the navigation helpers, not by the rendering layer. `RouteScreen.svelte`'s existing dispatch (`text` / `splash` / `options` / else `ChallengeCard`) has no branch for `template-type: "checkpoint"` today — if the invariant is ever violated (a bug, or one of the edge cases below), a checkpoint entry falls into the `ChallengeCard` branch and gets rendered as a `Location`, accessing fields like `location.coordinates.latitude` and `location.challenge.description` that a checkpoint file doesn't have. That's a crash, not a graceful failure. `RouteScreen` must gain an explicit checkpoint branch (rendering nothing, or a loading state, while the navigation logic re-normalizes `currentIndex`) as defense-in-depth, independent of the navigation logic being correct.

### Edge cases made explicit

- **Checkpoint as the last entry in a route**: `nextNavigableIndex` has nothing to skip forward to. Treated as a no-op — `currentIndex` doesn't move, same as trying to advance past the end of a route today. A trailing checkpoint gates nothing and is almost certainly an authoring mistake; worth a lint/schema note but not a runtime concern.
- **Consecutive checkpoints**: explicitly unsupported/undefined for v1. The navigation helpers don't special-case chaining multiple failure/`on_succeed` dialogs back to back, and doing that well is real, non-trivial UX design (do two confirms stack? does failing the second one unwind past the first?). Authoring two checkpoint files back-to-back in `routes.yaml` is a mistake to avoid, not a supported pattern — called out here rather than silently mishandled.

## Prerequisite fix: stable location IDs

`ChallengeCard`'s badge number, `ChallengeForm`'s `locationId`, and `RoutePage`'s `formStatusByIndex` / `skippedIndices` / `buildFormStorageKey` calls all currently key on **raw array position** (`index + 1`). That's already wrong today: `000_options_eula` is a non-location entry sitting at position 0 in the live Den Haag route, so every location's "ID" is already offset by one from its true position among locations. Inserting a checkpoint anywhere in the array would shift every subsequent location's ID again, silently misattributing already-submitted form answers.

The fix uses a primitive that already exists: `locationOrdinalAt(entries, index)` (`src/utils/routeEntries.ts`) — it already drives the "N of M" progress indicator and is already immune to non-location entries (checkpoints, text, splash, options) appearing anywhere around a location, since those are filtered out of the count.

Replace every location-identity use of raw position with `locationOrdinalAt(entries, index)`:

- `ChallengeCard.svelte`: badge number, `ChallengeForm`'s `locationId` prop, the `onFormStatusChange` callback argument
- `RoutePage.svelte`: `currentLocationId`, the form-state restore loop's `locId`, every `buildFormStorageKey(...)` call

`currentIndex` itself stays array-position-based — it answers "which screen is showing," which is inherently positional, not a question an ID scheme should answer.

**This is a one-time breaking change for the live route**, independent of adding any checkpoint: shipping it changes the storage key under which each location's submitted-form/skip state lives, so anyone with an in-progress Den Haag hunt at deploy time will see their already-completed badges reset once. `currentIndex` positioning itself is unaffected — a returning participant still resumes on the correct card, just with completion badges/form state cleared. Given this is a small live pilot, this one-time reset was confirmed acceptable in exchange for permanently removing the risk going forward.

## What does *not* change

- `locationTotal` / `locationOrdinalAt` already exclude non-`location` template types, so checkpoints are automatically invisible to the "N of M" progress counter.
- The existing per-location `project.form_required` gate is untouched and orthogonal to checkpoint `forms` requirements — a checkpoint is an independent, additional gate. This is exactly why the pre-completion use case works as a *soft* nudge even with Den Haag's current `form_required: false`.
- `min_completed_forms` and `requires_all_forms_completed` aren't schema-enforced as mutually exclusive; the evaluator simply ignores `min_completed_forms` when `requires_all_forms_completed` is `true`. Documented precedence, not a hard error.

## Validation

New `src/data/schemas/checkpoint.schema.json`, wired into `scripts/validate-yaml.js` (new `CHECKPOINT_PATTERN = /^\d+_checkpoint_.*\.yaml$/`) and `.vscode/settings.json`, matching the existing three-layer validation for `text`/`splash`/`options`. Schema requires at least one of `entry` / `"re-entry"` to be present.

## Concrete authoring for the two use cases

```yaml
# 000_options_eula.yaml — unchanged
# 006_checkpoint_eula_lock.yaml — new (006 is the first unused number prefix)
template-type: checkpoint
"re-entry": false
```

```yaml
# routes.yaml — short_loop
locations:
  - 000_options_eula
  - 006_checkpoint_eula_lock
  - 001_loc_right_to_read
  - 002_loc_vredespaleis
  - 003_loc_plein
  - 004_loc_american_bookstore
  - 005_loc_binnenhof
  - 009_loc_noordeinde
  - 010_loc_mauritshuis
  - 011_checkpoint_pre_completion
  - 007_splash_completion
  - 008_options_end_of_hunt
```

```yaml
# 011_checkpoint_pre_completion.yaml — new
template-type: checkpoint
entry:
  requirements:
    - type: forms
      requires_all_forms_completed: true
      on_fail:
        message: "There are still forms waiting for answers, but you're welcome to call it a day"
  skippable: true
```

## Known residual risk (not fixed here)

`currentIndex` (swipe position) remains array-position-based. Inserting *any* entry (checkpoint or otherwise) into a live route still shifts what raw position means for anyone with a saved position from before the edit — worst case, a returning participant's resume position is off by one screen, self-correctable by swiping. This is pre-existing behavior for any route edit today, not introduced by checkpoints, and is a much lower-severity issue than the form-storage-key problem above (no data loss, just a resume-position nudge). Out of scope; flagged for awareness, not action.

## Testing expectations (for the implementation plan)

- `checkpointNav.ts` / `routeRequirements.ts`: unit tests, pure functions, no Svelte needed. Include a trailing-checkpoint case (`nextNavigableIndex` no-ops at the end of a route).
- `RoutePage` integration: forward crossing with pass/fail/skip/on_succeed, backward crossing blocked/unblocked, checkpoint-at-position-0 on mount, no-checkpoint routes fully unaffected (regression).
- `RouteScreen`: explicit test that a `template-type: "checkpoint"` entry does not fall through to `ChallengeCard` (the defense-in-depth branch actually renders something safe, not a `Location`-shaped crash).
- `CheckpointGateModal`: unit tests for both configurations (fail with/without Skip; succeed with Cancel/Continue), and that it never auto-dismisses.
- Stable-ID fix: badge numbers and form-storage keys unaffected by inserting a checkpoint/text/splash/options entry anywhere in the array; only affected by inserting/removing an actual location.
