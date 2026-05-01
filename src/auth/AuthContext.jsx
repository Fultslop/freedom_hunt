import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [activeAuth, setActiveAuth] = useState(null)

  useEffect(() => {
    fetch('/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setActiveAuth({ projectId: data.project, teamName: data.teamName, contact: data.contact })
        }
      })
      .catch(() => {})
  }, [])

  function login(projectId, teamName, contact) {
    setActiveAuth({ projectId, teamName, contact })
  }

  async function logout() {
    try {
      await fetch('/auth/logout', { method: 'POST' })
    } catch {}
    setActiveAuth(null)
  }

  return (
    <AuthContext.Provider value={{ activeAuth, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
