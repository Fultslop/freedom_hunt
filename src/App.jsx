import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LanguageProvider } from './i18n/LanguageContext'
import { ThemeProvider, useTheme } from './theme/ThemeContext'
import { TitleBarProvider } from './theme/TitleBarContext'
import TitleBar from './components/TitleBar'
import AppPage from './pages/AppPage'
import ProjectPage from './pages/ProjectPage'
import CityPage from './pages/CityPage'
import RoutePage from './pages/RoutePage'

function ThemeBodySync() {
  const { theme } = useTheme()
  useEffect(() => {
    document.body.style.background = theme.background
  }, [theme])
  return null
}

export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <TitleBarProvider>
          <BrowserRouter>
            <ThemeBodySync />
            <TitleBar />
            <Routes>
              <Route path="/" element={<AppPage />} />
              <Route path="/:project" element={<ProjectPage />} />
              <Route path="/:project/:city" element={<CityPage />} />
              <Route path="/:project/:city/:route" element={<RoutePage />} />
            </Routes>
          </BrowserRouter>
        </TitleBarProvider>
      </ThemeProvider>
    </LanguageProvider>
  )
}
