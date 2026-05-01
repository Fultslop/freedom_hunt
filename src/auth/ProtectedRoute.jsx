import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from './AuthContext'

export default function ProtectedRoute({ children }) {
  const { activeAuth, authLoading } = useAuth()
  const { project } = useParams()
  if (authLoading) return null
  if (!activeAuth) {
    return <Navigate to={`/login/${project}`} replace />
  }
  return children
}
