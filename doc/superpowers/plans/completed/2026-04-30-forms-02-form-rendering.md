# Task 2 — ChallengeForm: field rendering

**Files:**
- Create: `src/components/ChallengeForm.jsx`
- Create: `src/test/ChallengeForm.test.jsx`

---

- [ ] **Step 1: Write failing rendering tests**

Create `src/test/ChallengeForm.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
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
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm run test:run -- src/test/ChallengeForm.test.jsx
```

Expected: all 9 tests FAIL — `Cannot find module '../components/ChallengeForm'`.

- [ ] **Step 3: Create ChallengeForm.jsx with field rendering**

Create `src/components/ChallengeForm.jsx`:

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
    <form onSubmit={e => e.preventDefault()} style={{ marginTop: 14 }}>
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

Note: the form's `onSubmit` is a placeholder (`e.preventDefault()`) for now — submission logic is wired up in Task 3.

- [ ] **Step 4: Run tests to verify they pass**

```
npm run test:run -- src/test/ChallengeForm.test.jsx
```

Expected: all 9 tests PASS.

- [ ] **Step 5: Run full test suite to check for regressions**

```
npm run test:run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```
git add src/components/ChallengeForm.jsx src/test/ChallengeForm.test.jsx
git commit -m "feat: add ChallengeForm component with field rendering and definition validation"
```
