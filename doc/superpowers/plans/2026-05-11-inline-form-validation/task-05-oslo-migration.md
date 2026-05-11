# Task 05 — Oslo data migration

**Prerequisite:** Tasks 01–04 must be complete. At the start of this task, all three
validation layers are active and flagging the 7 Oslo location files.

**Files:**
- Create: `src/data/text/en/projects/democrats_abroad/oslo/001_form_royal_palace.yaml`
- Create: `src/data/text/en/projects/democrats_abroad/oslo/002_form_stortinget.yaml`
- Create: `src/data/text/en/projects/democrats_abroad/oslo/003_form_national_theatre.yaml`
- Create: `src/data/text/en/projects/democrats_abroad/oslo/004_form_akershus.yaml`
- Create: `src/data/text/en/projects/democrats_abroad/oslo/005_form_resistance_museum.yaml`
- Create: `src/data/text/en/projects/democrats_abroad/oslo/006_form_nobel_center.yaml`
- Create: `src/data/text/en/projects/democrats_abroad/oslo/007_form_city_hall.yaml`
- Modify: all 7 corresponding `*_loc_*.yaml` files (replace `form:` array with filename string)

---

### Location 001 — Royal Palace

- [ ] **Step 1a: Create `001_form_royal_palace.yaml`**

```yaml
- id: photo
  type: photo
  label: Take a photo of the statue or the palace gate
- id: pedestal_year
  type: string
  label: What year is inscribed on the Karl Johan pedestal?
- id: guards_visible
  type: radio
  label: How many guards are currently visible at the main gate?
  options:
    - "0"
    - "1"
    - "2"
    - More than 2
- id: royal_standard
  type: boolean
  label: Is the royal standard (flag) flying above the palace today?
```

- [ ] **Step 1b: Update `001_loc_royal_palace.yaml`**

Replace the `challenge:` block's `form:` array with a string reference. The full
updated `challenge:` block:

```yaml
challenge:
  name: ""
  description: |
    Observe the palace guard at the main gate. Note two visible details that distinguish the guard's
    uniform from a standard soldier's. Then discuss in your group: what does a head of state who
    refuses a collaborationist deal mean for a democracy — and does it matter that this was a king,
    not an elected official?
  notes: ""
  form: "001_form_royal_palace.yaml"
```

---

### Location 002 — Stortinget

- [ ] **Step 2a: Create `002_form_stortinget.yaml`**

```yaml
- id: photo
  type: photo
  label: Take a photo of one of the relief panels
- id: left_panel
  type: string
  label: Describe the left relief panel scene
- id: right_panel
  type: string
  label: Describe the right relief panel scene
- id: better_panel
  type: radio
  label: Which panel does your group think better represents what a parliament is for?
  options:
    - Left panel
    - Right panel
    - Neither
    - Both equally
- id: flag_flying
  type: boolean
  label: Is the Norwegian flag flying above the building today?
```

- [ ] **Step 2b: Update `002_loc_stortinget.yaml`**

Replace the `challenge:` block's `form:` array:

```yaml
challenge:
  name: ""
  description: |
    Two relief panels flank the entrance — one on each side. Describe what each scene depicts.
    Then discuss in your group: which panel better represents what a parliament is actually for?
  notes: ""
  form: "002_form_stortinget.yaml"
```

---

### Location 003 — National Theatre

- [ ] **Step 3a: Create `003_form_national_theatre.yaml`**

```yaml
- id: photo
  type: photo
  label: Take a photo of one of the statues
- id: found_both
  type: boolean
  label: Did you find both statues?
- id: pedestal_inscription
  type: string
  label: Copy the inscription from one of the pedestals
- id: ibsen_theme
  type: radio
  label: Which Ibsen theme did your group choose?
  options:
    - Individual freedom against social pressure
    - Institutional corruption
    - Tyranny of majority opinion
    - We couldn't agree
```

- [ ] **Step 3b: Update `003_loc_national_theatre.yaml`**

Replace the `challenge:` block's `form:` array:

```yaml
challenge:
  name: ""
  description: |
    Read the inscription on one of the two statue pedestals. Then discuss in your group: which of
    Ibsen's recurring themes feels most alive in the world right now? Pick one and commit to it.
  notes: ""
  form: "003_form_national_theatre.yaml"
```

---

### Location 004 — Akershus

- [ ] **Step 4a: Create `004_form_akershus.yaml`**

```yaml
- id: photo
  type: photo
  label: Take a photo of the memorial or the courtyard
- id: found_memorial
  type: boolean
  label: Did you find the execution site memorial?
- id: execution_estimate
  type: number
  label: Your estimate (before looking it up) — how many were executed here?
- id: courtyard_description
  type: string
  label: Describe what you can see from where you are standing
- id: emotional_response
  type: radio
  label: How did the space make you feel?
  options:
    - Solemn
    - Angry
    - Proud
    - Numb
```

- [ ] **Step 4b: Update `004_loc_akershus.yaml`**

Replace the `challenge:` block's `form:` array:

```yaml
challenge:
  name: ""
  description: |
    Stand in the fortress courtyard. Without checking your phone: how many Norwegian resistance
    fighters do you think were executed at Akershus during the five years of occupation? Write your
    estimate. Then look it up — how close were you? And describe what you can see from where
    you are standing.
  notes: "The actual number executed at Akershus is approximately 42."
  form: "004_form_akershus.yaml"
```

---

### Location 005 — Resistance Museum

- [ ] **Step 5a: Create `005_form_resistance_museum.yaml`**

```yaml
- id: photo
  type: photo
  label: Take a photo of the object or display you chose
- id: entered_museum
  type: boolean
  label: Did you enter the museum?
- id: liberation_date
  type: string
  label: What liberation date did you find at the entrance?
- id: found_object
  type: string
  label: What did you find inside, and why does it matter?
- id: biggest_surprise
  type: radio
  label: What surprised you most?
  options:
    - The scale of organised resistance
    - The extent of collaboration
    - Individual acts of courage
    - The role of women in the resistance
```

- [ ] **Step 5b: Update `005_loc_resistance_museum.yaml`**

Replace the `challenge:` block's `form:` array:

```yaml
challenge:
  name: ""
  description: |
    Walk through the museum and find one object, document, or story that you think every democracy
    should know about. Note what it is — and explain in your own words, not the museum's, why it
    matters.
  notes: ""
  form: "005_form_resistance_museum.yaml"
```

---

### Location 006 — Nobel Center

- [ ] **Step 6a: Create `006_form_nobel_center.yaml`**

```yaml
- id: photo
  type: photo
  label: Take a photo of the laureate display or an exhibit that caught your eye
- id: entered_center
  type: boolean
  label: Did you enter the center?
- id: recent_laureate
  type: string
  label: Who is the most recent Nobel Peace Prize laureate?
- id: least_known_laureate
  type: string
  label: Which laureate did you know least, and in one sentence — why did they win?
```

- [ ] **Step 6b: Update `006_loc_nobel_center.yaml`**

Replace the `challenge:` block's `form:` array:

```yaml
challenge:
  name: ""
  description: |
    Inside the center, find the laureate you know least about — the one whose name means the least
    to you right now. Read their full citation. Write one sentence in your own words explaining why
    the Nobel Committee chose them.
  notes: ""
  form: "006_form_nobel_center.yaml"
```

---

### Location 007 — City Hall

- [ ] **Step 7a: Create `007_form_city_hall.yaml`**

```yaml
- id: photo
  type: photo
  label: Take a photo of the facade or the mural
- id: towers_identical
  type: boolean
  label: Are the two towers identical?
- id: tower_difference
  type: string
  label: What difference did you spot between the towers?
- id: professions_count
  type: number
  label: How many distinct professions did you count in the mural?
- id: hall_word
  type: radio
  label: One word for the main hall?
  options:
    - Grand
    - Austere
    - Warm
    - Surprising
```

- [ ] **Step 7b: Update `007_loc_city_hall.yaml`**

Replace the `challenge:` block's `form:` array:

```yaml
challenge:
  name: ""
  description: |
    Step inside the main hall. Henrik Sørensen's mural cycle covers the walls. Find the section
    depicting Norwegian workers and craftspeople — fishers, farmers, builders, weavers, and more.
    Count how many distinct professions you can identify in the scene.
  notes: ""
  form: "007_form_city_hall.yaml"
```

---

### Verification

- [ ] **Step 8: Verify the validate script passes**

```
npm run validate:yaml
```

Expected: exits with code 0, no output.

- [ ] **Step 9: Run the full test suite**

```
npm run test:run
```

Expected: all tests pass.

- [ ] **Step 10: Run lint and typecheck**

```
npm run lint
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 11: Verify VS Code shows no squiggles on Oslo files**

Open any of the 7 updated `*_loc_*.yaml` files in VS Code. The `form:` line should
now show no red squiggles — the string value matches the schema. ✓

- [ ] **Step 12: Commit**

```
git add src/data/text/en/projects/democrats_abroad/oslo/
git commit -m "feat: migrate Oslo inline form data to separate form YAML files"
```
