# Task 03 — Extract GitHub utilities module

> **Index:** [worker-refactor](2026-05-02-worker-refactor.md) | **Depends on:** Task 02

**Goal:** Move all GitHub API logic out of `src/worker.js` into `src/worker/github.js`. Extract the inline route logic into named functions (`fetchLocations`, `fetchLocation`, `fetchPRStatuses`). Add unit tests for the pure encode/decode helpers.

**Files:**
- Create: `src/worker/github.js`
- Create: `src/test/worker.github.test.js`
- Modify: `src/worker.js`

---

- [ ] **Step 1: Write unit tests for pure helpers (they will fail)**

Create `src/test/worker.github.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { decodeGitHubContent, encodeGitHubContent, locationFilePath } from '../worker/github.js'

describe('encodeGitHubContent / decodeGitHubContent', () => {
  it('round-trips ASCII content', () => {
    const original = 'locationId: 1\ntitle: Test\n'
    expect(decodeGitHubContent(encodeGitHubContent(original))).toBe(original)
  })

  it('round-trips UTF-8 content (accented characters)', () => {
    const original = 'title: Café de Unie\naddress: Plein 1\n'
    expect(decodeGitHubContent(encodeGitHubContent(original))).toBe(original)
  })

  it('strips whitespace from base64 before decoding (GitHub API wraps at 76 chars)', () => {
    const original = 'hello: world\n'
    const encoded = encodeGitHubContent(original)
    const withNewlines = encoded.replace(/.{10}/g, '$&\n')
    expect(decodeGitHubContent(withNewlines)).toBe(original)
  })
})

describe('locationFilePath', () => {
  it('builds the canonical data path', () => {
    expect(locationFilePath('democrats_abroad', 'den_haag', '001_loc_test.yaml'))
      .toBe('src/data/text/en/projects/democrats_abroad/den_haag/001_loc_test.yaml')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail (module not found)**

```
npm run test -- src/test/worker.github.test.js
```

Expected: FAIL — `Cannot find module '../worker/github.js'`

---

- [ ] **Step 3: Create `src/worker/github.js`**

```js
import yaml from 'js-yaml'

// Matches location YAML files: e.g. 001_loc_binnenhof.yaml
const LOC_FILE_PATTERN = /^\d+_loc_.*\.yaml$/
const DATA_PATH = 'src/data/text/en/projects'

async function githubRequest(path, options = {}, env) {
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${env.GITHUB_PAT}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'freedom-hunt-editor',
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GitHub ${res.status}: ${err}`)
  }
  return res.json()
}

export function decodeGitHubContent(base64) {
  const raw = atob(base64.replace(/\s/g, ''))
  const bytes = Uint8Array.from(raw, c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeGitHubContent(str) {
  const bytes = new TextEncoder().encode(str)
  const binary = Array.from(bytes, b => String.fromCharCode(b)).join('')
  return btoa(binary)
}

export function locationFilePath(project, city, filename) {
  return `${DATA_PATH}/${project}/${city}/${filename}`
}

export async function fetchLocations(project, city, env) {
  const files = await githubRequest(`/contents/${DATA_PATH}/${project}/${city}`, {}, env)
  const locFiles = files.filter(f => f.type === 'file' && LOC_FILE_PATTERN.test(f.name))
  return Promise.all(locFiles.map(async f => {
    const fileData = await githubRequest(`/contents/${f.path}`, {}, env)
    const content = decodeGitHubContent(fileData.content)
    const location = yaml.load(content)
    return { filename: f.name, sha: fileData.sha, location }
  }))
}

export async function fetchLocation(project, city, filename, env) {
  const fileData = await githubRequest(`/contents/${locationFilePath(project, city, filename)}`, {}, env)
  const content = decodeGitHubContent(fileData.content)
  const location = yaml.load(content)
  return { filename, sha: fileData.sha, location }
}

// Creates a branch, commits a YAML file, and opens a PR against main.
// Sequence: resolve HEAD sha → create branch → PUT file → create PR.
export async function createLocationPR(project, city, filename, yamlContent, existingSha, prTitle, env) {
  const ref = await githubRequest('/git/ref/heads/main', {}, env)
  const headSha = ref.object.sha
  const branchName = `editor/${filename.replace('.yaml', '')}-${Date.now()}`

  await githubRequest('/git/refs', {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: headSha }),
  }, env)

  const filePath = locationFilePath(project, city, filename)
  let currentSha = existingSha
  if (!currentSha) {
    try {
      const existing = await githubRequest(`/contents/${filePath}`, {}, env)
      currentSha = existing.sha
    } catch {}
  }

  const putBody = { message: prTitle, content: encodeGitHubContent(yamlContent), branch: branchName }
  if (currentSha) putBody.sha = currentSha
  await githubRequest(`/contents/${filePath}`, { method: 'PUT', body: JSON.stringify(putBody) }, env)

  const pr = await githubRequest('/pulls', {
    method: 'POST',
    body: JSON.stringify({
      title: prTitle,
      body: `Auto-generated by the Freedom Hunt location editor.\n\nFile: \`${filePath}\``,
      head: branchName,
      base: 'main',
    }),
  }, env)
  return { prUrl: pr.html_url, prNumber: pr.number, branchName }
}

// GitHub uses state "closed" for both merged and rejected PRs.
export async function fetchPRStatuses(numbers, env) {
  const statuses = {}
  await Promise.all(numbers.map(async n => {
    const pr = await githubRequest(`/pulls/${n}`, {}, env)
    statuses[n] = pr.state
  }))
  return statuses
}
```

- [ ] **Step 4: Run unit tests to verify they pass**

```
npm run test -- src/test/worker.github.test.js
```

Expected: all tests pass.

---

- [ ] **Step 5: Update `src/worker.js` to use the new module**

Add import at the top of `src/worker.js`:
```js
import { fetchLocations, fetchLocation, createLocationPR, fetchPRStatuses } from './worker/github.js'
```

Remove the now-duplicate inline functions from `src/worker.js`: `githubRequest`, `decodeGitHubContent`, `encodeGitHubContent`, and `createLocationPR`.

Replace the inline route logic for the three editor GET routes and the PR status route:

**`GET /editor/locations`** — replace the try body:
```js
// was: const dirPath = ...; const files = await githubRequest(...); ...
// becomes:
const locations = await fetchLocations(project, city, env)
return json({ ok: true, locations: locations.sort((a, b) => (a.location.locationId ?? 0) - (b.location.locationId ?? 0)) })
```

**`GET /editor/location`** — replace the try body:
```js
// was: const filePath = ...; const fileData = await githubRequest(...); ...
// becomes:
const { filename: name, sha, location } = await fetchLocation(project, city, file, env)
return json({ ok: true, filename: name, sha, location })
```

**`GET /editor/pr-status`** — replace the try body:
```js
// was: const statuses = {}; await Promise.all(numbers.map(...)); ...
// becomes:
const statuses = await fetchPRStatuses(numbers, env)
return json({ ok: true, statuses })
```

**`POST /editor/location`** — `createLocationPR` is already imported; the call remains the same.

- [ ] **Step 6: Run the full test suite**

```
npm run test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```
git add src/worker/github.js src/test/worker.github.test.js src/worker.js
git commit -m "refactor: extract GitHub utilities to src/worker/github.js"
```
