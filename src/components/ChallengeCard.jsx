import { useState, useRef, useEffect } from 'react'
import 'leaflet/dist/leaflet.css'
import { useTheme } from '../theme/ThemeContext'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import MarkdownText from './MarkdownText'
import ChallengeForm from './ChallengeForm'
import { BookOpen, MapPin, Crosshair, Compass, Camera } from 'lucide-react'
import { fetchImage } from '../assets/AssetManager'
import './ChallengeCard.css'

const pin = L.divIcon({
  className: '',
  html: '<div style="width:14px;height:14px;background:#BF0A30;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>',
  iconAnchor: [7, 7],
})

export default function ChallengeCard({ location, isLast, index, routeId }) {
  const { theme } = useTheme()
  const [uploadState, setUploadState] = useState('idle')
  const fileInputRef = useRef(null)
  const [heroSrc, setHeroSrc] = useState(() => location.image ? null : null)

  useEffect(() => {
    if (!location.image) {
      setHeroSrc(null) /* eslint-disable-line react-hooks/set-state-in-effect */
      return
    }
    let cancelled = false
    fetchImage(location.image).then(url => {
      if (!cancelled) setHeroSrc(url)
    })
    return () => { cancelled = true }
  }, [location.image])

  const hasHero = !!heroSrc
  const hasPhotoField = location.challenge.form?.some(f => f.type === 'photo') ?? false
  const pos = [location.coordinates.latitude, location.coordinates.longitude]

  async function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploadState('uploading')
    const body = new FormData()
    body.append('photo', file)
    body.append('locationId', String(location.locationId))
    try {
      const res = await fetch('/upload', { method: 'POST', body })
      const data = await res.json()
      setUploadState(data.ok ? 'success' : 'error')
    } catch {
      setUploadState('error')
    }
  }

  const titleCard = (
    <div className={`cc-title-card${hasHero ? ' cc-title-card--shadow' : ''}`}>
      <div
        className="cc-badge"
        style={{ background: location.themeColor ?? theme.accent }}
        data-testid="location-badge"
      >
        {index}
      </div>
      <div>
        <div className="cc-location-title">{location.title}</div>
        {location.name?.value && (
          <div className="cc-location-name">{location.name.value}</div>
        )}
        {location.address && (
          <div className="cc-location-address">{location.address}</div>
        )}
      </div>
    </div>
  )

  return (
    <div className="cc-root">
      {hasHero ? (
        <div className="cc-hero-wrap">
          <img
            src={heroSrc}
            alt={location.name?.value || location.title}
            className="cc-hero-img"
          />
          <div className="cc-hero-title-wrap">
            {titleCard}
          </div>
        </div>
      ) : (
        <div className="cc-no-hero-wrap">
          {titleCard}
        </div>
      )}

      <div className="cc-section">
        <div className="cc-section-label">
          <BookOpen size={12} aria-hidden />
          Storyline
        </div>
        <MarkdownText text={location.storyline} />
      </div>

      <div className="cc-section">
        <div className="cc-section-label">
          <MapPin size={12} aria-hidden />
          Location
        </div>
        <MapContainer
          key={location.locationId}
          center={pos}
          zoom={16}
          style={{ height: 180, borderRadius: 6, border: '1px solid var(--color-border)' }}
          zoomControl={false}
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <Marker position={pos} icon={pin} />
        </MapContainer>
        <div className="cc-map-coords">
          {location.coordinates.latitude}° N, {location.coordinates.longitude}° E
        </div>

        <div className="cc-challenge-box">
          <div className="cc-section-label">
            <Crosshair size={12} aria-hidden />
            Challenge
          </div>
          <MarkdownText text={location.challenge.description} />
        </div>

        {location.challenge.form && location.challenge.form.length > 0 && (
          <ChallengeForm form={location.challenge.form} locationId={location.locationId} routeId={routeId} />
        )}

        {hasPhotoField && (
          <div className="cc-photo-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            {uploadState === 'success' ? (
              <div className="cc-photo-success">✓ Photo submitted</div>
            ) : (
              <>
                <button
                  data-testid="submit-btn"
                  onClick={() => fileInputRef.current.click()}
                  disabled={uploadState === 'uploading'}
                  className={`cc-photo-btn cc-photo-btn--${uploadState}`}
                >
                  {uploadState === 'uploading'
                    ? 'Uploading…'
                    : uploadState === 'error'
                      ? <><Camera size={14} aria-hidden style={{ verticalAlign: 'middle', marginRight: 4 }} /> Try again</>
                      : <><Camera size={14} aria-hidden style={{ verticalAlign: 'middle', marginRight: 4 }} /> Submit photo proof</>
                  }
                </button>
                {uploadState === 'error' && (
                  <div className="cc-photo-error">Upload failed. Please try again.</div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {!isLast && (
        <div className="cc-section--no-border">
          <div className="cc-section-label">
            <Compass size={12} aria-hidden />
            Your clue to your next destination
          </div>
          <p className="cc-breadcrumb">
            {location.breadcrumb}
          </p>
        </div>
      )}
    </div>
  )
}
