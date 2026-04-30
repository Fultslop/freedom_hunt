import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchImage } from '../assets/AssetManager'

export default function CitySelector({ project, city }) {
  const navigate = useNavigate()
  const [imageSrc, setImageSrc] = useState(null)

  useEffect(() => {
    if (!city.image) { setImageSrc(null); return }
    let cancelled = false
    fetchImage(city.image).then(url => {
      if (!cancelled) setImageSrc(url)
    })
    return () => { cancelled = true }
  }, [city.image])

  const handleNav = () => navigate(`/${project}/${city.id}`)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleNav}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleNav()}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        border: '1px solid #ddd',
        borderRadius: 8,
        cursor: 'pointer',
        marginBottom: 12,
      }}
    >
      {imageSrc && (
        <img
          src={imageSrc}
          alt={city.name}
          style={{
            width: 60,
            height: 60,
            objectFit: 'cover',
            borderRadius: 8,
            marginRight: 16,
            flexShrink: 0,
          }}
        />
      )}
      <div>
        <div style={{ fontWeight: 600, fontSize: 17 }}>{city.name}</div>
        <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{city.country}</div>
        {city.description && (
          <div style={{ fontSize: 13, color: '#888', marginTop: 6 }}>{city.description}</div>
        )}
      </div>
    </div>
  )
}
