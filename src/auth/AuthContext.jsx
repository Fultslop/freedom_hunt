import { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [activeAuth, setActiveAuth] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  // Reset the logout flag once navigation has committed (location changed).
  // We can't reset it inside logout() because React 18 batches it with
  // setActiveAuth(null), which defeats the ProtectedRoute guard.
  useEffect(() => {
    setIsLoggingOut(false)
  }, [location.pathname])

  useEffect(() => {
    fetch('/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setActiveAuth({ projectId: data.project, teamName: data.teamName, contact: data.contact })
        }
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false))
  }, [])

  function login(projectId, teamName, contact) {
    setActiveAuth({ projectId, teamName, contact })
  }

  async function logout() {
    setIsLoggingOut(true)
    try {
      await fetch('/auth/logout', { method: 'POST' })
    } catch {}
    // Clear auth first so ProtectedRoute doesn't redirect mid-flight.
    // Navigate after so the / route is already active when the page renders.
    setActiveAuth(null)
    navigate('/', { replace: true })
    // isLoggingOut stays true here; the location-change effect above resets it
    // once navigation commits so ProtectedRoute never sees null+false together.
  }

  return (
    <AuthContext.Provider value={{ activeAuth, authLoading, login, logout, isLoggingOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
