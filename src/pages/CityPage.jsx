import { useParams } from 'react-router-dom'
import { useText } from '../hooks/useText'
import { useTheme } from '../theme/ThemeContext'
import { useTitleBar } from '../theme/TitleBarContext'
import RouteSelector from '../components/RouteSelector'

const STYLE_RESET = `html, body, #root { margin: 0; padding: 0; }`

export default function CityPage() {
  const { project, city } = useParams()
  const { text: cityText, loading: cityLoading } = useText(
    `projects/${project}/${city}/${city}`
  )
  const { text: routesText, loading: routesLoading } = useText(
    `projects/${project}/${city}/routes`
  )
  const { theme } = useTheme()

  useTitleBar({
    title: cityText?.['city.title'] ?? city,
    progress: null,
    backPath: `/${project}`,
  })

  if (cityLoading || routesLoading) return (
    <><style>{STYLE_RESET}</style><div style={{ padding: 24, background: theme.background, color: theme.text }}>Loading…</div></>
  )
  if (!routesText) return (
    <><style>{STYLE_RESET}</style><div style={{ padding: 24, background: theme.background, color: theme.text }}>City not found.</div></>
  )

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 24, background: theme.background, minHeight: '100vh' }}>
      <style>{STYLE_RESET}</style>
      {cityText && (
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: theme.text }}>{cityText['city.title']}</h1>
          <p style={{ fontSize: 14, color: theme.textSecondary, marginTop: 8 }}>{cityText['city.description']}</p>
        </div>
      )}
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: theme.text }}>Choose a route</h2>
      {Object.entries(routesText).map(([routeId, route]) => (
        <RouteSelector
          key={routeId}
          project={project}
          city={city}
          routeId={routeId}
          route={route}
        />
      ))}
    </div>
  )
}
