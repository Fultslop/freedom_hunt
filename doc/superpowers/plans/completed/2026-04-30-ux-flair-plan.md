# UX Flair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add motion, visual hierarchy, and sparse icons to make the hunt feel like a game rather than a form.

**Architecture:** Six targeted edits across three existing files (`TitleBar.jsx`, `ChallengeCard.jsx`, `RoutePage.jsx`) plus one new test file. All animation is CSS keyframes — no animation libraries. Icons come from `lucide-react`.

**Tech Stack:** React 19, Vite, Vitest + @testing-library/react, lucide-react (new dep)

---

## File Map

| File | Changes |
|------|---------|
| `src/components/TitleBar.jsx` | Progress bar: 3 → 6px, gradient fill, glow shadow |
| `src/components/ChallengeCard.jsx` | Badge themeColor, submit button amber, section icons, Camera icon, clue fade-in |
| `src/pages/RoutePage.jsx` | Nav hierarchy, chevron icons, direction state, slide transition |
| `src/test/ChallengeCard.test.jsx` | Update emoji text matchers, add badge/button color tests |
| `src/test/RoutePage.test.jsx` | New — nav behaviour + slide direction |

---

### Task 1: Install lucide-react

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install**

```bash
npm install lucide-react
```

Expected: lucide-react appears in `package.json` dependencies.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add lucide-react for icons"
```

---

### Task 2: Progress bar — thicker and glowing

**Files:**
- Modify: `src/components/TitleBar.jsx:63-70`
- Test: `src/test/TitleBar.test.jsx`

- [ ] **Step 1: Write the failing test**

Add to `src/test/TitleBar.test.jsx`:

```jsx
test('progress fill is 6px tall', () => {
  render(<Wrapper><Setup config={{ title: 'Test', progress: { current: 2, total: 5 }, backPath: null }} /></Wrapper>)
  const fill = screen.getByTestId('progress-bar')
  expect(fill).toHaveStyle({ height: '6px' })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/test/TitleBar.test.jsx
```

Expected: FAIL — `progress fill is 6px tall`

- [ ] **Step 3: Update TitleBar.jsx progress section**

Replace the progress block (the `{progress && ...}` section at the bottom of the component) with:

```jsx
{progress && (
  <div style={{ background: theme.progressTrack, height: 6 }}>
    <div
      data-testid="progress-bar"
      style={{
        background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
        width: `${(progress.current / progress.total) * 100}%`,
        height: '100%',
        transition: 'width 0.2s ease',
        boxShadow: '0 0 8px rgba(245,158,11,0.5)',
      }}
    />
  </div>
)}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm run test:run -- src/test/TitleBar.test.jsx
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/TitleBar.jsx src/test/TitleBar.test.jsx
git commit -m "feat: progress bar thicker with amber glow"
```

---

### Task 3: ChallengeCard — badge themeColor + submit button amber

**Files:**
- Modify: `src/components/ChallengeCard.jsx`
- Test: `src/test/ChallengeCard.test.jsx`

- [ ] **Step 1: Write the failing tests**

Add `themeColor` to the existing `location` fixture in `src/test/ChallengeCard.test.jsx`:

```jsx
const location = {
  locationId: 1,
  title: 'The Final Civic Act',
  name: { value: 'Binnenhof / Het Plein' },
  address: 'Binnenhof 1',
  storyline: 'The Binnenhof is the oldest seat of parliament.',
  coordinates: { latitude: 52.0799, longitude: 4.3133 },
  challenge: { description: 'Register to vote.' },
  breadcrumb: 'Find the inner courtyard.',
  themeColor: '#8B1A1A',
}
```

Then add these tests:

```jsx
test('badge background uses location themeColor', () => {
  render(<Wrapper><ChallengeCard location={location} index={1} /></Wrapper>)
  expect(screen.getByTestId('location-badge')).toHaveStyle({ background: '#8B1A1A' })
})

test('badge falls back to navy when themeColor absent', () => {
  const loc = { ...location, themeColor: undefined }
  render(<Wrapper><ChallengeCard location={loc} index={1} /></Wrapper>)
  expect(screen.getByTestId('location-badge')).toHaveStyle({ background: '#002868' })
})

test('submit button uses amber accent color', () => {
  render(<Wrapper><ChallengeCard location={location} index={1} /></Wrapper>)
  expect(screen.getByTestId('submit-btn')).toHaveStyle({ background: '#f59e0b' })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm run test:run -- src/test/ChallengeCard.test.jsx
```

Expected: 3 new tests FAIL (testids don't exist yet)

- [ ] **Step 3: Update the badge in ChallengeCard.jsx**

Find the badge `<div>` in the `titleCard` section (the one that shows the stop number). Add `data-testid` and change background:

```jsx
<div style={{
  minWidth: 44,
  height: 44,
  background: location.themeColor ?? '#002868',
  color: '#fff',
  borderRadius: 6,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 20,
  fontWeight: 800,
  flexShrink: 0,
}} data-testid="location-badge">
  {index}
</div>
```

- [ ] **Step 4: Update the submit button in ChallengeCard.jsx**

Find the `<button>` that calls `fileInputRef.current.click()`. Add `data-testid` and change colors:

```jsx
<button
  data-testid="submit-btn"
  onClick={() => fileInputRef.current.click()}
  disabled={uploadState === 'uploading'}
  style={{
    width: '100%',
    padding: '10px 0',
    background: uploadState === 'uploading' ? theme.surface : theme.accent,
    color: uploadState === 'uploading' ? theme.textMuted : '#000',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: uploadState === 'uploading' ? 'not-allowed' : 'pointer',
  }}
>
  {uploadState === 'uploading' ? 'Uploading…' : uploadState === 'error' ? '📷 Try again' : '📷 Submit photo proof'}
</button>
```

- [ ] **Step 5: Run tests to verify pass**

```bash
npm run test:run -- src/test/ChallengeCard.test.jsx
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/ChallengeCard.jsx src/test/ChallengeCard.test.jsx
git commit -m "feat: badge uses themeColor, submit button uses accent"
```

---

### Task 4: ChallengeCard — section header icons + Camera on submit

**Files:**
- Modify: `src/components/ChallengeCard.jsx`
- Test: `src/test/ChallengeCard.test.jsx`

- [ ] **Step 1: Update existing emoji text matchers in tests**

The three photo upload tests reference emoji strings that will change. Update them:

```jsx
// was: expect(screen.getByText('📷 Submit photo proof')).toBeInTheDocument()
test('renders camera button in idle state', () => {
  render(<Wrapper><ChallengeCard location={location} /></Wrapper>)
  expect(screen.getByText('Submit photo proof')).toBeInTheDocument()
})

// was: expect(screen.getByText('📷 Try again')).toBeInTheDocument()
test('shows retry button on failed upload', async () => {
  global.fetch = vi.fn(() => Promise.resolve({
    json: () => Promise.resolve({ ok: false, error: 'Upload failed' }),
  }))
  render(<Wrapper><ChallengeCard location={location} /></Wrapper>)
  const input = document.querySelector('input[type="file"]')
  fireEvent.change(input, { target: { files: [new File(['img'], 'photo.jpg', { type: 'image/jpeg' })] } })
  await waitFor(() => expect(screen.getByText('Try again')).toBeInTheDocument())
})
```

- [ ] **Step 2: Run tests to verify they fail (emoji text no longer matches)**

```bash
npm run test:run -- src/test/ChallengeCard.test.jsx
```

Expected: 2 tests FAIL on the updated matchers (implementation still has emojis)

- [ ] **Step 3: Add icon imports to ChallengeCard.jsx**

At the top of `src/components/ChallengeCard.jsx`, add:

```jsx
import { BookOpen, MapPin, Crosshair, Compass, Camera } from 'lucide-react'
```

- [ ] **Step 4: Update the four section headers in ChallengeCard.jsx**

Replace each plain label `<div>` with an icon + text version. The shared label style (add `display: 'flex', alignItems: 'center', gap: 5`):

**Storyline header:**
```jsx
<div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: theme.textMuted, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
  <BookOpen size={12} aria-hidden />
  Storyline
</div>
```

**Location header:**
```jsx
<div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: theme.textMuted, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
  <MapPin size={12} aria-hidden />
  Location
</div>
```

**Challenge header** (inside the surface card):
```jsx
<div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: theme.textMuted, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
  <Crosshair size={12} aria-hidden />
  Challenge
</div>
```

**Next clue header:**
```jsx
<div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: theme.textMuted, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
  <Compass size={12} aria-hidden />
  Your clue to your next destination
</div>
```

- [ ] **Step 5: Update the submit button text to use Camera icon**

Replace the button children:

```jsx
{uploadState === 'uploading'
  ? 'Uploading…'
  : uploadState === 'error'
    ? <><Camera size={14} aria-hidden style={{ verticalAlign: 'middle', marginRight: 4 }} /> Try again</>
    : <><Camera size={14} aria-hidden style={{ verticalAlign: 'middle', marginRight: 4 }} /> Submit photo proof</>
}
```

- [ ] **Step 6: Run tests to verify all pass**

```bash
npm run test:run -- src/test/ChallengeCard.test.jsx
```

Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/ChallengeCard.jsx src/test/ChallengeCard.test.jsx
git commit -m "feat: add lucide icons to challenge card section headers and submit button"
```

---

### Task 5: ChallengeCard — breadcrumb clue fade-in

**Files:**
- Modify: `src/components/ChallengeCard.jsx`

CSS animations do not execute in jsdom, so no new tests. Existing tests must continue to pass.

- [ ] **Step 1: Inject keyframe styles in ChallengeCard.jsx**

At the top of the component's `return`, add a `<style>` block (alongside any existing reset style). The component's return starts with `<div style={{ background: theme.background }}>` — add the style before or inside it:

```jsx
return (
  <div style={{ background: theme.background }}>
    <style>{`
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `}</style>
    {/* ... rest of component */}
```

- [ ] **Step 2: Apply animation to the clue container**

Find the `!isLast && (...)` block at the bottom of the component. Wrap the clue `<p>` in an animated container:

```jsx
{!isLast && (
  <div style={{ padding: 16 }}>
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: theme.textMuted, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
      <Compass size={12} aria-hidden />
      Your clue to your next destination
    </div>
    <p style={{
      margin: 0,
      fontSize: 14,
      lineHeight: 1.65,
      color: theme.text,
      fontStyle: 'italic',
      borderLeft: '3px solid #BF0A30',
      paddingLeft: 12,
      animation: 'fadeInUp 400ms ease-out',
    }}>
      {location.breadcrumb}
    </p>
  </div>
)}
```

Note: the Compass icon here replaces the label from Task 4 Step 4 — do not duplicate it.

- [ ] **Step 3: Run all ChallengeCard tests to verify no regression**

```bash
npm run test:run -- src/test/ChallengeCard.test.jsx
```

Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/ChallengeCard.jsx
git commit -m "feat: breadcrumb clue fades in on each stop"
```

---

### Task 6: RoutePage — nav button hierarchy + chevron icons

**Files:**
- Create: `src/test/RoutePage.test.jsx`
- Modify: `src/pages/RoutePage.jsx`

- [ ] **Step 1: Create src/test/RoutePage.test.jsx with the full mock setup and nav tests**

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '../theme/ThemeContext'
import { TitleBarProvider } from '../theme/TitleBarContext'
import RoutePage from '../pages/RoutePage'

vi.mock('../hooks/useText', () => ({
  useText: vi.fn(() => ({
    text: {
      route_a: {
        description: 'Test route',
        locations: ['loc1', 'loc2', 'loc3'],
      },
    },
    loading: false,
  })),
}))

const mockLocations = [
  {
    locationId: 1,
    title: 'Stop One',
    name: { value: '' },
    address: '',
    storyline: 'First stop storyline.',
    coordinates: { latitude: 52.0, longitude: 4.0 },
    challenge: { description: 'First challenge.' },
    breadcrumb: 'Head north.',
    image: null,
    themeColor: '#8B1A1A',
  },
  {
    locationId: 2,
    title: 'Stop Two',
    name: { value: '' },
    address: '',
    storyline: 'Second stop storyline.',
    coordinates: { latitude: 52.1, longitude: 4.1 },
    challenge: { description: 'Second challenge.' },
    breadcrumb: 'Head south.',
    image: null,
    themeColor: '#2B5A27',
  },
  {
    locationId: 3,
    title: 'Stop Three',
    name: { value: '' },
    address: '',
    storyline: 'Third stop storyline.',
    coordinates: { latitude: 52.2, longitude: 4.2 },
    challenge: { description: 'Third challenge.' },
    breadcrumb: null,
    image: null,
    themeColor: '#002868',
  },
]

vi.mock('../hooks/useLocations', () => ({
  useLocations: vi.fn(() => ({ locations: mockLocations, loading: false })),
}))

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
}))

vi.mock('leaflet', () => ({
  default: { divIcon: () => ({}) },
}))

function Wrapper() {
  return (
    <MemoryRouter initialEntries={['/hunt/amsterdam/route_a']}>
      <ThemeProvider>
        <TitleBarProvider>
          <Routes>
            <Route path="/:project/:city/:route" element={<RoutePage />} />
          </Routes>
        </TitleBarProvider>
      </ThemeProvider>
    </MemoryRouter>
  )
}

beforeEach(() => localStorage.clear())

test('renders first stop on mount', () => {
  render(<Wrapper />)
  expect(screen.getByText('Stop One')).toBeInTheDocument()
})

test('Next button advances to the next stop', () => {
  render(<Wrapper />)
  fireEvent.click(screen.getByLabelText('Next stop'))
  expect(screen.getByText('Stop Two')).toBeInTheDocument()
})

test('Prev button is not visible on the first stop', () => {
  render(<Wrapper />)
  expect(screen.queryByLabelText('Previous stop')).not.toBeInTheDocument()
})

test('Prev button returns to the previous stop', () => {
  render(<Wrapper />)
  fireEvent.click(screen.getByLabelText('Next stop'))
  fireEvent.click(screen.getByLabelText('Previous stop'))
  expect(screen.getByText('Stop One')).toBeInTheDocument()
})

test('Next button is not visible on the last stop', () => {
  render(<Wrapper />)
  fireEvent.click(screen.getByLabelText('Next stop'))
  fireEvent.click(screen.getByLabelText('Next stop'))
  expect(screen.queryByLabelText('Next stop')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npm run test:run -- src/test/RoutePage.test.jsx
```

Expected: FAIL — `aria-label` attributes don't exist yet on nav buttons

- [ ] **Step 3: Add ChevronLeft/ChevronRight import to RoutePage.jsx**

At the top of `src/pages/RoutePage.jsx`, add:

```jsx
import { ChevronLeft, ChevronRight } from 'lucide-react'
```

- [ ] **Step 4: Replace the bottom nav bar in RoutePage.jsx**

Find the fixed bottom bar (the `<div style={{ position: 'fixed', bottom: 0, ... }}>` block) and replace its contents:

```jsx
<div style={{
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 24px',
  borderTop: `1px solid ${theme.border}`,
  background: theme.surface,
}}>
  <div style={{ width: 80 }}>
    {currentIndex > 0 && (
      <button
        aria-label="Previous stop"
        onClick={() => { setDirection('prev'); setCurrentIndex(i => clampedPrev(i)) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '8px 14px',
          cursor: 'pointer',
          background: 'transparent',
          color: theme.textSecondary,
          border: `1px solid ${theme.border}`,
          borderRadius: 8,
          fontSize: 13,
        }}
      >
        <ChevronLeft size={16} aria-hidden /> Prev
      </button>
    )}
  </div>

  <button
    onClick={() => navigate(`/${project}/${city}`)}
    style={{
      padding: '8px 14px',
      cursor: 'pointer',
      background: 'transparent',
      color: theme.textMuted,
      border: 'none',
      fontSize: 12,
    }}
  >
    Exit
  </button>

  <div style={{ width: 80, display: 'flex', justifyContent: 'flex-end' }}>
    {currentIndex < locations.length - 1 && (
      <button
        aria-label="Next stop"
        onClick={() => { setDirection('next'); setCurrentIndex(i => clampedNext(i, locations.length)) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '8px 14px',
          cursor: 'pointer',
          background: theme.accent,
          color: '#000',
          border: 'none',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        Next <ChevronRight size={16} aria-hidden />
      </button>
    )}
  </div>
</div>
```

Note: `setDirection` is introduced in Task 7. For now add `const [direction, setDirection] = useState('next')` at the top of the component with the other state declarations so the calls above don't break.

- [ ] **Step 5: Run RoutePage tests to verify pass**

```bash
npm run test:run -- src/test/RoutePage.test.jsx
```

Expected: all PASS

- [ ] **Step 6: Run full test suite to verify no regressions**

```bash
npm run test:run
```

Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add src/pages/RoutePage.jsx src/test/RoutePage.test.jsx
git commit -m "feat: nav buttons have visual hierarchy and chevron icons"
```

---

### Task 7: RoutePage — slide transition between stops

**Files:**
- Modify: `src/pages/RoutePage.jsx`

The `direction` state was introduced in Task 6. This task adds the CSS animation that uses it. No new tests — the transition is visual-only and jsdom does not execute CSS animations.

- [ ] **Step 1: Inject keyframe styles into RoutePage.jsx**

Inside the component's return, add a `<style>` block (the component already has one for the html/body reset — add alongside it):

```jsx
<style>{`
  html, body, #root { margin: 0; padding: 0; height: 100%; }
  @keyframes slideInFromRight {
    from { transform: translateX(40px); opacity: 0; }
    to   { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideInFromLeft {
    from { transform: translateX(-40px); opacity: 0; }
    to   { transform: translateX(0); opacity: 1; }
  }
`}</style>
```

- [ ] **Step 2: Update the swipe handlers to also set direction**

Find `handleTouchEnd` and update the two delta branches:

```jsx
const handleTouchEnd = (e) => {
  if (touchStartX.current === null) return
  const delta = e.changedTouches[0].clientX - touchStartX.current
  touchStartX.current = null
  if (delta < -60) {
    setDirection('next')
    setCurrentIndex(i => clampedNext(i, locations.length))
  } else if (delta > 60) {
    setDirection('prev')
    setCurrentIndex(i => clampedPrev(i))
  }
}
```

- [ ] **Step 3: Wrap ChallengeCard in an animated container keyed to currentIndex**

Find the `<ChallengeCard ... />` line inside the `<div style={{ paddingBottom: 60 }}>` wrapper and wrap it:

```jsx
<div style={{ paddingBottom: 60 }}>
  <div
    key={currentIndex}
    style={{ animation: `${direction === 'next' ? 'slideInFromRight' : 'slideInFromLeft'} 250ms ease-out` }}
  >
    <ChallengeCard location={location} isLast={currentIndex === locations.length - 1} index={currentIndex + 1} />
  </div>
</div>
```

- [ ] **Step 4: Run full test suite**

```bash
npm run test:run
```

Expected: all PASS

- [ ] **Step 5: Manual smoke test**

```bash
npm run dev
```

Open the app in browser. Navigate a hunt route. Verify:
- Tapping Next slides the card in from the right
- Tapping Prev slides the card in from the left
- Swiping left/right also animates correctly
- Progress bar is 6px with amber glow
- Submit button is amber
- Section headers show small icons
- Nav buttons: Next is amber/filled, Prev is bordered, Exit is text-only

- [ ] **Step 6: Commit**

```bash
git add src/pages/RoutePage.jsx
git commit -m "feat: slide transition between stops with direction-aware animation"
```
