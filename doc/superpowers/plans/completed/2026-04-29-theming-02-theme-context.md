# Task 2: ThemeContext

State: Completed

**Part of:** [Theming & Title Bar](2026-04-29-theming-titlebar.md)  
**Depends on:** [Task 1 — themes.js](2026-04-29-theming-01-themes.md)  
**Next:** [Task 3 — TitleBarContext](2026-04-29-theming-03-titlebar-context.md)

**Files:**
- Create: `src/theme/ThemeContext.jsx`
- Create: `src/test/ThemeContext.test.jsx`

---

- [ ] **Step 1: Write the failing tests**

Create `src/test/ThemeContext.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider, useTheme } from '../theme/ThemeContext'

function Consumer() {
  const { theme, themeName, setThemeName } = useTheme()
  return (
    <>
      <span data-testid="name">{themeName}</span>
      <span data-testid="bg">{theme.background}</span>
      <button onClick={() => setThemeName('wireframe')}>switch</button>
    </>
  )
}

test('defaults to app theme', () => {
  render(<ThemeProvider><Consumer /></ThemeProvider>)
  expect(screen.getByTestId('name')).toHaveTextContent('app')
})

test('resolves theme tokens for current name', () => {
  render(<ThemeProvider><Consumer /></ThemeProvider>)
  expect(screen.getByTestId('bg')).toHaveTextContent('#0f172a')
})

test('setThemeName switches theme and tokens', () => {
  render(<ThemeProvider><Consumer /></ThemeProvider>)
  fireEvent.click(screen.getByText('switch'))
  expect(screen.getByTestId('name')).toHaveTextContent('wireframe')
  expect(screen.getByTestId('bg')).toHaveTextContent('#ffffff')
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run src/test/ThemeContext.test.jsx
```
Expected: 3 failures (module not found).

- [ ] **Step 3: Implement `src/theme/ThemeContext.jsx`**

```jsx
import { createContext, useState, useContext } from 'react'
import { themes, DEFAULT_THEME } from './themes'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState(DEFAULT_THEME)
  const theme = themes[themeName] ?? themes[DEFAULT_THEME]
  return (
    <ThemeContext.Provider value={{ theme, themeName, setThemeName }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/test/ThemeContext.test.jsx
```
Expected: 3 passing.

- [ ] **Step 5: Run full suite — expect all still passing**

```bash
npm run test:run
```

- [ ] **Step 6: Commit**

```bash
git add src/theme/ThemeContext.jsx src/test/ThemeContext.test.jsx
git commit -m "feat: add ThemeContext with wireframe/app/GWC presets"
```
