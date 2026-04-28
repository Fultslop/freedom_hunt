import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useText } from '../hooks/useText'
import { useLocations } from '../hooks/useLocations'
import ChallengeCard from '../components/ChallengeCard'

export function clampedNext(current, total) {
  if (total <= 0) return 0
  return Math.min(current + 1, total - 1)
}

export function clampedPrev(current) {
  return Math.max(current - 1, 0)
}

export default function RoutePage() {
  const { project, city, route } = useParams()
  const navigate = useNavigate()
  const storageKey = `${project}/${city}/${route}`

  const { text: routesText, loading: routesLoading } = useText(
    `projects/${project}/${city}/routes`
  )

  const routeData = !routesLoading && routesText ? routesText[route] : null
  const locationPaths = routeData
    ? routeData.locations.map(id => `projects/${project}/${city}/${id}`)
    : []

  const { locations, loading: locationsLoading } = useLocations(locationPaths)

  const [currentIndex, setCurrentIndex] = useState(() => {
    const saved = localStorage.getItem(storageKey)
    const parsed = saved ? parseInt(saved, 10) : 0
    return isNaN(parsed) ? 0 : parsed
  })

  const touchStartX = useRef(null)

  useEffect(() => {
    localStorage.setItem(storageKey, currentIndex)
  }, [storageKey, currentIndex])

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (delta < -60) setCurrentIndex(i => clampedNext(i, locations.length))
    else if (delta > 60) setCurrentIndex(i => clampedPrev(i))
  }

  if (routesLoading || locationsLoading) {
    return <div style={{ padding: 24 }}>Loading…</div>
  }

  if (!routeData) {
    return <div style={{ padding: 24 }}>Route not found.</div>
  }

  const location = locations[currentIndex]
  if (!location) {
    return <div style={{ padding: 24 }}>No locations found for this route.</div>
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ userSelect: 'none' }}
    >
      <style>{`html, body, #root { margin: 0; padding: 0; height: 100%; }`}</style>

      <ChallengeCard
        location={location}
        index={currentIndex}
        total={locations.length}
      />

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '12px 24px',
        borderTop: '1px solid #eee',
      }}>
        <button
          onClick={() => setCurrentIndex(i => clampedPrev(i))}
          disabled={currentIndex === 0}
          style={{ padding: '8px 16px', cursor: 'pointer' }}
        >
          ← Prev
        </button>
        <button
          onClick={() => navigate(`/${project}/${city}`)}
          style={{ padding: '8px 16px', cursor: 'pointer' }}
        >
          Exit
        </button>
        <button
          onClick={() => setCurrentIndex(i => clampedNext(i, locations.length))}
          disabled={currentIndex === locations.length - 1}
          style={{ padding: '8px 16px', cursor: 'pointer' }}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
