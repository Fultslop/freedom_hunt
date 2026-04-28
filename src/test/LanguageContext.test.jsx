import { render, screen, fireEvent } from '@testing-library/react'
import { useContext } from 'react'
import { LanguageContext, LanguageProvider } from '../i18n/LanguageContext'

function Consumer() {
  const { currentLang, setLang } = useContext(LanguageContext)
  return (
    <>
      <span data-testid="lang">{currentLang}</span>
      <button onClick={() => setLang('nl')}>switch</button>
    </>
  )
}

test('defaults to en', () => {
  render(<LanguageProvider><Consumer /></LanguageProvider>)
  expect(screen.getByTestId('lang')).toHaveTextContent('en')
})

test('setLang updates currentLang', () => {
  render(<LanguageProvider><Consumer /></LanguageProvider>)
  fireEvent.click(screen.getByText('switch'))
  expect(screen.getByTestId('lang')).toHaveTextContent('nl')
})
