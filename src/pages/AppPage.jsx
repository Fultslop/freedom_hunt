import { useNavigate } from 'react-router-dom'
import { useText } from '../hooks/useText'

const STYLE_RESET = `html, body, #root { margin: 0; padding: 0; }`

export default function AppPage() {
  const navigate = useNavigate()
  const { text: appText, loading: appLoading } = useText('application')
  const { text: projectsText, loading: projectsLoading } = useText('projects/projects')

  if (appLoading || projectsLoading) return <><style>{STYLE_RESET}</style><div style={{ padding: 24 }}>Loading…</div></>
  if (!projectsText) return <><style>{STYLE_RESET}</style><div style={{ padding: 24 }}>Content unavailable.</div></>

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <style>{STYLE_RESET}</style>

      {appText && (
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{appText['app.title']}</h1>
          <p style={{ fontSize: 15, color: '#666', marginTop: 8 }}>{appText['app.tagline']}</p>
        </div>
      )}

      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
        {projectsText['page.subtitle']}
      </h2>
      {projectsText.items.map(project => (
        <div
          key={project.id}
          role="button"
          tabIndex={0}
          onClick={() => navigate(`/${project.id}`)}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && navigate(`/${project.id}`)}
          style={{
            padding: '16px 20px',
            border: '1px solid #ddd',
            borderRadius: 8,
            cursor: 'pointer',
            marginBottom: 12,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 17 }}>{project.name}</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{project.description}</div>
        </div>
      ))}
    </div>
  )
}
