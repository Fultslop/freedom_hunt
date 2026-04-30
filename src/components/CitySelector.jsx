import { useNavigate } from 'react-router-dom'

function getImageUrl(imageName) {
  switch (imageName) {
    case 'den-haag-logo.jpg':
      return new URL('../data/img/den-haag-logo.jpg', import.meta.url).href
    default:
      return null
  }
}

export default function CitySelector({ project, city }) {
  const navigate = useNavigate()
  const handleNav = () => navigate(`/${project}/${city.id}`)
  const imageSrc = city.image ? getImageUrl(city.image) : null
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
