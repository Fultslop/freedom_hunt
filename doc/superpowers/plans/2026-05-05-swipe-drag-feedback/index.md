# Swipe Drag Feedback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give mobile users real-time drag feedback when swiping between challenge cards, with adjacent cards peeking in from the edges, configurable per theme.

**Architecture:** Three card slots (prev, current, next) are always rendered in an absolutely-positioned strip. A rewritten `swipe.ts` action emits continuous drag deltas with direction-locking (horizontal swipe vs. vertical scroll). RoutePage translates the slots based on `dragOffset`; on release it commits or springs back via CSS transition. Behaviour (`peek | carousel | snap`) is driven by `$themeStore.theme.swipe.mode`.

**Tech Stack:** Svelte 5 runes, TypeScript, CSS custom properties, CSS `transition` for commit/spring-back animation, `TouchEvent` API.

**Spec:** `doc/superpowers/specs/2026-05-05-swipe-drag-feedback-design.md`

---

## Tasks

| # | Task | File(s) |
|---|------|---------|
| 1 | [SwipeConfig type + theme wiring](task-01-types.md) | `src/types/theme.ts`, `src/theme/themes.ts` |
| 2 | [Swipe action rewrite (TDD)](task-02-swipe-action.md) | `src/actions/swipe.ts`, `src/test/swipe.test.ts` |
| 3 | [Commit/elastic helpers (TDD)](task-03-helpers.md) | `src/utils/routeNav.ts`, `src/test/RoutePage.swipe.test.ts` |
| 4 | [RoutePage CSS strip layout](task-04-css.md) | `src/pages/RoutePage.css` |
| 5 | [RoutePage — static three-card strip](task-05-strip-render.md) | `src/pages/RoutePage.svelte` |
| 6 | [RoutePage — drag state + commit/spring-back](task-06-drag-wiring.md) | `src/pages/RoutePage.svelte` |
| 7 | [RoutePage — nav buttons + snap mode](task-07-nav-snap.md) | `src/pages/RoutePage.svelte` |
