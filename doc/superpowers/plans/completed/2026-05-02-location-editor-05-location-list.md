# Task 05: Location List

Status: Completed

> Part of [2026-05-02-location-editor.md](2026-05-02-location-editor.md)

**Goal:** A page at `/editor/locations/:project/:city` that shows all location files fetched from GitHub, with a "Pending edit" badge on any that have a locally stored PR from a previous session. Each row has Edit, Hide, and (for new locations only) a Delete badge. A Refresh button re-fetches from GitHub.

**localStorage schema:**

```js
// Key: `editor_pending_${project}_${city}`
// Value: JSON array of:
[
  {
    filename: '001_loc_binnenhof.yaml',
    locationTitle: 'The Final Civic Act',
    prUrl: 'https://github.com/owner/repo/pull/5',
    prTitle: 'Edit location: The Final Civic Act',
    submittedAt: '2026-05-02T12:00:00Z',
  }
]
```

**Files:**
- Create: `src/pages/editor/editorStorage.js` — localStorage read/write helpers
- Create: `src/pages/editor/EditorLocationList.jsx` + `EditorLocationList.css`
- Modify: `src/App.jsx` — add route for the list page

---

- [ ] **Step 1: Create `src/pages/editor/editorStorage.js`**

```js
const PREFIX = 'editor_pending_'

export function getPending(project, city) {
  try {
    const raw = localStorage.getItem(`${PREFIX}${project}_${city}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addPending(project, city, entry) {
  const current = getPending(project, city)
  const without = current.filter(e => e.filename !== entry.filename)
  localStorage.setItem(`${PREFIX}${project}_${city}`, JSON.stringify([...without, entry]))
}

export function removePending(project, city, filename) {
  const current = getPending(project, city)
  localStorage.setItem(
    `${PREFIX}${project}_${city}`,
    JSON.stringify(current.filter(e => e.filename !== filename))
  )
}
```

- [ ] **Step 2: Create `src/pages/editor/EditorLocationList.css`**

```css
/* src/pages/editor/EditorLocationList.css */

.loc-list {
  max-width: 480px;
  margin: 0 auto;
  padding: 24px;
  background: var(--color-background);
  min-height: 100vh;
}

.loc-list__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.loc-list__add-btn,
.loc-list__refresh-btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  border: none;
}

.loc-list__add-btn {
  background: var(--color-accent);
  color: #fff;
}

.loc-list__refresh-btn {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.loc-list__item {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 10px;
  background: var(--color-surface);
}

.loc-list__item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.loc-list__item-title {
  font-weight: 600;
  font-size: var(--font-size-base);
  color: var(--color-text);
}

.loc-list__item-meta {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.loc-list__item-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.loc-list__btn {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
}

.loc-list__btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.loc-list__btn--danger:hover {
  border-color: #c0392b;
  color: #c0392b;
}

.loc-list__pending {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #e67e22;
  background: #fef3e2;
  padding: 3px 8px;
  border-radius: 4px;
  text-decoration: none;
}

.loc-list__pending:hover {
  text-decoration: underline;
}

.loc-list__error {
  padding: 16px;
  color: var(--color-accent);
  font-size: var(--font-size-sm);
}

.loc-list__loading {
  padding: 16px;
  color: var(--color-text-secondary);
}
```

- [ ] **Step 3: Create `src/pages/editor/EditorLocationList.jsx`**

```jsx
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTitleBar } from '../../theme/TitleBarContext'
import { getPending, addPending } from './editorStorage'
import './EditorLocationList.css'

export default function EditorLocationList() {
  const { project, city } = useParams()
  const navigate = useNavigate()
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState([])

  useTitleBar({ title: 'Locations', progress: null, backPath: '/editor' })

  const fetchLocations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/editor/locations?project=${project}&city=${city}`)
      const data = await res.json()
      if (data.ok) {
        setLocations(data.locations.sort((a, b) => (a.location.locationId ?? 0) - (b.location.locationId ?? 0)))
      } else {
        setError(data.error ?? 'Failed to load locations')
      }
    } catch {
      setError('Failed to load locations')
    } finally {
      setLoading(false)
    }
  }, [project, city])

  useEffect(() => {
    fetchLocations()
    setPending(getPending(project, city))
  }, [fetchLocations, project, city])

  async function handleHide(loc, sha) {
    if (!window.confirm(`Hide "${loc.title}"? This will open a PR setting hidden: true.`)) return
    const { _filename, ...cleanLoc } = loc
    try {
      const res = await fetch('/editor/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project,
          city,
          filename: _filename,
          existingSha: sha,
          location: { ...cleanLoc, hidden: true },
        }),
      })
      const data = await res.json()
      if (data.ok) {
        addPending(project, city, {
          filename: loc._filename,
          locationTitle: loc.title,
          prUrl: data.prUrl,
          prTitle: `Hide location: ${loc.title}`,
          submittedAt: new Date().toISOString(),
        })
        setPending(getPending(project, city))
      } else {
        alert(`Failed: ${data.error}`)
      }
    } catch {
      alert('Request failed.')
    }
  }

  function pendingFor(filename) {
    return pending.find(p => p.filename === filename)
  }

  if (loading) return <div className="loc-list__loading">Loading…</div>
  if (error) return <div className="loc-list__error">{error}</div>

  return (
    <div className="loc-list">
      <div className="loc-list__toolbar">
        <button
          className="loc-list__add-btn"
          onClick={() => navigate(`/editor/locations/${project}/${city}/new`)}
        >
          + Add location
        </button>
        <button className="loc-list__refresh-btn" onClick={fetchLocations}>
          Refresh
        </button>
      </div>

      {locations.map(({ filename, sha, location }) => {
        const pend = pendingFor(filename)
        return (
          <div key={filename} className="loc-list__item">
            <div className="loc-list__item-header">
              <div>
                <div className="loc-list__item-title">{location.title || filename}</div>
                <div className="loc-list__item-meta">
                  {location.address || `ID: ${location.locationId}`}
                </div>
              </div>
              <div className="loc-list__item-actions">
                <button
                  className="loc-list__btn"
                  onClick={() => navigate(`/editor/locations/${project}/${city}/edit/${filename}`)}
                >
                  Edit
                </button>
                <button
                  className="loc-list__btn loc-list__btn--danger"
                  onClick={() => handleHide({ ...location, _filename: filename }, sha)}
                >
                  Hide
                </button>
              </div>
            </div>
            {pend && (
              <a href={pend.prUrl} target="_blank" rel="noopener noreferrer" className="loc-list__pending">
                ⏳ Pending edit — view PR
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Add the route to `src/App.jsx`**

Add an import:

```jsx
import EditorLocationList from './pages/editor/EditorLocationList'
```

Add a route inside `<Routes>` after the `/editor` route:

```jsx
<Route path="/editor/locations/:project/:city" element={<AdminRoute><EditorLocationList /></AdminRoute>} />
```

- [ ] **Step 5: Manually verify in the browser**

1. `npm run dev` and log in as admin at `/editor/login`
2. Click the Locations tile → confirm the list loads and shows the Den Haag locations
3. Each item shows title + address, Edit button, Hide button
4. Click Refresh — list reloads
5. Click Hide on any location → confirm modal appears → confirm a PR is created (check GitHub)
6. After hiding, confirm the "Pending edit — view PR" badge appears on that item
7. Reload the page — confirm the badge is still there (read from localStorage)

- [ ] **Step 6: Commit**

```
git add src/pages/editor/editorStorage.js src/pages/editor/EditorLocationList.jsx src/pages/editor/EditorLocationList.css src/App.jsx
git commit -m "feat: add location list with pending PR overlay"
```
