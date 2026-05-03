# Task 05 — ChallengeForm: inline styles → className + fix hardcoded colours

**Depends on:** [Task 02 — App wiring](2026-05-01-styling-refactor-02-app-wiring.md)
**Next:** [Task 06 — TitleBar](2026-05-01-styling-refactor-06-titlebar.md)

**Files:**

- Create: `src/components/ChallengeForm.css`
- Modify: `src/components/ChallengeForm.jsx`

ChallengeForm currently has no `useTheme()` call and uses only hardcoded colours. After this task it still needs no `useTheme()` — CSS custom properties handle everything.

---

- [ ] **Step 1: Create `src/components/ChallengeForm.css`**

Hardcoded colours fixed:

- `#BF0A30` → `var(--color-error)`
- `#2d7a2d` → `var(--color-success)`
- `#002868` → `var(--color-accent)`
- `#333` → `var(--color-text)`
- `#ccc` → `var(--color-border)`
- `#6b7280` → `var(--color-text-muted)`
- `#e5e7eb` → `var(--color-surface)`
- `#fff0f0` → kept as-is (a lightened error tint not in the token set; acceptable fixed value)

```css
/* src/components/ChallengeForm.css */

.cf-field {
  margin-bottom: 12px;
}

.cf-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  display: block;
}

.cf-label--checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  cursor: pointer;
}

.cf-label--radio {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 13px;
  font-weight: 400;
  cursor: pointer;
}

.cf-checkbox {
  width: 16px;
  height: 16px;
}

.cf-radio-group {
  margin-top: 6px;
}

.cf-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 13px;
  margin-top: 4px;
}

.cf-input--error {
  border-color: var(--color-error);
}

.cf-error-msg {
  font-size: 11px;
  color: var(--color-error);
  margin-top: 2px;
}

.cf-invalid-field {
  background: #fff0f0;
  border: 1px solid var(--color-error);
  border-radius: 4px;
  padding: 8px 10px;
  font-size: 12px;
  color: var(--color-error);
  margin-bottom: 10px;
}

.cf-submit-btn {
  width: 100%;
  padding: 10px 0;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 4px;
}

.cf-submit-btn--submitting {
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.cf-submit-error {
  font-size: 11px;
  color: var(--color-error);
  margin-top: 4px;
}

.cf-success {
  font-size: 13px;
  color: var(--color-success);
  font-weight: 600;
  margin-top: 12px;
}
```

- [ ] **Step 2: Rewrite `src/components/ChallengeForm.jsx`**

```jsx
import { useState } from "react";
import "./ChallengeForm.css";

const VALID_TYPES = ["string", "number", "boolean", "radio"];

function checkDefinition(field) {
  if (!VALID_TYPES.includes(field.type)) return `unknown type "${field.type}"`;
  if (field.type === "radio" && (!field.options || field.options.length === 0))
    return "radio field missing options";
  return null;
}

export default function ChallengeForm({ form, locationId }) {
  const [submitterId, setSubmitterId] = useState("");
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [submitState, setSubmitState] = useState("idle");

  function setValue(id, value) {
    setValues((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function validate() {
    const newErrors = {};
    if (!submitterId.trim())
      newErrors.__submitterId = "Please enter your name or team";
    for (const field of form) {
      if (checkDefinition(field)) continue;
      if (field.type === "boolean") continue;
      if (field.type === "radio" && !values[field.id])
        newErrors[field.id] = "Please select an option";
      if (field.type === "string" && !String(values[field.id] ?? "").trim())
        newErrors[field.id] = "This field is required";
      if (
        field.type === "number" &&
        (values[field.id] === "" || values[field.id] === undefined)
      )
        newErrors[field.id] = "This field is required";
    }
    return newErrors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setSubmitState("submitting");
    try {
      const res = await fetch("/form-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: String(locationId),
          timestamp: new Date().toISOString(),
          submitterId: submitterId.trim(),
          fields: values,
        }),
      });
      const data = await res.json();
      setSubmitState(data.ok ? "success" : "error");
    } catch {
      setSubmitState("error");
    }
  }

  function renderField(field) {
    const defError = checkDefinition(field);
    if (defError) {
      return (
        <div key={field.id} className="cf-invalid-field">
          {`⚠ Invalid field "${field.id}": ${defError}`}
        </div>
      );
    }

    return (
      <div key={field.id} className="cf-field">
        {field.type === "boolean" ? (
          <label htmlFor={field.id} className="cf-label--checkbox">
            <input
              id={field.id}
              type="checkbox"
              checked={values[field.id] ?? false}
              onChange={(e) => setValue(field.id, e.target.checked)}
              className="cf-checkbox"
            />
            {field.label}
          </label>
        ) : (
          <>
            <label htmlFor={field.id} className="cf-label">
              {field.label}
            </label>
            {field.type === "string" && (
              <input
                id={field.id}
                type="text"
                value={values[field.id] ?? ""}
                onChange={(e) => setValue(field.id, e.target.value)}
                className={`cf-input${errors[field.id] ? " cf-input--error" : ""}`}
              />
            )}
            {field.type === "number" && (
              <input
                id={field.id}
                type="number"
                value={values[field.id] ?? ""}
                onChange={(e) =>
                  setValue(
                    field.id,
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                className={`cf-input${errors[field.id] ? " cf-input--error" : ""}`}
              />
            )}
            {field.type === "radio" && (
              <div className="cf-radio-group">
                {field.options.map((opt) => (
                  <label
                    key={opt}
                    htmlFor={`${field.id}-${opt}`}
                    className="cf-label--radio"
                  >
                    <input
                      id={`${field.id}-${opt}`}
                      type="radio"
                      name={field.id}
                      value={opt}
                      checked={values[field.id] === opt}
                      onChange={() => setValue(field.id, opt)}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}
          </>
        )}
        {errors[field.id] && (
          <div className="cf-error-msg">{errors[field.id]}</div>
        )}
      </div>
    );
  }

  if (submitState === "success") {
    return <div className="cf-success">✓ Answers submitted</div>;
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
      <div className="cf-field">
        <label htmlFor="submitter-id" className="cf-label">
          Your name or team
        </label>
        <input
          id="submitter-id"
          type="text"
          value={submitterId}
          onChange={(e) => {
            setSubmitterId(e.target.value);
            setErrors((prev) => {
              const next = { ...prev };
              delete next.__submitterId;
              return next;
            });
          }}
          className={`cf-input${errors.__submitterId ? " cf-input--error" : ""}`}
        />
        {errors.__submitterId && (
          <div className="cf-error-msg">{errors.__submitterId}</div>
        )}
      </div>

      {form.map(renderField)}

      <button
        type="submit"
        disabled={submitState === "submitting"}
        className={`cf-submit-btn${submitState === "submitting" ? " cf-submit-btn--submitting" : ""}`}
      >
        {submitState === "submitting"
          ? "Submitting…"
          : submitState === "error"
            ? "Try again"
            : "Submit answers"}
      </button>
      {submitState === "error" && (
        <div className="cf-submit-error">
          Submission failed. Please try again.
        </div>
      )}
    </form>
  );
}
```

- [ ] **Step 3: Run the test suite**

```
npm test
```

Expected: all tests pass. ChallengeForm tests check behaviour (field rendering, validation, submission) via `data-testid` and DOM queries — none assert on computed style, so no test changes needed.

- [ ] **Step 4: Visual smoke test**

Open a challenge card with a form. Verify:

- Labels are readable in all three themes
- Input borders turn red on validation error (uses `--color-error`)
- Submit button uses accent colour and turns muted when submitting
- Success/error messages appear in correct colours

- [ ] **Step 5: Commit**

```
git add src/components/ChallengeForm.css src/components/ChallengeForm.jsx
git commit -m "refactor: migrate ChallengeForm to className + fix hardcoded colours"
```
