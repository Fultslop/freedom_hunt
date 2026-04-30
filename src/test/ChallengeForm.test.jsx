import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import ChallengeForm from '../components/ChallengeForm'

const stringField = { id: 'motto', type: 'string', label: 'What is the motto?' }
const numberField = { id: 'trees', type: 'number', label: 'How many trees?' }
const booleanField = { id: 'found', type: 'boolean', label: 'Did you find it?' }
const radioField = { id: 'time', type: 'radio', label: 'Time of day?', options: ['Morning', 'Afternoon', 'Evening'] }

test('always renders submitter ID input', () => {
  render(<ChallengeForm form={[stringField]} locationId="001" />)
  expect(screen.getByLabelText('Your name or team')).toBeInTheDocument()
})

test('renders string field as text input', () => {
  render(<ChallengeForm form={[stringField]} locationId="001" />)
  expect(screen.getByLabelText('What is the motto?')).toHaveAttribute('type', 'text')
})

test('renders number field as number input', () => {
  render(<ChallengeForm form={[numberField]} locationId="001" />)
  expect(screen.getByLabelText('How many trees?')).toHaveAttribute('type', 'number')
})

test('renders boolean field as checkbox', () => {
  render(<ChallengeForm form={[booleanField]} locationId="001" />)
  expect(screen.getByLabelText('Did you find it?')).toHaveAttribute('type', 'checkbox')
})

test('renders radio field with all options', () => {
  render(<ChallengeForm form={[radioField]} locationId="001" />)
  expect(screen.getByText('Time of day?')).toBeInTheDocument()
  expect(screen.getByLabelText('Morning')).toHaveAttribute('type', 'radio')
  expect(screen.getByLabelText('Afternoon')).toHaveAttribute('type', 'radio')
  expect(screen.getByLabelText('Evening')).toHaveAttribute('type', 'radio')
})

test('renders error placeholder for unknown field type', () => {
  const bad = { id: 'oops', type: 'nmber', label: 'Typo field' }
  render(<ChallengeForm form={[bad]} locationId="001" />)
  expect(screen.getByText(/Invalid field "oops".*unknown type "nmber"/)).toBeInTheDocument()
})

test('renders error placeholder for radio field missing options', () => {
  const bad = { id: 'pick', type: 'radio', label: 'Pick one' }
  render(<ChallengeForm form={[bad]} locationId="001" />)
  expect(screen.getByText(/Invalid field "pick".*missing options/)).toBeInTheDocument()
})

test('renders error placeholder for radio field with empty options array', () => {
  const bad = { id: 'pick', type: 'radio', label: 'Pick one', options: [] }
  render(<ChallengeForm form={[bad]} locationId="001" />)
  expect(screen.getByText(/Invalid field "pick".*missing options/)).toBeInTheDocument()
})

test('renders submit button', () => {
  render(<ChallengeForm form={[stringField]} locationId="001" />)
  expect(screen.getByRole('button', { name: 'Submit answers' })).toBeInTheDocument()
})

describe('submission validation', () => {
  test('shows error when submitter ID is empty on submit', () => {
    render(<ChallengeForm form={[booleanField]} locationId="001" />)
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }))
    expect(screen.getByText('Please enter your name or team')).toBeInTheDocument()
  })

  test('shows error when string field is empty on submit', () => {
    render(<ChallengeForm form={[stringField]} locationId="001" />)
    fireEvent.change(screen.getByLabelText('Your name or team'), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }))
    expect(screen.getByText('This field is required')).toBeInTheDocument()
  })

  test('shows error when number field is empty on submit', () => {
    render(<ChallengeForm form={[numberField]} locationId="001" />)
    fireEvent.change(screen.getByLabelText('Your name or team'), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }))
    expect(screen.getByText('This field is required')).toBeInTheDocument()
  })

  test('shows error when radio field is unselected on submit', () => {
    render(<ChallengeForm form={[radioField]} locationId="001" />)
    fireEvent.change(screen.getByLabelText('Your name or team'), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }))
    expect(screen.getByText('Please select an option')).toBeInTheDocument()
  })

  test('boolean field does not require selection', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ ok: true }) }))
    render(<ChallengeForm form={[booleanField]} locationId="001" />)
    fireEvent.change(screen.getByLabelText('Your name or team'), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }))
    await waitFor(() => expect(screen.getByText('✓ Answers submitted')).toBeInTheDocument())
    vi.restoreAllMocks()
  })

  test('does not call fetch when validation fails', () => {
    global.fetch = vi.fn()
    render(<ChallengeForm form={[stringField]} locationId="001" />)
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }))
    expect(global.fetch).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})

describe('submission states', () => {
  afterEach(() => vi.restoreAllMocks())

  test('POSTs correct payload to /form-submit', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ ok: true }) }))
    render(<ChallengeForm form={[stringField, booleanField]} locationId="001" />)
    fireEvent.change(screen.getByLabelText('Your name or team'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText('What is the motto?'), { target: { value: 'Pro Rege' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    const [url, options] = global.fetch.mock.calls[0]
    expect(url).toBe('/form-submit')
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body)
    expect(body.locationId).toBe('001')
    expect(body.submitterId).toBe('Alice')
    expect(body.fields.motto).toBe('Pro Rege')
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  test('shows Submitting… while fetch is pending', async () => {
    global.fetch = vi.fn(() => new Promise(() => {}))
    render(<ChallengeForm form={[booleanField]} locationId="001" />)
    fireEvent.change(screen.getByLabelText('Your name or team'), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }))
    await waitFor(() => expect(screen.getByText('Submitting…')).toBeInTheDocument())
  })

  test('shows success confirmation after ok response', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ ok: true }) }))
    render(<ChallengeForm form={[booleanField]} locationId="001" />)
    fireEvent.change(screen.getByLabelText('Your name or team'), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }))
    await waitFor(() => expect(screen.getByText('✓ Answers submitted')).toBeInTheDocument())
  })

  test('shows Try again after non-ok response', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ ok: false }) }))
    render(<ChallengeForm form={[booleanField]} locationId="001" />)
    fireEvent.change(screen.getByLabelText('Your name or team'), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }))
    await waitFor(() => expect(screen.getByText('Try again')).toBeInTheDocument())
    expect(screen.getByText('Submission failed. Please try again.')).toBeInTheDocument()
  })

  test('shows Try again when fetch throws', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')))
    render(<ChallengeForm form={[booleanField]} locationId="001" />)
    fireEvent.change(screen.getByLabelText('Your name or team'), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }))
    await waitFor(() => expect(screen.getByText('Try again')).toBeInTheDocument())
  })
})
