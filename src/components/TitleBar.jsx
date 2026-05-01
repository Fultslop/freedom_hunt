import { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../theme/ThemeContext'
import { TitleBarContext } from '../theme/TitleBarContext'
import { themes } from '../theme/themes'
import { useAuth } from '../auth/AuthContext'

export default function TitleBar() {
  const { theme, themeName, setThemeName } = useTheme()
  const { titleBar } = useContext(TitleBarContext)
  const { title, progress, backPath } = titleBar
  const { activeAuth, logout } = useAuth()
  const navigate = useNavigate()
  const [menuView, setMenuView] = useState(null) // null | 'root' | 'profile' | 'themes'

  function closeMenu() { setMenuView(null) }

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 100, background: theme.barBackground, borderBottom: `1px solid ${theme.barBorder}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {backPath && (
            <button
              onClick={() => navigate(backPath)}
              aria-label="Back"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.barTextSecondary, fontSize: 18, padding: 0, lineHeight: 1 }}
            >←</button>
          )}
          <span style={{ fontWeight: 700, fontSize: 15, color: theme.barText }}>{title}</span>
        </div>

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuView(v => v ? null : 'root')}
            aria-label="Menu"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.barTextSecondary, fontSize: 18, padding: 4, lineHeight: 1 }}
          >☰</button>

          {menuView && (
            <div style={{ position: 'absolute', right: 0, top: '100%', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, minWidth: 180, zIndex: 200, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', overflow: 'hidden' }}>

              {menuView === 'root' && (
                <>
                  <button
                    onClick={() => setMenuView('profile')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '14px 16px', background: 'transparent', border: 'none', borderBottom: `1px solid ${theme.border}`, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>Profile</span>
                    <span style={{ fontSize: 14, color: theme.textMuted }}>›</span>
                  </button>
                  <button
                    onClick={() => setMenuView('themes')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>Themes</span>
                    <span style={{ fontSize: 14, color: theme.textMuted }}>›</span>
                  </button>
                </>
              )}

              {menuView === 'profile' && (
                <>
                  <button
                    onClick={() => setMenuView('root')}
                    aria-label="Back to menu"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: theme.barBackground, border: 'none', borderBottom: `1px solid ${theme.border}`, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span style={{ fontSize: 14, color: theme.barText }}>‹</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: theme.barText, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Profile</span>
                  </button>
                  <div style={{ padding: 16 }}>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, marginBottom: 2 }}>Team</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{activeAuth?.teamName || '—'}</div>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, marginBottom: 2 }}>Contact</div>
                      <div style={{ fontSize: 13, color: theme.text }}>{activeAuth?.contact || '—'}</div>
                    </div>
                    <button
                      onClick={async () => { await logout(); closeMenu(); navigate('/') }}
                      style={{ width: '100%', padding: 9, background: 'transparent', color: theme.accent, border: `1.5px solid ${theme.accent}`, borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                    >Sign out</button>
                  </div>
                </>
              )}

              {menuView === 'themes' && (
                <>
                  <button
                    onClick={() => setMenuView('root')}
                    aria-label="Back to menu"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: theme.barBackground, border: 'none', borderBottom: `1px solid ${theme.border}`, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span style={{ fontSize: 14, color: theme.barText }}>‹</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: theme.barText, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Themes</span>
                  </button>
                  {Object.keys(themes).map(name => (
                    <button
                      key={name}
                      onClick={() => { setThemeName(name); closeMenu() }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', padding: '12px 14px',
                        background: name === themeName ? theme.accent : 'transparent',
                        color: name === themeName ? '#ffffff' : theme.text,
                        border: 'none', borderTop: `1px solid ${theme.border}`,
                        cursor: 'pointer', fontSize: 13, fontWeight: name === themeName ? 700 : 400,
                      }}
                    >
                      <span>{name}</span>
                      {name === themeName && <span style={{ fontSize: 11 }}>✓</span>}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {progress && (
        <div data-testid="progress-bar" style={{ background: theme.progressTrack, height: 6 }}>
          <div style={{ background: 'linear-gradient(90deg, #f59e0b, #fbbf24)', width: `${(progress.current / progress.total) * 100}%`, height: '100%', transition: 'width 0.2s ease', boxShadow: '0 0 8px rgba(245,158,11,0.5)' }} />
        </div>
      )}
    </div>
  )
}
