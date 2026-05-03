# Task 01: Accept `photo` type in ChallengeForm

**Next:** [Task 02 — Card visibility](2026-05-02-photo-field-02-card-visibility.md)

**Goal:** `ChallengeForm` treats `photo` as a valid field type that renders nothing and requires no validation. This prevents a spurious "unknown type" warning when a `photo` field appears in a form array.

**Files:**
- Modify: `src/components/ChallengeForm.jsx`
- Modify: `src/test/ChallengeForm.test.jsx`

---

- [ ] **Step 1: Write two failing tests**

Add at the bottom of `src/test/ChallengeForm.test.jsx`:

```js
const photoField = { id: 'proof', type: 'photo', label: 'Photo proof' }

test('photo field renders nothing in the form', () => {
  render(<ChallengeForm form={[photoField]} locationId="001" />)
  expect(screen.queryByText('Photo proof')).not.toBeInTheDocument()
  expect(screen.queryByText(/Invalid field/)).not.toBeInTheDocument()
})

test('photo field does not block submission of other fields', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ ok: true }) }))
  render(<ChallengeForm form={[booleanField, photoField]} locationId="001" />)
  fireEvent.change(screen.getByLabelText('Your name or team'), { target: { value: 'Alice' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }))
  await waitFor(() => expect(screen.getByText('✓ Answers submitted')).toBeInTheDocument())
  vi.restoreAllMocks()
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm run test -- ChallengeForm
```

Expected: both new tests FAIL — first with "unknown type photo" in DOM, second with submit blocked.

- [ ] **Step 3: Add `photo` to VALID_TYPES in `src/components/ChallengeForm.jsx`**

```js
const VALID_TYPES = ['string', 'number', 'boolean', 'radio', 'photo']
```

- [ ] **Step 4: Return null for `photo` type in `renderField`**

In `renderField`, after the `checkDefinition` guard and before the main `return`, add:

```js
if (field.type === 'photo') return null
```

The full top of `renderField` becomes:

```js
function renderField(field) {
  const defError = checkDefinition(field)
  if (defError) {
    return (
      <div key={field.id} className="cf-invalid-field">
        {`⚠ Invalid field "${field.id}": ${defError}`}
      </div>
    )
  }
  if (field.type === 'photo') return null
  // ... rest unchanged
```

- [ ] **Step 5: Run tests to confirm they pass**

```
npm run test -- ChallengeForm
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```
git add src/components/ChallengeForm.jsx src/test/ChallengeForm.test.jsx
git commit -m "feat: accept photo field type in ChallengeForm (renders nothing)"
```
