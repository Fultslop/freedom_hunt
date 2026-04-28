import { render, screen } from '@testing-library/react'
import ChallengeCard from '../components/ChallengeCard'

const location = {
  title: 'Test Location',
  description: 'A historic place.',
  clue: 'Find the plaque.',
  challenge: 'Register to vote.',
}

test('renders title', () => {
  render(<ChallengeCard location={location} index={0} total={3} />)
  expect(screen.getByText('Test Location')).toBeInTheDocument()
})

test('renders description', () => {
  render(<ChallengeCard location={location} index={0} total={3} />)
  expect(screen.getByText('A historic place.')).toBeInTheDocument()
})

test('renders clue and challenge', () => {
  render(<ChallengeCard location={location} index={0} total={3} />)
  expect(screen.getByText('Find the plaque.')).toBeInTheDocument()
  expect(screen.getByText('Register to vote.')).toBeInTheDocument()
})

test('renders progress indicator', () => {
  render(<ChallengeCard location={location} index={1} total={3} />)
  expect(screen.getByText('2 / 3')).toBeInTheDocument()
})
