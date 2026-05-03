# ChallengeCard Redesign — Implementation Index

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `ChallengeCard.jsx` in-place to show a hero image, overlapping title card (locationId badge + title + name + address), storyline, Leaflet map, challenge, and breadcrumb.

**Architecture:** ChallengeCard receives the full location object from RoutePage (no prop-signature change). Hero image is loaded asynchronously via Vite's dynamic import — when absent or failed the hero is skipped and the title card renders in normal document flow. A Leaflet map replaces the plain coordinates display.

**Tech Stack:** React 19, react-leaflet + leaflet (new), Vite asset pipeline for local images, Vitest + Testing Library.

**Spec:** [doc/superpowers/specs/2026-04-29-challenge-card-redesign-design.md](../specs/2026-04-29-challenge-card-redesign-design.md)

---

## Tasks

Execute in order — each task depends on the previous one.

| #   | Task                                                                               | File(s)                            |
| --- | ---------------------------------------------------------------------------------- | ---------------------------------- |
| 1   | [Install leaflet + react-leaflet](2026-04-29-challenge-card-01-install-leaflet.md) | `package.json`                     |
| 2   | [Add image field to Binnenhof YAML](2026-04-29-challenge-card-02-image-field.md)   | `001_loc_binnenhof.yaml`           |
| 3   | [Rewrite ChallengeCard tests (failing)](2026-04-29-challenge-card-03-tests.md)     | `src/test/ChallengeCard.test.jsx`  |
| 4   | [Implement redesigned ChallengeCard](2026-04-29-challenge-card-04-implement.md)    | `src/components/ChallengeCard.jsx` |
