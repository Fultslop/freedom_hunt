import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTheme } from '../theme/ThemeContext'
import { useAuth } from '../auth/AuthContext'

const STYLE_RESET = `html, body, #root { margin: 0; padding: 0; }`

export default function LoginPage() {
  const { project } = useParams()
  const navigate = useNavigate()
  const { theme } = useTheme()
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
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: theme.background, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', boxSizing: 'border-box' }}>
      <style>{STYLE_RESET}</style>

      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.accent, marginBottom: 6 }}>
          {project.replace(/_/g, ' ')}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: theme.text, marginBottom: 6 }}>Join the Hunt</div>
        <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.5 }}>
          Enter your team details and the password<br />shared by your event organizer.
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 300 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: theme.text, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Team name
          </label>
          <input
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            required
            placeholder="Your team name"
            style={{ display: 'block', width: '100%', padding: '10px 12px', border: `1.5px solid ${theme.border}`, borderRadius: 6, background: theme.surface, fontSize: 13, color: theme.text, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: theme.text, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Contact email <span style={{ fontWeight: 400, color: theme.textMuted }}>(optional)</span>
          </label>
          <input
            type="email"
            value={contact}
            onChange={e => setContact(e.target.value)}
            placeholder="you@example.com"
            style={{ display: 'block', width: '100%', padding: '10px 12px', border: `1.5px solid ${theme.border}`, borderRadius: 6, background: theme.surface, fontSize: 13, color: theme.text, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: error ? 8 : 20 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: theme.text, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            placeholder="Event password"
            style={{ display: 'block', width: '100%', padding: '10px 12px', border: `1.5px solid ${error ? theme.accent : theme.border}`, borderRadius: 6, background: theme.surface, fontSize: 13, color: theme.text, boxSizing: 'border-box' }}
          />
        </div>

        {error && (
          <div style={{ fontSize: 12, color: theme.accent, fontWeight: 600, marginBottom: 16 }}>
            ✕ {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: 12, background: theme.accent, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Joining…' : 'Join the Hunt'}
        </button>
      </form>
    </div>
  )
}
