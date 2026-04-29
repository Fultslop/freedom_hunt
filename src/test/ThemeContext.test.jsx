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
