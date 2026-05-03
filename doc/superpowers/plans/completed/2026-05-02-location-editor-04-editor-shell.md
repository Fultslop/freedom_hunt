# Task 04: Editor Shell — Login, Landing, Routing

Status: Completed

> Part of [2026-05-02-location-editor.md](2026-05-02-location-editor.md)

**Goal:** Add the `/editor` subtree to the app: a dedicated login page (no team/contact fields), a landing page with three tiles (City and Route are placeholders; Location is active), and the React Router routes that wire them together.

**Files:**
- Create: `src/pages/editor/EditorLoginPage.jsx` + `EditorLoginPage.css`
- Create: `src/pages/editor/EditorPage.jsx` + `EditorPage.css`
- Modify: `src/App.jsx` — import new pages + AdminRoute, add `/editor/login` and `/editor` routes

**Note:** `src/pages/editor/` is a new directory. No index file needed — all imports are explicit.

---

- [ ] **Step 1: Create `src/pages/editor/EditorLoginPage.css`**

```css
/* src/pages/editor/EditorLoginPage.css */

.editor-login {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  background: var(--color-background);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  box-sizing: border-box;
}

.editor-login__header {
  text-align: center;
  margin-bottom: 28px;
}

.editor-login__eyebrow {
  font-size: var(--font-size-sm);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-accent);
  margin-bottom: 6px;
}

.editor-login__headline {
  font-size: 20px;
  font-weight: 800;
  color: var(--color-text);
}

.editor-login__form {
  width: 100%;
  max-width: 300px;
}

.editor-login__field {
  margin-bottom: 12px;
}

.editor-login__field--last {
  margin-bottom: 20px;
}

.editor-login__field--last-error {
  margin-bottom: 8px;
}

.editor-login__label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.editor-login__input {
  display: block;
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  font-size: var(--font-size-base);
  color: var(--color-text);
  box-sizing: border-box;
}

.editor-login__input--error {
  border-color: var(--color-accent);
}

.editor-login__error {
  font-size: 12px;
  color: var(--color-accent);
  font-weight: 600;
  margin-bottom: 16px;
}

.editor-login__submit {
  width: 100%;
  padding: 12px;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.editor-login__submit--loading {
  opacity: 0.7;
  cursor: default;
}
```

- [ ] **Step 2: Create `src/pages/editor/EditorLoginPage.jsx`**

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import './EditorLoginPage.css'

export default function EditorLoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [project, setProject] = useState('democrats_abroad')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, teamName: '', contact: '', password }),
      })
      const data = await res.json()
      if (data.ok && data.isAdmin) {
        login(project, '', '', true)
        navigate('/editor')
      } else if (data.ok && !data.isAdmin) {
        setError('These credentials do not have organiser access.')
      } else {
        setError(data.error || 'Incorrect password.')
      }
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="editor-login">
      <div className="editor-login__header">
        <div className="editor-login__eyebrow">Organiser tools</div>
        <div className="editor-login__headline">Sign in</div>
      </div>
      <form onSubmit={handleSubmit} className="editor-login__form">
        <div className="editor-login__field">
          <label className="editor-login__label">Project</label>
          <input
            value={project}
            onChange={e => setProject(e.target.value)}
            required
            className="editor-login__input"
          />
        </div>
        <div className={error ? 'editor-login__field--last-error' : 'editor-login__field--last'}>
          <label className="editor-login__label">Admin password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className={`editor-login__input${error ? ' editor-login__input--error' : ''}`}
          />
        </div>
        {error && <div className="editor-login__error">✕ {error}</div>}
        <button
          type="submit"
          disabled={loading}
          className={`editor-login__submit${loading ? ' editor-login__submit--loading' : ''}`}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/pages/editor/EditorPage.css`**

```css
/* src/pages/editor/EditorPage.css */

.editor-page {
  max-width: 480px;
  margin: 0 auto;
  padding: 24px;
  background: var(--color-background);
  min-height: 100vh;
}

.editor-page__title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 6px;
}

.editor-page__subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: 32px;
}

.editor-page__tiles {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.editor-page__tile {
  display: block;
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  text-decoration: none;
  cursor: pointer;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.editor-page__tile:hover:not(.editor-page__tile--disabled) {
  border-color: var(--color-accent);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
}

.editor-page__tile--disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.editor-page__tile-name {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text);
}

.editor-page__tile-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-top: 4px;
}

.editor-page__tile-tag {
  display: inline-block;
  margin-top: 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  background: var(--color-border);
  padding: 2px 8px;
  border-radius: 4px;
}
```

- [ ] **Step 4: Create `src/pages/editor/EditorPage.jsx`**

```jsx
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useTitleBar } from '../../theme/TitleBarContext'
import './EditorPage.css'

export default function EditorPage() {
  const { activeAuth } = useAuth()
  useTitleBar({ title: 'Editor', progress: null, backPath: null })

  const project = activeAuth?.projectId ?? 'democrats_abroad'

  return (
    <div className="editor-page">
      <h1 className="editor-page__title">Organiser tools</h1>
      <p className="editor-page__subtitle">{project.replace(/_/g, ' ')}</p>

      <div className="editor-page__tiles">
        <div className="editor-page__tile editor-page__tile--disabled">
          <div className="editor-page__tile-name">Cities</div>
          <div className="editor-page__tile-desc">Add or edit city entries</div>
          <span className="editor-page__tile-tag">Coming soon</span>
        </div>

        <div className="editor-page__tile editor-page__tile--disabled">
          <div className="editor-page__tile-name">Routes</div>
          <div className="editor-page__tile-desc">Define which locations belong to each route</div>
          <span className="editor-page__tile-tag">Coming soon</span>
        </div>

        <Link
          to={`/editor/locations/${project}/den_haag`}
          className="editor-page__tile"
        >
          <div className="editor-page__tile-name">Locations</div>
          <div className="editor-page__tile-desc">Add, edit, or hide individual hunt locations</div>
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Update `src/App.jsx`**

Add three imports after the existing page imports:

```jsx
import AdminRoute from './auth/AdminRoute'
import EditorLoginPage from './pages/editor/EditorLoginPage'
import EditorPage from './pages/editor/EditorPage'
```

Add two routes inside `<Routes>`, after the existing routes:

```jsx
<Route path="/editor/login" element={<EditorLoginPage />} />
<Route path="/editor" element={<AdminRoute><EditorPage /></AdminRoute>} />
```

- [ ] **Step 6: Manually verify in the browser**

1. `npm run dev`
2. Navigate to `http://localhost:5173/editor/login`
3. Enter `democrats_abroad` and your local admin password (set in `.dev.vars` or local KV)
4. Confirm you are redirected to `/editor`
5. Confirm the three tiles render — Cities and Routes are greyed out / "Coming soon"
6. Confirm the Locations tile is clickable (it will 404 at `/editor/locations/...` — that's fine, the list page is built in Task 05)
7. Navigate to `/editor` without logging in — confirm you are redirected to `/`

- [ ] **Step 7: Commit**

```
git add src/pages/editor/EditorLoginPage.jsx src/pages/editor/EditorLoginPage.css src/pages/editor/EditorPage.jsx src/pages/editor/EditorPage.css src/App.jsx
git commit -m "feat: add editor login page and landing shell"
```
