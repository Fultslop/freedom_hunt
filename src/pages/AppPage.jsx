import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useText } from '../hooks/useText'
import { useTheme } from '../theme/ThemeContext'
import { useTitleBar } from '../theme/TitleBarContext'
import MarkdownText from '../components/MarkdownText'
import { fetchImage } from '../assets/AssetManager'
import './AppPage.css'

export default function AppPage() {
  const navigate = useNavigate()
  const { text: appText, loading: appLoading } = useText('application')
  const { text: projectsText, loading: projectsLoading } = useText('projects/projects')
  const { theme, setThemeName } = useTheme()
  const [landingImageUrl, setLandingImageUrl] = useState(null)
  const [imgHeight, setImgHeight] = useState(0)

  useTitleBar({ title: appText?.['app.title'], progress: null, backPath: null })

  useEffect(() => { setThemeName('app') }, [setThemeName])
  useEffect(() => { fetchImage('landing-page.jpg').then(setLandingImageUrl) }, [])

  if (appLoading || projectsLoading) return (
    <div style={{ padding: 24, background: theme.background, color: theme.text }}>Loading…</div>
  )
  if (!projectsText) return (
    <div style={{ padding: 24, background: theme.background, color: theme.text }}>Content unavailable.</div>
  )

  // Pull content up so its top sits at 20% of viewport height from the top
  const contentMarginTop = imgHeight
    ? Math.round(-(imgHeight / 2 - window.innerHeight * 0.2))
    : (landingImageUrl ? -80 : 0)

  return (
    <div className="app-page">
      {landingImageUrl && (
        <div
          className="app-page__hero-wrap"
          style={{ height: imgHeight ? imgHeight / 2 : 'auto' }}
        >
          <img
            src={landingImageUrl}
            alt=""
            onLoad={e => setImgHeight(e.target.offsetHeight)}
            className="app-page__hero-img"
          />
          <div className="app-page__hero-gradient" />
        </div>
      )}

      <div
        className="app-page__content"
        style={{ marginTop: contentMarginTop }}
      >
        {appText && (
          <div className="app-page__heading">
            <h1 className="app-page__title">{appText['app.title']}</h1>
            <p className="app-page__tagline">{appText['app.tagline']}</p>
          </div>
        )}
        <h2 className="app-page__subtitle">
          {projectsText['page.subtitle']}
        </h2>
        {projectsText.items.map(project => (
          <div
            key={project.id}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/${project.id}`)}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && navigate(`/${project.id}`)}
            className="app-page__project-card"
          >
            <div className="app-page__project-name">{project.name}</div>
            <MarkdownText
              text={project.description}
              style={{ fontSize: 13, color: theme.textMuted, marginTop: 4, lineHeight: 1.5 }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
