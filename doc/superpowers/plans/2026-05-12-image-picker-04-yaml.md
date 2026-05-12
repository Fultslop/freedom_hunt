# Task 04 — YAML wiring

**Files:**
- Modify: `src/data/text/en/editor/location_form.yaml`

**Context:**
Change the `image` field's type from `string` to `image-picker`. This is the only change needed — `AppForm` already handles `image-picker` fields after Task 03, and the stored value remains a plain filename string so no data model changes are required.

---

- [ ] **Step 1: Update `location_form.yaml`**

Open `src/data/text/en/editor/location_form.yaml`. Find:

```yaml
- id: image
  type: string
  label: "Image filename (e.g. my-photo.jpg — upload separately)"
  isRequired: false
```

Replace with:

```yaml
- id: image
  type: image-picker
  label: Image
  isRequired: false
```

- [ ] **Step 2: Run the full test suite and linter**

```
npm test
npm run lint
```

Expected: all tests pass (the form field YAML change does not affect any existing test that checks specific field labels or types). No lint errors.

- [ ] **Step 3: Verify in the dev server**

```
npm run dev
```

Open the editor in the browser, navigate to a location form. Confirm:

1. The Image field shows a "Choose image" button (not a text input)
2. Clicking it opens the dialog grid showing all images from `src/data/img/`
3. Clicking an image closes the dialog and shows the thumbnail + filename in the form
4. Clicking "Change" re-opens the dialog
5. Selecting "None" clears the selection and shows "Choose image" again
6. Editing a location that already has `image: "den-haag-logo.jpg"` shows the thumbnail immediately on load
7. If a location has an image filename not in `src/data/img/`, the warning message appears

- [ ] **Step 4: Commit**

```
git add src/data/text/en/editor/location_form.yaml
git commit -m "feat: switch image field to image-picker in location form"
```
