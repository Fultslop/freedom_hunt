# Task 06: Location Form — Add / Edit

Status: Completed

> Part of [2026-05-02-location-editor.md](2026-05-02-location-editor.md)

**Goal:** A form page at `/editor/locations/:project/:city/new` (add) and `/editor/locations/:project/:city/edit/:filename` (edit). In edit mode, fields pre-populate from `GET /editor/location`. Submitting posts to `POST /editor/location`, stores a pending entry in localStorage, and navigates back to the list. `challenge.form` is preserved in the round-trip but not shown in the form.

**New filename generation (add mode):**
`${String(locationId).padStart(3, '0')}_loc_${title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}.yaml`
e.g. locationId=5, title="My Location" → `005_loc_my_location.yaml`

**Files:**

- Create: `src/pages/editor/EditorLocationForm.jsx` + `EditorLocationForm.css`
- Modify: `src/App.jsx` — add two routes (new + edit)

---

- [ ] **Step 1: Create `src/pages/editor/EditorLocationForm.css`**

```css
/* src/pages/editor/EditorLocationForm.css */

.loc-form {
  max-width: 480px;
  margin: 0 auto;
  padding: 24px;
  background: var(--color-background);
  min-height: 100vh;
}

.loc-form__section {
  margin-bottom: 28px;
}

.loc-form__section-title {
  font-size: var(--font-size-sm);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-secondary);
  margin-bottom: 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--color-border);
}

.loc-form__field {
  margin-bottom: 14px;
}

.loc-form__label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
}

.loc-form__label--muted {
  font-weight: 400;
  color: var(--color-text-secondary);
}

.loc-form__input,
.loc-form__textarea {
  display: block;
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  font-size: var(--font-size-base);
  color: var(--color-text);
  box-sizing: border-box;
  font-family: inherit;
}

.loc-form__input:focus,
.loc-form__textarea:focus {
  outline: none;
  border-color: var(--color-accent);
}

.loc-form__input--readonly {
  opacity: 0.5;
  cursor: not-allowed;
}

.loc-form__textarea {
  resize: vertical;
  min-height: 80px;
}

.loc-form__row {
  display: flex;
  gap: 12px;
}

.loc-form__row .loc-form__field {
  flex: 1;
}

.loc-form__hint {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 4px;
}

.loc-form__actions {
  display: flex;
  gap: 12px;
  margin-top: 32px;
}

.loc-form__submit {
  flex: 1;
  padding: 12px;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.loc-form__submit--loading {
  opacity: 0.7;
  cursor: default;
}

.loc-form__cancel {
  padding: 12px 20px;
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.loc-form__success {
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  margin-top: 16px;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.loc-form__pr-link {
  color: var(--color-accent);
  font-weight: 600;
}

.loc-form__error {
  margin-top: 12px;
  font-size: var(--font-size-sm);
  color: var(--color-accent);
}
```

- [ ] **Step 2: Create `src/pages/editor/EditorLocationForm.jsx`**

```jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTitleBar } from "../../theme/TitleBarContext";
import { addPending } from "./editorStorage";
import "./EditorLocationForm.css";

function buildFilename(locationId, title) {
  const slug = String(title)
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  return `${String(locationId).padStart(3, "0")}_loc_${slug}.yaml`;
}

const EMPTY = {
  locationId: "",
  title: "",
  image: "",
  name: { label: "", value: "" },
  address: "",
  coordinates: { latitude: "", longitude: "" },
  storyline: "",
  challenge: { name: "", description: "", notes: "", form: [] },
  breadcrumb: "",
};

export default function EditorLocationForm() {
  const { project, city, filename } = useParams();
  const isEdit = Boolean(filename);
  const navigate = useNavigate();

  const [fields, setFields] = useState(EMPTY);
  const [existingSha, setExistingSha] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [submitState, setSubmitState] = useState("idle");
  const [prUrl, setPrUrl] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  useTitleBar({
    title: isEdit ? "Edit location" : "Add location",
    progress: null,
    backPath: `/editor/locations/${project}/${city}`,
  });

  useEffect(() => {
    if (!isEdit) return;
    fetch(`/editor/location?project=${project}&city=${city}&file=${filename}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setFields({
            ...EMPTY,
            ...data.location,
            name: { ...EMPTY.name, ...(data.location.name ?? {}) },
            coordinates: {
              ...EMPTY.coordinates,
              ...(data.location.coordinates ?? {}),
            },
            challenge: {
              ...EMPTY.challenge,
              ...(data.location.challenge ?? {}),
            },
          });
          setExistingSha(data.sha);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isEdit, project, city, filename]);

  function set(path, value) {
    setFields((prev) => {
      const next = { ...prev };
      if (path.includes(".")) {
        const [parent, child] = path.split(".");
        next[parent] = { ...prev[parent], [child]: value };
      } else {
        next[path] = value;
      }
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitState("submitting");
    setSubmitError(null);

    const resolvedFilename = isEdit
      ? filename
      : buildFilename(fields.locationId, fields.title);

    const location = {
      ...fields,
      locationId: Number(fields.locationId) || fields.locationId,
      coordinates: {
        latitude: parseFloat(fields.coordinates.latitude) || 0,
        longitude: parseFloat(fields.coordinates.longitude) || 0,
      },
    };

    try {
      const res = await fetch("/editor/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project,
          city,
          filename: resolvedFilename,
          existingSha,
          location,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        addPending(project, city, {
          filename: resolvedFilename,
          locationTitle: fields.title,
          prUrl: data.prUrl,
          prTitle: `${isEdit ? "Edit" : "Add"} location: ${fields.title}`,
          submittedAt: new Date().toISOString(),
        });
        setSubmitState("success");
        setPrUrl(data.prUrl);
      } else {
        setSubmitError(data.error ?? "Submission failed");
        setSubmitState("error");
      }
    } catch {
      setSubmitError("Request failed. Check your connection.");
      setSubmitState("error");
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;

  if (submitState === "success") {
    return (
      <div className="loc-form">
        <div className="loc-form__success">
          ✓ Changes submitted for review.{" "}
          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="loc-form__pr-link"
          >
            View pull request →
          </a>
        </div>
        <div className="loc-form__actions" style={{ marginTop: 20 }}>
          <button
            className="loc-form__cancel"
            onClick={() => navigate(`/editor/locations/${project}/${city}`)}
          >
            Back to list
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="loc-form" onSubmit={handleSubmit}>
      <div className="loc-form__section">
        <div className="loc-form__section-title">Identity</div>

        <div className="loc-form__field">
          <label className="loc-form__label">
            Location ID{" "}
            <span className="loc-form__label--muted">
              (number, must be unique)
            </span>
          </label>
          <input
            type="number"
            value={fields.locationId}
            onChange={(e) => set("locationId", e.target.value)}
            required
            readOnly={isEdit}
            className={`loc-form__input${isEdit ? " loc-form__input--readonly" : ""}`}
          />
        </div>

        <div className="loc-form__field">
          <label className="loc-form__label">Title</label>
          <input
            type="text"
            value={fields.title}
            onChange={(e) => set("title", e.target.value)}
            required
            className="loc-form__input"
          />
        </div>

        <div className="loc-form__field">
          <label className="loc-form__label">
            Image filename{" "}
            <span className="loc-form__label--muted">
              (e.g. my-photo.jpg — upload separately)
            </span>
          </label>
          <input
            type="text"
            value={fields.image}
            onChange={(e) => set("image", e.target.value)}
            className="loc-form__input"
          />
        </div>

        <div className="loc-form__row">
          <div className="loc-form__field">
            <label className="loc-form__label">Name label</label>
            <input
              type="text"
              value={fields.name.label}
              onChange={(e) => set("name.label", e.target.value)}
              className="loc-form__input"
            />
          </div>
          <div className="loc-form__field">
            <label className="loc-form__label">Name value</label>
            <input
              type="text"
              value={fields.name.value}
              onChange={(e) => set("name.value", e.target.value)}
              className="loc-form__input"
            />
          </div>
        </div>

        <div className="loc-form__field">
          <label className="loc-form__label">Street address</label>
          <input
            type="text"
            value={fields.address}
            onChange={(e) => set("address", e.target.value)}
            className="loc-form__input"
          />
        </div>

        <div className="loc-form__row">
          <div className="loc-form__field">
            <label className="loc-form__label">Latitude</label>
            <input
              type="number"
              step="any"
              value={fields.coordinates.latitude}
              onChange={(e) => set("coordinates.latitude", e.target.value)}
              className="loc-form__input"
            />
          </div>
          <div className="loc-form__field">
            <label className="loc-form__label">Longitude</label>
            <input
              type="number"
              step="any"
              value={fields.coordinates.longitude}
              onChange={(e) => set("coordinates.longitude", e.target.value)}
              className="loc-form__input"
            />
          </div>
        </div>
      </div>

      <div className="loc-form__section">
        <div className="loc-form__section-title">Narrative</div>

        <div className="loc-form__field">
          <label className="loc-form__label">Storyline</label>
          <textarea
            value={fields.storyline}
            onChange={(e) => set("storyline", e.target.value)}
            className="loc-form__textarea"
            style={{ minHeight: 120 }}
          />
        </div>

        <div className="loc-form__field">
          <label className="loc-form__label">Breadcrumb clue</label>
          <textarea
            value={fields.breadcrumb}
            onChange={(e) => set("breadcrumb", e.target.value)}
            className="loc-form__textarea"
          />
        </div>
      </div>

      <div className="loc-form__section">
        <div className="loc-form__section-title">Challenge</div>

        <div className="loc-form__field">
          <label className="loc-form__label">Challenge name</label>
          <input
            type="text"
            value={fields.challenge.name}
            onChange={(e) => set("challenge.name", e.target.value)}
            className="loc-form__input"
          />
        </div>

        <div className="loc-form__field">
          <label className="loc-form__label">Challenge description</label>
          <textarea
            value={fields.challenge.description}
            onChange={(e) => set("challenge.description", e.target.value)}
            className="loc-form__textarea"
            style={{ minHeight: 100 }}
          />
        </div>

        <div className="loc-form__field">
          <label className="loc-form__label">
            Notes{" "}
            <span className="loc-form__label--muted">
              (internal, not shown to participants)
            </span>
          </label>
          <textarea
            value={fields.challenge.notes}
            onChange={(e) => set("challenge.notes", e.target.value)}
            className="loc-form__textarea"
          />
        </div>

        {isEdit && fields.challenge.form?.length > 0 && (
          <p className="loc-form__hint">
            This location has {fields.challenge.form.length} form field(s). Form
            fields are preserved but not editable here — edit them directly in
            the YAML file.
          </p>
        )}
      </div>

      {submitError && <div className="loc-form__error">✕ {submitError}</div>}

      <div className="loc-form__actions">
        <button
          type="button"
          className="loc-form__cancel"
          onClick={() => navigate(`/editor/locations/${project}/${city}`)}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitState === "submitting"}
          className={`loc-form__submit${submitState === "submitting" ? " loc-form__submit--loading" : ""}`}
        >
          {submitState === "submitting" ? "Submitting…" : "Submit for review"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Add two routes to `src/App.jsx`**

Add import:

```jsx
import EditorLocationForm from "./pages/editor/EditorLocationForm";
```

Add routes inside `<Routes>` after the list route:

```jsx
<Route path="/editor/locations/:project/:city/new" element={<AdminRoute><EditorLocationForm /></AdminRoute>} />
<Route path="/editor/locations/:project/:city/edit/:filename" element={<AdminRoute><EditorLocationForm /></AdminRoute>} />
```

- [ ] **Step 4: Manually verify in the browser**

**Add flow:**

1. Navigate to `/editor/locations/democrats_abroad/den_haag`
2. Click `+ Add location`
3. Fill in all fields — use locationId `5` and title `Test Location`
4. Click `Submit for review`
5. Confirm success screen appears with "View pull request →" link
6. Open the PR link — confirm the new YAML file exists on the branch with correct content
7. Navigate back to list — confirm the new location shows a "Pending edit" badge
8. Reload the page — confirm the badge persists

**Edit flow:**

1. Click Edit on an existing location
2. Confirm all fields are pre-populated
3. Change the title
4. Click `Submit for review`
5. Confirm the PR modifies the correct field in the YAML
6. Confirm `challenge.form` is preserved in the PR diff (not removed)

**Cancel flow:**

1. Open the add form, fill some fields, click Cancel
2. Confirm navigation returns to list
3. Confirm no PR was created

- [ ] **Step 5: Commit**

```
git add src/pages/editor/EditorLocationForm.jsx src/pages/editor/EditorLocationForm.css src/App.jsx
git commit -m "feat: add location add/edit form with GitHub PR submission"
```
