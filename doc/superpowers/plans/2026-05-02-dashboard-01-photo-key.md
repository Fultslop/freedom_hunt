# Task 01: Fix R2 Photo Key

> Part of [2026-05-02-dashboard.md](2026-05-02-dashboard.md)

**Goal:** Include `teamName` and `routeId` in every R2 photo key so the dashboard can match photos to submissions without guessing by timestamp proximity.

**New key format:** `{safeTeam}--{routeId}--{locationId}--{timestamp}.{ext}`
- `--` (double hyphen) is the field separator
- `safeTeam` is teamName lowercased with every non-alphanumeric character replaced by `_`
- This is unambiguous because the sanitised team name only contains `[a-z0-9_]` — no hyphens

**Files:**
- Modify: `src/worker.js` — export `sanitizeName`, update `buildR2Key` signature, read `routeId` from FormData in `/upload`
- Modify: `src/components/ChallengeForm.jsx` — append `routeId` to the photo upload FormData
- Modify: `src/test/worker.test.js` — update `buildR2Key` tests for new signature

---

- [ ] **Step 1: Write the failing tests for `sanitizeName` and the new `buildR2Key`**

Open `src/test/worker.test.js`. Replace the existing `describe('buildR2Key', ...)` block with:

```js
import worker, { buildR2Key, sanitizeName, createToken } from '../worker.js'

describe('sanitizeName', () => {
  it('lowercases and replaces spaces with underscores', () => {
    expect(sanitizeName('Team Alpha')).toBe('team_alpha')
  })
  it('replaces special characters with underscores', () => {
    expect(sanitizeName('A & B!')).toBe('a___b_')
  })
  it('handles already-safe names', () => {
    expect(sanitizeName('team_a')).toBe('team_a')
  })
})

describe('buildR2Key', () => {
  it('builds key with separator and jpg extension for jpeg', () => {
    expect(buildR2Key('001', 'Team A', 'route1', 'image/jpeg', 1000000))
      .toBe('team_a--route1--001--1000000.jpg')
  })
  it('uses png extension for png mime type', () => {
    expect(buildR2Key('001', 'Team A', 'route1', 'image/png', 1000000))
      .toBe('team_a--route1--001--1000000.png')
  })
  it('falls back to jpg for unknown mime type', () => {
    expect(buildR2Key('001', 'Team A', 'route1', 'image/webp', 1000000))
      .toBe('team_a--route1--001--1000000.jpg')
  })
  it('sanitizes teamName in the key', () => {
    expect(buildR2Key('001', 'Red & Blue!', 'r1', 'image/jpeg', 42))
      .toBe('red___blue_--r1--001--42.jpg')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm test -- src/test/worker.test.js
```

Expected: FAIL — `sanitizeName is not a function` or similar.

- [ ] **Step 3: Update `sanitizeName` and `buildR2Key` in `src/worker.js`**

Find the existing `buildR2Key` function (line ~74) and replace it with:

```js
export function sanitizeName(str) {
  return String(str).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
}

export function buildR2Key(locationId, teamName, routeId, mimeType, timestamp) {
  const ext = mimeType === 'image/png' ? 'png' : 'jpg'
  const safeTeam = sanitizeName(teamName)
  return `${safeTeam}--${routeId}--${locationId}--${timestamp}.${ext}`
}
```

- [ ] **Step 4: Update the `/upload` handler in `src/worker.js` to pass the new arguments**

Find the `/upload` handler (around line 132). The `formData.get` block currently reads `locationId`. Add `routeId` and pass both plus `authPayload.teamName` to `buildR2Key`:

```js
if (request.method === 'POST' && url.pathname === '/upload') {
  const authPayload = await requireAuth(request, env)
  if (!authPayload) return json({ ok: false, error: 'Unauthorized' }, 401)
  try {
    const formData = await request.formData()
    const photo = formData.get('photo')
    const locationId = formData.get('locationId') || 'unknown'
    const routeId = formData.get('routeId') || 'unknown'
    const key = buildR2Key(locationId, authPayload.teamName, routeId, photo.type, Date.now())
    await env.PHOTOS.put(key, photo.stream(), {
      httpMetadata: { contentType: photo.type },
    })
    return json({ ok: true, key })
  } catch {
    return json({ ok: false, error: 'Upload failed' }, 500)
  }
}
```

- [ ] **Step 5: Update `src/components/ChallengeForm.jsx` to send `routeId` with the upload**

Find `handleFileChange` (~line 29). Add `body.append('routeId', String(routeId))` after the existing `locationId` append:

```js
async function handleFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  setUploadState('uploading')
  const body = new FormData()
  body.append('photo', file)
  body.append('locationId', String(locationId))
  body.append('routeId', String(routeId))
  try {
    const res = await fetch('/upload', { method: 'POST', body })
    const data = await res.json()
    setUploadState(data.ok ? 'success' : 'error')
  } catch {
    setUploadState('error')
  }
}
```

`routeId` is already a prop on `ChallengeForm` (line 17: `export default function ChallengeForm({ form, locationId, routeId })`), so no prop change is needed.

- [ ] **Step 6: Run all tests and confirm they pass**

```
npm test -- src/test/worker.test.js
```

Expected: All `buildR2Key` and `sanitizeName` tests pass. The `/upload` handler test (if any) should also pass — it doesn't test the key format directly, just the response shape.

- [ ] **Step 7: Commit**

```
git add src/worker.js src/components/ChallengeForm.jsx src/test/worker.test.js
git commit -m "feat: include teamName and routeId in R2 photo key"
```
