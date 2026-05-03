# Task 02: Gate photo section in ChallengeCard

**Depends on:** [Task 01 — Form type](2026-05-02-photo-field-01-form-type.md)

**Goal:** The `cc-photo-wrap` section in `ChallengeCard` is only rendered when `location.challenge.form` contains a field with `type: photo`. Update the example YAML to demonstrate the new field.

**Files:**

- Modify: `src/components/ChallengeCard.jsx`
- Modify: `src/test/ChallengeCard.test.jsx`
- Modify: `src/data/text/en/projects/democrats_abroad/den_haag/001_loc_binnenhof.yaml`

---

- [ ] **Step 1: Write failing tests**

The existing photo tests use `location` which has no form, so they will break after the change. Add a `locationWithPhoto` fixture and update the relevant tests.

At the top of `src/test/ChallengeCard.test.jsx`, after the `location` fixture, add:

```js
const locationWithPhoto = {
  ...location,
  challenge: {
    ...location.challenge,
    form: [{ id: "proof", type: "photo", label: "Photo proof" }],
  },
};
```

Add these two new tests inside `describe('photo upload', ...)`:

```js
test("photo section is hidden when form has no photo field", () => {
  render(
    <Wrapper>
      <ChallengeCard location={location} index={1} />
    </Wrapper>,
  );
  expect(screen.queryByText("Submit photo proof")).not.toBeInTheDocument();
});

test("photo section is visible when form has a photo field", () => {
  render(
    <Wrapper>
      <ChallengeCard location={locationWithPhoto} index={1} />
    </Wrapper>,
  );
  expect(screen.getByText("Submit photo proof")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to confirm new tests fail and existing photo tests also fail**

```
npm run test -- ChallengeCard
```

Expected: the two new tests FAIL (photo section always visible), plus existing photo tests still pass (no change yet).

- [ ] **Step 3: Update existing photo tests to use `locationWithPhoto`**

In `src/test/ChallengeCard.test.jsx`, change every test inside `describe('photo upload', ...)` that renders `location` to render `locationWithPhoto` instead. Also update `'submit button has idle class in default state'`:

```js
test("submit button has idle class in default state", () => {
  render(
    <Wrapper>
      <ChallengeCard location={locationWithPhoto} index={1} />
    </Wrapper>,
  );
  expect(screen.getByTestId("submit-btn")).toHaveClass("cc-photo-btn--idle");
});
```

Inside `describe('photo upload', ...)`, replace all `location` references with `locationWithPhoto`:

```js
test("renders camera button in idle state", () => {
  render(
    <Wrapper>
      <ChallengeCard location={locationWithPhoto} />
    </Wrapper>,
  );
  expect(screen.getByText("Submit photo proof")).toBeInTheDocument();
});

test("shows uploading state while fetch is pending", async () => {
  global.fetch = vi.fn(() => new Promise(() => {}));
  render(
    <Wrapper>
      <ChallengeCard location={locationWithPhoto} />
    </Wrapper>,
  );
  const input = document.querySelector('input[type="file"]');
  fireEvent.change(input, {
    target: { files: [new File(["img"], "photo.jpg", { type: "image/jpeg" })] },
  });
  await waitFor(() =>
    expect(screen.getByText("Uploading…")).toBeInTheDocument(),
  );
});

test("shows success confirmation after upload", async () => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve({ ok: true, key: "001_123.jpg" }),
    }),
  );
  render(
    <Wrapper>
      <ChallengeCard location={locationWithPhoto} />
    </Wrapper>,
  );
  const input = document.querySelector('input[type="file"]');
  fireEvent.change(input, {
    target: { files: [new File(["img"], "photo.jpg", { type: "image/jpeg" })] },
  });
  await waitFor(() =>
    expect(screen.getByText("✓ Photo submitted")).toBeInTheDocument(),
  );
});

test("shows retry button on failed upload", async () => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve({ ok: false, error: "Upload failed" }),
    }),
  );
  render(
    <Wrapper>
      <ChallengeCard location={locationWithPhoto} />
    </Wrapper>,
  );
  const input = document.querySelector('input[type="file"]');
  fireEvent.change(input, {
    target: { files: [new File(["img"], "photo.jpg", { type: "image/jpeg" })] },
  });
  await waitFor(() =>
    expect(screen.getByText("Try again")).toBeInTheDocument(),
  );
});
```

- [ ] **Step 4: Implement the gate in `src/components/ChallengeCard.jsx`**

Add a derived constant after the existing `hasHero` line:

```js
const hasHero = !!heroSrc;
const hasPhotoField =
  location.challenge.form?.some((f) => f.type === "photo") ?? false;
```

Wrap the `cc-photo-wrap` div with a conditional:

```jsx
{
  hasPhotoField && (
    <div className="cc-photo-wrap">
      {/* ... existing contents unchanged ... */}
    </div>
  );
}
```

- [ ] **Step 5: Run tests to confirm all pass**

```
npm run test -- ChallengeCard
```

Expected: all tests PASS.

- [ ] **Step 6: Add photo field to the example YAML**

In `src/data/text/en/projects/democrats_abroad/den_haag/001_loc_binnenhof.yaml`, add as the last entry in the `form` array:

```yaml
- id: photo_proof
  type: photo
  label: Photograph the screen showing your completed registration
```

- [ ] **Step 7: Commit**

```
git add src/components/ChallengeCard.jsx src/test/ChallengeCard.test.jsx src/data/text/en/projects/democrats_abroad/den_haag/001_loc_binnenhof.yaml
git commit -m "feat: gate photo upload section on photo field in form definition"
```
