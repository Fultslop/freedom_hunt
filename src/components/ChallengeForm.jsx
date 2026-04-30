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
