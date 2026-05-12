# Location List Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the location list into a single sorted view with an inline add row, removing the separate "Pending additions" section and toolbar add button.

**Architecture:** Add an `allItems` derived state merging live locations and pending-only additions, sorted numerically by `getLocationIndex`. Replace the two-section template with a single `{#each allItems}` loop. Move the add-location action to a styled button row at the bottom of the list. Update toolbar to show icon-prefixed labels only (no add button).

**Tech Stack:** Svelte 5 runes (`$derived`, `$state`), TypeScript, Vitest + Testing Library

---

## Tasks

- [Task 01 – Unified allItems derived state and list template](task-01-unified-list.md)
- [Task 02 – Add row, toolbar icons, and CSS](task-02-add-row-toolbar.md)
