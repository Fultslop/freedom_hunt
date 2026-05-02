import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTitleBar } from '../../theme/TitleBarContext'
import { addPending } from './editorStorage'
import './EditorLocationForm.css'

function buildFilename(locationId, title) {
  const slug = String(title).toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  return `${String(locationId).padStart(3, '0')}_loc_${slug}.yaml`
}

const EMPTY = {
  locationId: '',
  title: '',
  image: '',
  name: { label: '', value: '' },
  address: '',
  coordinates: { latitude: '', longitude: '' },
  storyline: '',
  challenge: { name: '', description: '', notes: '', form: [] },
  breadcrumb: '',
}

export default function EditorLocationForm() {
  const { project, city, filename } = useParams()
  const isEdit = Boolean(filename)
  const navigate = useNavigate()

  const [fields, setFields] = useState(EMPTY)
  const [existingSha, setExistingSha] = useState(null)
  const [loading, setLoading] = useState(isEdit)
  const [submitState, setSubmitState] = useState('idle')
  const [prUrl, setPrUrl] = useState(null)
  const [submitError, setSubmitError] = useState(null)

  useTitleBar({
    title: isEdit ? 'Edit location' : 'Add location',
    progress: null,
    backPath: `/editor/locations/${project}/${city}`,
  })

  useEffect(() => {
    if (!isEdit) return
    fetch(`/editor/location?project=${project}&city=${city}&file=${filename}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setFields({
            ...EMPTY,
            ...data.location,
            name: { ...EMPTY.name, ...(data.location.name ?? {}) },
            coordinates: { ...EMPTY.coordinates, ...(data.location.coordinates ?? {}) },
            challenge: { ...EMPTY.challenge, ...(data.location.challenge ?? {}) },
          })
          setExistingSha(data.sha)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isEdit, project, city, filename])

  function set(path, value) {
    setFields(prev => {
      const next = { ...prev }
      if (path.includes('.')) {
        const [parent, child] = path.split('.')
        next[parent] = { ...prev[parent], [child]: value }
      } else {
        next[path] = value
      }
      return next
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitState('submitting')
    setSubmitError(null)

    const resolvedFilename = isEdit
      ? filename
      : buildFilename(fields.locationId, fields.title)

    const location = {
      ...fields,
      locationId: Number(fields.locationId) || fields.locationId,
      coordinates: {
        latitude: parseFloat(fields.coordinates.latitude) || 0,
        longitude: parseFloat(fields.coordinates.longitude) || 0,
      },
    }

    try {
      const res = await fetch('/editor/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, city, filename: resolvedFilename, existingSha, location }),
      })
      const data = await res.json()
      if (data.ok) {
        addPending(project, city, {
          filename: resolvedFilename,
          locationTitle: fields.title,
          prUrl: data.prUrl,
          prTitle: `${isEdit ? 'Edit' : 'Add'} location: ${fields.title}`,
          submittedAt: new Date().toISOString(),
        })
        setSubmitState('success')
        setPrUrl(data.prUrl)
      } else {
        setSubmitError(data.error ?? 'Submission failed')
        setSubmitState('error')
      }
    } catch {
      setSubmitError('Request failed. Check your connection.')
      setSubmitState('error')
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>

  if (submitState === 'success') {
    return (
      <div className="loc-form">
        <div className="loc-form__success">
          ✓ Changes submitted for review.{' '}
          <a href={prUrl} target="_blank" rel="noopener noreferrer" className="loc-form__pr-link">
            View pull request →
          </a>
        </div>
        <div className="loc-form__actions" style={{ marginTop: 20 }}>
          <button
            className="loc-form__cancel"
            onClick={() => navigate(`/editor/locations/${project}/${city}`)}
          >
            Back to list
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="loc-form" onSubmit={handleSubmit}>

      <div className="loc-form__section">
        <div className="loc-form__section-title">Identity</div>

        <div className="loc-form__field">
          <label className="loc-form__label">
            Location ID <span className="loc-form__label--muted">(number, must be unique)</span>
          </label>
          <input
            type="number"
            value={fields.locationId}
            onChange={e => set('locationId', e.target.value)}
            required
            readOnly={isEdit}
            className={`loc-form__input${isEdit ? ' loc-form__input--readonly' : ''}`}
          />
        </div>

        <div className="loc-form__field">
          <label className="loc-form__label">Title</label>
          <input
            type="text"
            value={fields.title}
            onChange={e => set('title', e.target.value)}
            required
            className="loc-form__input"
          />
        </div>

        <div className="loc-form__field">
          <label className="loc-form__label">
            Image filename <span className="loc-form__label--muted">(e.g. my-photo.jpg — upload separately)</span>
          </label>
          <input
            type="text"
            value={fields.image}
            onChange={e => set('image', e.target.value)}
            className="loc-form__input"
          />
        </div>

        <div className="loc-form__row">
          <div className="loc-form__field">
            <label className="loc-form__label">Name label</label>
            <input
              type="text"
              value={fields.name.label}
              onChange={e => set('name.label', e.target.value)}
              className="loc-form__input"
            />
          </div>
          <div className="loc-form__field">
            <label className="loc-form__label">Name value</label>
            <input
              type="text"
              value={fields.name.value}
              onChange={e => set('name.value', e.target.value)}
              className="loc-form__input"
            />
          </div>
        </div>

        <div className="loc-form__field">
          <label className="loc-form__label">Street address</label>
          <input
            type="text"
            value={fields.address}
            onChange={e => set('address', e.target.value)}
            className="loc-form__input"
          />
        </div>

        <div className="loc-form__row">
          <div className="loc-form__field">
            <label className="loc-form__label">Latitude</label>
            <input
              type="number"
              step="any"
              value={fields.coordinates.latitude}
              onChange={e => set('coordinates.latitude', e.target.value)}
              className="loc-form__input"
            />
          </div>
          <div className="loc-form__field">
            <label className="loc-form__label">Longitude</label>
            <input
              type="number"
              step="any"
              value={fields.coordinates.longitude}
              onChange={e => set('coordinates.longitude', e.target.value)}
              className="loc-form__input"
            />
          </div>
        </div>
      </div>

      <div className="loc-form__section">
        <div className="loc-form__section-title">Narrative</div>

        <div className="loc-form__field">
          <label className="loc-form__label">Storyline</label>
          <textarea
            value={fields.storyline}
            onChange={e => set('storyline', e.target.value)}
            className="loc-form__textarea"
            style={{ minHeight: 120 }}
          />
        </div>

        <div className="loc-form__field">
          <label className="loc-form__label">Breadcrumb clue</label>
          <textarea
            value={fields.breadcrumb}
            onChange={e => set('breadcrumb', e.target.value)}
            className="loc-form__textarea"
          />
        </div>
      </div>

      <div className="loc-form__section">
        <div className="loc-form__section-title">Challenge</div>

        <div className="loc-form__field">
          <label className="loc-form__label">Challenge name</label>
          <input
            type="text"
            value={fields.challenge.name}
            onChange={e => set('challenge.name', e.target.value)}
            className="loc-form__input"
          />
        </div>

        <div className="loc-form__field">
          <label className="loc-form__label">Challenge description</label>
          <textarea
            value={fields.challenge.description}
            onChange={e => set('challenge.description', e.target.value)}
            className="loc-form__textarea"
            style={{ minHeight: 100 }}
          />
        </div>

        <div className="loc-form__field">
          <label className="loc-form__label">
            Notes <span className="loc-form__label--muted">(internal, not shown to participants)</span>
          </label>
          <textarea
            value={fields.challenge.notes}
            onChange={e => set('challenge.notes', e.target.value)}
            className="loc-form__textarea"
          />
        </div>

        {isEdit && fields.challenge.form?.length > 0 && (
          <p className="loc-form__hint">
            This location has {fields.challenge.form.length} form field(s). Form fields are preserved but not editable here — edit them directly in the YAML file.
          </p>
        )}
      </div>

      {submitError && <div className="loc-form__error">✕ {submitError}</div>}

      <div className="loc-form__actions">
        <button
          type="button"
          className="loc-form__cancel"
          onClick={() => navigate(`/editor/locations/${project}/${city}`)}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitState === 'submitting'}
          className={`loc-form__submit${submitState === 'submitting' ? ' loc-form__submit--loading' : ''}`}
        >
          {submitState === 'submitting' ? 'Submitting…' : 'Submit for review'}
        </button>
      </div>
    </form>
  )
}
