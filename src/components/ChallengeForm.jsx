import { useState } from 'react'
import './ChallengeForm.css'

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
          timestamp: new Date().toISOString(),
          // TODO needs to have route id
          locationId: String(locationId),
          // TODO needs to have team name
          // TODO needs to have email if defined
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
        <div key={field.id} className="cf-invalid-field">
          {`⚠ Invalid field "${field.id}": ${defError}`}
        </div>
      )
    }

    return (
      <div key={field.id} className="cf-field">
        {field.type === 'boolean' ? (
          <label htmlFor={field.id} className="cf-label--checkbox">
            <input
              id={field.id}
              type="checkbox"
              checked={values[field.id] ?? false}
              onChange={e => setValue(field.id, e.target.checked)}
              className="cf-checkbox"
            />
            {field.label}
          </label>
        ) : (
          <>
            <label htmlFor={field.id} className="cf-label">
              {field.label}
            </label>
            {field.type === 'string' && (
              <input
                id={field.id}
                type="text"
                value={values[field.id] ?? ''}
                onChange={e => setValue(field.id, e.target.value)}
                className={`cf-input${errors[field.id] ? ' cf-input--error' : ''}`}
              />
            )}
            {field.type === 'number' && (
              <input
                id={field.id}
                type="number"
                value={values[field.id] ?? ''}
                onChange={e => setValue(field.id, e.target.value === '' ? '' : Number(e.target.value))}
                className={`cf-input${errors[field.id] ? ' cf-input--error' : ''}`}
              />
            )}
            {field.type === 'radio' && (
              <div className="cf-radio-group">
                {field.options.map(opt => (
                  <label key={opt} htmlFor={`${field.id}-${opt}`} className="cf-label--radio">
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
          <div className="cf-error-msg">{errors[field.id]}</div>
        )}
      </div>
    )
  }

  if (submitState === 'success') {
    return <div className="cf-success">✓ Answers submitted</div>
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
      <div className="cf-field">
        <label htmlFor="submitter-id" className="cf-label">
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
          className={`cf-input${errors.__submitterId ? ' cf-input--error' : ''}`}
        />
        {errors.__submitterId && (
          <div className="cf-error-msg">{errors.__submitterId}</div>
        )}
      </div>

      {form.map(renderField)}

      <button
        type="submit"
        disabled={submitState === 'submitting'}
        className={`cf-submit-btn${submitState === 'submitting' ? ' cf-submit-btn--submitting' : ''}`}
      >
        {submitState === 'submitting' ? 'Submitting…' : submitState === 'error' ? 'Try again' : 'Submit answers'}
      </button>
      {submitState === 'error' && (
        <div className="cf-submit-error">Submission failed. Please try again.</div>
      )}
    </form>
  )
}
