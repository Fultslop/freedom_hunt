import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '../theme/ThemeContext'
import ChallengeCard from '../components/ChallengeCard'

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
}))

vi.mock('leaflet', () => ({
  default: { divIcon: () => ({}) },
}))

const location = {
  locationId: 1,
  title: 'The Final Civic Act',
  name: { value: 'Binnenhof / Het Plein' },
  address: 'Binnenhof 1',
  storyline: 'The Binnenhof is the oldest seat of parliament.',
  coordinates: { latitude: 52.0799, longitude: 4.3133 },
  challenge: { description: 'Register to vote.' },
  breadcrumb: 'Find the inner courtyard.',
}

function Wrapper({ children }) {
  return <ThemeProvider>{children}</ThemeProvider>
}

test('renders locationId badge', () => {
  render(<Wrapper><ChallengeCard location={location} /></Wrapper>)
  expect(screen.getByText('1')).toBeInTheDocument()
})

test('renders title', () => {
  render(<Wrapper><ChallengeCard location={location} /></Wrapper>)
  expect(screen.getByText('The Final Civic Act')).toBeInTheDocument()
})

test('renders name.value when present', () => {
  render(<Wrapper><ChallengeCard location={location} /></Wrapper>)
  expect(screen.getByText('Binnenhof / Het Plein')).toBeInTheDocument()
})

test('omits name when value is empty', () => {
  const loc = { ...location, name: { value: '' } }
  render(<Wrapper><ChallengeCard location={loc} /></Wrapper>)
  expect(screen.queryByText('Binnenhof / Het Plein')).not.toBeInTheDocument()
})

test('renders address when present', () => {
  render(<Wrapper><ChallengeCard location={location} /></Wrapper>)
  expect(screen.getByText('Binnenhof 1')).toBeInTheDocument()
})

test('omits address when empty', () => {
  const loc = { ...location, address: '' }
  render(<Wrapper><ChallengeCard location={loc} /></Wrapper>)
  expect(screen.queryByText('Binnenhof 1')).not.toBeInTheDocument()
})

test('renders storyline', () => {
  render(<Wrapper><ChallengeCard location={location} /></Wrapper>)
  expect(screen.getByText('The Binnenhof is the oldest seat of parliament.')).toBeInTheDocument()
})

test('renders map', () => {
  render(<Wrapper><ChallengeCard location={location} /></Wrapper>)
  expect(screen.getByTestId('map')).toBeInTheDocument()
})

test('renders challenge description', () => {
  render(<Wrapper><ChallengeCard location={location} /></Wrapper>)
  expect(screen.getByText('Register to vote.')).toBeInTheDocument()
})

test('renders breadcrumb', () => {
  render(<Wrapper><ChallengeCard location={location} /></Wrapper>)
  expect(screen.getByText('Find the inner courtyard.')).toBeInTheDocument()
})

test('does not render hero image when image field absent', () => {
  render(<Wrapper><ChallengeCard location={location} /></Wrapper>)
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})
