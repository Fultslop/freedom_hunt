import { render, screen } from '@testing-library/react'
import { TitleBarProvider, useTitleBar } from '../theme/TitleBarContext'

function Consumer({ config }) {
  const { titleBar } = useTitleBar(config)
  return (
    <>
      <span data-testid="title">{titleBar.title}</span>
      <span data-testid="back">{titleBar.backPath ?? 'none'}</span>
      <span data-testid="progress">
        {titleBar.progress ? `${titleBar.progress.current}/${titleBar.progress.total}` : 'none'}
      </span>
    </>
  )
}

test('defaults to Freedom Hunt with no config', () => {
  render(<TitleBarProvider><Consumer /></TitleBarProvider>)
  expect(screen.getByTestId('title')).toHaveTextContent('Freedom Hunt')
  expect(screen.getByTestId('back')).toHaveTextContent('none')
  expect(screen.getByTestId('progress')).toHaveTextContent('none')
})

test('sets title and backPath from config', () => {
  render(
    <TitleBarProvider>
      <Consumer config={{ title: 'Short Walk', progress: null, backPath: '/da/den_haag' }} />
    </TitleBarProvider>
  )
  expect(screen.getByTestId('title')).toHaveTextContent('Short Walk')
  expect(screen.getByTestId('back')).toHaveTextContent('/da/den_haag')
})

test('sets progress from config', () => {
  render(
    <TitleBarProvider>
      <Consumer config={{ title: 'Test', progress: { current: 2, total: 3 }, backPath: null }} />
    </TitleBarProvider>
  )
  expect(screen.getByTestId('progress')).toHaveTextContent('2/3')
})
