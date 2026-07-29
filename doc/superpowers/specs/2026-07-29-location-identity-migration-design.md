# Location Identity Migration Design

**Date:** 2026-07-29
**Branch:** feat_add_binnenhof

## Summary

Replace the computed ordinal `locationId: number` (a location's position among location-type entries in a route) with the location's existing `routes.yaml` id string (e.g. `"004_loc_lange_voorhout"`) as the canonical identity, everywhere a location is identified: local draft storage, the submission API payload, the results database, and results-matching logic.

This is a prerequisite for a follow-up feature (a `source:` field on textarea form fields that reads a value from another location's form — see the forthcoming sourced-textarea design). Resolving `source: <location_id>.form.<field_id>` requires locations to be addressable by a stable, YAML-authorable id; the ordinal position is neither stable (depends on route composition) nor known to whoever is authoring a `source:` reference.

Also adds a version envelope around persisted form state, so a future change to the stored shape doesn't get silently misread by older client code.

## Motivation

- Ordinals are fragile: they're a function of a route's full entry list (`locationOrdinalAt`, filtering out checkpoints), not something visible or referenceable from a single location's YAML file.
- The same form file can already be attached to more than one location (`001_form_abc.yaml` is used by both `001_loc_abc.yaml` and, currently, `012_loc_right_to_read_blocks.yaml`). Identity needs to belong to the *location*, not the form file, since the form is a stateless, reusable template.
- No hunts are currently in progress, so there is no migration path to preserve — existing localStorage and results-DB rows for this identity scheme can be treated as obsolete once this ships.

## Approach

Single migration, all layers in one pass — client storage, submission payload, results matching, and a new versioning envelope. Scope is contained (no DB schema change; `location_id` stays a `TEXT` column, it just holds a different string shape).

---

## Section 1: Storage versioning envelope

**`src/utils/formStorage.ts`** — wrap persisted state in a version envelope, independent of the `FormState` shape itself:

```ts
const STORAGE_VERSION = "1.0"; // "major.minor"

function majorVersion(v: string): string {
  return v.split(".")[0];
}

export function loadFormState(key: string): FormState {
  const raw = localStorage.getItem(key);
  if (!raw) return { ...EMPTY_STATE, values: {}, uploads: {} };
  try {
    const parsed = JSON.parse(raw) as Partial<FormState> & { version?: string };
    if (majorVersion(parsed.version ?? "0.0") !== majorVersion(STORAGE_VERSION)) {
      return { ...EMPTY_STATE, values: {}, uploads: {} };
    }
    return {
      values: parsed.values ?? {},
      uploads: parsed.uploads ?? {},
      submitted: parsed.submitted ?? false,
      skipped: parsed.skipped ?? false,
    };
  } catch {
    return { ...EMPTY_STATE, values: {}, uploads: {} };
  }
}

export function saveFormState(key: string, state: FormState): void {
  localStorage.setItem(key, JSON.stringify({ version: STORAGE_VERSION, ...state }));
}
```

- A missing `version` (all pre-migration data, since the field didn't exist before) is treated as `"0.0"` — always a major mismatch, always discarded. This is intentional: it means this migration's own storage-key change is doubly safe (old keys are a different string *and* old payloads would fail the version check even if they somehow collided).
- Minor version bumps (e.g. Spec 2 adding a `touchedFields` array to `FormState`) stay readable — only a major bump invalidates existing data. Bump the major segment only for a breaking shape change.
- `FormState` (the type used by `ChallengeForm`/`AppForm`) is unchanged — `version` lives only in the serialized envelope, not the app-facing type.
- Chosen over key-embedded versioning (e.g. `.../v1/form`): a future upgrade script has to parse and transform the payload shape either way; key-versioning additionally requires computing both old and new key patterns and cleaning up orphaned old-format keys. Payload-versioning keeps one stable key format and lets a migration script transform-in-place. There's no concurrent-access case here (localStorage is per-browser; a reload gets the new bundle and the new scheme) that would favor key-versioning.

---

## Section 2: Identity model & storage key

The identity is the string each location is already given in `routes.yaml`'s `locations` array (e.g. `"004_loc_lange_voorhout"`) — the same id used today to build each location's file path (`RoutePage.svelte:37-42`, `` `projects/${project}/${city}/${id}` ``). No new id scheme, no YAML authoring changes.

**`src/utils/formStorage.ts`**:

```ts
export function buildFormStorageKey(
  project: string,
  city: string,
  route: string | undefined,
  locationId: string, // was: number
): string {
  return `${project}/${city}/${route ?? ""}/${locationId}/form`;
}
```

Route stays in the key — a location shared across multiple routes (this happens today in Oslo: `002_loc_stortinget` appears in `inner_circuit`, `resistance_walk`, and `full_route`) keeps independent answers per route, matching current behavior. This is a scoped, deliberate choice, not an oversight — see Non-goals.

---

## Section 3: Client wiring

`entries` (resolved route content, from `loadLocations`) and `routeData.locations` (id strings) are already parallel arrays — same order, same length, built from the same `locationPaths` map (`RoutePage.svelte:37-42, 82-84`). Everywhere a location's identity is currently derived from position, switch to indexing the id string at that same position instead:

| File | Current | New |
| --- | --- | --- |
| `RoutePage.svelte` | `locationOrdinalAt(entries, i)` (ordinal number) | `routeData.locations[i]` (id string) |
| `RoutePage.svelte` | `formStatusByIndex: Record<number, ...>`, `skippedIndices: Set<number>` | keyed by location id string |
| `OptionsScreen.svelte:39` | `locationId: index` | `locationId: <id string at index>` |
| `ChallengeCard.svelte:169` | `locationId={index ?? -1}` | `locationId={<id string>}` |
| `ChallengeForm.svelte:22` | `locationId: number` prop | `locationId: string` prop |

`ChallengeForm`'s `storageKey` (line 32) and its `postFormSubmit`/`postPhotoUpload`/`postVideoUpload` calls all use this same prop, so the type change flows through them without any additional plumbing inside `ChallengeForm.svelte` itself.

---

## Section 4: Submission API & backend

`src/utils/api.ts` — `postFormSubmit`/`postPhotoUpload`/`postVideoUpload`'s `locationId` field becomes a location id string instead of a number.

`src/worker/routes/formSubmitRoute.ts:43` — `location_id: String(body.locationId ?? "unknown")`: the `String()` coercion becomes a no-op (already a string) or is dropped.

`src/worker/routes/uploadRoute.ts:81`, `uploadVideoRoute.ts:91` — `location_id: locationId` unchanged in shape, just receives a string now. `src/worker/photoKeys.ts`'s `buildR2KeyPrefix(locationId: string, ...)` was already typed `string` — it was silently accepting a coerced number before; no signature change needed there.

No D1 schema change: `location_id` is already `TEXT` in both the `photos` and `form_submissions` tables (`src/worker/db.ts:265, 330`).

---

## Section 5: Results matching

**`src/utils/resultsData.ts`** — `submissionsForCell` currently matches by ordinal:

```ts
Number(sub.locationId) === ordinal
```

This becomes a direct string comparison against the location id, and `RouteLocationEntry` (currently `{ ordinal, name, fields }`) gains a location-id field used for matching instead of (or alongside) `ordinal` — `ordinal` can stay for display purposes (e.g. "Location 3 of 7") since it's still meaningful as a position, it just stops being the join key.

---

## Section 6: Testing

Update fixtures using numeric `locationId` to string ids across: `ChallengeForm.test.ts`, `formStorage.test.ts`, `api.test.ts`, `worker.test.ts`, `worker.formsubmissiondb.test.ts`, `worker.photodb.test.ts`, `worker.gallery.test.ts`, `worker.uploadRoute.test.ts`, `worker.uploadVideoRoute.test.ts`, `resultsData.test.ts`, `RoutePage.test.ts`, `OptionsScreen.test.ts`, `EditorLocationList.test.ts`, `EditorLocationForm.test.ts`.

New tests:
- `formStorage.test.ts`: a saved-then-loaded round trip with a mismatched major version returns the empty state; a mismatched minor version still round-trips.
- `resultsData.test.ts`: `submissionsForCell` matches by location id string across a route where the same location id appears validly once (no accidental ordinal-shaped string collisions).

---

## Non-goals

- The `source:` field / sourced-textarea feature itself — separate, follow-up spec, built on top of this one.
- Any D1 schema migration — `location_id` stays `TEXT`.
- Any data-preservation/migration path for existing localStorage or D1 rows — none currently in progress; both are safe to leave behind under the old shape (localStorage: unreadable under the new version envelope regardless; D1: historical rows keep their old ordinal-shaped `location_id` values and simply predate this scheme, which is acceptable since there's nothing live depending on cross-referencing them against current route ordinals).
- Changing route-scoping behavior — a location shared across multiple routes keeps independent per-route answers, unchanged from today.
- Checkpoint entries — no identity change needed; checkpoints don't carry forms and aren't addressed by `source:`.
