# Task 3 — ChallengeForm: submission logic

**Files:**
- Modify: `src/components/ChallengeForm.jsx`
- Modify: `src/test/ChallengeForm.test.jsx`

---

- [ ] **Step 1: Write failing submission tests**

Append to `src/test/ChallengeForm.test.jsx`:

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
// (already imported above — do not duplicate the import line)

const stringField = { id: 'motto', type: 'string', label: 'What is the motto?' }
const numberField = { id: 'trees', type: 'number', label: 'How many trees?' }
const booleanField = { id: 'found', type: 'boolean', label: 'Did you find it?' }
const radioField = { id: 'time', type: 'radio', label: 'Time of day?', options: ['Morning', 'Afternoon', 'Evening'] }
// (already defined above — do not duplicate)

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
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm run test:run -- src/test/ChallengeForm.test.jsx
```

Expected: the 9 rendering tests still PASS; the new submission tests FAIL because submit does nothing yet.

- [ ] **Step 3: Wire up submission logic in ChallengeForm.jsx**

Replace the `<form onSubmit={e => e.preventDefault()}>` placeholder with a real `handleSubmit`. Replace the `return (` form JSX block in `src/components/ChallengeForm.jsx` with:

```jsx
  function validate() {
    const newErrors = {}
    if (!submitterId.trim()) newErrors.__submitterId = 'Please enter your name or team'
    for (const field of form) {
      if (checkDefinition(field)) continue
      if (field.type === 'boolean') continue
      if (field.type === 'radio' && !values[field.id]) newErrors[field.id] = 'Please select an option'
      if (field.type === 'string' && !String(values[field.id] ?? '').trim()) newErrors[field.id] = 'This field is required'
      if (field.type === 'number' && (values[field.id] === '' || values[field.id] === undefined)) newErrors[field.id] = 'This field is required'
    }
    return newErrors
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const newErrors = validate()
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setSubmitState('submitting')
    try {
      const res = await fetch('/form-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: String(locationId),
          timestamp: new Date().toISOString(),
          submitterId: submitterId.trim(),
          fields: values,
        }),
      })
      const data = await res.json()
      setSubmitState(data.ok ? 'success' : 'error')
    } catch {
      setSubmitState('error')
    }
  }
```

Then change `<form onSubmit={e => e.preventDefault()}>` to `<form onSubmit={handleSubmit}>`.

Place the `validate` and `handleSubmit` functions inside the component, between `setValue` and `renderField`.

Full `src/components/ChallengeForm.jsx` after the edit:

```jsx
import { useState } from 'react'

const VALID_TYPES = ['string', 'number', 'boolean', 'radio']

function checkDefinition(field) {
  if (!VALID_TYPES.includes(field.type)) return `unknown type "${field.type}"`
  if (field.type === 'radio' && (!field.options || field.options.length === 0)) return 'radio field missing options'
  return null
}

export default function ChallengeForm({ form, locationId }) {
  const [submitterId, setSubmitterId] = useState('')
  const [values, setValues] = useState({})
  const [errors, setErrors] = useState({})
  const [submitState, setSubmitState] = useState('idle')

  function setValue(id, value) {
    setValues(prev => ({ ...prev, [id]: value }))
    setErrors(prev => { const next = { ...prev }; delete next[id]; return next })
  }

  function validate() {
    const newErrors = {}
    if (!submitterId.trim()) newErrors.__submitterId = 'Please enter your name or team'
    for (const field of form) {
      if (checkDefinition(field)) continue
      if (field.type === 'boolean') continue
      if (field.type === 'radio' && !values[field.id]) newErrors[field.id] = 'Please select an option'
      if (field.type === 'string' && !String(values[field.id] ?? '').trim()) newErrors[field.id] = 'This field is required'
      if (field.type === 'number' && (values[field.id] === '' || values[field.id] === undefined)) newErrors[field.id] = 'This field is required'
    }
    return newErrors
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const newErrors = validate()
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setSubmitState('submitting')
    try {
      const res = await fetch('/form-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: String(locationId),
          timestamp: new Date().toISOString(),
          submitterId: submitterId.trim(),
          fields: values,
        }),
      })
      const data = await res.json()
      setSubmitState(data.ok ? 'success' : 'error')
    } catch {
      setSubmitState('error')
    }
  }

  function renderField(field) {
    const defError = checkDefinition(field)
    if (defError) {
      return (
        <div key={field.id} style={{
          background: '#fff0f0',
          border: '1px solid #BF0A30',
          borderRadius: 4,
          padding: '8px 10px',
          fontSize: 12,
          color: '#BF0A30',
          marginBottom: 10,
        }}>
          {`⚠ Invalid field "${field.id}": ${defError}`}
        </div>
      )
    }

    const inputStyle = {
      width: '100%',
      boxSizing: 'border-box',
      padding: '8px 10px',
      border: `1px solid ${errors[field.id] ? '#BF0A30' : '#ccc'}`,
      borderRadius: 4,
      fontSize: 13,
      marginTop: 4,
    }

    return (
      <div key={field.id} style={{ marginBottom: 12 }}>
        {field.type === 'boolean' ? (
          <label htmlFor={field.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#333', cursor: 'pointer' }}>
            <input
              id={field.id}
              type="checkbox"
              checked={values[field.id] ?? false}
              onChange={e => setValue(field.id, e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            {field.label}
          </label>
        ) : (
          <>
            <label htmlFor={field.id} style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block' }}>
              {field.label}
            </label>
            {field.type === 'string' && (
              <input
                id={field.id}
                type="text"
                value={values[field.id] ?? ''}
                onChange={e => setValue(field.id, e.target.value)}
                style={inputStyle}
              />
            )}
            {field.type === 'number' && (
              <input
                id={field.id}
                type="number"
                value={values[field.id] ?? ''}
                onChange={e => setValue(field.id, e.target.value === '' ? '' : Number(e.target.value))}
                style={inputStyle}
              />
            )}
            {field.type === 'radio' && (
              <div style={{ marginTop: 6 }}>
                {field.options.map(opt => (
                  <label key={opt} htmlFor={`${field.id}-${opt}`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 13, fontWeight: 400, cursor: 'pointer' }}>
                    <input
                      id={`${field.id}-${opt}`}
                      type="radio"
                      name={field.id}
                      value={opt}
                      checked={values[field.id] === opt}
                      onChange={() => setValue(field.id, opt)}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}
          </>
        )}
        {errors[field.id] && (
          <div style={{ fontSize: 11, color: '#BF0A30', marginTop: 2 }}>{errors[field.id]}</div>
        )}
      </div>
    )
  }

  if (submitState === 'success') {
    return (
      <div style={{ fontSize: 13, color: '#2d7a2d', fontWeight: 600, marginTop: 12 }}>
        ✓ Answers submitted
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="submitter-id" style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block' }}>
          Your name or team
        </label>
        <input
          id="submitter-id"
          type="text"
          value={submitterId}
          onChange={e => {
            setSubmitterId(e.target.value)
            setErrors(prev => { const next = { ...prev }; delete next.__submitterId; return next })
          }}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '8px 10px',
            border: `1px solid ${errors.__submitterId ? '#BF0A30' : '#ccc'}`,
            borderRadius: 4,
            fontSize: 13,
            marginTop: 4,
          }}
        />
        {errors.__submitterId && (
          <div style={{ fontSize: 11, color: '#BF0A30', marginTop: 2 }}>{errors.__submitterId}</div>
        )}
      </div>

      {form.map(renderField)}

      <button
        type="submit"
        disabled={submitState === 'submitting'}
        style={{
          width: '100%',
          padding: '10px 0',
          background: submitState === 'submitting' ? '#e5e7eb' : '#002868',
          color: submitState === 'submitting' ? '#6b7280' : '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          cursor: submitState === 'submitting' ? 'not-allowed' : 'pointer',
          marginTop: 4,
        }}
      >
        {submitState === 'submitting' ? 'Submitting…' : submitState === 'error' ? 'Try again' : 'Submit answers'}
      </button>
      {submitState === 'error' && (
        <div style={{ fontSize: 11, color: '#BF0A30', marginTop: 4 }}>Submission failed. Please try again.</div>
      )}
    </form>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm run test:run -- src/test/ChallengeForm.test.jsx
```

Expected: all tests PASS (9 rendering + 11 submission).

- [ ] **Step 5: Run full test suite to check for regressions**

```
npm run test:run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```
git add src/components/ChallengeForm.jsx src/test/ChallengeForm.test.jsx
git commit -m "feat: add ChallengeForm submission logic with validation and upload states"
```
