# Submit Confirmation Dialog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require an explicit confirmation tap before submitting the form — tapping Submit first shows an inline overlay dialog ("Submit your answers? / Cancel / Confirm"), so an accidental tap on Submit does nothing harmful.

**Architecture:** A `showConfirm` boolean state is added to `ChallengeForm`. `handleSubmit` now sets `showConfirm(true)` after validation passes (instead of calling fetch directly). A new `submitAnswers` function contains the existing fetch logic and is called only when the user taps Confirm. The dialog renders as a fixed overlay via CSS; no third-party library needed.

**Tech Stack:** React 19, TypeScript, CSS custom properties

---

### Task 1: Add confirmation dialog to ChallengeForm

**Files:**
- Modify: `src/components/ChallengeForm.tsx`
- Modify: `src/components/ChallengeForm.css`
- Test: `src/test/ChallengeForm.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add a new `describe("confirmation dialog", ...)` block in `src/test/ChallengeForm.test.tsx`:

```tsx
describe("confirmation dialog", () => {
  beforeEach(() => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      activeAuth: { projectId: "test", teamName: "Alice", contact: "a@b.com" },
    });
  });

  afterEach(() => vi.restoreAllMocks());

  test("tapping Submit on a valid form shows confirmation dialog, not submission", () => {
    globalThis.fetch = vi.fn();
    render(<ChallengeForm form={[booleanField]} locationId={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByText("Submit your answers?")).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("tapping Cancel dismisses the dialog without submitting", () => {
    globalThis.fetch = vi.fn();
    render(<ChallengeForm form={[booleanField]} locationId={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Submit your answers?")).not.toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("tapping Confirm in dialog submits the form", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      json: () => Promise.resolve({ ok: true }),
    } as unknown as Response);
    render(<ChallengeForm form={[booleanField]} locationId={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(screen.getByText("✓ Answers submitted")).toBeInTheDocument(),
    );
  });

  test("validation errors still show without opening dialog", () => {
    globalThis.fetch = vi.fn();
    render(<ChallengeForm form={[stringField]} locationId={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.queryByText("Submit your answers?")).not.toBeInTheDocument();
    expect(screen.getByText("This field is required")).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```
npx vitest run src/test/ChallengeForm.test.tsx
```

Expected: all 4 new tests FAIL.

- [ ] **Step 3: Add the CSS**

Append to `src/components/ChallengeForm.css`:

```css
.cf-confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.cf-confirm-dialog {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 24px 20px 18px;
  width: min(320px, 90vw);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.cf-confirm-msg {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text);
  text-align: center;
}

.cf-confirm-actions {
  display: flex;
  gap: 10px;
}

.cf-confirm-cancel {
  flex: 1;
  padding: 10px 0;
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: var(--font-size-base);
  font-weight: 500;
  cursor: pointer;
}

.cf-confirm-ok {
  flex: 1;
  padding: 10px 0;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
}
```

- [ ] **Step 4: Update `ChallengeForm.tsx`**

**4a.** Add `showConfirm` state after the existing state declarations:

```tsx
const [showConfirm, setShowConfirm] = useState(false);
```

**4b.** Rename the existing `handleSubmit` fetch logic to `submitAnswers` (a plain async function, no event parameter):

```tsx
async function submitAnswers() {
  setSubmitState("submitting");
  try {
    const res = await fetch("/form-submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        routeId: String(routeId),
        locationId: String(locationId),
        teamName: activeAuth?.teamName ?? "",
        email: activeAuth?.contact ?? "",
        fields: values,
      }),
    });
    const data = (await res.json()) as { ok: boolean };
    setSubmitState(data.ok ? "success" : "error");
  } catch {
    setSubmitState("error");
  }
}
```

**4c.** Replace the body of `handleSubmit` so it shows the dialog instead of fetching:

```tsx
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  const newErrors = validate();
  if (Object.keys(newErrors).length > 0) {
    setErrors(newErrors);
    return;
  }
  setShowConfirm(true);
}
```

**4d.** Add a `handleConfirm` function:

```tsx
async function handleConfirm() {
  setShowConfirm(false);
  await submitAnswers();
}
```

**4e.** Add the dialog overlay to the form JSX, just before the closing `</form>` tag:

```tsx
{showConfirm ? (
  <div className="cf-confirm-overlay">
    <div className="cf-confirm-dialog">
      <p className="cf-confirm-msg">Submit your answers?</p>
      <div className="cf-confirm-actions">
        <button
          type="button"
          className="cf-confirm-cancel"
          onClick={() => setShowConfirm(false)}
        >
          Cancel
        </button>
        <button
          type="button"
          className="cf-confirm-ok"
          onClick={handleConfirm}
        >
          Confirm
        </button>
      </div>
    </div>
  </div>
) : null}
```

- [ ] **Step 5: Run all ChallengeForm tests**

```
npx vitest run src/test/ChallengeForm.test.tsx
```

Expected: all tests pass. Note: the existing "boolean field does not require selection" and "shows success confirmation after ok response" tests still pass because they now go through the dialog — but those tests call `fireEvent.click` on the Submit button and then `waitFor` the success state, which only works if the Confirm button is also clicked. **If those tests break**, add a `fireEvent.click(screen.getByRole("button", { name: "Confirm" }))` step after the Submit click in each affected test.

- [ ] **Step 6: Run the full test suite**

```
npx vitest run
```

Expected: all tests pass with no regressions.

- [ ] **Step 7: Commit**

```
git add src/components/ChallengeForm.tsx src/components/ChallengeForm.css src/test/ChallengeForm.test.tsx
git commit -m "feat: add confirmation dialog to prevent accidental form submission"
```
