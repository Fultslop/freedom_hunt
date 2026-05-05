# Photo Field Inline Rendering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move photo button rendering from a dedicated bottom block into `renderField()` so it appears at its natural position in the field order, removing the fat-finger hazard of having the photo button immediately above the submit button.

**Architecture:** `renderField` currently returns `null` for `photo`-type fields; a separate `hasPhotoField` block renders the photo UI just above Submit. After this change, `renderField` handles `photo` fields directly and the bottom block is removed. The `fileInputRef`, `uploadState`, and `handleFileChange` remain unchanged at component level.

**Tech Stack:** React 19, TypeScript, Vitest + @testing-library/react

---

### Task 1: Move photo button into `renderField`

**Files:**
- Modify: `src/components/ChallengeForm.tsx`
- Test: `src/test/ChallengeForm.test.tsx`

- [ ] **Step 1: Write the failing test**

Add this test inside the `describe("photo upload", ...)` block in `src/test/ChallengeForm.test.tsx`, after the existing "photo upload section appears before submit button" test:

```tsx
test("photo button renders at its field-order position, not always above submit", () => {
  // photoField is first in the array; stringField is second.
  // After the fix the photo button must precede the text input in the DOM.
  render(<ChallengeForm form={[photoField, stringField]} locationId={1} />);
  const photoBtn = screen.getByTestId("submit-btn");
  const textInput = screen.getByLabelText("What is the motto?");
  // DOCUMENT_POSITION_PRECEDING means photoBtn comes before textInput
  const pos = textInput.compareDocumentPosition(photoBtn);
  expect(pos & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```
npx vitest run src/test/ChallengeForm.test.tsx
```

Expected: the new test FAILS — currently the photo block always renders after all fields, so the photo button follows the text input in the DOM.

- [ ] **Step 3: Implement the change in `ChallengeForm.tsx`**

**3a.** Remove the `hasPhotoField` constant (line 61):

```diff
-  const hasPhotoField = form.some((f) => f.type === "photo");
```

**3b.** In `renderField`, replace the `if (field.type === "photo") return null;` guard (line 174) with a full photo render:

```tsx
if (field.type === "photo") {
  return (
    <div key={field.id} className="cf-photo-wrap">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
      {uploadState === "success" ? (
        <div className="cf-photo-success">✓ Photo submitted</div>
      ) : (
        <button
          data-testid="submit-btn"
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadState === "uploading"}
          className={`cf-photo-btn cf-photo-btn--${uploadState}`}
        >
          {uploadState === "uploading" ? (
            "Uploading…"
          ) : uploadState === "error" ? (
            <>
              <Camera
                size={14}
                aria-hidden
                style={{ verticalAlign: "middle", marginRight: 4 }}
              />{" "}
              Try again
            </>
          ) : (
            <>
              <Camera
                size={14}
                aria-hidden
                style={{ verticalAlign: "middle", marginRight: 4 }}
              />{" "}
              {field.label ?? "Submit photo proof"}
            </>
          )}
        </button>
      )}
    </div>
  );
}
```

**3c.** In the form JSX, remove the entire `hasPhotoField` conditional block (lines 289–336):

```diff
-      {hasPhotoField ? (
-        <div className="cf-photo-wrap">
-          <input
-            ref={fileInputRef}
-            ...
-          />
-          {uploadState === "success" ? (
-            ...
-          ) : (
-            <>
-              <button ...>
-                ...
-              </button>
-            </>
-          )}
-        </div>
-      ) : null}
```

The `form.map(renderField)` call that was already there now handles the photo field, so no other JSX changes are needed.

- [ ] **Step 4: Run all ChallengeForm tests**

```
npx vitest run src/test/ChallengeForm.test.tsx
```

Expected: all tests pass, including the new one and the pre-existing "photo upload section appears before submit button" test (photo still renders before Submit since Submit is always last).

- [ ] **Step 5: Run the full test suite**

```
npx vitest run
```

Expected: all tests pass with no regressions.

- [ ] **Step 6: Commit**

```
git add src/components/ChallengeForm.tsx src/test/ChallengeForm.test.tsx
git commit -m "refactor: render photo field inline in renderField to separate it from submit button"
```
