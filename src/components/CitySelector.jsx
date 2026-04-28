import { useNavigate } from 'react-router-dom'

export default function CitySelector({ project, city }) {
  const navigate = useNavigate()
  const handleNav = () => navigate(`/${project}/${city.id}`)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleNav}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleNav()}
      style={{
        padding: '16px 20px',
        border: '1px solid #ddd',
        borderRadius: 8,
        cursor: 'pointer',
        marginBottom: 12,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 17 }}>{city.name}</div>
      <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{city.country}</div>
      {city.description && (
        <div style={{ fontSize: 13, color: '#888', marginTop: 6 }}>{city.description}</div>
      )}
    </div>
  )
}
