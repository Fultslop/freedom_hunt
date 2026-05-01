# Task 07 — LoginPage

**Files:**
- Create: `src/pages/LoginPage.jsx`
- Create: `src/test/LoginPage.test.jsx`

---

- [ ] **Step 1: Write the failing tests**

Create `src/test/LoginPage.test.jsx`:

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import LoginPage from '../pages/LoginPage'
import { ThemeProvider } from '../theme/ThemeContext'

vi.mock('../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '../auth/AuthContext'

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
  useAuth.mockReturnValue({ login: vi.fn() })
})

function wrap() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/test_project']}>
        <Routes>
          <Route path="/:project" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  )
}

test('renders team name, contact, and password fields', () => {
  wrap()
  expect(screen.getByPlaceholderText('Your team name')).toBeInTheDocument()
  expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
  expect(screen.getByPlaceholderText('Event password')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /join the hunt/i })).toBeInTheDocument()
})

test('shows Joining… and disables button while loading', async () => {
  fetch.mockReturnValue(new Promise(() => {}))
  wrap()
  fireEvent.change(screen.getByPlaceholderText('Your team name'), { target: { value: 'Team A' } })
  fireEvent.change(screen.getByPlaceholderText('Event password'), { target: { value: 'secret' } })
  fireEvent.click(screen.getByRole('button', { name: /join the hunt/i }))
  await waitFor(() => expect(screen.getByRole('button', { name: /joining/i })).toBeDisabled())
})

test('shows error message on failed login', async () => {
  fetch.mockResolvedValue({ json: async () => ({ ok: false, error: 'Incorrect password' }) })
  wrap()
  fireEvent.change(screen.getByPlaceholderText('Your team name'), { target: { value: 'Team A' } })
  fireEvent.change(screen.getByPlaceholderText('Event password'), { target: { value: 'wrong' } })
  fireEvent.click(screen.getByRole('button', { name: /join the hunt/i }))
  await waitFor(() => expect(screen.getByText(/incorrect password/i)).toBeInTheDocument())
})

test('shows rate limit message on 429', async () => {
  fetch.mockResolvedValue({ json: async () => ({ ok: false, error: 'Too many attempts. Please wait a moment.' }) })
  wrap()
  fireEvent.change(screen.getByPlaceholderText('Your team name'), { target: { value: 'Team A' } })
  fireEvent.change(screen.getByPlaceholderText('Event password'), { target: { value: 'wrong' } })
  fireEvent.click(screen.getByRole('button', { name: /join the hunt/i }))
  await waitFor(() => expect(screen.getByText(/too many attempts/i)).toBeInTheDocument())
})

test('calls login() with projectId, teamName, and contact on success', async () => {
  const loginMock = vi.fn()
  useAuth.mockReturnValue({ login: loginMock })
  fetch.mockResolvedValue({ json: async () => ({ ok: true, teamName: 'Team A', contact: 'a@b.com' }) })
  wrap()
  fireEvent.change(screen.getByPlaceholderText('Your team name'), { target: { value: 'Team A' } })
  fireEvent.change(screen.getByPlaceholderText('Contact email'), { target: { value: 'a@b.com' } })
  fireEvent.change(screen.getByPlaceholderText('Event password'), { target: { value: 'secret' } })
  fireEvent.click(screen.getByRole('button', { name: /join the hunt/i }))
  await waitFor(() => expect(loginMock).toHaveBeenCalledWith('test_project', 'Team A', 'a@b.com'))
})

test('shows connection error when fetch throws', async () => {
  fetch.mockRejectedValue(new Error('Network error'))
  wrap()
  fireEvent.change(screen.getByPlaceholderText('Your team name'), { target: { value: 'Team A' } })
  fireEvent.change(screen.getByPlaceholderText('Event password'), { target: { value: 'secret' } })
  fireEvent.click(screen.getByRole('button', { name: /join the hunt/i }))
  await waitFor(() => expect(screen.getByText(/connection error/i)).toBeInTheDocument())
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/test/LoginPage.test.jsx
```

Expected: all 6 tests FAIL (module not found).

- [ ] **Step 3: Create src/pages/LoginPage.jsx**

```jsx
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTheme } from '../theme/ThemeContext'
import { useAuth } from '../auth/AuthContext'

const STYLE_RESET = `html, body, #root { margin: 0; padding: 0; }`

export default function LoginPage() {
  const { project } = useParams()
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
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: theme.background, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', boxSizing: 'border-box' }}>
      <style>{STYLE_RESET}</style>

      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.accent, marginBottom: 6 }}>
          {project.replace(/_/g, ' ')}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: theme.text, marginBottom: 6 }}>Join the Hunt</div>
        <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.5 }}>
          Enter your team details and the password<br />shared by your event organizer.
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 300 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: theme.text, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Team name
          </label>
          <input
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            required
            placeholder="Your team name"
            style={{ display: 'block', width: '100%', padding: '10px 12px', border: `1.5px solid ${theme.border}`, borderRadius: 6, background: theme.surface, fontSize: 13, color: theme.text, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: theme.text, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Contact email <span style={{ fontWeight: 400, color: theme.textMuted }}>(optional)</span>
          </label>
          <input
            type="email"
            value={contact}
            onChange={e => setContact(e.target.value)}
            placeholder="you@example.com"
            style={{ display: 'block', width: '100%', padding: '10px 12px', border: `1.5px solid ${theme.border}`, borderRadius: 6, background: theme.surface, fontSize: 13, color: theme.text, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: error ? 8 : 20 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: theme.text, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            placeholder="Event password"
            style={{ display: 'block', width: '100%', padding: '10px 12px', border: `1.5px solid ${error ? theme.accent : theme.border}`, borderRadius: 6, background: error ? '#fff8f8' : theme.surface, fontSize: 13, color: theme.text, boxSizing: 'border-box' }}
          />
        </div>

        {error && (
          <div style={{ fontSize: 12, color: theme.accent, fontWeight: 600, marginBottom: 16 }}>
            ✕ {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: 12, background: theme.accent, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Joining…' : 'Join the Hunt'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/test/LoginPage.test.jsx
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/LoginPage.jsx src/test/LoginPage.test.jsx
git commit -m "feat: add LoginPage component (cookie-based auth)"
```
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: 12, background: theme.accent, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Joining…' : 'Join the Hunt'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/test/LoginPage.test.jsx
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/LoginPage.jsx src/test/LoginPage.test.jsx
git commit -m "feat: add LoginPage component"
```
