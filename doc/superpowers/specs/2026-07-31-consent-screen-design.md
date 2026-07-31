# Consent Screen — "Before you begin"

Date: 2026-07-31
Status: **draft — user-authored product/UX spec, not yet reviewed against this codebase.**
The engineering-alignment pass (checking it against the real current implementation,
the data model, and how it needs to change) was started and immediately paused when
this session pivoted to building a prerequisite (`isVisible`, see the handover doc at
`doc/handovers/2026-07-31-consent-screen-handover.md`). **Read that handover before
touching this document or starting implementation** — it has the specific mismatches
already found between this draft and the real codebase, which are not yet folded into
the text below.

Version: v1.0 (as pasted by the user; unmodified since)
Scope: one screen. Standalone — does not depend on the landing/join-flow spec.

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
  EU between 13 and 16. Make it a config value per project rather than a constant.

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

### 2.2 Components and tokens

Build as an `AppForm` behind a checkpoint gate that blocks navigation until acknowledged.
No new form machinery:

- `section` field type → the three section headings.
- `radio` → the age question, rendered as a two-option segmented control.
- `boolean` → the consent checkbox.
- `WideButton` primary → the acknowledge button.

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

| Answer | Consent block renders |
|---|---|
| `yes` | The promotional-use checkbox, unticked, plus the optional/withdrawal note |
| `no` | A statement instead of a control: photos will **not** be used for promotion; they still appear in this hunt's gallery for other teams; a parent or guardian can grant promotional permission via the organiser |
| unanswered | Neither — show the question only |

The `no` state must not read as a dead end or a reprimand. Confirm what *will* still happen
alongside what won't, and name the route for a guardian who does want to grant permission. A
state that only says "denied" makes people wonder what they've broken.

Switching the answer from `yes` to `no` clears any ticked consent — it does not preserve it
hidden.

---

## 4. What to record

Four fields. No ages.

```ts
{
  acknowledgedAt: string,      // ISO timestamp
  consentVersion: number,      // version of the consent TEXT, not of the app
  allSixteenPlus: boolean,
  promoConsent: boolean        // always false when allSixteenPlus is false
}
```

- `consentVersion` is what lets you re-prompt **only** participants whose recorded version is
  older than the current text, rather than re-prompting everyone or guessing. Bump it
  whenever the consent wording changes materially.
- **`localStorage` is a cache, not the source of truth.** The server record is authoritative.
  If local storage is cleared and the screen is shown again, the write must **update** the
  existing record, never create a second, possibly contradictory one.
- `promoConsent: true` must be impossible to persist when `allSixteenPlus` is false — enforce
  server-side, not only in the UI.

---

## 5. The actual safety net — deliberately not on this screen

Consent grants permission; it does not stop a specific bad photo going out.

**Add a `promoApproved` flag set by a human, and require it before any photo is used
promotionally, regardless of what the participant ticked.** One field plus a filter on
whatever the organiser exports. This is the control that matters, and it is cheap.

Two related choices to make at content-authoring time rather than here:

- **Any challenge that asks for people in frame should be completable without faces.** "Your
  team's shoes on the step" scores the same as a group selfie. This removes most of the
  problem at source and costs nothing.
- A photo-removal route is needed anyway for erasure requests — state it rather than leaving
  people to guess.

---

## 6. Withdrawal

Add **Photo permissions** to the `☰` menu, available at all times, showing the current
setting with a control to change it.

This is a requirement, not a nicety: withdrawal has to be as easy as granting, and a screen
shown once per route cannot serve that. Changing it there updates the same record from §4 and
bumps nothing else. The note under the checkbox names this location at the moment consent is
given, so the participant learns the exit as they enter.

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
- [ ] `promoConsent: true` cannot be persisted when `allSixteenPlus` is false — verified
      server-side, not just in the UI.
- [ ] Clearing `localStorage` and re-acknowledging updates one record rather than creating a
      second.
- [ ] Raising `consentVersion` re-prompts only participants with an older recorded version.
- [ ] Photo permissions is reachable from the `☰` menu at any time and reflects the stored
      value; changing it updates the same record.
- [ ] Checkbox row and each segmented option clear 44px; the checkbox label is clickable.
- [ ] Screen reader: age question is a labelled radio group; the consent note is wired via
      `aria-describedby`; switching the age answer announces the change via
      `aria-live="polite"`.
- [ ] Renders correctly in all three themes; red is not the primary button colour in any of
      them.
- [ ] `data-fontsize` at `small`, `medium`, `large` — no clipped or overlapping text.
- [ ] No hardcoded hex in component CSS; no new runtime dependency; no image assets.
- [ ] The age threshold is a per-project config value, not a hardcoded 16.

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
