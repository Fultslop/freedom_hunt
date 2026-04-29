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
