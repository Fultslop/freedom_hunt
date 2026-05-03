# Task 2: Add image field to Binnenhof YAML

**Part of:** [ChallengeCard Redesign](2026-04-29-challenge-card-redesign.md)
**Depends on:** [Task 1 — Install leaflet + react-leaflet](2026-04-29-challenge-card-01-install-leaflet.md)
**Next:** [Task 3 — Rewrite ChallengeCard tests](2026-04-29-challenge-card-03-tests.md)

**Files:**

- Modify: `src/data/text/en/projects/democrats_abroad/den_haag/001_loc_binnenhof.yaml`

The image file `alireza-parpaei-den-haag-unsplash.jpg` already exists at `src/data/img/`. Locations 002 and 003 intentionally have no `image` field — they exercise the no-hero fallback path.

---

- [ ] **Step 1: Add the image field to binnenhof.yaml**

Add `image` as the second line (after `locationId`):

```yaml
locationId: 1
image: "alireza-parpaei-den-haag-unsplash.jpg"
title: "The Final Civic Act"
name:
  label: ""
  value: "Binnenhof / Het Plein"
address: "Binnenhof 1"
coordinates:
  longitude: 4.3133
  latitude: 52.0799
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

- [ ] **Step 2: Confirm 002 and 003 have no image field**

`002_loc_vredespaleis.yaml` and `003_loc_plein.yaml` should have no `image` field. Do not add one.

- [ ] **Step 3: Run tests to confirm nothing broke**

```bash
npm run test:run
```

Expected: all existing tests pass (the `image` field is not yet used by the component).

- [ ] **Step 4: Commit**

```bash
git add src/data/text/en/projects/democrats_abroad/den_haag/001_loc_binnenhof.yaml
git commit -m "feat: add image field to Binnenhof location"
```
