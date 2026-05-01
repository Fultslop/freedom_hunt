import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LanguageProvider } from './i18n/LanguageContext'
import { ThemeProvider, useTheme } from './theme/ThemeContext'
import { TitleBarProvider } from './theme/TitleBarContext'
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import TitleBar from './components/TitleBar'
import AppPage from './pages/AppPage'
import LoginPage from './pages/LoginPage'
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
            <AuthProvider>
              <ThemeBodySync />
              <TitleBar />
              <Routes>
                <Route path="/" element={<AppPage />} />
                <Route path="/login/:project" element={<LoginPage />} />
                <Route path="/:project" element={<ProtectedRoute><ProjectPage /></ProtectedRoute>} />
                <Route path="/:project/:city" element={<ProtectedRoute><CityPage /></ProtectedRoute>} />
                <Route path="/:project/:city/:route" element={<ProtectedRoute><RoutePage /></ProtectedRoute>} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TitleBarProvider>
      </ThemeProvider>
    </LanguageProvider>
  )
}
