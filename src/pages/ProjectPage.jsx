import { useParams } from 'react-router-dom'
import { useText } from '../hooks/useText'
import CitySelector from '../components/CitySelector'

export default function ProjectPage() {
  const { project } = useParams()
  const { text, loading } = useText(`projects/${project}/cities`)

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>
  if (!text) return <div style={{ padding: 24 }}>Project not found.</div>

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <style>{`html, body, #root { margin: 0; padding: 0; }`}</style>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{text['page.title']}</h1>
      <div style={{ marginTop: 24 }}>
        {text.items.map(city => (
          <CitySelector key={city.id} project={project} city={city} />
        ))}
      </div>
    </div>
  )
}
