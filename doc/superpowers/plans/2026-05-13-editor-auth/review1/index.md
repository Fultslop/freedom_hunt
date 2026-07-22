# Editor Auth Review Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix seven deficiencies found during code review of the `fix_editor_auth` branch before it is merged.

**Architecture:** All changes are surgical fixes to staged code — no new subsystems. The two critical bugs (pr-status 403 for D1 users, redirect loop after invite acceptance) are independent and can be fixed in parallel if desired. The remaining tasks are test coverage gaps and small code-quality issues.

**Tech Stack:** Svelte 5 runes, TypeScript, Vitest, Cloudflare Workers.

---

## File Map

### Modified files
| File | Change |
|------|--------|
| `src/worker/auth.ts` | Export new `cookieHeader` helper |
| `src/worker/routes/authRoutes.ts` | Remove local `cookieHeader`, import from auth |
| `src/worker/routes/inviteRoutes.ts` | Remove local `cookieHeader`, import from auth |
| `src/utils/api.ts` | Add `project` param to `fetchPrStatuses`; add `userId/email/username` to `InviteAcceptResponse`; fix trailing newline |
| `src/pages/editor/EditorLocationList.svelte` | Pass `params.project` to `fetchPrStatuses` |
| `src/pages/editor/EditorLoginPage.svelte` | Refresh authStore with invite capabilities after `postInviteAccept` |
| `src/pages/SignupPage.svelte` | Refresh authStore with invite capabilities after `postInviteAccept` |
| `src/pages/InviteAcceptPage.svelte` | Update authStore after `postInviteAccept` |
| `src/pages/editor/EditorPage.svelte` | Use derived `project` variable in `handleInvite` |
| `src/test/stores.test.ts` | Add editor session tests for `init()`, `loginEditor`, `loginParticipant` |
| `src/test/api.test.ts` | Update `fetchPrStatuses` test to pass project param |
| `src/test/EditorPage.test.ts` | Restore "does not redirect" guard test |
| `src/test/EditorLoginPage.test.ts` | Add assertion: store has new capabilities after pending invite |
| `src/test/SignupPage.test.ts` | Add assertion: store has new capabilities after pending invite |
| `src/test/InviteAcceptPage.test.ts` | Add assertion: store updated after acceptance |

---

## Tasks

| # | Task | File |
|---|------|------|
| 01 | Move shared `cookieHeader` helper to `auth.ts` | [task-01-cookieheader.md](task-01-cookieheader.md) |
| 02 | Fix `fetchPrStatuses` — add `project` param | [task-02-pr-status.md](task-02-pr-status.md) |
| 03 | Refresh authStore after invite acceptance | [task-03-invite-accept-refresh.md](task-03-invite-accept-refresh.md) |
| 04 | Add `stores.test.ts` editor session tests | [task-04-stores-test.md](task-04-stores-test.md) |
| 05 | `EditorPage` hardcoded project + restore redirect test | [task-05-editor-page-fixes.md](task-05-editor-page-fixes.md) |
