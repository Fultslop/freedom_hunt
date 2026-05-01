# Task 5: Migrate Location Files to New Schema

Create the 3 location YAML files with the new schema, delete the old JSON files, then verify the app renders location data correctly in the browser.

**Files:**
- Create: `src/data/text/en/projects/democrats_abroad/den_haag/001_loc_binnenhof.yaml`
- Create: `src/data/text/en/projects/democrats_abroad/den_haag/002_loc_vredespaleis.yaml`
- Create: `src/data/text/en/projects/democrats_abroad/den_haag/003_loc_plein.yaml`
- Delete: the 3 corresponding `.json` files

---

- [ ] **Step 1: Create `001_loc_binnenhof.yaml`**

```yaml
locationId: 1
title: "Binnenhof"
name:
  label: "location details"
  value: ""
address: ""
coordinates:
  longitude: 4.3133
  lattitude: 52.0799
storyline: |
  The Binnenhof is the oldest seat of parliament in the world still in use. Its 13th-century towers have witnessed wars, occupations, liberation, and democratic renewal.
challenge:
  name: ""
  description: |
    Register to vote — or confirm your registration is current — before you leave this courtyard. Photograph the screen showing your completed registration as proof.
  notes: ""
breadcrumb: |
  Find the inner courtyard where a statue of William of Orange keeps watch. What motto is engraved on the plaque at his feet?
```

- [ ] **Step 2: Create `002_loc_vredespaleis.yaml`**

```yaml
locationId: 2
title: "Peace Palace"
name:
  label: "location details"
  value: ""
address: ""
coordinates:
  longitude: 4.2951
  lattitude: 52.0877
storyline: |
  Built in 1913 to house the Permanent Court of Arbitration, the Peace Palace is now home to the International Court of Justice — the principal judicial organ of the United Nations. It stands on the premise that disputes between nations can be settled by law, not war.
challenge:
  name: ""
  description: |
    The US donated this gift when it still believed in international institutions. Write or voice-memo one sentence: what does American leadership in international law mean to you today? Share it with one person in your group.
  notes: ""
breadcrumb: |
  At the main gate, find the mosaic donated by the United States in 1913. What image does it depict, and which state commissioned it?
```

- [ ] **Step 3: Create `003_loc_plein.yaml`**

```yaml
locationId: 3
title: "Plein 1813"
name:
  label: "location details"
  value: ""
address: ""
coordinates:
  longitude: 4.3115
  lattitude: 52.0793
storyline: |
  The Plein square in central Den Haag is named for the date in 1813 when the Netherlands regained its independence after French occupation. It later became a gathering point for resistance networks during the Nazi occupation of 1940–1945.
challenge:
  name: ""
  description: |
    You've reached the final stop. Every location on this hunt was once visited by people who had no vote, no voice, and no safety. You have all three. Complete your voter registration at vote.gov and send the confirmation to a fellow American abroad.
  notes: ""
breadcrumb: |
  Find the monument at the centre of the square. What year is marked at its base, and what event does the inscription describe?
```

- [ ] **Step 4: Delete the old location JSON files**

```bash
rm src/data/text/en/projects/democrats_abroad/den_haag/001_loc_binnenhof.json
rm src/data/text/en/projects/democrats_abroad/den_haag/002_loc_vredespaleis.json
rm src/data/text/en/projects/democrats_abroad/den_haag/003_loc_plein.json
```

- [ ] **Step 5: Run tests to confirm nothing broke**

```bash
npm run test:run
```

Expected: all 15 tests pass. The location files are not covered by unit tests; the browser verification in the next step covers them.

- [ ] **Step 6: Start the dev server and verify location rendering**

```bash
npm run dev
```

Navigate to `http://localhost:5173/democrats_abroad/den_haag/short_walk` in a browser.

Swipe through all 3 cards. For each card verify:
- Title renders (e.g. "Binnenhof", "Peace Palace", "Plein 1813")
- Storyline paragraph renders (the historical description text)
- Clue section renders the breadcrumb text (the find-the-thing instruction)
- Challenge section renders the challenge description (the voting CTA)

If any card shows blank text where content should appear, the field name mapping is wrong — check `ChallengeCard.jsx` against the YAML keys.

- [ ] **Step 7: Commit**

```bash
git add src/data/text/en/projects/democrats_abroad/den_haag/
git commit -m "feat: migrate location files to new YAML schema"
```
