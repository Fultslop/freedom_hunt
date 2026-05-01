import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from './AuthContext'

export default function ProtectedRoute({ children }) {
  const { activeAuth, authLoading, isLoggingOut } = useAuth()
  const { project } = useParams()
  if (authLoading) return null
  // Don't redirect during logout transition — the user is already being navigated to /
  if (!activeAuth && !isLoggingOut) {
    return <Navigate to={`/login/${project}`} replace />
  }
  return children
}
