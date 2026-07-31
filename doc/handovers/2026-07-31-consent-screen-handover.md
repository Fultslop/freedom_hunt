# Handover: Consent screen — prerequisite built, screen work not started

**Date:** 2026-07-31
**Branch:** `consent_screen`
**Status:** `isVisible` (conditional field visibility) is fully implemented, tested, and
**staged but not committed** on top of `05b589a`. The consent screen itself — the actual
subject of this branch — **has not been started**. This session went one layer deeper than
planned: the consent screen needed a capability the form system didn't have, so this session
built that capability first, generically, rather than bolting a one-off onto the screen.

## What this is

The user pasted a complete, well-developed UX/legal design doc for a "Before you begin"
consent screen (age gate + separable photo-promotion consent, GDPR-motivated) and asked for
it to be reviewed and turned into a spec. That doc is now saved at
`doc/superpowers/specs/2026-07-31-consent-screen-design.md` — **verbatim as pasted, marked
draft, not yet reconciled with the codebase**. Read that file for the actual screen
requirements; this handover covers what's already known to be wrong or missing relative to
it, plus everything that happened instead this session.

Early architecture review (before the pivot) found the pasted doc's technical framing doesn't
quite match reality — see "What the draft spec gets wrong or omits" below. Then, working
through the screen's interaction design (§3 of the draft: age answer reveals/hides the promo
checkbox, and clears it if answered "no" after being ticked), it became clear `AppForm`
had no way to conditionally show/hide one field based on another's answer. The user
explicitly wants to move the project **away from bespoke one-off components and toward
generic, reusable, YAML-declarable capabilities** — see the two new `.claude/CLAUDE.md`
policy notes (Design Process section: YAML-first for data-driven components; Coding
Conventions: dependencies-over-hand-rolled-code, moving off the old blanket "no new runtime
dependency" stance). So this session detoured into designing and building that capability
properly, as its own spec + plan + implementation, before touching the screen at all.

## Current repo state

```
git log --oneline -1        # 05b589a chore: minor fixes, doc: new spec for conditionals
git status --short          # everything below is staged (M/A), nothing unstaged, nothing committed
```

Staged files: `.claude/CLAUDE.md`, `scripts/validate-yaml.ts`, `src/components/AppForm.svelte`,
`src/components/ChallengeForm.svelte`, `src/data/schemas/form.schema.json`,
`src/test/{AppForm,ChallengeForm,locationFormLookup,visibility}.test.ts`,
`src/types/conditions.ts`, `src/types/data.ts`, `src/utils/{locationFormLookup,visibility}.ts`.

Verified clean immediately before this handover was written: `npx vitest run` (1020/1020),
`npx tsc --noEmit` (0 errors), `npm run lint` (0 errors), `npm run validate:yaml` (0
violations). **First thing next session: decide whether to commit this before starting the
screen work**, or fold it into the same eventual PR — the user hasn't said which.

## What was built this session: `isVisible`

Full spec: `doc/superpowers/specs/2026-07-31-conditional-visibility-design.md`.
Full plan (exact code, task-by-task): `doc/superpowers/plans/2026-07-31-conditional-visibility.md`.

One-paragraph summary: `FormField` (and, later, other route-entry types on demand — not done
yet, deliberately) can carry an `isVisible` block. YAML shape:

```yaml
isVisible:
  initially: conditional   # visible (default, or omit isVisible entirely) | hidden | conditional
  condition:                # or: any: [...] / all: [...] / not: {...}, recursive, exactly one
    source: all_sixteen_plus    # bare id = this form's own field; dotted <loc>.<form>.<field> = cross-form
    operator: "="                # =, !=, <, <=, >, >=, like, "is null", "is not null"
    value: "Yes"
```

`src/utils/visibility.ts` exports `evaluateVisibility(config, ctx, options?)` returning
`{status:"visible"|"hidden"} | {status:"error", message}`. `AppForm.svelte` renders hidden
fields as nothing, error fields as the existing `.af-field--unknown` sentinel (never a crash
for a live participant), excludes both from validation, and clears a field's stored value the
instant it goes hidden.

**Things worth knowing before building on top of this:**

- **`source` is always a reference; `value` is a literal unless it's dotted cross-form
  shape.** No bare-id shorthand for `value` — deliberate, to avoid ambiguity with the common
  literal case. This directly matters for the consent screen's age→checkbox condition, which
  will look like `condition: { source: all_sixteen_plus, operator: "=", value: "Yes" }`.
- **No implicit type coercion, anywhere.** A `radio` field's value is always a string even
  when it looks numeric — comparing against a bare YAML number is a type-mismatch error, not
  a silent false. Quote it: `value: "2"`.
- **Three-state result, not boolean.** `error` renders visibly, never throws for a real user.
  "Fail hard, fail fast" in this codebase means *loud and visible*, not *crashes the app* —
  that distinction came up explicitly and repeatedly this session and should carry forward to
  any related work.
- **`function` operands (`{function: name, params: [...]}`) are reserved, not implemented.**
  The type already supports recursive params specifically so a future `max`/`min`/`join`
  transform can slot in later without another type change — but nothing resolves them today.
  `npm run validate:yaml` rejects any authored use; the resolver throws in dev/test, falls
  back to `hidden` in production as a last-resort safety net.
- **`evaluateVisibility`'s prod/dev check is an explicit `options.isProduction` parameter,
  never a module-top-level `import.meta.env` read.** `scripts/validate-yaml.ts` runs under
  plain `tsx`, not Vite — `import.meta.env` is `undefined` there. If this ever gets refactored
  and that constraint slips, the CI script silently breaks the moment anything triggers that
  code path. `scripts/validate-yaml.ts` only ever imports `findReservedFunctionUsage` from
  `visibility.ts`, never `evaluateVisibility` — keep it that way.
- **Cross-form references need `AppForm`'s new `formContext` prop** (`{project, city, route}`),
  which `ChallengeForm.svelte` already passes through. Any other future `AppForm` call site
  (editor forms, team setup) that doesn't pass it simply can't use cross-form `isVisible`
  conditions — attempting one without it is a runtime error, not a silent no-op.
- **A real bug was found and fixed during review** (not by the plan — the plan's own
  reference code had this gap): a dotted cross-form reference used as `value` (not `source`)
  that resolves to nothing (unvisited location) used to error instead of resolving to hidden.
  Fixed in `compare()`/`resolveStringOperand` via an `unresolvedReference` tag; regression
  test added. If anything about value-side cross-form resolution looks surprising, this is
  the fix to re-read.
- **Deliberately not built:** `variant: segmented` on `radio` fields, and a `note` field type
  (a `section`-shaped pseudo-field rendered as body copy instead of a heading) — both were
  discussed as part of designing `isVisible`'s worked examples, both are real and needed for
  the consent screen (segmented Yes/No age control; the "we won't use your photos" declined-
  state block), but neither was implemented — they belong to the consent-screen work itself.
  See `doc/superpowers/specs/2026-07-31-conditional-visibility-design.md` §2.4 and §8
  (non-goals) for the exact YAML shapes already sketched for both.

## What the draft consent-screen spec gets wrong or omits

Found during the initial architecture pass, before the `isVisible` detour. **Not yet folded
into the spec file itself** — do that as the first real step of next session, before writing
an implementation plan.

- **The current screen is not what §2.2 assumes.** Today's pre-hunt screen is
  `src/data/text/en/projects/democrats_abroad/den_haag/000_options_eula.yaml`
  (`template-type: options`, rendered by `OptionsScreen.svelte`) — a static markdown body plus
  one tracked button, **not** an `AppForm`. §2.2 says "build as an `AppForm` behind a
  checkpoint gate that blocks navigation until acknowledged" — this both understates the real
  work (it's a template-type swap, not a component tweak) and slightly mischaracterizes the
  mechanism: nothing currently *blocks* forward navigation on this screen, and per the draft's
  own acceptance checklist nothing should (primary button always enabled).
- **`000_checkpoint_eula.yaml` already exists** immediately after the EULA screen in
  `short_loop`'s route (`re-entry: { blocked_after_exit: true }`) and is what actually makes
  the screen "shown once per route" today — via backward-nav blocking plus `RoutePage`'s
  localStorage-persisted resume position, not via any forward gate. This checkpoint likely
  needs no changes at all for the acknowledgement behavior — but see the `consentVersion`
  re-prompt problem below, which does need something new.
- **No backend exists for §4's consent record.** `form_submissions` (D1) is per-location,
  per-route-position, not a stable per-participant record; there's no versioning, no
  update-not-duplicate endpoint, no `promoApproved` human-review flag (§5), no withdrawal
  endpoint. This is real new backend surface (D1 table + Worker routes), not a rendering
  detail — confirmed with the user, who explicitly chose **one full-stack spec** covering
  screen + backend together rather than splitting it (see "Decisions already made" below).
- **`consentVersion` re-prompting conflicts with how `RoutePage` resumes today.** `RoutePage`
  just resumes at the `localStorage`-persisted `currentIndex` for a route — it has no concept
  of "re-show an earlier screen because its content version is stale." Making §4's
  version-based re-prompt actually work needs new logic: on mount, compare the participant's
  recorded `consentVersion` against the current YAML's version and, if stale, override the
  resume position back to the consent screen regardless of where they'd gotten to. This is
  unaddressed in the draft spec and needs real design, not just a checklist bullet.
- **The `☰` menu (`TitleBar.svelte`) has a hardcoded root/submenu structure** (Profile /
  Themes / Text Size, each a literal `{#if menuView === "..."}` branch) — adding "Photo
  permissions" (§6) is straightforward mechanically but needs its own fetch/update API call,
  which doesn't exist yet either.
- **Age threshold as per-project config** (§3's caveat) fits the existing free-form
  `project.<key>: value` pattern already used for `project.form_required` etc. in
  `<projectId>.yaml` — this part of the draft translates cleanly, no gap here.
- **Not yet checked:** exact D1 schema shape, exact API route names/shapes, whether
  `promoApproved` (§5) belongs in this same spec or is explicitly deferred, how contact-optional
  participants (see `ParticipantAuthState.contact: string | null` in `src/types/auth.ts`) reach
  a "Photo permissions" menu item if they have no way to be re-identified — this wasn't
  investigated at all yet.

## Decisions already made (don't re-litigate these without new information)

1. **One full-stack spec for the consent screen** — screen + D1 table + versioning +
   withdrawal menu together, not split into a UI-only spec and a later backend spec. User's
   explicit call after I raised the option to split.
2. **The interactive age/consent portion is built on `AppForm` + `isVisible`**, not as a
   bespoke component with its own local `$state`. This is *why* `isVisible` got built this
   session — the user rejected the bespoke-component alternative specifically because "we
   want to move toward re-usability, not bespokeness."
3. **YAML-first design process, now in CLAUDE.md**: for any new data-driven capability, design
   and get the YAML authoring shape reviewed *before* the technical implementation. This is
   how `isVisible` actually got designed this session (YAML examples first, implementation
   plan second) and should apply again to whatever new template-type/component the consent
   screen needs.
4. **Dependencies-over-hand-rolled-code, now in CLAUDE.md**: the project no longer defaults to
   zero-new-dependencies. Evaluated case-by-case — for `isVisible` specifically, a build-vs-buy
   pass concluded no library actually fit (bespoke resolver needed regardless of library
   choice; the YAML shape was purpose-built and would need reshaping or a translation layer
   either way). Worth re-checking case-by-case for consent-screen needs (e.g. if a date/GDPR/
   consent-timestamp library turns out to fit better than hand-rolling).

## Suggested next steps

1. Fold the "What the draft consent-screen spec gets wrong or omits" section above into
   `doc/superpowers/specs/2026-07-31-consent-screen-design.md` itself (or a revised version of
   it) — that file is currently still the user's unmodified original draft.
2. Explore the backend shape (D1 table for the consent record, API routes, `promoApproved`)
   before finalizing the spec — this wasn't investigated at all this session beyond noting
   that nothing currently exists.
3. Design the `consentVersion`/resume-position interaction explicitly — it's the one piece of
   the draft spec that's actually underspecified relative to how `RoutePage` works today, not
   just unaligned with current file names.
4. Once the spec is solid: `variant: segmented` (radio) and the `note` field type are two
   small, already-sketched `AppForm` additions the screen needs — worth their own tight
   YAML-first mini-round before the full implementation plan, same pattern as `isVisible`.
5. Decide (with the user) whether to commit the currently-staged `isVisible` work before
   starting any of the above, or carry it forward uncommitted alongside the new work.
