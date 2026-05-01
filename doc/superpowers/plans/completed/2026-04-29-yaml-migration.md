# YAML Data Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all data files from JSON to YAML, adopt the new location schema, and wire up the YAML Vite plugin so the app and tests continue to work.

**Architecture:** Add `@modyfi/vite-plugin-yaml` to make Vite/Vitest treat `.yaml` files like JSON imports. Update both data-loading hooks to glob `.yaml` instead of `.json`. Convert all 10 data files; the 3 location files adopt a richer schema. Update `ChallengeCard` and its test to read the new field names.

**Tech Stack:** Vite 8, `@modyfi/vite-plugin-yaml`, React 19, Vitest

**Spec:** `doc/superpowers/specs/2026-04-29-yaml-data-migration-design.md`

---

## Tasks

| # | Task | Files |
|---|------|-------|
| 1 | [Add YAML plugin](2026-04-29-yaml-migration-01-plugin.md) | `vite.config.js` |
| 2 | [Update ChallengeCard test](2026-04-29-yaml-migration-02-challengecard-test.md) | `src/test/ChallengeCard.test.jsx` |
| 3 | [Update ChallengeCard component](2026-04-29-yaml-migration-03-challengecard-component.md) | `src/components/ChallengeCard.jsx` |
| 4 | [Migrate non-location data files + hooks](2026-04-29-yaml-migration-04-data-files.md) | 7 YAML files, `src/hooks/useText.js`, `src/hooks/useLocations.js` |
| 5 | [Migrate location files to new schema](2026-04-29-yaml-migration-05-location-files.md) | 3 YAML files |

## File Map

**Create:**
- `src/data/text/en/application.yaml`
- `src/data/text/en/projects/projects.yaml`
- `src/data/text/en/projects/democrats_abroad/democrats_abroad.yaml`
- `src/data/text/en/projects/democrats_abroad/cities.yaml`
- `src/data/text/en/projects/democrats_abroad/den_haag/den_haag.yaml`
- `src/data/text/en/projects/democrats_abroad/den_haag/routes.yaml`
- `src/data/text/en/test_fixture.yaml`
- `src/data/text/en/projects/democrats_abroad/den_haag/001_loc_binnenhof.yaml`
- `src/data/text/en/projects/democrats_abroad/den_haag/002_loc_vredespaleis.yaml`
- `src/data/text/en/projects/democrats_abroad/den_haag/003_loc_plein.yaml`

**Modify:**
- `vite.config.js`
- `src/hooks/useText.js`
- `src/hooks/useLocations.js`
- `src/components/ChallengeCard.jsx`
- `src/test/ChallengeCard.test.jsx`

**Delete:**
- `src/data/text/en/application.json`
- `src/data/text/en/projects/projects.json`
- `src/data/text/en/projects/democrats_abroad/democrats_abroad.json`
- `src/data/text/en/projects/democrats_abroad/cities.json`
- `src/data/text/en/projects/democrats_abroad/den_haag/den_haag.json`
- `src/data/text/en/projects/democrats_abroad/den_haag/routes.json`
- `src/data/text/en/test_fixture.json`
- `src/data/text/en/projects/democrats_abroad/den_haag/001_loc_binnenhof.json`
- `src/data/text/en/projects/democrats_abroad/den_haag/002_loc_vredespaleis.json`
- `src/data/text/en/projects/democrats_abroad/den_haag/003_loc_plein.json`
