import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from './AuthContext'

export default function ProtectedRoute({ children }) {
  const { activeAuth } = useAuth()
  const { project } = useParams()
  if (!activeAuth) {
    return <Navigate to={`/login/${project}`} replace />
  }
  return children
}
