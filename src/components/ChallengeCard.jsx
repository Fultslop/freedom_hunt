export default function ChallengeCard({ location, index, total }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      padding: 24,
    }}>
      <div style={{ fontSize: 13, color: '#888' }}>{index + 1} / {total}</div>

      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>{location.title}</h1>

      <p style={{ fontSize: 16, lineHeight: 1.6, margin: 0 }}>{location.description}</p>

      <div style={{ borderTop: '1px solid #eee', paddingTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: '#888', marginBottom: 8 }}>Clue</div>
        <p style={{ fontSize: 15, lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>{location.clue}</p>
      </div>

      <div style={{ borderTop: '1px solid #eee', paddingTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: '#888', marginBottom: 8 }}>Challenge</div>
        <p style={{ fontSize: 15, lineHeight: 1.6, margin: 0 }}>{location.challenge}</p>
      </div>
    </div>
  )
}
