# Sourced Textarea Design

**Date:** 2026-07-29
**Branch:** feat_add_binnenhof
**Depends on:** [2026-07-29-location-identity-migration-design.md](2026-07-29-location-identity-migration-design.md) — requires locations to be addressable by their stable `routes.yaml` id string, not a computed ordinal.

## Summary

Add a `source:` field to `type: textarea` form fields, letting a textarea seed its initial value from another location's already-answered field (e.g. a "final manifesto" field pre-filled from an earlier "draft manifesto" field). While the user hasn't edited the field, it stays live-synced to the source; once edited, it freezes, with a button to pull in the latest source value on demand.

This is the feature that motivated the location-identity migration: `007_form_binnenhof.yaml`'s `final_manifesto` field already carries a `source:` reference (currently unimplemented, and not even in the schema's known-keys allowlist, so it renders as a `schema_error` today).

## Reference format

`source: <location_id>.form.<field_id>`, e.g.:

```yaml
source: 004_loc_lange_voorhout.form.manifesto
```

`<location_id>` is the same id used in `routes.yaml`'s `locations` array (Spec 1). `.form.` is a fixed separator — not a variable path segment — chosen so the reference reads as "this location's form data," leaving room for a future non-form reference shape without a breaking change to this one. `<field_id>` is the target field's `id` within that location's form.

The `007_form_binnenhof.yaml` field currently reads `source: 004_form_lange_voorhout.manifesto` (a form filename, not a location id) — this will need updating to `004_loc_lange_voorhout.form.manifesto` as part of implementation.

---

## Section 1: Schema

**`src/types/data.ts`** — `FormField` gains:

```ts
source?: string;
```

**`src/utils/loadLocations.ts`**:

- Add `"source"` to `KNOWN_FORM_FIELD_KEYS`.
- New validation, alongside the existing `validateFieldValue`/`validateFieldConfig`: `source` is only valid on `type: "textarea"` (schema_error otherwise, matching the existing `CONFIG_SUPPORTED_TYPES` pattern for `config`).
- Shape validation: `source` must match `<location_id>.form.<field_id>` (three non-empty segments separated by `.form.` — a regex or simple split is enough, no need to validate that `<location_id>` or `<field_id>` actually exist elsewhere, since that's not knowable at this stage — see Section 2). A malformed shape produces a `schema_error` field, same as other invalid definitions.

---

## Section 2: Resolution

**`src/utils/locationFormLookup.ts`** (new):

```ts
export function parseSourceRef(source: string): { locationId: string; fieldId: string } | null {
  const match = /^(.+)\.form\.(.+)$/.exec(source);
  return match ? { locationId: match[1], fieldId: match[2] } : null;
}

export function getLocationFormValue(
  project: string,
  city: string,
  route: string | undefined,
  locationId: string,
  fieldId: string,
): string | undefined {
  const key = buildFormStorageKey(project, city, route, locationId);
  const value = loadFormState(key).values[fieldId];
  return typeof value === "string" ? value : undefined;
}
```

Built directly on Spec 1's `buildFormStorageKey`/`loadFormState` — a location is now addressable by id directly, so no route-wide mapping is needed (this was the blocker before Spec 1). A synchronous `localStorage` read; no async, no caching.

`getLocationFormValue` is intentionally generic (not named after textareas specifically) — the underlying "look up another location's stored field value" need is expected to recur (per earlier discussion) even though only this one caller exists today. `parseSourceRef` stays specific to this feature's YAML shape.

An unresolved lookup (location never visited, field never answered, or `values[fieldId]` isn't a string) returns `undefined`. The caller treats this identically to "source is empty" — see Section 4.

---

## Section 3: Persisted state

**`src/types/data.ts`** — `FormState` gains:

```ts
touchedFields: string[];
```

**`src/utils/formStorage.ts`**:

- `STORAGE_VERSION` bumps from `"1.0"` to `"1.1"` (minor — still readable, per Spec 1's version check; a client running pre-Spec-2 code reading `"1.1"` data would just ignore the extra field, though in practice both ship together).
- `EMPTY_STATE` and both branches of `loadFormState` gain `touchedFields: parsed.touchedFields ?? []`.

**`src/components/ChallengeForm.svelte`**:

- `touchedFields` becomes `$state<string[]>(stored.touchedFields)`, following the exact pattern already used for `baseValues`/`baseUploads`.
- `handleTouchedFieldsChange(fields: string[])` mirrors `handleValuesChange`/`handleUploadsChange` — updates state, persists via an extended `persist(...)` call.
- `sourceValues` is computed once, `untrack()`-guarded on mount (same pattern as `stored` itself, `ChallengeForm.svelte:32-37`): for each field in `form` with a `source`, parse it and call `getLocationFormValue(project, cityId, routeId, ...)`, collecting results into `Record<string, string>`. Only fields that actually resolve are present in the map — a missing entry means "unresolved," same signal as `undefined` from Section 2.
- Both `touchedFields` and `sourceValues` are passed to `<AppForm>` as new props.

---

## Section 4: `SourcedTextareaField.svelte` (new)

Used from `AppForm.svelte`'s field loop only when `field.type === "textarea" && field.source` — the existing inline `<textarea>` branch (`AppForm.svelte:578-586`) is untouched for ordinary textareas.

Props: `field`, `value` (current stored value), `sourceValue` (resolved live value, or `undefined`), `touched` (boolean), `onInput` (marks touched + updates value), `onUpdateFromSource` (overwrites value with `sourceValue`).

Behavior:
- **Untouched:** textarea's value is `sourceValue ?? field.value ?? ""` — live source content if resolved, else the field's own YAML default, else empty. No button. Every keystroke calls `onInput`, which marks the field touched (permanently — once touched, always touched, per your call) and updates the value.
- **Touched:** textarea's value is the stored value (the user's own edit), never overwritten automatically. An "Update available" affordance renders below it whenever `sourceValue !== undefined` (nothing to pull if the source has never resolved). Clicking it shows an inline confirm — reusing `AppForm`'s existing `showConfirm`/message/Confirm-Cancel pattern rather than introducing a new modal component — and on confirm, calls `onUpdateFromSource`, replacing the textarea's content with `sourceValue`. The field stays touched afterward (no reverting to auto-sync).

Because `sourceValues` is computed once per `ChallengeForm` mount, and `RoutePage`'s swipe strip only keeps the current ± 1 screens mounted (unmounting/remounting others as the user navigates), navigating away from the source location and back to the target naturally re-resolves the latest source value — no cross-component reactivity or subscription needed.

---

## Section 5: Testing

- `loadLocations.test.ts` (or wherever `withValidatedFields` is tested): `source` accepted on `textarea`, rejected (schema_error) on other types, rejected on malformed shape.
- `locationFormLookup.test.ts` (new): `parseSourceRef` on valid/invalid strings; `getLocationFormValue` returns the stored string, or `undefined` when unset/wrong type/location never visited.
- `formStorage.test.ts`: round-trip includes `touchedFields`; a `"1.0"` (Spec-1-only) payload loads with `touchedFields: []` rather than failing (minor-version forward compatibility).
- `SourcedTextareaField.test.ts` (new): untouched renders `sourceValue`; typing marks touched and stops following `sourceValue` changes; Update button appears only when touched and `sourceValue !== undefined`; clicking Update after confirm replaces the value; clicking Cancel leaves it unchanged.
- Update `007_form_binnenhof.yaml`'s `source:` value to the new `<location_id>.form.<field_id>` shape as part of implementation (currently `004_form_lange_voorhout.manifesto`, a stale form-filename-based reference from before this design).

---

## Non-goals

- No cross-field types beyond `textarea` (per your earlier scoping decision).
- No live update while both forms are mounted simultaneously at the same time — resolution is mount-time only, relying on the swipe strip's mount/unmount behavior for freshness on navigation.
- No merge/diff on Update — it's a full overwrite of the textarea's content, confirmed first.
- No validation that a `source:` reference's location id actually exists in the route — only the string *shape* is validated at load time; a reference to a nonexistent location simply never resolves (same as any other unresolved source).
