import { useTheme } from '../theme/ThemeContext'

export default function ChallengeCard({ location }) {
  const { theme } = useTheme()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 24, background: theme.background }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: theme.text }}>{location.title}</h1>

      <p style={{ fontSize: 16, lineHeight: 1.6, margin: 0, color: theme.textSecondary }}>{location.storyline}</p>

      <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.textMuted, marginBottom: 8 }}>Clue</div>
        <p style={{
          fontSize: 15,
          lineHeight: 1.6,
          margin: 0,
          fontStyle: 'italic',
          color: theme.textSecondary,
          background: theme.clueBackground,
          borderLeft: theme.clueBorderColor !== 'transparent' ? `3px solid ${theme.clueBorderColor}` : 'none',
          padding: theme.clueBackground !== 'transparent' ? '8px 10px' : 0,
        }}>{location.breadcrumb}</p>
      </div>

      <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.textMuted, marginBottom: 8 }}>Challenge</div>
        <p style={{ fontSize: 15, lineHeight: 1.6, margin: 0, color: theme.textSecondary }}>{location.challenge.description}</p>
      </div>
    </div>
  )
}
