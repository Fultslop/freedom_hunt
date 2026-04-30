import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '../theme/ThemeContext'
import { TitleBarProvider, useTitleBar } from '../theme/TitleBarContext'
import TitleBar from '../components/TitleBar'

function Wrapper({ children }) {
  return (
    <MemoryRouter>
      <ThemeProvider>
        <TitleBarProvider>{children}</TitleBarProvider>
      </ThemeProvider>
    </MemoryRouter>
  )
}

function Setup({ config }) {
  useTitleBar(config)
  return <TitleBar />
}

test('renders title', () => {
  render(<Wrapper><Setup config={{ title: 'Peace Palace', progress: null, backPath: null }} /></Wrapper>)
  expect(screen.getByText('Peace Palace')).toBeInTheDocument()
})

test('renders back button when backPath is set', () => {
  render(<Wrapper><Setup config={{ title: 'Test', progress: null, backPath: '/foo' }} /></Wrapper>)
  expect(screen.getByLabelText('Back')).toBeInTheDocument()
})

test('hides back button when backPath is null', () => {
  render(<Wrapper><Setup config={{ title: 'Test', progress: null, backPath: null }} /></Wrapper>)
  expect(screen.queryByLabelText('Back')).not.toBeInTheDocument()
})

test('renders progress bar when progress is set', () => {
  render(<Wrapper><Setup config={{ title: 'Test', progress: { current: 2, total: 3 }, backPath: null }} /></Wrapper>)
  expect(screen.getByTestId('progress-bar')).toBeInTheDocument()
})

test('hides progress bar when progress is null', () => {
  render(<Wrapper><Setup config={{ title: 'Test', progress: null, backPath: null }} /></Wrapper>)
  expect(screen.queryByTestId('progress-bar')).not.toBeInTheDocument()
})

test('opens style menu on ☰ click and lists all themes', () => {
  render(<Wrapper><Setup config={{ title: 'Test', progress: null, backPath: null }} /></Wrapper>)
  fireEvent.click(screen.getByLabelText('Style menu'))
  expect(screen.getByText('wireframe')).toBeInTheDocument()
  expect(screen.getByText('app')).toBeInTheDocument()
  expect(screen.getByText('GWC')).toBeInTheDocument()
})

test('selecting a theme closes the style menu', () => {
  render(<Wrapper><Setup config={{ title: 'Test', progress: null, backPath: null }} /></Wrapper>)
  fireEvent.click(screen.getByLabelText('Style menu'))
  fireEvent.click(screen.getByText('wireframe'))
  expect(screen.queryByText('GWC')).not.toBeInTheDocument()
})

test('progress fill is 6px tall', () => {
  render(<Wrapper><Setup config={{ title: 'Test', progress: { current: 2, total: 5 }, backPath: null }} /></Wrapper>)
  const fill = screen.getByTestId('progress-bar')
  expect(fill).toHaveStyle({ height: '6px' })
})
