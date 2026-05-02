import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useText } from '../hooks/useText'
import { useTheme } from '../theme/ThemeContext'
import { useTitleBar } from '../theme/TitleBarContext'

import CitySelector from '../components/CitySelector'
import MarkdownText from '../components/MarkdownText'

import './ProjectPage.css'

export default function ProjectPage() {
  const { project } = useParams()
  const { text: projectMeta } = useText(`projects/${project}/${project}`)
  const { text: citiesText, loading: citiesLoading } = useText(`projects/${project}/cities`)
  const { theme, setThemeName } = useTheme()

  useEffect(() => {
    if (projectMeta) setThemeName(projectMeta.style ?? 'app')
  }, [projectMeta, setThemeName])

  useTitleBar({
    title: citiesText?.['page.title'] ?? project,
    progress: null,
    backPath: '/',
  })

  if (citiesLoading) return (
    <div style={{ padding: 24, background: theme.background, color: theme.text }}>Loading…</div>
  )
  if (!citiesText) return (
    <div style={{ padding: 24, background: theme.background, color: theme.text }}>Project not found.</div>
  )

  return (
    <div className="project-page">
      <h1 className="project-page__title">{citiesText['page.title']}</h1>
      <MarkdownText text={citiesText['page.text']} />
      <h2 className="project-page__select-city">{citiesText['page.selectCity']}</h2>
      <div className="project-page__city-list">
        {citiesText.items.map(city => (
          <CitySelector key={city.id} project={project} city={city} />
        ))}
      </div>
    </div>
  )
}
