# Task 4: Implement redesigned ChallengeCard

**Part of:** [ChallengeCard Redesign](2026-04-29-challenge-card-redesign.md)
**Depends on:** [Task 3 — Rewrite ChallengeCard tests](2026-04-29-challenge-card-03-tests.md)
**Next:** nothing — this completes the plan

**Files:**
- Modify: `src/components/ChallengeCard.jsx`

---

- [ ] **Step 1: Replace the entire component**

```jsx
import 'leaflet/dist/leaflet.css'
import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import { useTheme } from '../theme/ThemeContext'

const pin = L.divIcon({
  className: '',
  html: '<div style="width:14px;height:14px;background:#BF0A30;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>',
  iconAnchor: [7, 7],
})

export default function ChallengeCard({ location }) {
  const { theme } = useTheme()
  const [heroSrc, setHeroSrc] = useState(null)

  useEffect(() => {
    if (!location.image) return
    import(`../data/img/${location.image}`)
      .then(m => setHeroSrc(m.default))
      .catch(() => setHeroSrc(null))
  }, [location.image])

  const hasHero = !!heroSrc
  const pos = [location.coordinates.latitude, location.coordinates.longitude]

  const titleCard = (
    <div style={{
      background: theme.surface,
      borderRadius: 8,
      boxShadow: hasHero ? '0 2px 12px rgba(0,0,0,0.15)' : 'none',
      padding: 14,
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
    }}>
      <div style={{
        minWidth: 44,
        height: 44,
        background: '#002868',
        color: '#fff',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 20,
        fontWeight: 800,
        flexShrink: 0,
      }}>
        {location.locationId}
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: theme.text, lineHeight: 1.25 }}>
          {location.title}
        </div>
        {location.name?.value && (
          <div style={{ fontSize: 13, color: theme.textSecondary, marginTop: 3 }}>
            {location.name.value}
          </div>
        )}
        {location.address && (
          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>
            {location.address}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ background: theme.background }}>

      {hasHero ? (
        <div style={{ position: 'relative', marginBottom: 48 }}>
          <img
            src={heroSrc}
            alt={location.name?.value || location.title}
            style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }}
          />
          <div style={{ position: 'absolute', bottom: -48, left: 16, right: 16 }}>
            {titleCard}
          </div>
        </div>
      ) : (
        <div style={{ margin: 16 }}>
          {titleCard}
        </div>
      )}

      <div style={{ padding: 16, borderBottom: `1px solid ${theme.border}` }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: theme.textMuted, marginBottom: 8 }}>
          Storyline
        </div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: theme.text }}>
          {location.storyline}
        </p>
      </div>

      <div style={{ padding: 16, borderBottom: `1px solid ${theme.border}` }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: theme.textMuted, marginBottom: 8 }}>
          Location
        </div>
        <MapContainer
          center={pos}
          zoom={16}
          style={{ height: 180, borderRadius: 6, border: `1px solid ${theme.border}` }}
          zoomControl={false}
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <Marker position={pos} icon={pin} />
        </MapContainer>
        <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 6, fontFamily: 'monospace' }}>
          {location.coordinates.latitude}° N, {location.coordinates.longitude}° E
        </div>

        <div style={{ marginTop: 14, background: theme.surface, borderRadius: 6, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: theme.textMuted, marginBottom: 6 }}>
            Challenge
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: theme.text }}>
            {location.challenge.description}
          </p>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: theme.textMuted, marginBottom: 8 }}>
          Your clue to your next destination
        </div>
        <p style={{
          margin: 0,
          fontSize: 14,
          lineHeight: 1.65,
          color: theme.text,
          fontStyle: 'italic',
          borderLeft: '3px solid #BF0A30',
          paddingLeft: 12,
        }}>
          {location.breadcrumb}
        </p>
      </div>

    </div>
  )
}
```

- [ ] **Step 2: Run the tests — expect all to pass**

```bash
npm run test:run
```

Expected: all 11 tests pass. The hero-absent test passes because `heroSrc` starts as `null` and the async import does not resolve synchronously in tests.

- [ ] **Step 3: Verify in the browser**

```bash
npm run dev
```

Navigate to `http://localhost:5173/democrats_abroad/den_haag/short_walk`. Swipe or click Next to cycle through all three locations. Verify:

- **Location 1 (Binnenhof):** hero photo appears, title card overlaps the bottom of the image, Leaflet map centred on Binnenhof, all five sections visible
- **Locations 2 + 3:** no hero image, title card at top in normal document flow, map centred on their coordinates

- [ ] **Step 4: Commit**

```bash
git add src/components/ChallengeCard.jsx
git commit -m "feat: redesign ChallengeCard with hero image, Leaflet map, and new layout"
```
