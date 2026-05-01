import { useNavigate } from 'react-router-dom'
import './RouteSelector.css'

export default function RouteSelector({ project, city, routeId, route }) {
  const navigate = useNavigate()
  const handleNav = () => navigate(`/${project}/${city}/${routeId}`)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleNav}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleNav()}
      className="route-card"
    >
      <div className="route-card__name">
        {routeId.replace(/_/g, ' ')}
      </div>
      <div className="route-card__description">{route.description}</div>
      <div className="route-card__stops">
        {route.locations.length} stop{route.locations.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
