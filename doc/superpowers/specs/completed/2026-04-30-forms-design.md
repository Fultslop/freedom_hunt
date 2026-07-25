# Challenge Forms — Design Spec

**Date:** 2026-04-30
**Status:** Approved

## Overview

Add data-driven forms to challenge cards so participants can submit text answers, numbers, boolean confirmations, and single-choice selections. Submissions are proxied through the existing Cloudflare Worker and stored in a Google Sheet via a Google Apps Script Web App. The Apps Script URL is stored as a Cloudflare Worker secret — never in code or the public repo.

**Scope:** MVP / proof of concept. No team identity yet (placeholder submitter ID field). No authentication beyond the secret URL.

---

## YAML Schema

The `form` field is an optional array added inside `challenge` in any location YAML. Locations without `form` are unaffected.

```yaml
challenge:
  name: ""
  description: |
    Register to vote before you leave this courtyard.
  notes: ""
  form:
    - id: found_plaque
      type: boolean
      label: Did you find the plaque?
    - id: motto_text
      type: string
      label: What motto is engraved on it?
    - id: tree_count
      type: number
      label: How many trees do you see?
    - id: time_of_day
      type: radio
      label: What time of day did you arrive?
      options:
        - Morning
        - Afternoon
        - Evening
```

**Supported field types:**

| Type      | Input rendered               | Required `options`? |
| --------- | ---------------------------- | ------------------- |
| `string`  | `<input type="text">`        | No                  |
| `number`  | `<input type="number">`      | No                  |
| `boolean` | `<input type="checkbox">`    | No                  |
| `radio`   | `<input type="radio">` group | Yes                 |

All fields are implicitly required. The `options` key is only used by `radio` — ignored on all other types.

---

## Component: ChallengeForm

**File:** `src/components/ChallengeForm.jsx`

**Props:** `form` (array of field definitions from YAML), `locationId` (string)

### Standard fields (always present, not in YAML)

- **Submitter ID** — plain text input at the top of every form. Manual entry for now; will be pre-populated or replaced once team identity is decided.
- **Timestamp** — added automatically at submission time (`new Date().toISOString()`), not shown to the user.

### Definition validation (render-time)

Before rendering, each field definition is validated:

- Unknown `type` → render a visible red error placeholder instead of an input:
  > ⚠ Invalid field "tree_count": unknown type "nmber"
- `radio` missing `options` (or `options` is empty) → same visible error placeholder.

This makes YAML authoring errors immediately visible during testing without crashing the form.

### Submission validation (on submit)

All fields (including submitter ID) are required. On submit attempt:

- Each empty or unselected field shows an inline error message below it.
- The form does not POST until all fields pass validation.
- Errors are cleared when the user starts correcting a field.

### Upload states

| State        | UI                                                                     |
| ------------ | ---------------------------------------------------------------------- |
| `idle`       | Submit button active                                                   |
| `submitting` | Button disabled, "Submitting…"                                         |
| `success`    | Button replaced by "✓ Answers submitted" (green)                       |
| `error`      | "Try again" button + error message below (network/server failure only) |

### Submission payload

```json
{
  "locationId": "001_loc_binnenhof",
  "timestamp": "2026-04-30T14:23:00.000Z",
  "submitterId": "Alice",
  "fields": {
    "found_plaque": true,
    "motto_text": "Pro Rege, Lege et Grege",
    "tree_count": 7,
    "time_of_day": "Morning"
  }
}
```

POSTed as `application/json` to `/form-submit`.

### Styling

Inline styles throughout, matching existing card aesthetic. Submitter ID field and YAML-defined fields use the same label + input pattern. Error messages in red below each invalid field. Submit button full-width, dark background (`#002868`), white text — matching the camera upload button.

---

## Worker Route: /form-submit

**File:** `src/worker.js` (new route added to existing Worker)

**Route:** `POST /form-submit`

**Processing:**

1. Parse the JSON body
2. Read `env.FORM_SCRIPT_URL` (Cloudflare Worker secret)
3. Forward the payload as-is to the Apps Script URL via `fetch`
4. Return `{ ok: true }` on success
5. Return `{ ok: false, error: "Submission failed" }` with HTTP 500 on any error

**Secret:** `FORM_SCRIPT_URL` is set once via `wrangler secret put FORM_SCRIPT_URL` and lives only in Cloudflare's secret store — never in code or git.

All other requests continue to fall through to `env.ASSETS.fetch(request)` as before.

---

## Google Apps Script

A small script (~25 lines) deployed once manually to the Google account that owns the data. Lives outside the repo (in Google's Apps Script editor). The full script to copy-paste is included in `doc/setup.md`.

**What it does:**

1. Receives the POST from the Cloudflare Worker
2. Parses the JSON body
3. Appends one row to the active Sheet

**Sheet row format:**

| timestamp            | locationId        | submitterId | fields                                                                                 |
| -------------------- | ----------------- | ----------- | -------------------------------------------------------------------------------------- |
| 2026-04-30T14:23:00Z | 001_loc_binnenhof | Alice       | `{"found_plaque":true,"motto_text":"Pro Rege","tree_count":7,"time_of_day":"Morning"}` |

`fields` is stored as a JSON string in a single column — simple for a PoC, readable by organizers for scoring.

**Deploy settings:** Web App, execute as "Me", access "Anyone" — the URL is the only protection. Access is controlled by storing the URL exclusively as a Cloudflare Worker secret.

---

## Integration: ChallengeCard

`src/components/ChallengeCard.jsx` gains a conditional render:

```
if (location.challenge.form && location.challenge.form.length > 0)
  render <ChallengeForm form={location.challenge.form} locationId={location.locationId} />
```

Placement: below the challenge description box, above the camera button.

No changes to YAML loading logic — `challenge.form` is just another field on the existing object, `undefined` when absent.

---

## Deliverable: doc/setup.md

A step-by-step setup guide covering:

1. **Google Apps Script setup** — creating the project, pasting the script, deploying as a Web App, copying the URL. Written for someone with no prior Apps Script experience.
2. **Cloudflare Worker secret** — running `wrangler secret put FORM_SCRIPT_URL` and pasting the URL.

---

## Files Changed

| File                                                                         | Change                                    |
| ---------------------------------------------------------------------------- | ----------------------------------------- |
| `src/components/ChallengeForm.jsx`                                           | New component                             |
| `src/components/ChallengeCard.jsx`                                           | Conditional render of `ChallengeForm`     |
| `src/worker.js`                                                              | New `POST /form-submit` route             |
| `src/data/text/en/projects/democrats_abroad/den_haag/001_loc_binnenhof.yaml` | Example `form` array added to `challenge` |
| `doc/setup.md`                                                               | New setup guide                           |

YAML for other locations: `form` is optional — existing locations require no changes.

---

## Stretch Goals (out of scope for this spec)

- Pre-populate submitter ID from localStorage once team identity is decided
- Per-field `required: false` to make some fields optional
- Answer persistence across page reloads (localStorage)
- Authenticated submission endpoint
- Organizer dashboard replacing the Google Sheet
