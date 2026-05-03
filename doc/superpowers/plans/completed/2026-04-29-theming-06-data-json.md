# Task 6: Add style field to project JSON

State: Completed

**Part of:** [Theming & Title Bar](2026-04-29-theming-titlebar.md)  
**Depends on:** [Task 5 — App wiring](2026-04-29-theming-05-app-wiring.md)  
**Next:** [Task 7 — AppPage](2026-04-29-theming-07-apppage.md)

**Files:**

- Modify: `src/data/text/en/projects/democrats_abroad/democrats_abroad.json`

Adding `"style": "GWC"` tells `ProjectPage` which theme to activate when a user enters this project. Any project JSON without this field falls back to `"app"`.

---

- [ ] **Step 1: Edit `src/data/text/en/projects/democrats_abroad/democrats_abroad.json`**

Replace the file contents with:

```json
{
  "style": "GWC",
  "project.title": "Democrats Abroad",
  "project.description": "Democrats Abroad is the official arm of the US Democratic Party for Americans living outside the United States. This scavenger hunt connects the history of European resistance to fascism with the stakes of American democracy today.",
  "project.cta": "Choose a city to start your hunt."
}
```

- [ ] **Step 2: Run full suite — expect all still passing**

```bash
npm run test:run
```

- [ ] **Step 3: Commit**

```bash
git add src/data/text/en/projects/democrats_abroad/democrats_abroad.json
git commit -m "feat: add GWC style to democrats_abroad project config"
```
