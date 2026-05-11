# Task 02 — loadLocations: inline array → sentinel field

**Files:**
- Modify: `src/utils/loadLocations.ts`
- Modify: `src/test/loadText.test.ts` (add test to existing `describe("loadLocations")` block)

---

- [ ] **Step 1: Write the failing test**

Add this `it` block inside the existing `describe("loadLocations", ...)` block in
`src/test/loadText.test.ts`:

```ts
it("replaces inline form array with a sentinel field", async () => {
  vi.mocked(loadText).mockResolvedValueOnce({
    title: "Test",
    name: { value: "Test Location" },
    coordinates: { latitude: 0, longitude: 0 },
    storyline: "Test storyline",
    breadcrumb: "Test breadcrumb",
    challenge: {
      name: "",
      description: "Do the thing",
      notes: "",
      form: [{ id: "field1", type: "string", label: "Some field" }],
    },
  } as unknown as Location);

  const result = await loadLocations("en", ["projects/test/001_loc_test"]);

  expect(result[0].challenge.form).toHaveLength(1);
  expect(result[0].challenge.form[0].id).toBe("form");
  expect(result[0].challenge.form[0].label).toBe("challenge.form");
});
```

- [ ] **Step 2: Run the failing test**

```
npm run test -- --reporter=verbose loadText
```

Expected: FAIL — the current implementation passes the inline array through unchanged,
so `result[0].challenge.form[0].id` is `"field1"`, not `"form"`.

- [ ] **Step 3: Implement the sentinel branch**

In `src/utils/loadLocations.ts`, update the import to include `FormFieldType`, then
add an `else if` branch to `loadAndResolveLocation`:

```ts
import type { Location, FormField, RawChallenge, FormFieldType } from "../types/data";

type RawLocation = Omit<Location, "challenge"> & { challenge: RawChallenge };

async function loadAndResolveLocation(
  lang: string,
  path: string,
): Promise<Location | null> {
  const raw = await loadText<RawLocation>(lang, path);
  if (!raw) {
    return null;
  }

  if (raw.challenge && typeof raw.challenge.form === "string") {
    const formFileName = raw.challenge.form;
    const dir = path.substring(0, path.lastIndexOf("/") + 1);
    const formPath = dir + formFileName.replace(/\.yaml$/, "");
    raw.challenge.form = (await loadText<FormField[]>(lang, formPath)) ?? [];
  } else if (raw.challenge && Array.isArray(raw.challenge.form)) {
    raw.challenge.form = [
      { id: "form", type: "inline_form" as FormFieldType, label: "challenge.form" },
    ];
  }

  return raw as Location;
}

export async function loadLocations(
  lang: string,
  paths: string[],
): Promise<Location[]> {
  if (paths.length === 0) {
    return [];
  }
  const results = await Promise.all(
    paths.map((path) => loadAndResolveLocation(lang, path)),
  );
  return results.filter((loc): loc is Location => loc !== null);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```
npm run test -- --reporter=verbose loadText
```

Expected: PASS — all 4 tests in the describe block pass.

- [ ] **Step 5: Run the full test suite**

```
npm run test:run
```

Expected: all tests pass, 0 failures.

- [ ] **Step 6: Commit**

```
git add src/utils/loadLocations.ts src/test/loadText.test.ts
git commit -m "feat: replace inline form arrays with sentinel field in loadLocations"
```
