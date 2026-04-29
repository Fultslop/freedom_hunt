import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useText } from '../hooks/useText'
import { useTheme } from '../theme/ThemeContext'
import { useTitleBar } from '../theme/TitleBarContext'

const STYLE_RESET = `html, body, #root { margin: 0; padding: 0; }`

export default function AppPage() {
  const navigate = useNavigate()
  const { text: appText, loading: appLoading } = useText('application')
  const { text: projectsText, loading: projectsLoading } = useText('projects/projects')
  const { theme, setThemeName } = useTheme()

  useTitleBar({ title: 'Freedom Hunt', progress: null, backPath: null })

  useEffect(() => { setThemeName('app') }, [setThemeName])

  if (appLoading || projectsLoading) return (
    <>
      <style>{STYLE_RESET}</style>
      <div style={{ padding: 24, background: theme.background, color: theme.text }}>Loading…</div>
    </>
  )
  if (!projectsText) return (
    <>
      <style>{STYLE_RESET}</style>
      <div style={{ padding: 24, background: theme.background, color: theme.text }}>Content unavailable.</div>
    </>
  )

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 24, background: theme.background, minHeight: '100vh' }}>
      <style>{STYLE_RESET}</style>

      {appText && (
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: theme.text }}>{appText['app.title']}</h1>
          <p style={{ fontSize: 15, color: theme.textSecondary, marginTop: 8 }}>{appText['app.tagline']}</p>
        </div>
      )}

      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: theme.text }}>
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
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            cursor: 'pointer',
            marginBottom: 12,
            background: theme.surface,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 17, color: theme.text }}>{project.name}</div>
          <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 4 }}>{project.description}</div>
        </div>
      ))}
    </div>
  )
}
