# Task 06: Dashboard React Page

> Part of [2026-05-02-dashboard.md](2026-05-02-dashboard.md)

**Goal:** Add a `/admin` route to the app showing the organiser dashboard — a summary of submission counts and a table of all team submissions with inline photo thumbnails. Protected by `AdminRoute` from Task 03.

**Photo-to-submission matching:** R2 keys use the format `{safeTeam}--{routeId}--{locationId}--{timestamp}.ext` (from Task 01). To find whether a submission row has a photo, build a lookup prefix `{safeTeam}--{routeId}--{locationId}--` and search the photo list. The `sanitizeName` helper used to build the R2 key is in the Worker and is not available on the client — redefine it inline in `DashboardPage.jsx` (it's a one-liner).

**Files:**
- Create: `src/pages/DashboardPage.jsx`
- Create: `src/pages/DashboardPage.css`
- Modify: `src/App.jsx` — import `AdminRoute` and `DashboardPage`, add `/admin` route

---

- [ ] **Step 1: Create `src/pages/DashboardPage.css`**

```css
/* src/pages/DashboardPage.css */

.dashboard {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;
  background: var(--color-background);
  min-height: 100vh;
}

.dashboard__title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  margin-bottom: 24px;
  color: var(--color-text);
}

.dashboard__stats {
  display: flex;
  gap: 16px;
  margin-bottom: 32px;
  flex-wrap: wrap;
}

.dashboard__stat {
  flex: 1;
  min-width: 100px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  text-align: center;
}

.dashboard__stat-value {
  display: block;
  font-size: var(--font-size-3xl);
  font-weight: 700;
  color: var(--color-accent);
}

.dashboard__stat-label {
  display: block;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-top: 4px;
}

.dashboard__table-wrap {
  overflow-x: auto;
}

.dashboard__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.dashboard__table th,
.dashboard__table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
}

.dashboard__table th {
  font-weight: 600;
  background: var(--color-surface);
}

.dashboard__table tr:hover td {
  background: var(--color-surface);
}

.dashboard__thumb {
  display: block;
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 4px;
  cursor: pointer;
}

.dashboard__loading,
.dashboard__error {
  padding: 24px;
  color: var(--color-text-secondary);
}
```

- [ ] **Step 2: Create `src/pages/DashboardPage.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { useTitleBar } from '../theme/TitleBarContext'
import './DashboardPage.css'

function sanitizeName(str) {
  return String(str).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
}

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useTitleBar({ title: 'Dashboard', progress: null, backPath: '/' })

  useEffect(() => {
    fetch('/admin/submissions')
      .then(r => r.json())
      .then(d => {
        if (d.ok) setData(d)
        else setError('Failed to load data')
      })
      .catch(() => setError('Failed to load submissions'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="dashboard__loading">Loading…</div>
  if (error) return <div className="dashboard__error">{error}</div>

  const { submissions, photos } = data
  const uniqueTeams = new Set(submissions.map(s => s.teamName)).size

  function findPhoto(teamName, routeId, locationId) {
    const prefix = `${sanitizeName(teamName)}--${routeId}--${locationId}--`
    return photos.find(k => k.startsWith(prefix)) ?? null
  }

  return (
    <div className="dashboard">
      <h1 className="dashboard__title">Organiser Dashboard</h1>

      <div className="dashboard__stats">
        <div className="dashboard__stat">
          <span className="dashboard__stat-value">{uniqueTeams}</span>
          <span className="dashboard__stat-label">Teams</span>
        </div>
        <div className="dashboard__stat">
          <span className="dashboard__stat-value">{submissions.length}</span>
          <span className="dashboard__stat-label">Submissions</span>
        </div>
        <div className="dashboard__stat">
          <span className="dashboard__stat-value">{photos.length}</span>
          <span className="dashboard__stat-label">Photos</span>
        </div>
      </div>

      <div className="dashboard__table-wrap">
        <table className="dashboard__table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Route</th>
              <th>Location</th>
              <th>Time</th>
              <th>Photo</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((row, i) => {
              const photoKey = findPhoto(row.teamName, row.routeId, row.locationId)
              return (
                <tr key={i}>
                  <td>{row.teamName || '—'}</td>
                  <td>{row.routeId || '—'}</td>
                  <td>{row.locationId || '—'}</td>
                  <td>{row.timestamp ? new Date(row.timestamp).toLocaleString() : '—'}</td>
                  <td>
                    {photoKey
                      ? <img src={`/photo/${photoKey}`} alt="" className="dashboard__thumb" />
                      : '—'
                    }
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add the `/admin` route to `src/App.jsx`**

Add the two imports after the existing page imports:

```jsx
import AdminRoute from './auth/AdminRoute'
import DashboardPage from './pages/DashboardPage'
```

Add the route inside `<Routes>`, after the existing routes:

```jsx
<Route path="/admin" element={<AdminRoute><DashboardPage /></AdminRoute>} />
```

- [ ] **Step 4: Manually verify in the browser**

1. Set the admin KV key in the local dev store (run once):
   ```
   wrangler kv key put --binding=AUTH_STORE "admin:democrats_abroad" "adminpass" --local
   ```
2. `npm run dev` (or `wrangler dev` if testing the Worker separately)
3. Navigate to `http://localhost:5173/login/democrats_abroad`
4. Log in with the admin password
5. Navigate to `http://localhost:5173/admin`
6. Confirm the dashboard loads, stats show, table renders (may be empty if no local submissions)
7. Confirm that logging in with a participant password and navigating to `/admin` redirects to `/`

- [ ] **Step 5: Commit**

```
git add src/pages/DashboardPage.jsx src/pages/DashboardPage.css src/App.jsx
git commit -m "feat: add organiser dashboard at /admin with submission table and photo thumbnails"
```
