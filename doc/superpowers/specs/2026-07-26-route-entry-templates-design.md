# Route Entry Templates — Design Spec

**Date:** 2026-07-26
**Status:** Approved

## Overview

Today every entry in a route's `locations` list is assumed to be a location — a place with coordinates, a storyline, a challenge, and (optionally) a form, rendered by `ChallengeCard`. This adds a `template-type` field so a route can also include non-location screens: a plain markdown/text interstitial, a full-bleed splash screen with an entrance effect, and a multiple-choice navigation screen. Existing location YAML is untouched — `template-type` absent means `location`, preserving full backward compatibility.

**Scope:** Frontend rendering, TS types, JSON Schema validation, and `validate-yaml.js`/IDE wiring for three new template types. Admin editor UI support is explicitly deferred (see Out of Scope).

---

## File & Schema Conventions

Existing `NNN_loc_<slug>.yaml` files are unchanged — no renaming. **New template files use `NNN_<type>_<slug>.yaml`**, where `<type>` matches the template's `template-type` value:

```
projects/demo/new_york/
  021_loc_brooklyn_bridge.yaml      # existing, untouched, template-type absent
  022_splash_subway_checkpoint.yaml # template-type: splash
  023_text_intro.yaml               # template-type: text
  024_options_pick_a_path.yaml      # template-type: options
```

`routes.yaml` is unchanged — still a flat list of filenames (minus `.yaml`) regardless of type.

Four schemas live in `src/data/schemas/`, one per file infix:

| Schema | Filename pattern | 
|--------|-------------------|
| `location.schema.json` | `*_loc_*.yaml` (existing, gains optional `template-type: "location"`) |
| `text.schema.json` | `*_text_*.yaml` (new) |
| `splash.schema.json` | `*_splash_*.yaml` (new) |
| `options.schema.json` | `*_options_*.yaml` (new) |

`scripts/validate-yaml.js` gets one `findFiles(DATA_DIR, PATTERN)` + `ajv.compile(...)` pair per new infix, following the exact pattern already used for `LOC_PATTERN`/`FORM_PATTERN`. `.vscode/settings.json`'s `yaml.schemas` map gets three new entries so IDE autocomplete and red-squiggles work per type, same as today.

---

## TypeScript Data Model

`src/types/data.ts` gains a discriminated union. The existing `Location` interface is unchanged (callers matching on `template-type === "location" || undefined` still get the exact same shape):

```ts
export interface LocationEntry extends Location {
  "template-type"?: "location";
}

export interface TextEntry {
  "template-type": "text";
  image?: string;
  title: string;
  text: string;       // markdown
  margin?: string;     // CSS margin value, e.g. "1rem 2rem"; omitted = component default
}

export interface SplashEntry {
  "template-type": "splash";
  image: string;
  shader?: "none" | "grayscale" | "duotone" | "vignette" | "darken";
  effect?: "confetti" | "shooting-stars" | "fireworks";
  "repeat-effect"?: { cooldown: number; max: number };
  title: string;
  anchor?: {
    horizontal: "left" | "center" | "right";
    vertical: "top" | "center" | "bottom";
  };
}

export interface OptionsEntry {
  "template-type": "options";
  image?: string;
  title: string;
  options: Array<{
    text: string;
    target:
      | { type: "link"; value: string }
      | { type: "page"; value: "title" | "project" | "start_route" | "gallery" };
  }>;
}

export type RouteEntry = LocationEntry | TextEntry | SplashEntry | OptionsEntry;
```

Field names stay kebab-case (`template-type`, `title-anchor`→`anchor`, `repeat-effect`) matching the existing YAML convention for multi-word keys elsewhere in the project — no camelCase transform layer.

`loadLocations.ts`'s `loadAndResolveLocation` reads `template-type`, defaulting to `"location"` when absent, and returns `RouteEntry` instead of `Location`. `RoutePage.svelte`'s `locations: Location[]` state becomes `entries: RouteEntry[]` (rename reflects the broader meaning — locations are one case now, not the whole set).

---

## Rendering Architecture

### Dispatch component

A new `src/components/RouteScreen.svelte` wraps the per-entry render, replacing the direct `<ChallengeCard>` calls in both of `RoutePage`'s existing layout branches (`snap` mode at `RoutePage.svelte:313`, carousel-strip mode at `RoutePage.svelte:341`). It switches on `entry["template-type"]`:

- `location` (or absent) → `ChallengeCard` (unchanged, receives the narrowed `LocationEntry` as before)
- `text` → new `TextScreen.svelte`
- `splash` → new `SplashScreen.svelte`
- `options` → new `OptionsScreen.svelte`

All the location-specific props `RouteScreen` doesn't need (`storeFormsInLocalStorage`, `allowResubmit`, `onFormStatusChange`, `badgeStatus`) are only threaded through to `ChallengeCard` when the entry is a location.

### Shared top-hero image

`text` and `options` reuse the exact hero-image treatment `ChallengeCard` already has: the cache-hit `$effect.pre` + async-fetch `$effect` pair (`ChallengeCard.svelte:46-62`) plus the hero markup (`ChallengeCard.svelte:85-121`, minus the location-specific name/address lines). This becomes a shared `ScreenHero.svelte` taking `{ image, title }`, used by `ChallengeCard`, `TextScreen`, and `OptionsScreen`. `splash` does NOT use it — its image is a full-bleed background, a different treatment (see Splash section).

### Progress & badge numbering

Only `location`-type entries count toward the "N of M" progress indicator and get a numbered pin badge. This requires separating two notions of position that today are the same number:

- **Array index** (`currentIndex`) — raw position in `entries`. Stays exactly as-is: drives swipe navigation, the `currentIndex` localStorage key, and form-storage keys. Unaffected by this feature.
- **Location ordinal** — a new derived value, the 1-based count of `location`-type entries at-or-before a given array index. Used only for the progress indicator and `ChallengeCard`'s badge number.

```ts
let locationTotal = $derived(entries.filter(isLocationEntry).length);
let currentLocationOrdinal = $derived(
  entries.slice(0, currentIndex + 1).filter(isLocationEntry).length,
);
```

While viewing a non-location screen, `currentLocationOrdinal` naturally holds at the last-passed location's ordinal (the filter+count simply doesn't increment), so the progress indicator shows e.g. "3 of 8" through a splash/text/options screen sitting between locations 3 and 4, rather than flickering to 0 or blank. Non-location entries never render a `ChallengeCard` badge at all (they're not `ChallengeCard`), so there's no badge-suppression logic needed there.

### Form gating

`RoutePage`'s `canAdvance`/`currentHasForm` derivations already key off `challenge.form?.length` on the current entry. Narrowed to only read that when the entry is a `LocationEntry`, non-location entries naturally have no form → `currentHasForm = false` → `canAdvance = true`. No new gating logic.

---

## Template Specs

### `text`

```yaml
template-type: text
image: filename.jpg   # optional; ScreenHero top image
title: "Between the Bridges"
text: |
  Markdown body, rendered via the existing MarkdownText component.
margin: "1rem 2rem"    # optional CSS margin around the markdown block
```

`TextScreen.svelte`: `ScreenHero` (if `image` present) → centered `title` → `MarkdownText` wrapped in a div with `style="margin: {margin}"` when `margin` is set (this is the one dynamic-inline-style case allowed by the CSS conventions — a free-form author-supplied CSS value, not a themeable color).

### `splash`

```yaml
template-type: splash
image: filename.jpg
shader: duotone            # none | grayscale | duotone | vignette | darken; default none
effect: confetti            # confetti | shooting-stars | fireworks; optional
repeat-effect:               # optional; without it, effect fires once on first mount only
  cooldown: 30                # seconds; re-entering sooner than this suppresses replay
  max: 3                      # total replay cap for this screen instance
title: "You Found It!"
anchor:                      # optional; default { horizontal: center, vertical: center }
  horizontal: center
  vertical: bottom
```

`SplashScreen.svelte`: full-bleed `image` as a background (`background-size: cover`), `shader` applied as a CSS `filter`/overlay preset:

| shader | implementation |
|--------|-----------------|
| `grayscale` | `filter: grayscale(1)` |
| `duotone` | `filter: grayscale(1) sepia(1) hue-rotate(...)` using the active theme's accent color |
| `vignette` | radial-gradient overlay div, transparent center → dark edges |
| `darken` | semi-transparent black overlay div |
| `none` / absent | no filter, no overlay |

`title` is absolutely positioned per `anchor` (9-way grid: `{horizontal} {vertical}` maps to CSS `justify-content`/`align-items` on a full-size flex container). Note: `vertical` is `top | center | bottom` — during brainstorming this was verbally given as "top/center/right", read here as a typo for "bottom" since "right" isn't a vertical position.

**Effects:** three new hand-rolled components under `src/components/effects/` — `ConfettiEffect.svelte`, `ShootingStarsEffect.svelte`, `FireworksEffect.svelte` — using CSS keyframes and/or a small `<canvas>` particle loop, matching the project's existing hand-rolled-interaction style (`swipe.ts`, `leafletMap.ts`). No new dependency.

**Repeat trigger:** the effect fires once whenever this screen's array index becomes the current one (mirrors the existing `{#key}`-per-index remount pattern used for `ChallengeForm` at `RoutePage.svelte:154`), gated by:
- No `repeat-effect`: fires only on the very first time this index is reached (per route-visit — not persisted across reloads).
- With `repeat-effect`: fires on every re-entry EXCEPT when fewer than `cooldown` seconds have elapsed since it last fired, or it has already fired `max` times this session. Fire count and last-fired timestamp are in-memory (`$state` in `SplashScreen`), not persisted to localStorage — a reload resets the count, same lifetime as `isAnimating`/`currentSlotIndex` today.

### `options`

```yaml
template-type: options
image: filename.jpg    # optional; ScreenHero top image
title: "Where to next?"
options:
  - text: "Explore more of Den Haag"
    target: { type: page, value: title }
  - text: "Start the route again"
    target: { type: page, value: start_route }
  - text: "Visit our website"
    target: { type: link, value: "https://example.org" }
```

`OptionsScreen.svelte`: `ScreenHero` (if `image` present) → centered `title` → a button per option. On click:
- `type: link` → plain `<a href={value} target="_blank" rel="noopener noreferrer">` (external).
- `type: page`, resolved relative to the route's own `project`/`city` params via `push()` (svelte-spa-router), no new fields needed:
  - `title` → `push(`/${project}/${city}`)`
  - `project` → `push(`/${project}`)`
  - `gallery` → `push(`/${project}/${city}/gallery`)`
  - `start_route` → clears this route's saved position (`localStorage.removeItem(`${project}/${city}/${route}`)`) **then** `push(`/${project}/${city}/${route}`)`, so it actually restarts at index 0 instead of resuming where the participant left off.

---

## Validation

New schemas follow the existing `additionalProperties: false` + `required` pattern. `options.schema.json`'s per-option `target` uses an ajv draft-07 `if`/`then` conditional so `value`'s shape depends on `type`:

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["type", "value"],
  "properties": {
    "type": { "enum": ["link", "page"] },
    "value": { "type": "string" }
  },
  "if": { "properties": { "type": { "const": "page" } } },
  "then": { "properties": { "value": { "enum": ["title", "project", "start_route", "gallery"] } } },
  "else": { "properties": { "value": { "type": "string", "format": "uri" } } }
}
```

`splash.schema.json` and `text.schema.json` enum-constrain `shader`/`anchor.horizontal`/`anchor.vertical`/`effect` the same way `location.schema.json` already enum-constrains form field `type`.

---

## Out of Scope

- **Editor UI.** `EditorLocationForm`/`EditorLocationList` are unchanged and continue to only handle `location` entries. Template screens are hand-authored YAML for now, protected by the same three validation layers (`architecture.md`'s "YAML Data Validation" section) locations already get: IDE schema (Layer 1), runtime sentinel (Layer 2 — N/A here since there's no form-reference migration case), CI `validate:yaml` (Layer 3). Editor support is a candidate follow-up spec once the format has proven out in real content.
- **Real WebGL/GLSL shaders.** `shader` is a small CSS filter/overlay enum, not a shader pipeline.
- **Animation libraries.** Effects are hand-rolled CSS/canvas, no new dependency.
- **Cross-project/cross-city option targets.** `type: page` targets always resolve within the current route's own `project`/`city`. Linking to a different project or city requires `type: link` with a full in-app URL (e.g. `#/other_project/other_city`) for now.
