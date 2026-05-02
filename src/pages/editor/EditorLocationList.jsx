import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTitleBar } from '../../theme/TitleBarContext'
import { getPending, addPending, removePending } from './editorStorage'
import './EditorLocationList.css'

export default function EditorLocationList() {
  const { project, city } = useParams()
  const navigate = useNavigate()
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState([])

  useTitleBar({ title: 'Locations', progress: null, backPath: '/editor' })

  const fetchLocations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/editor/locations?project=${project}&city=${city}`)
      const data = await res.json()
      if (data.ok) {
        setLocations(data.locations.sort((a, b) => (a.location.locationId ?? 0) - (b.location.locationId ?? 0)))
      } else {
        setError(data.error ?? 'Failed to load locations')
      }
    } catch {
      setError('Failed to load locations')
    } finally {
      setLoading(false)
    }
  }, [project, city])

  const syncPending = useCallback(() => {
    const items = getPending(project, city)
    setPending(items)
    if (!items.length) return
    const numbers = items
      .map(p => p.prUrl?.match(/\/pull\/(\d+)/)?.[1])
      .filter(Boolean)
    if (!numbers.length) return
    fetch(`/editor/pr-status?numbers=${numbers.join(',')}`)
      .then(r => r.json())
      .then(data => {
        if (!data.ok) return
        let changed = false
        items.forEach(p => {
          const n = p.prUrl?.match(/\/pull\/(\d+)/)?.[1]
          if (n && data.statuses[n] === 'closed') {
            removePending(project, city, p.filename)
            changed = true
          }
        })
        if (changed) setPending(getPending(project, city))
      })
      .catch(() => {})
  }, [project, city])

  useEffect(() => {
    fetchLocations()
    syncPending()
  }, [fetchLocations, syncPending])

  async function handleHide(loc, sha) {
    if (!window.confirm(`Hide "${loc.title}"? This will open a PR setting hidden: true.`)) return
    const { _filename, ...cleanLoc } = loc
    try {
      const res = await fetch('/editor/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project,
          city,
          filename: _filename,
          existingSha: sha,
          location: { ...cleanLoc, hidden: true },
        }),
      })
      const data = await res.json()
      if (data.ok) {
        addPending(project, city, {
          filename: loc._filename,
          locationTitle: loc.title,
          prUrl: data.prUrl,
          prTitle: `Hide location: ${loc.title}`,
          submittedAt: new Date().toISOString(),
        })
        setPending(getPending(project, city))
      } else {
        alert(`Failed: ${data.error}`)
      }
    } catch {
      alert('Request failed.')
    }
  }

  function pendingFor(filename) {
    return pending.find(p => p.filename === filename)
  }

  function isNewLocation(filename) {
    return pending.some(p => p.filename === filename && p.prTitle?.startsWith('Add location:'))
  }

  function handleDelete(filename) {
    const pend = pendingFor(filename)
    if (!window.confirm(`Remove this new location? You will need to close the PR on GitHub manually.\n\n${pend?.prUrl ?? ''}`)) return
    removePending(project, city, filename)
    setPending(getPending(project, city))
  }

  if (loading) return <div className="loc-list__loading">Loading…</div>
  if (error) return <div className="loc-list__error">{error}</div>

  return (
    <div className="loc-list">
      <div className="loc-list__toolbar">
        <button
          className="loc-list__add-btn"
          onClick={() => navigate(`/editor/locations/${project}/${city}/new`)}
        >
          + Add location
        </button>
        <button className="loc-list__refresh-btn" onClick={() => { fetchLocations(); syncPending() }}>
          Refresh
        </button>
      </div>

      {locations.map(({ filename, sha, location }) => {
        const pend = pendingFor(filename)
        return (
          <div key={filename} className="loc-list__item">
            <div className="loc-list__item-header">
              <div>
                <div className="loc-list__item-title">{location.title || filename}</div>
                <div className="loc-list__item-meta">
                  {location.address || `ID: ${location.locationId}`}
                </div>
              </div>
              <div className="loc-list__item-actions">
                <button
                  className="loc-list__btn"
                  onClick={() => navigate(`/editor/locations/${project}/${city}/edit/${filename}`)}
                >
                  Edit
                </button>
                <button
                  className="loc-list__btn loc-list__btn--danger"
                  onClick={() => handleHide({ ...location, _filename: filename }, sha)}
                >
                  Hide
                </button>
                {isNewLocation(filename) && (
                  <button
                    className="loc-list__btn loc-list__btn--danger"
                    onClick={() => handleDelete(filename)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
            {pend && (
              <a href={pend.prUrl} target="_blank" rel="noopener noreferrer" className="loc-list__pending">
                ⏳ Pending edit — view PR
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}
