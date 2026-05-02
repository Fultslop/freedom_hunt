import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useText } from '../hooks/useText'
import { useTheme } from '../theme/ThemeContext'
import { useTitleBar } from '../theme/TitleBarContext'
import { fetchImage } from '../assets/AssetManager'

import CitySelector from '../components/CitySelector'
import MarkdownText from '../components/MarkdownText'

import './ProjectPage.css'

export default function ProjectPage() {
  const { project } = useParams()
  const { text: projectMeta } = useText(`projects/${project}/${project}`)
  const { text: citiesText, loading: citiesLoading } = useText(`projects/${project}/cities`)
  const { theme, setThemeName } = useTheme()
  const [logoUrl, setLogoUrl] = useState(null)

  useEffect(() => {
    if (projectMeta) setThemeName(projectMeta.style ?? 'app')
  }, [projectMeta, setThemeName])

  useEffect(() => {
    if (projectMeta?.['project.image']) {
      fetchImage(projectMeta['project.image']).then(setLogoUrl)
    }
  }, [projectMeta])

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
      {logoUrl && <img src={logoUrl} alt="" className="project-page__logo" />}
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
