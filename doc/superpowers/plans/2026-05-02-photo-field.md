# Photo Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the photo upload section in `ChallengeCard` opt-in — shown only when the form definition contains a field with `type: photo`.

**Architecture:** A `photo` field in the YAML form array acts as a marker. `ChallengeForm` accepts it silently (valid type, renders nothing). `ChallengeCard` inspects the form array to decide whether to show the `cc-photo-wrap` section.

**Tech Stack:** React (JSX), Vitest + React Testing Library

---

## Tasks

| # | File | Description |
|---|------|-------------|
| 01 | [2026-05-02-photo-field-01-form-type.md](2026-05-02-photo-field-01-form-type.md) | Accept `photo` type in ChallengeForm without rendering UI |
| 02 | [2026-05-02-photo-field-02-card-visibility.md](2026-05-02-photo-field-02-card-visibility.md) | Gate photo section in ChallengeCard on `photo` field presence |
