# Cancel Discard Design

**Date:** 2026-05-12
**Status:** Approved

## Summary

When the user edits a location in `EditorLocationForm`, their changes are auto-saved to localStorage on every keystroke. Pressing **Cancel** should discard those changes after a confirmation prompt. The title bar should reflect the file being edited and show a dirty indicator (`*`) as soon as changes exist.

Browser back and the title bar back arrow continue to navigate away without clearing the draft — preserving the existing behaviour.

---

## Architecture

### `titleBarStore` / `TitleBarState`

Add two optional fields:

```ts
subtitle?: string;   // label shown below the main title, e.g. "Dam Square" or "new"
isDirty?: boolean;   // when true, " *" is appended to the subtitle
```

`TitleBar.svelte` renders a second line beneath the title whenever `subtitle` is set. The asterisk is only appended when `isDirty` is also true. The subtitle is styled smaller and muted (CSS custom property colours).

Visual example:
```
Edit location
Dam Square *
```

### `AppForm.svelte`

Add one optional callback prop:

```ts
onHasChangesChange?: (hasChanges: boolean) => void;
```

A `$effect` inside `AppForm` calls this whenever `hasChanges` flips. The callback reference is read inside `untrack` to avoid the effect re-registering every time the parent re-renders. No other changes to `AppForm`.

### `EditorLocationForm.svelte`

**Subtitle computation**

- Edit mode (`params.filename` set): parse the filename via `tryParseLocationName(params.filename)` to get the slug (e.g. `"dam-square"`), then format it for display: `slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())` → `"Dam Square"`. Fall back to the raw `params.filename` if parsing returns null.
- New mode: subtitle is `"new"`.
- The subtitle is included in the existing `titleBarStore.set(...)` effect so it is set once on mount.

**Dirty tracking**

```ts
let isDirty = $state(false);
```

Updated via the new `onHasChangesChange` callback passed to `AppForm`. A separate `$effect` syncs `isDirty` into `titleBarStore` (`titleBarStore.update(s => ({ ...s, isDirty }))`), keeping the store in step without rebuilding the full state object on every keystroke.

**Cancel button — new behaviour**

```
if (!isDirty) → push(backPath)
if (isDirty)  → window.confirm("Discard changes?")
               → confirmed:  clearDraft(draftKey) → push(backPath)
               → cancelled:  do nothing
```

`clearDraft` must be added to the `editorStorage` import in `EditorLocationForm`. `backPath` is `/editor/locations/${params.project}/${params.city}`.

**Back button (menu arrow) and browser back — unchanged**

Both navigate via `push(backPath)` without touching the draft. The draft is preserved exactly as today.

---

## Data Flow

```
User types in AppForm
  → hasChanges (derived in AppForm) flips true
  → onHasChangesChange(true) fires
  → EditorLocationForm: isDirty = true
  → $effect: titleBarStore.update(s => ({ ...s, isDirty: true }))
  → TitleBar renders "Dam Square *"

User clicks Cancel (dirty)
  → window.confirm("Discard changes?")
  → confirmed → clearDraft(draftKey) → push(backPath)
  → dismissed → nothing

User clicks Cancel (clean) or Back arrow
  → push(backPath) immediately, draft untouched
```

---

## Error Handling

- `window.confirm` is synchronous and cannot fail.
- `clearDraft` wraps `localStorage.removeItem` in a try/catch and silently ignores errors — no additional handling needed.
- If `tryParseLocationName` returns null, fall back to displaying the raw `params.filename`.

---

## Testing

Existing tests cover:
- `AppForm` `hasChanges` logic
- `EditorLocationForm` draft save/restore lifecycle

New tests to add:
- `TitleBar`: renders subtitle when `subtitle` is set; appends `*` only when `isDirty` is true.
- `AppForm`: `onHasChangesChange` is called with `true` when a field value differs from baseline; called with `false` when restored.
- `EditorLocationForm`: cancel with no changes navigates immediately; cancel with changes shows confirm; confirm → clears draft + navigates; dismiss → stays.

---

## Out of Scope

- Custom confirm dialog component (native `window.confirm` is sufficient).
- Dirty indicator on other pages or forms.
- Persisting `isDirty` across page reloads.
