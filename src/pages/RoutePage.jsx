import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useText } from '../hooks/useText'
import { useLocations } from '../hooks/useLocations'
import { useTheme } from '../theme/ThemeContext'
import { useTitleBar } from '../theme/TitleBarContext'
import ChallengeCard from '../components/ChallengeCard'
import { ChevronLeft, ChevronRight } from 'lucide-react'

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
  const [direction, setDirection] = useState('next')

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
    if (delta < -60) {
      setDirection('next')
      setCurrentIndex(i => clampedNext(i, locations.length))
    } else if (delta > 60) {
      setDirection('prev')
      setCurrentIndex(i => clampedPrev(i))
    }
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
      <style>{`
        html, body, #root { margin: 0; padding: 0; height: 100%; }
        @keyframes slideInFromRight {
          from { transform: translateX(40px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideInFromLeft {
          from { transform: translateX(-40px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>

      <div style={{ paddingBottom: 60 }}>
        <div
          key={currentIndex}
          style={{ animation: `${direction === 'next' ? 'slideInFromRight' : 'slideInFromLeft'} 250ms ease-out` }}
        >
          {/* isLast: hides the breadcrumb clue on the final stop */}
          <ChallengeCard location={location} isLast={currentIndex === locations.length - 1} index={currentIndex + 1} />
        </div>
      </div>

      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
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
              aria-label="Previous stop"
              onClick={() => { setDirection('prev'); setCurrentIndex(i => clampedPrev(i)) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '8px 14px',
                cursor: 'pointer',
                background: 'transparent',
                color: theme.textSecondary,
                border: `1px solid ${theme.border}`,
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              <ChevronLeft size={16} aria-hidden /> Prev
            </button>
          )}
        </div>

        <button
          onClick={() => navigate(`/${project}/${city}`)}
          style={{
            padding: '8px 14px',
            cursor: 'pointer',
            background: 'transparent',
            color: theme.textMuted,
            border: 'none',
            fontSize: 12,
          }}
        >
          Exit
        </button>

        <div style={{ width: 80, display: 'flex', justifyContent: 'flex-end' }}>
          {currentIndex < locations.length - 1 && (
            <button
              aria-label="Next stop"
              onClick={() => { setDirection('next'); setCurrentIndex(i => clampedNext(i, locations.length)) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '8px 14px',
                cursor: 'pointer',
                background: theme.accent,
                color: '#000',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Next <ChevronRight size={16} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
