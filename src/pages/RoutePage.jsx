import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useText } from '../hooks/useText'
import { useLocations } from '../hooks/useLocations'
import { useTheme } from '../theme/ThemeContext'
import { useTitleBar } from '../theme/TitleBarContext'
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
  const { theme } = useTheme()

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

  useTitleBar({
    title: route.replace(/_/g, ' '),
    progress: locations.length > 0 ? { current: currentIndex + 1, total: locations.length } : null,
    backPath: `/${project}/${city}`,
  })

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
    return <div style={{ padding: 24, background: theme.background, color: theme.text }}>Loading…</div>
  }

  if (!routeData) {
    return <div style={{ padding: 24, background: theme.background, color: theme.text }}>Route not found.</div>
  }

  const location = locations[currentIndex]
  if (!location) {
    return <div style={{ padding: 24, background: theme.background, color: theme.text }}>No locations found for this route.</div>
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ userSelect: 'none', background: theme.background, minHeight: '100vh' }}
    >
      <style>{`html, body, #root { margin: 0; padding: 0; height: 100%; }`}</style>

      <ChallengeCard location={location} />

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 24px',
        borderTop: `1px solid ${theme.border}`,
        background: theme.surface,
      }}>
        <div style={{ width: 80 }}>
          {currentIndex > 0 && (
            <button
              onClick={() => setCurrentIndex(i => clampedPrev(i))}
              style={{ padding: '8px 16px', cursor: 'pointer', background: theme.surface, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 4 }}
            >
              ← Prev
            </button>
          )}
        </div>
        <button
          onClick={() => navigate(`/${project}/${city}`)}
          style={{ padding: '8px 16px', cursor: 'pointer', background: theme.surface, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 4 }}
        >
          Exit
        </button>
        <div style={{ width: 80, display: 'flex', justifyContent: 'flex-end' }}>
          {currentIndex < locations.length - 1 && (
            <button
              onClick={() => setCurrentIndex(i => clampedNext(i, locations.length))}
              style={{ padding: '8px 16px', cursor: 'pointer', background: theme.surface, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 4 }}
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
