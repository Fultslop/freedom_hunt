import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useText } from '../hooks/useText'
import { useLocations } from '../hooks/useLocations'
import { useTheme } from '../theme/ThemeContext'
import { useTitleBar } from '../theme/TitleBarContext'
import ChallengeCard from '../components/ChallengeCard'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import './RoutePage.css'

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
      className="route-page"
    >
      <div className="route-page__cards">
        <div
          key={currentIndex}
          style={{ animation: `${direction === 'next' ? 'slideInFromRight' : 'slideInFromLeft'} 250ms ease-out` }}
        >
          <ChallengeCard location={location} isLast={currentIndex === locations.length - 1} index={currentIndex + 1} routeId={route} />
        </div>
      </div>

      <div className="route-page__nav">
        <div className="route-page__nav-slot">
          {currentIndex > 0 && (
            <button
              aria-label="Previous stop"
              onClick={() => { setDirection('prev'); setCurrentIndex(i => clampedPrev(i)) }}
              className="route-page__prev-btn"
            >
              <ChevronLeft size={16} aria-hidden /> Prev
            </button>
          )}
        </div>

        <button
          onClick={() => navigate(`/${project}/${city}`)}
          className="route-page__exit-btn"
        >
          Exit
        </button>

        <div className="route-page__nav-slot--right">
          {currentIndex < locations.length - 1 && (
            <button
              aria-label="Next stop"
              onClick={() => { setDirection('next'); setCurrentIndex(i => clampedNext(i, locations.length)) }}
              className="route-page__next-btn"
            >
              Next <ChevronRight size={16} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
