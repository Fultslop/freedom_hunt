import { useState, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import { useTheme } from '../theme/ThemeContext'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'

const pin = L.divIcon({
  className: '',
  html: '<div style="width:14px;height:14px;background:#BF0A30;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>',
  iconAnchor: [7, 7],
})

function getImageUrl(imageName) {
  switch (imageName) {
    case 'alireza-parpaei-den-haag-binnenhof-unsplash.jpg':
      return new URL('../data/img/alireza-parpaei-den-haag-binnenhof-unsplash.jpg', import.meta.url).href
    case 'rafael-ishkhanyan-den-haag-peace-palace-unsplash.jpg':
      return new URL('../data/img/rafael-ishkhanyan-den-haag-peace-palace-unsplash.jpg', import.meta.url).href
    case 'den-haag-het-plein.jpg':
      return new URL('../data/img/den-haag-het-plein.jpg', import.meta.url).href
    default:
      return null
  }
}

export default function ChallengeCard({ location }) {
  const { theme } = useTheme()
  const [uploadState, setUploadState] = useState('idle')
  const fileInputRef = useRef(null)
  const heroSrc = location.image ? getImageUrl(location.image) : null
  const hasHero = !!heroSrc
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
    <div style={{
      background: theme.surface,
      borderRadius: 8,
      boxShadow: hasHero ? '0 2px 12px rgba(0,0,0,0.15)' : 'none',
      padding: 14,
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
    }}>
      <div style={{
        minWidth: 44,
        height: 44,
        background: '#002868',
        color: '#fff',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 20,
        fontWeight: 800,
        flexShrink: 0,
      }}>
        {location.locationId}
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: theme.text, lineHeight: 1.25 }}>
          {location.title}
        </div>
        {location.name?.value && (
          <div style={{ fontSize: 13, color: theme.textSecondary, marginTop: 3 }}>
            {location.name.value}
          </div>
        )}
        {location.address && (
          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>
            {location.address}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ background: theme.background }}>

      {hasHero ? (
        <div style={{ position: 'relative', marginBottom: 48 }}>
          <img
            src={heroSrc}
            alt={location.name?.value || location.title}
            style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }}
          />
          <div style={{ position: 'absolute', bottom: -48, left: 16, right: 16 }}>
            {titleCard}
          </div>
        </div>
      ) : (
        <div style={{ margin: 16 }}>
          {titleCard}
        </div>
      )}

      <div style={{ padding: 16, borderBottom: `1px solid ${theme.border}` }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: theme.textMuted, marginBottom: 8 }}>
          Storyline
        </div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: theme.text }}>
          {location.storyline}
        </p>
      </div>

      <div style={{ padding: 16, borderBottom: `1px solid ${theme.border}` }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: theme.textMuted, marginBottom: 8 }}>
          Location
        </div>
        <MapContainer
          key={location.locationId}
          center={pos}
          zoom={16}
          style={{ height: 180, borderRadius: 6, border: `1px solid ${theme.border}` }}
          zoomControl={false}
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <Marker position={pos} icon={pin} />
        </MapContainer>
        <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 6, fontFamily: 'monospace' }}>
          {location.coordinates.latitude}° N, {location.coordinates.longitude}° E
        </div>

        <div style={{ marginTop: 14, background: theme.surface, borderRadius: 6, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: theme.textMuted, marginBottom: 6 }}>
            Challenge
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: theme.text }}>
            {location.challenge.description}
          </p>
        </div>

        <div style={{ marginTop: 12 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          {uploadState === 'success' ? (
            <div style={{ fontSize: 13, color: '#2d7a2d', fontWeight: 600 }}>✓ Photo submitted</div>
          ) : (
            <>
              <button
                onClick={() => fileInputRef.current.click()}
                disabled={uploadState === 'uploading'}
                style={{
                  width: '100%',
                  padding: '10px 0',
                  background: uploadState === 'uploading' ? theme.surface : '#002868',
                  color: uploadState === 'uploading' ? theme.textMuted : '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: uploadState === 'uploading' ? 'not-allowed' : 'pointer',
                }}
              >
                {uploadState === 'uploading' ? 'Uploading…' : uploadState === 'error' ? '📷 Try again' : '📷 Submit photo proof'}
              </button>
              {uploadState === 'error' && (
                <div style={{ fontSize: 11, color: '#BF0A30', marginTop: 4 }}>Upload failed. Please try again.</div>
              )}
            </>
          )}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: theme.textMuted, marginBottom: 8 }}>
          Your clue to your next destination
        </div>
        <p style={{
          margin: 0,
          fontSize: 14,
          lineHeight: 1.65,
          color: theme.text,
          fontStyle: 'italic',
          borderLeft: '3px solid #BF0A30',
          paddingLeft: 12,
        }}>
          {location.breadcrumb}
        </p>
      </div>

    </div>
  )
}
