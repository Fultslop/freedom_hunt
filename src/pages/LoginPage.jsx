import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import './LoginPage.css'

export default function LoginPage() {
  const { project } = useParams()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [teamName, setTeamName] = useState('')
  const [contact, setContact] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, teamName, contact, password }),
      })
      const data = await res.json()
      if (data.ok) {
        login(project, data.teamName, data.contact)
        navigate(`/${project}`)
      } else {
        setError(data.error || 'Incorrect password. Please try again.')
      }
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__header">
        <div className="login-page__project">
          {project.replace(/_/g, ' ')}
        </div>
        <div className="login-page__headline">Join the Hunt</div>
        <div className="login-page__subtext">
          Enter your team details and the password<br />shared by your event organizer.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="login-page__form">
        <div className="login-page__field">
          <label className="login-page__label">
            Team name
          </label>
          <input
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            required
            placeholder="Your team name"
            className="login-page__input"
          />
        </div>

        <div className="login-page__field">
          <label className="login-page__label">
            Contact email <span className="login-page__label-note">(optional)</span>
          </label>
          <input
            type="email"
            value={contact}
            onChange={e => setContact(e.target.value)}
            placeholder="you@example.com"
            className="login-page__input"
          />
        </div>

        <div className={error ? 'login-page__field--last-error' : 'login-page__field--last'}>
          <label className="login-page__label">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            placeholder="Event password"
            className={`login-page__input${error ? ' login-page__input--error' : ''}`}
          />
        </div>

        {error && (
          <div className="login-page__error">✕ {error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`login-page__submit${loading ? ' login-page__submit--loading' : ''}`}
        >
          {loading ? 'Joining…' : 'Join the Hunt'}
        </button>
      </form>
    </div>
  )
}
