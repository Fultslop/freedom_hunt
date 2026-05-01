# Task 11: Theme ChallengeCard

State: Completed

**Part of:** [Theming & Title Bar](2026-04-29-theming-titlebar.md)  
**Depends on:** [Task 10 — RoutePage](2026-04-29-theming-10-routepage.md)  
**Next:** nothing — this is the final task

**Files:**
- Modify: `src/components/ChallengeCard.jsx`
- Modify: `src/test/ChallengeCard.test.jsx`

Progress display (`index + 1 / total`) is removed from ChallengeCard — it now lives in the TitleBar progress bar. The `index` and `total` props are dropped. Tests are wrapped in `ThemeProvider` and the stale progress test is removed.

---

- [ ] **Step 1: Replace `src/components/ChallengeCard.jsx`**

```jsx
import { useTheme } from '../theme/ThemeContext'

export default function ChallengeCard({ location }) {
  const { theme } = useTheme()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 24, background: theme.background }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: theme.text }}>{location.title}</h1>

      <p style={{ fontSize: 16, lineHeight: 1.6, margin: 0, color: theme.textSecondary }}>{location.description}</p>

      <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.textMuted, marginBottom: 8 }}>Clue</div>
        <p style={{
          fontSize: 15,
          lineHeight: 1.6,
          margin: 0,
          fontStyle: 'italic',
          color: theme.textSecondary,
          background: theme.clueBackground,
          borderLeft: theme.clueBorderColor !== 'transparent' ? `3px solid ${theme.clueBorderColor}` : 'none',
          padding: theme.clueBackground !== 'transparent' ? '8px 10px' : 0,
        }}>{location.clue}</p>
      </div>

      <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.textMuted, marginBottom: 8 }}>Challenge</div>
        <p style={{ fontSize: 15, lineHeight: 1.6, margin: 0, color: theme.textSecondary }}>{location.challenge}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace `src/test/ChallengeCard.test.jsx`**

```jsx
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '../theme/ThemeContext'
import ChallengeCard from '../components/ChallengeCard'

const location = {
  title: 'Test Location',
  description: 'A historic place.',
  clue: 'Find the plaque.',
  challenge: 'Register to vote.',
}

function Wrapper({ children }) {
  return <ThemeProvider>{children}</ThemeProvider>
}

test('renders title', () => {
  render(<Wrapper><ChallengeCard location={location} /></Wrapper>)
  expect(screen.getByText('Test Location')).toBeInTheDocument()
})

test('renders description', () => {
  render(<Wrapper><ChallengeCard location={location} /></Wrapper>)
  expect(screen.getByText('A historic place.')).toBeInTheDocument()
})

test('renders clue and challenge', () => {
  render(<Wrapper><ChallengeCard location={location} /></Wrapper>)
  expect(screen.getByText('Find the plaque.')).toBeInTheDocument()
  expect(screen.getByText('Register to vote.')).toBeInTheDocument()
})
```

- [ ] **Step 3: Run full suite — expect all passing**

```bash
npm run test:run
```
Expected: all tests pass. The suite grows by +13 net (3 ThemeContext + 3 TitleBarContext + 8 TitleBar − 1 removed ChallengeCard progress test).

- [ ] **Step 4: Commit**

```bash
git add src/components/ChallengeCard.jsx src/test/ChallengeCard.test.jsx
git commit -m "feat: apply theme to ChallengeCard, progress indicator moved to TitleBar"
```
