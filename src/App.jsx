import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LanguageProvider } from './i18n/LanguageContext'
import AppPage from './pages/AppPage'
import ProjectPage from './pages/ProjectPage'
import CityPage from './pages/CityPage'
import RoutePage from './pages/RoutePage'

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppPage />} />
          <Route path="/:project" element={<ProjectPage />} />
          <Route path="/:project/:city" element={<CityPage />} />
          <Route path="/:project/:city/:route" element={<RoutePage />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  )
}
