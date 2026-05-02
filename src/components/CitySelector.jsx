import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchImage } from '../assets/AssetManager'
import './CitySelector.css'

export default function CitySelector({ project, city }) {
  const navigate = useNavigate()
  const [imageSrc, setImageSrc] = useState(() => city.image ? null : null)

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
      className="city-card"
    >
      {imageSrc && (
        <img
          src={imageSrc}
          alt={city.name}
          className="city-card__image"
        />
      )}
      <div>
        <div className="city-card__name">{city.name}</div>
        <div className="city-card__country">{city.country}</div>
        {city.description && (
          <div className="city-card__description">{city.description}</div>
        )}
      </div>
    </div>
  )
}
