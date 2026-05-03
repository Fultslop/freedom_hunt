# Task 5 — Example YAML

**Files:**

- Modify: `src/data/text/en/projects/democrats_abroad/den_haag/001_loc_binnenhof.yaml`

---

No tests for this task — YAML data is consumed by the existing component tests via the data loading hooks, and the form rendering is already covered by Tasks 2–4. Manual browser verification is the check here.

- [ ] **Step 1: Add form array to 001_loc_binnenhof.yaml**

The current `challenge` block in `src/data/text/en/projects/democrats_abroad/den_haag/001_loc_binnenhof.yaml`:

```yaml
challenge:
  name: ""
  description: |
    Register to vote — or confirm your registration is current — before you leave this courtyard. Photograph the screen showing your completed registration as proof.
  notes: ""
```

Replace with:

```yaml
challenge:
  name: ""
  description: |
    Register to vote — or confirm your registration is current — before you leave this courtyard. Photograph the screen showing your completed registration as proof.
  notes: ""
  form:
    - id: found_plaque
      type: boolean
      label: Did you find the plaque at the base of the William of Orange statue?
    - id: motto_text
      type: string
      label: What motto is engraved on the plaque?
    - id: visitor_count
      type: number
      label: Roughly how many other visitors are in the courtyard right now?
    - id: time_of_day
      type: radio
      label: What time of day did you arrive at the Binnenhof?
      options:
        - Morning (before 12:00)
        - Afternoon (12:00–17:00)
        - Evening (after 17:00)
```

- [ ] **Step 2: Start the dev server and verify the form renders**

```
npm run dev
```

Open `http://localhost:5173` in the browser. Navigate to the Den Haag hunt and open the first location card (Binnenhof). Verify:

- The challenge section shows the description as before
- Below the description, a form appears with:
  - "Your name or team" text input
  - "Did you find the plaque…" checkbox
  - "What motto is engraved…" text input
  - "Roughly how many other visitors…" number input
  - "What time of day…" radio group with 3 options
  - "Submit answers" button
- Submitting with empty fields shows inline error messages
- Filling all fields and submitting shows "Submitting…" then (since no real Apps Script is configured yet) "Try again" with the error message

- [ ] **Step 3: Commit**

```
git add src/data/text/en/projects/democrats_abroad/den_haag/001_loc_binnenhof.yaml
git commit -m "feat: add example form fields to Binnenhof location"
```
