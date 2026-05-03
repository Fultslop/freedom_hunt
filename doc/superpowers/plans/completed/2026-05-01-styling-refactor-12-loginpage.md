# Task 12 — LoginPage: remove `<style>` tag, inline styles → className

**Depends on:** [Task 02 — App wiring](2026-05-01-styling-refactor-02-app-wiring.md)
**Next:** [Task 13 — CLAUDE.md](2026-05-01-styling-refactor-13-claude-md.md)

**Files:**
- Create: `src/pages/LoginPage.css`
- Modify: `src/pages/LoginPage.jsx`

The password input border changes colour on error — it currently uses `theme.accent` for the error state. After migration this is expressed via a modifier class and CSS `var(--color-accent)`.

---

- [ ] **Step 1: Create `src/pages/LoginPage.css`**

```css
/* src/pages/LoginPage.css */

.login-page {
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

.login-page__header {
  text-align: center;
  margin-bottom: 28px;
}

.login-page__project {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-accent);
  margin-bottom: 6px;
}

.login-page__headline {
  font-size: 20px;
  font-weight: 800;
  color: var(--color-text);
  margin-bottom: 6px;
}

.login-page__subtext {
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.5;
}

.login-page__form {
  width: 100%;
  max-width: 300px;
}

.login-page__field {
  margin-bottom: 12px;
}

.login-page__field--last {
  margin-bottom: 20px;
}

.login-page__field--last-error {
  margin-bottom: 8px;
}

.login-page__label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.login-page__label-note {
  font-weight: 400;
  color: var(--color-text-muted);
}

.login-page__input {
  display: block;
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  font-size: 13px;
  color: var(--color-text);
  box-sizing: border-box;
}

.login-page__input--error {
  border-color: var(--color-accent);
}

.login-page__error {
  font-size: 12px;
  color: var(--color-accent);
  font-weight: 600;
  margin-bottom: 16px;
}

.login-page__submit {
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

.login-page__submit--loading {
  opacity: 0.7;
  cursor: default;
}
```

- [ ] **Step 2: Rewrite `src/pages/LoginPage.jsx`**

```jsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTheme } from '../theme/ThemeContext'
import { useAuth } from '../auth/AuthContext'
import './LoginPage.css'

export default function LoginPage() {
  const { project } = useParams()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const { login } = useAuth()
  const [teamName, setTeamName] = useState('')
  const [contact, setContact] = useState('')
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
        body: JSON.stringify({ project, teamName, contact, password }),
      })
      const data = await res.json()
      if (data.ok) {
        login(project, data.teamName, data.contact)
        navigate(`/${project}`)
      } else {
        setError(data.error || 'Incorrect password. Please try again.')
      }
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__header">
        <div className="login-page__project">
          {project.replace(/_/g, ' ')}
        </div>
        <div className="login-page__headline">Join the Hunt</div>
        <div className="login-page__subtext">
          Enter your team details and the password<br />shared by your event organizer.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="login-page__form">
        <div className="login-page__field">
          <label className="login-page__label">
            Team name
          </label>
          <input
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            required
            placeholder="Your team name"
            className="login-page__input"
          />
        </div>

        <div className="login-page__field">
          <label className="login-page__label">
            Contact email <span className="login-page__label-note">(optional)</span>
          </label>
          <input
            type="email"
            value={contact}
            onChange={e => setContact(e.target.value)}
            placeholder="you@example.com"
            className="login-page__input"
          />
        </div>

        <div className={error ? 'login-page__field--last-error' : 'login-page__field--last'}>
          <label className="login-page__label">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            placeholder="Event password"
            className={`login-page__input${error ? ' login-page__input--error' : ''}`}
          />
        </div>

        {error && (
          <div className="login-page__error">✕ {error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`login-page__submit${loading ? ' login-page__submit--loading' : ''}`}
        >
          {loading ? 'Joining…' : 'Join the Hunt'}
        </button>
      </form>
    </div>
  )
}
```

Note: `useTheme` import is kept because `theme` is still used in the loading and error message logic for... actually looking at the code, after migration `theme` is no longer used in this component at all. Remove the `useTheme` import.

Corrected — remove these two lines:
```jsx
import { useTheme } from '../theme/ThemeContext'
// and
const { theme } = useTheme()
```

Final import section:
```jsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import './LoginPage.css'
```

- [ ] **Step 3: Run the test suite**

```
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Visual smoke test**

Navigate to `/login/democrats_abroad`. Verify:
- Form renders correctly in all themes
- Submitting with no password turns the input border to accent colour
- Error message appears in accent colour
- Button uses accent background

- [ ] **Step 5: Commit**

```
git add src/pages/LoginPage.css src/pages/LoginPage.jsx
git commit -m "refactor: migrate LoginPage to className + remove style reset tag"
```
