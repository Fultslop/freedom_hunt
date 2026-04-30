import { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../theme/ThemeContext'
import { TitleBarContext } from '../theme/TitleBarContext'
import { themes } from '../theme/themes'

export default function TitleBar() {
  const { theme, themeName, setThemeName } = useTheme()
  const { titleBar } = useContext(TitleBarContext)
  const { title, progress, backPath } = titleBar
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 100, background: theme.barBackground, borderBottom: `1px solid ${theme.barBorder}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {backPath && (
            <button
              onClick={() => navigate(backPath)}
              aria-label="Back"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.barTextSecondary, fontSize: 18, padding: 0, lineHeight: 1 }}
            >
              ←
            </button>
          )}
          <span style={{ fontWeight: 700, fontSize: 15, color: theme.barText }}>{title}</span>
        </div>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Style menu"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.barTextSecondary, fontSize: 18, padding: 4, lineHeight: 1 }}
          >
            ☰
          </button>
          {menuOpen && (
            <div style={{ position: 'absolute', right: 0, top: '100%', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 6, minWidth: 140, zIndex: 200, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
              {Object.keys(themes).map(name => (
                <button
                  key={name}
                  onClick={() => { setThemeName(name); setMenuOpen(false) }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 14px',
                    background: name === themeName ? theme.accent : 'transparent',
                    color: name === themeName ? '#ffffff' : theme.text,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: name === themeName ? 700 : 400,
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {progress && (
        <div
          data-testid="progress-bar"
          style={{ background: theme.progressTrack, height: 6 }}
        >
          <div
            style={{
              background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
              width: `${(progress.current / progress.total) * 100}%`,
              height: '100%',
              transition: 'width 0.2s ease',
              boxShadow: '0 0 8px rgba(245,158,11,0.5)',
            }}
          />
        </div>
      )}
    </div>
  )
}
