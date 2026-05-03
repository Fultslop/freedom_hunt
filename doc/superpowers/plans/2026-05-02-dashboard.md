# Organiser Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only organiser dashboard that shows all team submissions and photos from a live hunt in a single view.

**Architecture:** The Cloudflare Worker gains an admin auth tier (separate KV password, `isAdmin` flag in token) and three new routes: `GET /photo/:key` to serve R2 objects, `GET /admin/submissions` to merge R2 photo keys with Google Sheet rows, and an updated Apps Script that both writes submissions (`doPost`) and exposes them for reading (`doGet`). A new `DashboardPage` in the React app fetches this merged data and renders a submission table with inline photo thumbnails. The dashboard is protected by an `AdminRoute` guard.

**Tech Stack:** Cloudflare Workers (KV + R2), Google Apps Script, React (JSX), Vitest

**Prerequisites / context:**

- The existing Apps Script (`doPost`) saves only 4 columns: `timestamp, locationId, submitterId, fields` — this does not match the Worker's current payload (`timestamp, routeId, locationId, teamName, email, fields`). Task 02 fixes both the script and setup.md together.
- R2 photo keys currently have no team identifier (`{locationId}_{timestamp}.ext`). Task 01 adds one.
- Tests run with `npm test`. Worker tests live in `src/test/worker.test.js`; component tests in `src/test/*.test.jsx`.

---

## Tasks

| #                                               | File                                                                           | What it does                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------- |
| [01](2026-05-02-dashboard-01-photo-key.md)      | `src/worker.js`, `src/components/ChallengeForm.jsx`, `src/test/worker.test.js` | Fix R2 key to include team + route       |
| [02](2026-05-02-dashboard-02-sheet-read.md)     | `doc/setup.md`, Apps Script (manual)                                           | Fix Apps Script schema + add `doGet()`   |
| [03](2026-05-02-dashboard-03-admin-auth.md)     | `src/worker.js`, `src/auth/AuthContext.jsx`, `src/auth/AdminRoute.jsx`         | Admin KV password + `isAdmin` token flag |
| [04](2026-05-02-dashboard-04-photo-serve.md)    | `src/worker.js`, `src/test/worker.test.js`                                     | `GET /photo/:key` Worker route           |
| [05](2026-05-02-dashboard-05-admin-endpoint.md) | `src/worker.js`, `src/test/worker.test.js`                                     | `GET /admin/submissions` Worker route    |
| [06](2026-05-02-dashboard-06-dashboard-page.md) | `src/pages/DashboardPage.jsx`, `src/pages/DashboardPage.css`, `src/App.jsx`    | Dashboard React page + routing           |
