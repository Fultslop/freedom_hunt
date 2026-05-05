# Ornamental Form Divider — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `— 🚩 —` style ornamental divider at the top and bottom of the ChallengeForm field list, creating a clear visual dead zone between the fields and the submit button (and framing the form at the top).

**Architecture:** A small inline `FormDivider` element rendered as a flex row (line / icon / line) using `--color-accent` for the icon and `--color-border` for the rules. Rendered twice inside `ChallengeForm.tsx` — before and after `form.map(renderField)`. No new file needed; the element and its styles live alongside the existing component.

**Tech Stack:** React 19, TypeScript, lucide-react (`Flag` icon), CSS custom properties

---

### Task 1: Add the ornamental divider

**Files:**
- Modify: `src/components/ChallengeForm.tsx`
- Modify: `src/components/ChallengeForm.css`
- Test: `src/test/ChallengeForm.test.tsx`

- [ ] **Step 1: Write the failing test**

Add this test at the top level of `src/test/ChallengeForm.test.tsx` (outside any `describe` block):

```tsx
test("renders two ornamental dividers framing the field list", () => {
  render(<ChallengeForm form={[stringField]} locationId={1} />);
  const dividers = document.querySelectorAll(".cf-divider");
  expect(dividers).toHaveLength(2);
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```
npx vitest run src/test/ChallengeForm.test.tsx
```

Expected: FAIL — `.cf-divider` does not exist yet.

- [ ] **Step 3: Add the CSS**

Append to `src/components/ChallengeForm.css`:

```css
.cf-divider {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 20px 0;
}

.cf-divider__line {
  flex: 1;
  height: 1px;
  background: var(--color-border);
}

.cf-divider__icon {
  color: var(--color-accent);
  flex-shrink: 0;
}
```

- [ ] **Step 4: Add the Flag import and render the dividers**

In `src/components/ChallengeForm.tsx`, update the lucide-react import:

```tsx
import { Camera, Flag } from "lucide-react";
```

Extract a constant above the `ChallengeForm` function (not inside it — it never changes):

```tsx
const FormDivider = () => (
  <div className="cf-divider" aria-hidden>
    <span className="cf-divider__line" />
    <Flag size={12} className="cf-divider__icon" />
    <span className="cf-divider__line" />
  </div>
);
```

In the form JSX, wrap `form.map(renderField)` with the two dividers:

```tsx
<form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
  <FormDivider />
  {form.map(renderField)}
  <FormDivider />

  {submitState === "error" ? (
    <div className="cf-error-banner">
      Submission failed. Please try again.
    </div>
  ) : null}

  <button
    type="submit"
    disabled={submitState === "submitting"}
    className="cf-submit-btn"
  >
    {submitState === "submitting"
      ? "Submitting…"
      : submitState === "error"
        ? "Try again"
        : "Submit"}
  </button>
</form>
```

- [ ] **Step 5: Run all ChallengeForm tests**

```
npx vitest run src/test/ChallengeForm.test.tsx
```

Expected: all tests pass including the new one.

- [ ] **Step 6: Run the full test suite**

```
npx vitest run
```

Expected: all tests pass with no regressions.

- [ ] **Step 7: Commit**

```
git add src/components/ChallengeForm.tsx src/components/ChallengeForm.css src/test/ChallengeForm.test.tsx
git commit -m "feat: add ornamental flag dividers above and below form fields"
```
