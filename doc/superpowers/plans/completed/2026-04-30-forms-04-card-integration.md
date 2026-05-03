# Task 4 — ChallengeCard integration

**Files:**

- Modify: `src/components/ChallengeCard.jsx`
- Modify: `src/test/ChallengeCard.test.jsx`

---

- [ ] **Step 1: Write failing integration tests**

Append to `src/test/ChallengeCard.test.jsx`:

```jsx
describe("ChallengeForm integration", () => {
  test("renders ChallengeForm when challenge.form is present", () => {
    const loc = {
      ...location,
      challenge: {
        ...location.challenge,
        form: [{ id: "q1", type: "string", label: "What do you see?" }],
      },
    };
    render(
      <Wrapper>
        <ChallengeCard location={loc} />
      </Wrapper>,
    );
    expect(screen.getByLabelText("Your name or team")).toBeInTheDocument();
    expect(screen.getByLabelText("What do you see?")).toBeInTheDocument();
  });

  test("does not render ChallengeForm when challenge.form is absent", () => {
    render(
      <Wrapper>
        <ChallengeCard location={location} />
      </Wrapper>,
    );
    expect(
      screen.queryByLabelText("Your name or team"),
    ).not.toBeInTheDocument();
  });

  test("does not render ChallengeForm when challenge.form is empty array", () => {
    const loc = {
      ...location,
      challenge: { ...location.challenge, form: [] },
    };
    render(
      <Wrapper>
        <ChallengeCard location={loc} />
      </Wrapper>,
    );
    expect(
      screen.queryByLabelText("Your name or team"),
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm run test:run -- src/test/ChallengeCard.test.jsx
```

Expected: the 3 new tests FAIL — `ChallengeForm` not rendered since it isn't imported yet.

- [ ] **Step 3: Add ChallengeForm to ChallengeCard**

In `src/components/ChallengeCard.jsx`:

1. Add the import at the top of the file (after the existing imports):

```jsx
import ChallengeForm from "./ChallengeForm";
```

2. Locate the block that renders the challenge description and camera button (the inner box inside the Location section). Add `<ChallengeForm>` directly after the challenge description box, before the camera button `<input>`. The relevant section currently looks like:

```jsx
        <div style={{ marginTop: 14, background: theme.surface, borderRadius: 6, padding: '12px 14px' }}>
          <div style={{ ... }}>
            <Crosshair size={12} aria-hidden />
            Challenge
          </div>
          <MarkdownText
            text={location.challenge.description}
            style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: theme.text }}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <input ref={fileInputRef} ... />
          ...camera button...
        </div>
```

Insert the conditional render between those two `<div>` blocks:

```jsx
{
  location.challenge.form && location.challenge.form.length > 0 && (
    <ChallengeForm
      form={location.challenge.form}
      locationId={location.locationId}
    />
  );
}
```

The full Location section after the edit (only the relevant portion shown — the rest of ChallengeCard is unchanged):

```jsx
      <div style={{ padding: 16, borderBottom: `1px solid ${theme.border}` }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: theme.textMuted, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
          <MapPin size={12} aria-hidden />
          Location
        </div>
        <MapContainer ... >
          ...
        </MapContainer>
        <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 6, fontFamily: 'monospace' }}>
          {location.coordinates.latitude}° N, {location.coordinates.longitude}° E
        </div>

        <div style={{ marginTop: 14, background: theme.surface, borderRadius: 6, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: theme.textMuted, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Crosshair size={12} aria-hidden />
            Challenge
          </div>
          <MarkdownText
            text={location.challenge.description}
            style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: theme.text }}
          />
        </div>

        {location.challenge.form && location.challenge.form.length > 0 && (
          <ChallengeForm form={location.challenge.form} locationId={location.locationId} />
        )}

        <div style={{ marginTop: 12 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          {uploadState === 'success' ? (
            <div style={{ fontSize: 13, color: '#2d7a2d', fontWeight: 600 }}>✓ Photo submitted</div>
          ) : (
            <>
              <button
                data-testid="submit-btn"
                onClick={() => fileInputRef.current.click()}
                disabled={uploadState === 'uploading'}
                style={{
                  width: '100%',
                  padding: '10px 0',
                  background: uploadState === 'uploading' ? theme.surface : theme.accent,
                  color: uploadState === 'uploading' ? theme.textMuted : '#000',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: uploadState === 'uploading' ? 'not-allowed' : 'pointer',
                }}
              >
                {uploadState === 'uploading'
                  ? 'Uploading…'
                  : uploadState === 'error'
                    ? <><Camera size={14} aria-hidden style={{ verticalAlign: 'middle', marginRight: 4 }} /> Try again</>
                    : <><Camera size={14} aria-hidden style={{ verticalAlign: 'middle', marginRight: 4 }} /> Submit photo proof</>
                }
              </button>
              {uploadState === 'error' && (
                <div style={{ fontSize: 11, color: '#BF0A30', marginTop: 4 }}>Upload failed. Please try again.</div>
              )}
            </>
          )}
        </div>
      </div>
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm run test:run -- src/test/ChallengeCard.test.jsx
```

Expected: all tests PASS (existing + 3 new).

- [ ] **Step 5: Run full test suite to check for regressions**

```
npm run test:run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```
git add src/components/ChallengeCard.jsx src/test/ChallengeCard.test.jsx
git commit -m "feat: render ChallengeForm in ChallengeCard when challenge.form is present"
```
