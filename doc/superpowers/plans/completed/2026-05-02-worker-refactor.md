# worker.js Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `src/worker.js` from a single 335-line file into well-tested, modular, documented code with named constants replacing all magic values.

**Architecture:** Extract three layers — utility modules (`auth.js`, `github.js`), route handler modules (one per domain), and a thin dispatcher in `worker.js`. Shared helpers go in `utils.js`. Every module gets direct unit tests before extraction so the test suite acts as a safety net.

**Tech Stack:** Cloudflare Workers (ES modules), Vitest, `js-yaml`

---

## Task index

| #                                                     | Task                                     | Files touched                                                                               |
| ----------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| [01](2026-05-02-worker-refactor-01-test-gaps.md)      | Close route test gaps                    | `src/test/worker.test.js`                                                                   |
| [02](2026-05-02-worker-refactor-02-auth-module.md)    | Extract auth utilities module            | `src/worker/auth.js`, `src/test/worker.auth.test.js`, `src/worker.js`                       |
| [03](2026-05-02-worker-refactor-03-github-module.md)  | Extract GitHub utilities module          | `src/worker/github.js`, `src/test/worker.github.test.js`, `src/worker.js`                   |
| [04](2026-05-02-worker-refactor-04-route-handlers.md) | Extract route handlers + thin dispatcher | `src/worker/utils.js`, `src/worker/routes/*.js`, `src/worker.js`, `src/test/worker.test.js` |
| [05](2026-05-02-worker-refactor-05-constants.md)      | Final magic-value sweep                  | `src/worker/auth.js`, route handler files                                                   |
| [06](2026-05-02-worker-refactor-06-docs.md)           | Documentation + dead code audit          | `src/worker/auth.js`, `src/worker/github.js`                                                |

## Final file structure

```
src/
  worker.js                           ← thin dispatcher only; re-exports nothing
  worker/
    auth.js                           ← createToken, verifyToken, checkRateLimit, requireAuth + constants
    github.js                         ← githubRequest, encode/decode, fetchLocations, fetchLocation, createLocationPR, fetchPRStatuses
    utils.js                          ← shared json() helper
    routes/
      authRoutes.js                   ← /auth/login, /auth/me, /auth/logout
      uploadRoute.js                  ← /upload, buildR2Key
      formSubmitRoute.js              ← /form-submit
      editorRoutes.js                 ← /editor/locations, /editor/location, /editor/pr-status
  test/
    worker.test.js                    ← integration tests (imports from new module paths)
    worker.auth.test.js               ← unit tests for auth.js
    worker.github.test.js             ← unit tests for github.js
```

## Dependency order

Tasks 01 → 02 → 03 → 04 must run in order. Tasks 05 and 06 are independent of each other but depend on 04.
