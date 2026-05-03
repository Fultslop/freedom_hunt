# Task 1: Install leaflet + react-leaflet

**Part of:** [ChallengeCard Redesign](2026-04-29-challenge-card-redesign.md)
**Depends on:** nothing
**Next:** [Task 2 — Add image field to Binnenhof YAML](2026-04-29-challenge-card-02-image-field.md)

**Files:**

- Modify: `package.json` (via npm install — do not edit by hand)

---

- [ ] **Step 1: Install the packages**

```bash
npm install leaflet react-leaflet
```

- [ ] **Step 2: Verify they appear in package.json**

Check that `package.json` now lists `"leaflet"` and `"react-leaflet"` under `"dependencies"`.

- [ ] **Step 3: Verify the dev server still starts**

```bash
npm run dev
```

Expected: server starts with no errors. Stop it with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install leaflet and react-leaflet"
```
