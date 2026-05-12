# Required Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate `AppForm` validation errors on `isRequired: true` and show a visual asterisk on required field labels.

**Architecture:** Two changes to `AppForm.svelte` — add `|| !field.isRequired` to the skip condition in `validateValues()`, and add a `af-label--required` modifier class to the label element. The asterisk is rendered purely via CSS `::after` so DOM text content stays clean and `getByLabelText` queries in tests are unaffected. Existing tests that rely on required-error behaviour receive `isRequired: true`; a new test confirms non-required empty fields pass without error.

**Tech Stack:** Svelte 5, TypeScript, CSS custom properties, Vitest + Testing Library

---

## Tasks

- [Task 01 – Required field validation + asterisk](task-01-required-fields.md)
