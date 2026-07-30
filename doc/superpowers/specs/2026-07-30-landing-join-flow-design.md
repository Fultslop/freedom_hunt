# Landing & Join Flow — Design Spec

Date: 2026-07-30
Status: ready to implement
Version: v1.1 (revised after codebase review — see "Revision notes" at the end)

Covers three participant-facing screens: the landing/attract screen, hunt-code entry
(project selection), and team setup. Written to be implemented directly. Where a number
appears it is a tuned value from an approved mock, not a suggestion — change it only with
a reason.

---

## 1. Scope

**In scope (v1.1)**

- `LandingPage` — attract screen with an endless procedural search animation.
- Hunt-code entry, presented as a sheet **on the landing route** (not a separate page).
- `TeamSetupPage` — team name only.
- A shared `SearchPlane` background component used by all three.
- Transition model between the three states.
- Deleting `AppPage`, `CodeEntryPage`, `JoinTeamPage` and their current routes, replaced by
  the routes in §4.
- A small **backend** task: normalize hunt-code comparison (see §4.1) — required for the
  sheet's lenient code matching (§8.1) to actually work, not purely cosmetic.

**Out of scope (deliberately deferred)**

| Item | Why deferred |
|---|---|
| Team colours | Not in the data model today; wait until the leaderboard and gallery can consume a colour. See §12. |
| Photo shelf on the plane | Needs real completed-hunt photos plus upload consent. |
| Loading screen | Separate screen; it is the intended home for the DFS in-joke copy. |
| Login step (email+password / bootstrap-password variants) | Already exists, unchanged. This spec only reserves a slot for it in the progress indicator. |
| A frictionless/anonymous demo mode | The demo entry point in this spec routes into the **existing** `/login/demo` → `/signup/demo` whitelist flow, unchanged. Building a truly accountless demo is a separate, larger feature (anonymous session handling, ephemeral data) not undertaken here. |
| Live team-name collision checking | No backend endpoint exists to query a project's existing team names today. Deferred alongside team colours — see §12. |
| City/route picker redesign | `ProjectPage`/`CityPage` are unchanged; this spec only adds a conditional auto-skip when a project has exactly one city and one route (§9). |
| Admin/editor surfaces | Unchanged. |

**Non-goals.** No new runtime dependency. No image assets of any kind — every visual is a
token, a `lucide-svelte` icon, or a DOM element. No changes to the theming mechanism. No
new webfont — `--font-map` uses a system condensed fallback stack (§3.3).

---

## 2. Responsive strategy

Mobile-first. The content column keeps `--content-max` and stays centred at every width.
The **background plane is full-viewport** and fills whatever space exists.

| Breakpoint | Content column | Plane | Sheet |
|---|---|---|---|
| `< 720px` (default) | full width minus gutters | fills viewport | rises from bottom edge, `border-radius` top corners only |
| `>= 720px` | `--content-max`, centred | fills viewport; grid fade radius increased | centred card, all corners rounded, max-width `--content-max` |
| `>= 1200px` | `--content-max`, centred | prune horizon raised so more of the tree is visible | as above |

Because the plane's perspective origin and the content column are both horizontally
centred, they stay aligned at all widths with no extra work.

On wide screens raise two values only (see §5 for what they mean):

```css
@media (min-width: 720px)  { --search-fade-solid: 14%; --search-fade-edge: 46%; }
@media (min-width: 1200px) { --search-fade-solid: 18%; --search-fade-edge: 54%; }
```

and raise `pruneRemove` from 13 to 18 at `>= 1200px` so the visible tree fills the extra
area rather than the camera sitting in an empty field.

Do **not** scale the plane, the tilt, or the node spacing per breakpoint. A wider viewport
should show *more* of the same world, not a bigger version of it.

---

## 3. New tokens

### 3.1 Per-theme colour tokens (`src/theme/themes.ts`)

Add to every theme's token set. Never reference a hex in component CSS.

| Token | Role |
|---|---|
| `--search-grid` | Grid rule lines on the plane |
| `--search-edge` | Unexplored edge |
| `--search-edge-active` | Edge of the branch just chosen (transient) |
| `--search-edge-visited` | Edge on the settled path |
| `--search-node` | Unexplored node dot |
| `--search-node-active` | Current node dot |
| `--search-node-halo` | Soft ring around the current node (needs alpha) |
| `--search-label` | Place-name label text |
| `--search-pin-stem` | Pin stem |
| `--search-pin-head` | Pin head |
| `--intro-fog` | Complete gradient value fading the far end of the plane into the background |
| `--intro-scrim` | Complete gradient value darkening/lightening behind the bottom controls |
| `--font-map` | Cartographic label face (see §3.3) |
| `--sheen-image` | Complete `linear-gradient(...)` for the wordmark sheen, or `none` |

`--intro-fog` and `--intro-scrim` are stored as **whole gradient values**, not colour
stops. Composing them in CSS from `--color-background` plus `transparent` produces a visible
grey band in several engines, because `transparent` interpolates through transparent
*black*. Storing the finished gradient per theme avoids that and keeps the light themes
correct.

Suggested values for `app` (dark), as a reference point for the other two — these already
line up with `app`'s real background (`#0f172a`) and accent (`#f59e0b`) in
`src/theme/themes.ts`:

```
--search-grid:         #27354d
--search-edge:         #243350
--search-edge-active:  #f59e0b
--search-edge-visited: #334c6e
--search-node:         #33415c
--search-node-active:  #f59e0b
--search-node-halo:    rgba(245,158,11,.12)
--search-label:        #a7bad0
--search-pin-stem:     #b06f09
--search-pin-head:     #f59e0b
--intro-fog:    linear-gradient(#0f172a 40%, rgba(15,23,42,0))
--intro-scrim:  linear-gradient(rgba(5,10,20,0), rgba(5,10,20,.74) 44%, rgba(5,10,20,.94))
--sheen-image:  linear-gradient(104deg,#e7eef7 8%,#ffd88a 26%,#f59e0b 42%,#ffe6a8 58%,#e7eef7 76%,#f0b84a 92%)
```

For `wireframe`: grid and edges resolve to `--color-border`, nodes to `--color-text`,
`--sheen-image: none`, fog/scrim gradients built from white. For `GWC`: pale grid on white,
`--sheen-image: none` (a civic brand should not shimmer — see §11).

### 3.2 Per-theme behaviour values

Following the `swipe.mode` precedent, these are theme *values*, not CSS:

```ts
intro: {
  motion: 'search' | 'static' | 'none',   // search = animate; static = one frozen tree; none = no plane
  sheen: boolean
}
```

- `wireframe`: `{ motion: 'static', sheen: false }`
- `app`: `{ motion: 'search', sheen: true }`
- `GWC`: `{ motion: 'search', sheen: false }`

### 3.3 Structural tokens (`src/styles/tokens.css`)

- `--font-size-display` — one step above `--font-size-3xl`, and it **must** rescale with
  `data-fontsize` like the rest of the scale.
- `--font-map` family stack: `'Barlow Semi Condensed','Roboto Condensed','Arial Narrow',sans-serif`.
  No new webfont is added — this is a system-fallback stack only, matching the app's
  "no new runtime dependency" constraint. Under `wireframe`, point it at Arial and let the
  theme stay honest.
- `--sheet-radius: 1.125rem` (18px).

Rationale for a condensed label face: at a 58° tilt the vertical squash is
`cos(58°) ≈ 0.53`, so a 16px label renders about 8.5px tall. A rounded geometric face
closes its counters at that size; a condensed humanist face stays legible and reads as
cartographic, which is what the labels are.

---

## 4. Files

**New**

```
src/components/SearchPlane.svelte        + SearchPlane.css
src/components/JoinSheet.svelte          + JoinSheet.css
src/components/HuntSummary.svelte        + HuntSummary.css
src/components/DepthWordmark.svelte      + DepthWordmark.css
<pages>/LandingPage.svelte               + LandingPage.css
<pages>/TeamSetupPage.svelte             + TeamSetupPage.css
src/utils/searchWalk.ts
src/utils/placeNames.ts
```

Place the two page components wherever existing page-level components live; match the
repo's current convention rather than introducing a new folder.

`placeNames.ts` holds only decorative map-label word lists for `SearchPlane` (place-like
names such as "Old Market"). It is **not** the team-name generator — see the "Changed"
list below.

**Changed**

- `src/theme/themes.ts` — tokens from §3.1, values from §3.2.
- `src/styles/tokens.css` — §3.3.
- `src/styles/global.css` — the shared `@keyframes` from §5.4 and §6.
- `TitleBar` — support a `progress` variant driven by join-flow step count (§8.3). No new
  component.
- `AppForm` — `random_value` gains `reroll: boolean` and `editable: boolean` (§8.2), **both
  defaulting to `false`**. The existing Jewish Children's Museum challenge
  (`003_form_jewish_children_museum.yaml`) uses `random_value` deliberately without a
  reroll — it must render exactly as it does today with no field changes.
- `src/utils/teamNameGenerator.ts` — extended (not replaced) to optionally seed its noun
  list from project data, with the existing 32-word global list as fallback. Same function
  signature/behavior for existing callers.

**Deleted**

- `src/pages/AppPage.svelte` (+ `.css`), `src/pages/CodeEntryPage.svelte` (+ `.css`),
  `src/pages/JoinTeamPage.svelte` (+ `.css`), and their tests — fully superseded by
  `LandingPage` + `JoinSheet` + `TeamSetupPage`.
- Old routes `/`, `/start`, `/join/:project` (in their current meaning) — replaced by the
  table below. `/login/demo`, `/signup/demo`, `/login/:project` (admin bootstrap password)
  are **unchanged** and out of scope.

**Routing** (hash router, as today)

| Route | State |
|---|---|
| `#/` | Landing, sheet closed |
| `#/start` | Landing, sheet open, code field empty |
| `#/join/<code>` | Landing, sheet open, code resolved (deep link / QR target) |
| `#/join/<code>/team` | Team setup |

`#/` and `#/start` and `#/join/<code>` all render the **same page component**. Only the
sheet state differs. This matters for the transition model in §9.

The sheet's demo button (§8.1) does **not** go through any of these routes — it navigates
directly to the existing `/login/demo` page, unchanged.

### 4.1 Required backend change: code normalization

§8.1 requires the hunt-code field to accept case- and separator-insensitive input
(trim, uppercase for display, treat `-`/`_`/space as equivalent). Today, the code the
participant types **is** the login password (see `authRoutes.ts`'s `/auth/verify-code`,
which does `storedPassword === trimmed` — an exact, case-sensitive match against a
KV-stored value), and that same original string is replayed verbatim to `/auth/login`.
Client-side-only normalization breaks this: normalizing before matching can find the right
project in `/auth/verify-code` while still failing the exact-match login check if the
user's casing/separators differ from what's stored.

This requires a small backend change, not just a friendlier input mask:

1. Normalize codes at provisioning time (wherever a project's participant password is set
   in KV) using one canonical function — trim, uppercase, collapse `-`/`_`/space to a
   single separator (or strip them entirely).
2. Apply the same normalization to the incoming code in both `/auth/verify-code` and
   `/auth/login`'s comparison, so client and server agree on one canonical form end to end.
3. **Migration:** existing provisioned codes in KV need a one-time pass through the same
   normalization function, or `/auth/verify-code`/`/auth/login` need to compare against a
   normalized copy of the stored value on the fly (simpler, no migration, marginally more
   work per request — recommended given the KV list is small).

This is a self-contained backend task and should be planned/implemented as its own unit
before or alongside the frontend work — the frontend sheet cannot be meaningfully tested
end-to-end without it.

---

## 5. `SearchPlane`

The shared background for all three screens. Owns the tilted plane, the grid, and the
search walk. Renders nothing else.

### 5.1 Props

```ts
{
  mode: 'search' | 'route' | 'frozen',
  anchor: number,        // plane origin as % of scene height. 64 landing, 46 join, 38 team
  route?: Stop[],        // required for mode 'route' — real stops from project data
  paused?: boolean       // true while a sheet is open in 'search' mode
}
```

### 5.2 Structure and z-order

Four sibling layers inside the plane, in this DOM order. The `translateZ` values are what
make the stack deterministic regardless of creation order — do not rely on DOM order alone,
and do not use `z-index` inside a `preserve-3d` context.

| Layer | `translateZ` | Contains |
|---|---|---|
| grid | 0 | single element, §5.3 |
| world | 0 | edges and node dots |
| pins | 2px | pins, each counter-rotated `rotateX(-58deg)` with `transform-origin: 0 0` |
| labels | 4px | place-name labels |

The pin counter-rotation is the only element that leaves the plane, and it is what sells
the perspective. Without it the whole scene reads as a flat tilted drawing.

Scene wrapper:

```
perspective: 520px;
perspective-origin: 50% 22%;
overflow: hidden;
```

Plane:

```
position: absolute; left: 50%; top: <anchor>%;
transform-style: preserve-3d;
transform: rotateX(58deg) translate3d(<-camX>px, <-camY>px, 0);
```

Labels lie **flat on the plane** — do not billboard them to face the camera. Printed map
labels are foreshortened in reality and this is what makes the scene read as a map on a
table rather than a 3D scene with floating UI.

### 5.3 The infinite grid

One element, `1700 × 1700px`, centred on the plane origin, two `repeating` background
gradients at `46px`, masked with a radial gradient:

```css
mask-image: radial-gradient(circle at 50% 50%,
            #000 0%, #000 var(--search-fade-solid), transparent var(--search-fade-edge));
```

Defaults: `--search-fade-solid: 11%`, `--search-fade-edge: 40%`.

Each frame, set the grid's own transform to the camera position **snapped to whole grid
cells**:

```js
grid.style.transform =
  `translate3d(${Math.round(cam.x / 46) * 46}px, ${Math.round(cam.y / 46) * 46}px, 0)`;
```

Because the grid is a child of the plane, the plane's `-cam` translation and this `+cam`
translation cancel, so the fade stays centred on the search head in screen space. Because
the offset is snapped to a whole cell, the *lines* never appear to slide. That is the whole
trick — an endless grid for one element.

The mask is applied in plane space, so it foreshortens into an ellipse. That is correct:
the falloff should follow the ground, not the screen.

### 5.4 The search walk — `mode: 'search'`

Put the generator in `src/utils/searchWalk.ts` as a pure function so it can be unit-tested
without a DOM. All angles in radians; `-π/2` points away from the viewer.

| Parameter | Value |
|---|---|
| Children per split (`k`) | 2 (30%), 3 (38%), 4 (32%) |
| Angular spacing between children | `k=2: 0.74`, `k=3: 0.60`, `k=4: 0.50`, each `+ rand(0, 0.12)` |
| Base heading jitter per split | `±0.275` |
| Heading clamp | within `±1.15` of `-π/2` |
| Edge length | `68 – 94px` |
| Camera lerp | `cam += (target - cam) * 0.045` per frame |
| Fade nodes from age | 7 steps |
| Remove nodes at age | 13 steps (18 at `>= 1200px`) |

Per-step timeline. `done = (k - 1) × 330 + 450`.

| t (ms) | Event |
|---|---|
| `i × 330` | Child `i`'s edge and dot are created; edge animates from `width: 0` to full over 450ms |
| `done + 250` | Pin drops on the chosen child (600ms, `cubic-bezier(.4,.05,.5,1)`, overshoot at 78%); chosen edge switches to `--search-edge-active`; **camera retargets** |
| `done + 500` | Previous current node demoted; chosen node becomes current; place-name label fades in (550ms) |
| `done + 1300` | Chosen edge settles to `--search-edge-visited` |
| `done + 1300` | Next split begins |

Two consequences of this timing that are intentional and should be preserved:

1. **Cadence varies with fan width** — about 2.1s for a two-way split, 2.7s for four-way.
   It reads as the search thinking harder about wider choices, and it stops the loop from
   feeling metronomic.
2. **All edges draw in `--search-edge`; only the pin reveals the choice.** An earlier
   version drew the chosen edge in the accent from the start, which gave away the decision
   and wasted the pin.

Camera and growth are deliberately unsynchronised: the lerp is still easing when the next
split fires, so nothing ever snaps.

`paused: true` means *no new split is scheduled*. In-flight animations finish, the head
node keeps its halo, the camera finishes easing. This is a real state, not a dim.

### 5.5 Route mode — `mode: 'route'`

Used once a hunt is known. Renders the hunt's **actual stops** as a single wandering path:
one node per stop, all in `--search-node-active`, edges in `--search-edge-visited`, a pin on
stop 1, and labels on roughly three stops (first, middle, last) to avoid clutter.

This mode requires a specific route's location list — see §8.1 for when that's actually
knowable (only once code resolution has narrowed to exactly one city and one route).

| Parameter | Value |
|---|---|
| Step length | `30 – 42px` (shorter than search mode so ~15 stops fit the viewport) |
| Heading jitter | `±0.35`, clamped within `±0.8` of `-π/2` |
| Camera | anchored on stop 1 |

Node positions are **derived from stop order, not from real coordinates**. This is a
decorative representation of route shape, not a map; using real lat/long would produce
illegible clustering and imply a precision the screen doesn't have. If you later want a
real map, that's Leaflet's job on the stop screens, not this one.

### 5.6 Frozen mode

One pre-generated tree, drawn at full width with no transitions, everything in settled
colours, head node lit. Used for `intro.motion: 'static'` (i.e. `wireframe`) and as the
`prefers-reduced-motion` fallback.

### 5.7 Performance and lifecycle

- One `requestAnimationFrame` loop for the camera and grid only. Everything else is CSS.
- DOM stays bounded at roughly 40 elements via the prune rule. Verify this — an unbounded
  attract screen is the one thing here that can degrade a phone over a long session.
- Stop the rAF loop and clear pending timeouts on `visibilitychange` (hidden) and on
  component destroy. An attract screen must not run while the hunt does.
- `prefers-reduced-motion: reduce` → `mode: 'frozen'`, no rAF loop, sheen parked at a fixed
  `background-position` rather than switched to flat colour.

---

## 6. `DepthWordmark`

The title, set as an indented depth hierarchy. The indent is not decoration — it encodes a
real containment relationship, which is why it extends to a third line.

```
Searchspace              ← platform            padding-left: 0
  Scavenger Hunt         ← product             padding-left: 20px
    <project name>       ← project (when known) padding-left: 40px
```

- Font: theme display face, `--font-size-display`, weight 700, `line-height: .98`,
  `letter-spacing: -.03em`.
- **Only the deepest visible line gets the sheen.** This makes the effect navigational: the
  glint marks where you are in the hierarchy and moves down as you descend. State it as a
  rule in the component, not an accident of markup.
- Sheen implementation: `background-image: var(--sheen-image)`, `background-size: 280% 100%`,
  `background-clip: text`, `color: transparent`, animated `background-position` to `280% 0`
  over **13s linear infinite**. Each depth line takes a `-2.6s` animation delay per level so
  the highlight travels down the block rather than pulsing in unison.
- Gate the whole treatment on `intro.sheen`. When false, use `--color-text`.

**Contrast requirement.** A gradient means contrast varies across the word. Every stop must
independently clear AA against `--color-background`, measured, not eyeballed — this app is
read outdoors in direct sunlight and that is the one place this effect could actually hurt.
This is the reason `--sheen-image` is `none` on both light themes rather than retuned three
times.

Third line appears only once a project is resolved. It is the same object gaining a level,
not a new element — see §9.

---

## 7. `LandingPage`

```
┌──────────────────────────────────────┐
│ ●                                 ☰  │  TitleBar: node mark left, menu right
├──────────────────────────────────────┤
│                                      │
│  Searchspace                         │  DepthWordmark, 2 lines
│    Scavenger Hunt                    │
│                                      │
│  Discover the city together,          │  sub-line, --color-text-secondary
│  one clue at a time.                  │  "together" in accent, weight 700
│                                      │
│         ·  ·                          │  SearchPlane, mode: 'search'
│       ·──●    ·                       │
│    ·──╯   ╰──·──╮                     │
│                 ●  Old Market         │
│                                      │
│  ┌────────────────────────────────┐  │
│  │        Start hunting           │  │  WideButton, primary
│  └────────────────────────────────┘  │
│   ▣ Gallery   ▣ Past hunts  ▣ Self-host │  icon + caps label, 44px targets
└──────────────────────────────────────┘
```

- **TitleBar mark.** The wordmark is *not* repeated in the bar — it would duplicate the
  headline. Instead the bar carries a single accent dot with a soft halo: the root node as
  the app mark. Same object the animation is built from, and it doubles as the favicon.
- `SearchPlane` with `anchor: 64`, `mode` from `intro.motion`.
- `--intro-fog` overlays the top of the scene so the far tree fades behind the type.
- `--intro-scrim` overlays the bottom so the graph never competes with the controls.
- Sub-line emphasis uses **weight and colour, not italic**. Comfortaa and Quicksand have no
  true italic; the browser synthesises a slant and a sheared rounded geometric face looks
  broken rather than emphatic.
- Nav is icon-above-label, three items, `padding: 11px 0` minimum so each clears 44px.
  Contact and the theme switcher live in the ☰ menu.
- The primary button is present and tappable from first paint. Nothing on this screen is
  ever gated behind an animation.

---

## 8. Join sheet and team setup

### 8.1 `JoinSheet` — states

The sheet lives on the landing route and has four states.

**`empty`**

```
eyebrow    JOIN A HUNT                        --font-map, caps, .22em tracking
h2         Enter your hunt code
help       Your organiser gave you a code, or it's on the QR you scanned.
field      [ ______________ ]                 --font-map, caps, .2em tracking, 48px min
primary    Find hunt                          disabled until >= 3 chars
divider
secondary  ▣ No code? Try the demo             bordered, 46px min
```

- Input is **case- and separator-insensitive**: trim, uppercase for display, treat `-`,
  `_` and space as equivalent when matching. This relies on the backend normalization
  described in §4.1 — do not ship this behavior without it, or valid codes typed in a
  different case/separator than stored will resolve in the sheet but then fail the actual
  login on the team-setup screen.
- `autocapitalize="off"`, `autocomplete="off"`, `enterkeyhint="go"`, autofocus on open.
- The demo button navigates directly to the existing `/login/demo` page (email+password,
  whitelist-gated, unchanged) — it does **not** go through code resolution or the `found`
  state below. It is a bordered button, not a text link, since it's the second most
  important action on the screen.

**`checking`** — primary button shows a transient busy state. Reuse the existing
`AppForm`/submit busy pattern rather than inventing one.

**`invalid`** — inline error below the field, `--color-error`, `aria-live="polite"`,
`aria-describedby` wired to the input. Copy in §10. Never navigate on failure.

**`found`**

A code resolves to a **project**, which may contain multiple cities and routes (see
`doc/architecture.md`'s data model) — it does not resolve to a single hunt with known
stats. The found state therefore has two variants:

*Common case today — the project has exactly one city and exactly one route* (true for
the only live project, Den Haag):

```
eyebrow    HUNT FOUND                         --color-success
h2         <project name>
help       <city> · <language> · hosted by <organiser>
field      [ da-hague              ✓ ]        success border, check icon
chips      ▣ 15 stops  ▣ 2.4 km  ▣ ~2 hours
primary    Join this hunt
note       No account needed. You'll pick a team name next.
```

*General case — the project has more than one city or route:*

```
eyebrow    HUNT FOUND                         --color-success
h2         <project name>
help       <city count> cities · hosted by <organiser>
field      [ da-hague              ✓ ]        success border, check icon
(no chips — route isn't known yet)
primary    Join this hunt
note       No account needed. You'll pick a team name, then a city and route, next.
```

- Behind the sheet, `SearchPlane` switches to `mode: 'route'` **only** in the single-city/
  single-route case, using that route's real stops. In the general case, `SearchPlane`
  stays in `mode: 'search'` (still paused) — the branching-collapses-to-a-path payoff only
  makes sense once a specific route is actually known.
- `DepthWordmark` gains its third line with the project name in both variants.
- The code field **stays visible** at the top of the found state. That is what makes this
  read as the same object gaining detail rather than a new screen.
- Green appears exactly twice — eyebrow and check. It is the only non-accent colour in the
  flow, which is why it registers.
- Chips (single-city/single-route case only): stops from project data; distance summed
  along stop coordinates (haversine); duration from project data or a stated per-stop
  estimate. If any value is unavailable, drop that chip rather than showing a placeholder.

### 8.2 `TeamSetupPage`

```
┌──────────────────────────────────────┐
│ ←  Join the hunt                  ☰  │  TitleBar with back + progress
│ ━━━━━━━━━━━━━━━━━━━━━━                │  2px accent progress line
├──────────────────────────────────────┤
│  Searchspace                         │  DepthWordmark, 3 lines, reduced size
│    Scavenger Hunt                    │
│      <project name>                  │  ← sheen on this line only
│                                      │
│   (route/search plane, settled,       │  SearchPlane, mode inherited from
│    dimmer, anchor 38)                 │  found state (route or search)
│                                      │
│  STEP 2 OF 2                          │
│  Name your team                       │
│  It shows on the leaderboard and on   │
│  every photo you take.                │
│  [ Rowdy Herring          ] [ 🎲 ]   │  48px field + 48px reroll button
│  ┌────────────────────────────────┐  │
│  │           Continue             │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

- Implement as `AppForm` with a single `random_value` field, extended:
  - `reroll: true` — renders an adjacent icon button (`dice-5` from lucide), 48px square,
    which regenerates the value. Not an in-field icon: those sit under-target and get
    missed by a thumb, which is exactly the failure mode an outdoor one-handed context
    punishes.
  - `editable: true` — the value is a normal text input, prefilled rather than locked.
  - Both properties default to `false` — see §4's "Changed" entry for why.
- Prefilled, never empty. Minimal typing is a stated constraint and an empty field on the
  fun screen reads as homework.
- Generator: `src/utils/teamNameGenerator.ts`, extended to accept an optional project-seeded
  noun list (falling back to its existing 32-word global list). Do not introduce a second,
  competing generator in `placeNames.ts` — that file is scoped to `SearchPlane`'s decorative
  map labels only (see §4).
- **Submission wires into the existing auth flow, not a new one.** "Continue" calls
  `postLogin({ project, teamName, password })`, where `password` is the code stashed in
  `sessionStorage` during code entry (`pendingHuntAuth`) — the same mechanic
  `CodeEntryPage`/`JoinTeamPage` use today. `AppForm`'s `onSubmit` callback is this call; on
  success, clear `pendingHuntAuth` and proceed per §9's routing rule. On failure, surface
  the returned error the same way `JoinTeamPage` does today.
- No live collision checking against existing team names — deferred, see §12 and the Scope
  table. Duplicate team names are allowed, same as today.
- The route/search plane stays exactly where it was behind this screen (same `mode` as
  whatever the found state left it in). That continuity is what tells the participant
  they've gone one level deeper rather than somewhere else.
- Button copy is **"Continue"**, not "Start the hunt" — because for a project with more
  than one city/route, tapping it does not start the hunt yet, it goes to the city picker.
  See §9 for the one case where it's reasonable to skip straight into the route.

### 8.3 Progress

Extend `TitleBar`'s existing `{ current, total, animateMs }` progress indicator (already
used for in-hunt stop progress) for join-flow step count instead. Step count is derived
from project settings so the optional login slots in without a code change:

- login not required → `Step 1 of 2` (code), `Step 2 of 2` (team)
- login required → `1 of 3`, `2 of 3` (login), `3 of 3` (team)

A 2px accent rule under the bar, not a stepper component.

---

## 9. Transitions

**The rule: sheets move vertically, content cross-fades, the plane only re-anchors.** Any
new screen in this flow picks one of those three and does not invent a fourth.

The plane is the constant. It never transitions — cross-fading or sliding whole screens
would make the shared surface flicker or double-move, which is the one thing that breaks
the illusion. It only ever settles (search pauses, camera holds) or re-anchors (camera eases
to a new focus using the lerp that is already running).

| From → To | Mechanic |
|---|---|
| Landing → code entry | Sheet `translateY(100%) → 0`, 320ms `ease-out`. Simultaneously `paused = true`: no new split is scheduled, in-flight animations finish. Reversible — tap outside or back sends it down and growth resumes. Same route. |
| Code entry → found | **Sheet does not move.** Content cross-fades in place: 180ms out, 180ms in. Panel height animates to the new content height. Behind it, plane switches `search → route` **only** in the single-city/single-route case (§8.1); otherwise it stays in `search`, still paused. `DepthWordmark` gains its third line. |
| Found → team setup | Route change, so the sheet leaves and returns: old sheet down, new sheet up, 40ms overlap. Breadcrumb gains its third line during the gap. Plane stays put. |
| Team setup → next (post-login) | If the joined project has exactly one city and exactly one route, navigate straight into `RoutePage` for that route — "Continue" effectively starts the hunt in this case. Otherwise navigate to the existing `ProjectPage` (city picker), unchanged. This is the one case where it's fair for the experience to feel like "Continue" meant "start" — because for the one hunt live today, it does. |
| Any → back | Reverse of the applicable step. Landing resumes `paused = false`. |

Implementation notes:

- Animate the sheet with `transform: translateY()` only. Animating `height` or `bottom` on
  a sheet that sits over a 3D-transformed sibling forces a repaint of the whole perspective
  layer on some Android browsers.
- For the height change on resolve, use an explicit measured height rather than `auto`, or
  the `grid-template-rows: 0fr → 1fr` technique if you'd rather not measure.
- At `>= 720px` the sheet is a centred card: replace the `translateY(100%)` entrance with
  `opacity 0 → 1` plus `translateY(6px) → 0` over the same 320ms. A sheet pinned to the
  bottom edge of a 1400px window looks wrong.
- All transitions collapse to ~1ms under `prefers-reduced-motion: reduce`.
- Sheet dismissal: outside click and `Escape`, matching the existing `TitleBar` menu
  baseline. Focus moves into the sheet on open and returns to the trigger on close.

---

## 10. Copy sheet

Sentence case throughout. Active voice. A control names what happens when it is used, and
keeps the same name through the flow.

| Key | Copy |
|---|---|
| Landing headline | `Searchspace` / `Scavenger Hunt` |
| Landing sub | `Discover the city **together**, one clue at a time.` |
| Landing primary | `Start hunting` |
| Nav | `Gallery` · `Past hunts` · `Self-host` |
| Sheet eyebrow | `Join a hunt` |
| Sheet heading | `Enter your hunt code` |
| Sheet help | `Your organiser gave you a code, or it's on the QR you scanned.` |
| Field label | `Hunt code` |
| Sheet primary | `Find hunt` |
| Demo | `No code? Try the demo` |
| Error, unknown code | `No hunt with that code. Check it with your organiser.` |
| Error, empty | `Enter the code your organiser gave you.` |
| Found eyebrow | `Hunt found` |
| Found primary | `Join this hunt` |
| Found note (single route known) | `No account needed. You'll pick a team name next.` |
| Found note (route not yet known) | `No account needed. You'll pick a team name, then a city and route, next.` |
| Team eyebrow | `Step 2 of 2` |
| Team heading | `Name your team` |
| Team help | `It shows on the leaderboard and on every photo you take.` |
| Team reroll `aria-label` | `Suggest another name` |
| Team primary | `Continue` |

Errors explain what happened and what to do. They do not apologise and they are never
vague. Empty states are invitations to act.

The DFS in-joke (`Breadth-first is for tourists.`) is deliberately **not** here. It rewards
people who get it and confuses everyone else, which makes it wrong for a hero and right for
a loading screen. Park it, with `expanding node 4 of 15` status text, for that screen.

---

## 11. Per-theme matrix

| | `wireframe` | `app` | `GWC` |
|---|---|---|---|
| `intro.motion` | `static` | `search` | `search` |
| `intro.sheen` | off | on | off |
| Grid | `--color-border`, thin | subtle navy rules | pale blue rules |
| Nodes | `--color-text` | accent amber | DA navy, accent red for current |
| Labels | Arial via `--font-map` | condensed | condensed |
| Sheet | square-ish corners | `--sheet-radius` | `--sheet-radius` |

`wireframe` gets a single frozen tree because a shimmering animated title flatly
contradicts what that theme is for. `GWC` keeps the motion but loses the sheen: a civic
brand should not twinkle, and a light background makes the gradient's contrast
unmanageable.

---

## 12. Deferred

Recorded here so the v1.1 work does not paint us into a corner.

**Team colours (v1.2+).** When the leaderboard and gallery can consume it, add a team
colour picked on `TeamSetupPage`. Shape:

- New per-theme palette tokens `--team-1` … `--team-n`.
- A `radio` field in `AppForm` rendered as swatches. Five at 44px plus gaps is what fits a
  320px column — six breaks the touch floor, so expand the palette only alongside a layout
  change.
- The picker must **do something visible**: tapping a swatch should recolour the route
  nodes and pin behind the sheet. A swatch row that only tints a preview dot is not worth
  the vertical space, and the visible recolour teaches what the colour is *for* before the
  participant ever sees the leaderboard.
- Open product question to settle first: are colours unique within a hunt? Unique makes the
  colour a real identifier and requires showing taken colours as disabled, and caps team
  count at palette size. Non-unique makes it decoration.

Nothing in v1.1 should hardcode node colour at a call site — always go through
`--search-node-active` — so that swapping in a team colour later is a token change.

**Live team-name collision checking.** Requires a new backend endpoint (query a project's
existing team names). Not built here; v1.1 has no collision detection, matching today's
behavior.

**Frictionless/anonymous demo mode.** The current demo entry point reuses the existing
whitelist-gated email+password flow. A genuinely accountless demo (ephemeral session, no
signup) is a larger, separately-scoped feature.

---

## 13. Acceptance checklist

- [ ] Renders correctly at 320px, 390px, 768px, 1440px.
- [ ] All three themes, switched at runtime mid-flow, with no layout break.
- [ ] `data-fontsize` at `small`, `medium`, `large` — no clipped text. Decide and document
      whether the wordmark indent survives a wrapped second line, or whether the wordmark
      opts out of the preference.
- [ ] Every tappable element clears 44px.
- [ ] No hardcoded hex in any component CSS.
- [ ] Keyboard: full flow completable without a pointer; visible focus everywhere; sheet
      traps focus and restores it on close; `Escape` closes.
- [ ] `aria-describedby` wires field help and error text; `aria-live="polite"` on resolve
      and error.
- [ ] Every sheen gradient stop measured against its theme background for AA.
- [ ] `prefers-reduced-motion: reduce` — no rAF loop, frozen plane, sheen parked,
      transitions ~1ms.
- [ ] Plane element count stays bounded over a 10-minute idle session.
- [ ] rAF loop stops on tab hide and on navigation away.
- [ ] `#/join/<code>` cold load lands in the found state without flashing the empty sheet.
- [ ] `#/join/<code>` for a multi-city/multi-route project shows the found state **without**
      stat chips and without switching `SearchPlane` to route mode.
- [ ] Backend code normalization (§4.1) ships before or alongside this work — verified by
      typing a code in a different case/with different separators than provisioned and
      completing the full join → team setup → login flow successfully.
- [ ] Team setup's "Continue" successfully calls `postLogin` using the stashed code and
      completes authentication — not just a cosmetic form submit.
- [ ] Demo button navigates to the existing `/login/demo` page and that flow is unaffected.
- [ ] No new runtime dependency; no image assets added; no new webfont added.

---

## Revision notes (v1.0 → v1.1)

This spec was originally drafted by an assistant without direct codebase access (see
`doc/prompts/ui-design-handover.md`). A review against the actual codebase found four
issues serious enough to change behavior, resolved as follows:

1. **The hunt code doubles as the login password** (exact-match, server-side) — the
   sheet's lenient matching needs a backend normalization change (§4.1), not just a nicer
   input mask.
2. **A code resolves to a project, not a single hunt** — the found state, `SearchPlane`
   route mode, and stat chips are now conditional on the resolved project having exactly
   one city and one route (§8.1, §9); otherwise the existing `ProjectPage`/`CityPage`
   pickers still run after team setup.
3. **Demo is a real whitelisted account today**, not a frictionless/ephemeral mode — the
   sheet's demo button now routes to the existing `/login/demo` flow unchanged, and the
   "nothing was saved" framing was removed.
4. Smaller fixes: old pages/routes explicitly deleted (§4); `random_value`'s new
   `reroll`/`editable` properties default `false` to protect existing YAML; the team-name
   generator work extends `teamNameGenerator.ts` instead of duplicating it inside
   `placeNames.ts`; live team-name collision checking deferred (no backend support exists);
   no new webfont.

`doc/prompts/ui-design-handover.md` was also updated with a new "Join flow mechanics"
section so future external-assistant handovers don't reproduce issues 1–3.
