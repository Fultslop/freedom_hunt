import { useNavigate } from 'react-router-dom'

export default function RouteSelector({ project, city, routeId, route }) {
  const navigate = useNavigate()
  const handleNav = () => navigate(`/${project}/${city}/${routeId}`)
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
      <div style={{ fontWeight: 600, fontSize: 17, textTransform: 'capitalize' }}>
        {routeId.replace(/_/g, ' ')}
      </div>
      <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{route.description}</div>
      <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
        {route.locations.length} stop{route.locations.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
