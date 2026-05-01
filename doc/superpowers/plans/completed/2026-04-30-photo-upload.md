# Photo Upload — Implementation Index

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a camera button to `ChallengeCard` that lets participants photograph location evidence and upload it to a Cloudflare R2 bucket on the same account.

**Architecture:** A thin Cloudflare Worker script (`src/worker.js`) handles `POST /upload` and stores images in R2; all other requests fall through to the existing static asset handler. `ChallengeCard` gets a hidden file input triggered by a styled button, with four local states: idle → uploading → success | error.

**Tech Stack:** Cloudflare Workers, Cloudflare R2, React 19, Vitest + Testing Library.

**Spec:** [doc/superpowers/specs/2026-04-30-photo-upload-design.md](../specs/2026-04-30-photo-upload-design.md)

---

## Tasks

Execute in order — each task depends on the previous one.

| # | Task | File(s) |
|---|---|---|
| 1 | [Configure wrangler.jsonc](2026-04-30-photo-upload-01-wrangler-config.md) | `wrangler.jsonc` |
| 2 | [Create Worker script](2026-04-30-photo-upload-02-worker-script.md) | `src/worker.js`, `src/test/worker.test.js` |
| 3 | [Add camera button to ChallengeCard](2026-04-30-photo-upload-03-camera-button.md) | `src/components/ChallengeCard.jsx`, `src/test/ChallengeCard.test.jsx` |
