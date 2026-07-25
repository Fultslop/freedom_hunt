# Image Picker Dialog — Design Spec

**Date:** 2026-05-12  
**Branch:** feat_editor_image_selection  
**Status:** Approved

## Problem

The editor location form has a free-text input for the `image` field. Users must type a filename exactly (e.g. `den-haag-logo.jpg`), which is error-prone and gives no visual feedback about which image they're selecting.

## Solution

Replace the `string` field with a new `image-picker` field type that opens a modal grid dialog showing all available images as thumbnails. The user clicks an image to select it. After selection, the thumbnail and filename are shown inline in the form.

## Architecture

### New field type

Add `"image-picker"` to `FormFieldType` in `src/types/data.ts`. No new `FormField` properties are needed for v1; filtering and configuration can be added later if required.

### Image discovery

`src/utils/images.ts` uses Vite's `import.meta.glob` over `src/data/img/*` to produce a list of `{ filename, url }` pairs at build time. An extension allowlist filters out any non-image files that may land in the directory. New images are auto-discovered on next build. No API changes needed.

```ts
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

export interface ImageEntry { filename: string; url: string; }

export function getAvailableImages(): ImageEntry[] {
  const modules = import.meta.glob('/src/data/img/*', { eager: true, query: '?url', import: 'default' });
  return Object.entries(modules)
    .filter(([path]) => ALLOWED_EXTENSIONS.has(path.slice(path.lastIndexOf('.')).toLowerCase()))
    .map(([path, url]) => ({
      filename: path.split('/').at(-1)!,
      url: url as string,
    }));
}
```

### New components

- `src/components/ImagePickerDialog.svelte` + `ImagePickerDialog.css` — modal grid
- `AppForm.svelte` — new `image-picker` rendering branch, `canSkipValidation` update, validation branch

### YAML change

`src/data/text/en/editor/location_form.yaml`: change the `image` field from `type: string` to `type: image-picker`.

### Stored value

Remains a plain filename string (e.g. `"den-haag-logo.jpg"`), or `""` when no image is selected. No changes to the data model, API, or how images are rendered in the hunt.

## UI & Interaction

### Form field — no image selected

```
Image
[ Choose image ]
```

### Form field — image selected (filename exists in available images)

```
Image
┌──────┐
│      │  den-haag-logo.jpg        [ Change ]
└──────┘
```

Thumbnail: ~64×64 px, `object-fit: cover`. Clicking "Change" re-opens the dialog.

### Form field — image selected but filename not in available images

```
Image
⚠ file den-haag-unknown.jpg not found in project        [ Change ]
```

No thumbnail is shown. A warning message makes the problem explicit so the user knows they need to pick a valid image. This handles locations saved via the old free-text field with a typo, or images not yet in `src/data/img/`.

### Dialog

```
┌──── Pick an image ───────────────────────────────────┐
│                                                       │
│  ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐          │
│  │  ✕   │   │      │   │  ★   │   │      │          │
│  │ None │   │      │   │      │   │      │          │
│  └──────┘   └──────┘   └──────┘   └──────┘          │
│  None       logo.jpg  lange.jpg  peace.jpg           │
│                                                       │
│                                         [ Cancel ]   │
└───────────────────────────────────────────────────────┘
```

- 3–4 column responsive grid
- Currently selected image highlighted with a border + checkmark overlay; if current value is `""` or not in the grid, the "None" tile is highlighted
- "None" tile always first — selecting it sets the value to `""` (empty string)
- Clicking any image immediately selects it and closes the dialog (no separate confirm; action is reversible via "Change")
- Cancel closes without changing the current value
- Dialog rendered via `use:portal` (same pattern as the existing confirm dialog in `AppForm`)

### Accessibility

Minimal implementation for v1:

- **Escape to close** — `keydown` listener on the dialog container dismisses it (same as Cancel)
- **Focus on open** — when the dialog mounts, focus is moved to the Cancel button so keyboard users are not stranded behind it
- **Focus on close** — when the dialog closes (any path: pick, cancel, Escape), focus returns to the trigger element that opened it ("Choose image" / "Change" button)
- `role="dialog"` and `aria-label="Pick an image"` on the dialog container

Full focus trap and arrow-key grid navigation are out of scope for v1.

## Component Interface

### `ImagePickerDialog.svelte`

```ts
{
  currentValue: string;              // "" means no image; highlights matching tile (or "None" if not found)
  images: ImageEntry[];              // list from getAvailableImages()
  onSelect: (filename: string) => void;  // "" for "None"; closes dialog
  onCancel: () => void;
}
```

### `AppForm.svelte` changes

- `image-picker` added to `canSkipValidation()` so it is not validated as a string input
- New validation branch for `image-picker`: if `field.isRequired` and `values[id] === ""`, emit `MSG_REQUIRED`
- New local `$state` boolean to control dialog open/closed
- `image-picker` stores its value as `string` (using `""` for no selection) in the existing `values` record — no type widening needed
- `onValuesChange` propagation unchanged

## Testing

- `src/utils/images.ts`: mock `import.meta.glob` in vitest; assert `getAvailableImages()` returns correct `{ filename, url }` pairs and excludes non-image extensions (e.g. `.gitkeep`, `.svg`)
- `ImagePickerDialog.svelte`:
  - renders grid from mocked image list with "None" tile first
  - `onSelect("")` fires when "None" is clicked
  - `onSelect(filename)` fires when an image tile is clicked
  - `onCancel` fires on cancel button
  - `onCancel` fires on Escape key
  - selected item (matching `currentValue`) gets highlight class; "None" highlighted when `currentValue` is `""`
- `AppForm.svelte`:
  - `image-picker` field renders "Choose image" button when value is `""`
  - after simulated `onSelect`, renders thumbnail + filename inline
  - for unknown filename (not in image list), renders warning message "⚠ file <filename> not found in project" with no thumbnail
  - required `image-picker` with empty value fails validation with "Required"
  - optional `image-picker` with empty value passes validation
