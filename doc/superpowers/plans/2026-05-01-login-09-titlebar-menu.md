# Task 09 — TitleBar: drill-down menu

**Files:**
- Modify: `src/components/TitleBar.jsx`
- Modify: `src/test/TitleBar.test.jsx`

---

- [ ] **Step 1: Update the TitleBar tests**

Replace the full contents of `src/test/TitleBar.test.jsx` with:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { ThemeProvider } from '../theme/ThemeContext'
import { TitleBarProvider, useTitleBar } from '../theme/TitleBarContext'
import TitleBar from '../components/TitleBar'

vi.mock('../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '../auth/AuthContext'

function Wrapper({ children }) {
  return (
    <MemoryRouter>
      <ThemeProvider>
        <TitleBarProvider>
          {children}
        </TitleBarProvider>
      </ThemeProvider>
    </MemoryRouter>
  )
}

function Setup({ config }) {
  useTitleBar(config)
  return <TitleBar />
}

const base = { title: 'Test', progress: null, backPath: null }

beforeEach(() => {
  vi.clearAllMocks()
  useAuth.mockReturnValue({ activeAuth: null, logout: vi.fn() })
})

test('renders title', () => {
  render(<Wrapper><Setup config={{ title: 'Peace Palace', progress: null, backPath: null }} /></Wrapper>)
  expect(screen.getByText('Peace Palace')).toBeInTheDocument()
})

test('renders back button when backPath is set', () => {
  render(<Wrapper><Setup config={{ ...base, backPath: '/foo' }} /></Wrapper>)
  expect(screen.getByLabelText('Back')).toBeInTheDocument()
})

test('hides back button when backPath is null', () => {
  render(<Wrapper><Setup config={base} /></Wrapper>)
  expect(screen.queryByLabelText('Back')).not.toBeInTheDocument()
})

test('renders progress bar when progress is set', () => {
  render(<Wrapper><Setup config={{ ...base, progress: { current: 2, total: 3 } }} /></Wrapper>)
  expect(screen.getByTestId('progress-bar')).toBeInTheDocument()
})

test('hides progress bar when progress is null', () => {
  render(<Wrapper><Setup config={base} /></Wrapper>)
  expect(screen.queryByTestId('progress-bar')).not.toBeInTheDocument()
})

test('opens menu showing Profile and Themes items', () => {
  render(<Wrapper><Setup config={base} /></Wrapper>)
  fireEvent.click(screen.getByLabelText('Menu'))
  expect(screen.getByText('Profile')).toBeInTheDocument()
  expect(screen.getByText('Themes')).toBeInTheDocument()
})

test('clicking Themes drills into theme list', () => {
  render(<Wrapper><Setup config={base} /></Wrapper>)
  fireEvent.click(screen.getByLabelText('Menu'))
  fireEvent.click(screen.getByText('Themes'))
  expect(screen.getByText('wireframe')).toBeInTheDocument()
  expect(screen.getByText('app')).toBeInTheDocument()
  expect(screen.getByText('GWC')).toBeInTheDocument()
})

test('clicking back in Themes returns to root menu', () => {
  render(<Wrapper><Setup config={base} /></Wrapper>)
  fireEvent.click(screen.getByLabelText('Menu'))
  fireEvent.click(screen.getByText('Themes'))
  fireEvent.click(screen.getByLabelText('Back to menu'))
  expect(screen.getByText('Profile')).toBeInTheDocument()
  expect(screen.queryByText('wireframe')).not.toBeInTheDocument()
})

test('selecting a theme closes the menu', () => {
  render(<Wrapper><Setup config={base} /></Wrapper>)
  fireEvent.click(screen.getByLabelText('Menu'))
  fireEvent.click(screen.getByText('Themes'))
  fireEvent.click(screen.getByText('wireframe'))
  expect(screen.queryByText('Profile')).not.toBeInTheDocument()
})

test('clicking Profile drills into profile view', () => {
  useAuth.mockReturnValue({ activeAuth: { projectId: 'test', teamName: 'Team A', contact: 'a@b.com' }, logout: vi.fn() })
  render(<Wrapper><Setup config={base} /></Wrapper>)
  fireEvent.click(screen.getByLabelText('Menu'))
  fireEvent.click(screen.getByText('Profile'))
  expect(screen.getByText('Team A')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
})

test('clicking back in Profile returns to root menu', () => {
  render(<Wrapper><Setup config={base} /></Wrapper>)
  fireEvent.click(screen.getByLabelText('Menu'))
  fireEvent.click(screen.getByText('Profile'))
  fireEvent.click(screen.getByLabelText('Back to menu'))
  expect(screen.getByText('Themes')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument()
})

test('sign out calls logout and closes menu', () => {
  const logoutMock = vi.fn()
  useAuth.mockReturnValue({ activeAuth: { projectId: 'test', teamName: 'Team A', contact: '' }, logout: logoutMock })
  render(<Wrapper><Setup config={base} /></Wrapper>)
  fireEvent.click(screen.getByLabelText('Menu'))
  fireEvent.click(screen.getByText('Profile'))
  fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
  expect(logoutMock).toHaveBeenCalled()
  expect(screen.queryByText('Profile')).not.toBeInTheDocument()
})

test('progress fill is 6px tall', () => {
  render(<Wrapper><Setup config={{ ...base, progress: { current: 2, total: 5 } }} /></Wrapper>)
  expect(screen.getByTestId('progress-bar')).toHaveStyle({ height: '6px' })
})
```

- [ ] **Step 2: Run tests to verify they fail on the old TitleBar**

```bash
npx vitest run src/test/TitleBar.test.jsx
```

Expected: several tests FAIL (aria-label "Menu" not found, "Profile" not found, etc.).

- [ ] **Step 3: Replace src/components/TitleBar.jsx**

```jsx
import { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../theme/ThemeContext'
import { TitleBarContext } from '../theme/TitleBarContext'
import { themes } from '../theme/themes'
import { useAuth } from '../auth/AuthContext'

export default function TitleBar() {
  const { theme, themeName, setThemeName } = useTheme()
  const { titleBar } = useContext(TitleBarContext)
  const { title, progress, backPath } = titleBar
  const { activeAuth, logout } = useAuth()
  const navigate = useNavigate()
  const [menuView, setMenuView] = useState(null) // null | 'root' | 'profile' | 'themes'

  function closeMenu() { setMenuView(null) }

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 100, background: theme.barBackground, borderBottom: `1px solid ${theme.barBorder}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {backPath && (
            <button
              onClick={() => navigate(backPath)}
              aria-label="Back"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.barTextSecondary, fontSize: 18, padding: 0, lineHeight: 1 }}
            >←</button>
          )}
          <span style={{ fontWeight: 700, fontSize: 15, color: theme.barText }}>{title}</span>
        </div>

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuView(v => v ? null : 'root')}
            aria-label="Menu"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.barTextSecondary, fontSize: 18, padding: 4, lineHeight: 1 }}
          >☰</button>

          {menuView && (
            <div style={{ position: 'absolute', right: 0, top: '100%', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, minWidth: 180, zIndex: 200, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', overflow: 'hidden' }}>

              {menuView === 'root' && (
                <>
                  <button
                    onClick={() => setMenuView('profile')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '14px 16px', background: 'transparent', border: 'none', borderBottom: `1px solid ${theme.border}`, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>Profile</span>
                    <span style={{ fontSize: 14, color: theme.textMuted }}>›</span>
                  </button>
                  <button
                    onClick={() => setMenuView('themes')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>Themes</span>
                    <span style={{ fontSize: 14, color: theme.textMuted }}>›</span>
                  </button>
                </>
              )}

              {menuView === 'profile' && (
                <>
                  <button
                    onClick={() => setMenuView('root')}
                    aria-label="Back to menu"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: theme.barBackground, border: 'none', borderBottom: `1px solid ${theme.border}`, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span style={{ fontSize: 14, color: theme.barText }}>‹</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: theme.barText, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Profile</span>
                  </button>
                  <div style={{ padding: 16 }}>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, marginBottom: 2 }}>Team</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{activeAuth?.teamName || '—'}</div>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, marginBottom: 2 }}>Contact</div>
                      <div style={{ fontSize: 13, color: theme.text }}>{activeAuth?.contact || '—'}</div>
                    </div>
                    <button
                      onClick={() => { logout(); closeMenu() }}
                      style={{ width: '100%', padding: 9, background: 'transparent', color: theme.accent, border: `1.5px solid ${theme.accent}`, borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                    >Sign out</button>
                  </div>
                </>
              )}

              {menuView === 'themes' && (
                <>
                  <button
                    onClick={() => setMenuView('root')}
                    aria-label="Back to menu"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: theme.barBackground, border: 'none', borderBottom: `1px solid ${theme.border}`, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span style={{ fontSize: 14, color: theme.barText }}>‹</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: theme.barText, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Themes</span>
                  </button>
                  {Object.keys(themes).map(name => (
                    <button
                      key={name}
                      onClick={() => { setThemeName(name); closeMenu() }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', padding: '12px 14px',
                        background: name === themeName ? theme.accent : 'transparent',
                        color: name === themeName ? '#ffffff' : theme.text,
                        border: 'none', borderTop: `1px solid ${theme.border}`,
                        cursor: 'pointer', fontSize: 13, fontWeight: name === themeName ? 700 : 400,
                      }}
                    >
                      <span>{name}</span>
                      {name === themeName && <span style={{ fontSize: 11 }}>✓</span>}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {progress && (
        <div data-testid="progress-bar" style={{ background: theme.progressTrack, height: 6 }}>
          <div style={{ background: 'linear-gradient(90deg, #f59e0b, #fbbf24)', width: `${(progress.current / progress.total) * 100}%`, height: '100%', transition: 'width 0.2s ease', boxShadow: '0 0 8px rgba(245,158,11,0.5)' }} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run TitleBar tests to verify they pass**

```bash
npx vitest run src/test/TitleBar.test.jsx
```

Expected: all 12 tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/TitleBar.jsx src/test/TitleBar.test.jsx
git commit -m "feat: redesign TitleBar menu with Profile and Themes drill-down"
```
