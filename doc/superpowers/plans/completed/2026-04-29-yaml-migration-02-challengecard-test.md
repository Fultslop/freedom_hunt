# Task 2: Update ChallengeCard Test

Update the test fixture to use the new field names. Tests will fail after this step — that's expected. Task 3 makes them pass.

**Files:**
- Modify: `src/test/ChallengeCard.test.jsx`

---

- [ ] **Step 1: Update the location fixture in the test file**

Current `src/test/ChallengeCard.test.jsx`:
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

Replace with:
```jsx
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '../theme/ThemeContext'
import ChallengeCard from '../components/ChallengeCard'

const location = {
  title: 'Test Location',
  storyline: 'A historic place.',
  breadcrumb: 'Find the plaque.',
  challenge: { description: 'Register to vote.' },
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

- [ ] **Step 2: Run tests to verify the right tests fail**

```bash
npm run test:run
```

Expected: 2 tests fail — `renders description` and `renders clue and challenge`. The `renders title` test still passes. This is correct: the component still reads the old field names, so the text doesn't render. Proceed to Task 3.
