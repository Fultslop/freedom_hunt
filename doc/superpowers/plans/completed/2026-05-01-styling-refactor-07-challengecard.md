# Task 07 — ChallengeCard: inline styles → className + fix hardcoded colours

**Depends on:** [Task 01 — CSS infrastructure](2026-05-01-styling-refactor-01-css-infrastructure.md) (keyframes already in global.css)
**Next:** [Task 08 — AppPage](2026-05-01-styling-refactor-08-apppage.md)

**Files:**

- Create: `src/components/ChallengeCard.css`
- Modify: `src/components/ChallengeCard.jsx`

Hardcoded colours fixed:

- `#2d7a2d` (photo success) → `var(--color-success)`
- `#BF0A30` (upload error, breadcrumb border) → `var(--color-error)` / `var(--color-accent)`
- `#002868` (location badge fallback) → `var(--color-accent)` (see note in Step 2)

The `@keyframes fadeInUp` already moved to `global.css` in Task 01, so the `<style>` tag in the component is removed here.

The MapContainer must keep an inline `style` for `height` (react-leaflet requires it to render). Its `border` can use the CSS variable directly in the inline style string since CSS vars work there.

---

- [ ] **Step 1: Create `src/components/ChallengeCard.css`**

```css
/* src/components/ChallengeCard.css */

.cc-root {
  background: var(--color-background);
}

/* Hero image layout */
.cc-hero-wrap {
  position: relative;
  margin-bottom: 48px;
}

.cc-hero-img {
  width: 100%;
  height: 220px;
  object-fit: cover;
  display: block;
}

.cc-hero-title-wrap {
  position: absolute;
  bottom: -48px;
  left: 16px;
  right: 16px;
}

.cc-no-hero-wrap {
  margin: 16px;
}

/* Title card */
.cc-title-card {
  background: var(--color-surface);
  border-radius: 8px;
  padding: 14px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.cc-title-card--shadow {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}

.cc-badge {
  min-width: 44px;
  height: 44px;
  color: #fff;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 800;
  flex-shrink: 0;
}

.cc-location-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.25;
}

.cc-location-name {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-top: 3px;
}

.cc-location-address {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 1px;
}

/* Section headers (Storyline / Location / Your clue) */
.cc-section {
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}

.cc-section--no-border {
  padding: 16px;
}

.cc-section-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 5px;
}

/* Map */
.cc-map-coords {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 6px;
  font-family: monospace;
}

/* Challenge inset */
.cc-challenge-box {
  margin-top: 14px;
  background: var(--color-surface);
  border-radius: 6px;
  padding: 12px 14px;
}

/* Photo upload */
.cc-photo-wrap {
  margin-top: 12px;
}

.cc-photo-success {
  font-size: 13px;
  color: var(--color-success);
  font-weight: 600;
}

.cc-photo-error {
  font-size: 11px;
  color: var(--color-error);
  margin-top: 4px;
}

.cc-photo-btn {
  width: 100%;
  padding: 10px 0;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.cc-photo-btn--idle {
  background: var(--color-accent);
  color: #000;
}

.cc-photo-btn--uploading {
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.cc-photo-btn--error {
  background: var(--color-accent);
  color: #000;
}

/* Breadcrumb clue */
.cc-breadcrumb {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--color-text);
  font-style: italic;
  border-left: 3px solid var(--color-error);
  padding-left: 12px;
  animation: fadeInUp 400ms ease-out;
}
```

- [ ] **Step 2: Rewrite `src/components/ChallengeCard.jsx`**

Remaining inline styles:

- `cc-badge` background: `location.themeColor ?? theme.accent` — per-location data value, must stay inline
- MapContainer `style`: height (required by react-leaflet) + border uses `var(--color-border)` inline
- Photo button: upload state logic (idle/uploading/error) handled by modifier classes
- `cc-title-card` shadow: conditional on `hasHero` — handled by modifier class

```jsx
import { useState, useRef, useEffect } from "react";
import "leaflet/dist/leaflet.css";
import { useTheme } from "../theme/ThemeContext";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import MarkdownText from "./MarkdownText";
import ChallengeForm from "./ChallengeForm";
import { BookOpen, MapPin, Crosshair, Compass, Camera } from "lucide-react";
import { fetchImage } from "../assets/AssetManager";
import "./ChallengeCard.css";

const pin = L.divIcon({
  className: "",
  html: '<div style="width:14px;height:14px;background:#BF0A30;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>',
  iconAnchor: [7, 7],
});

export default function ChallengeCard({ location, isLast, index }) {
  const { theme } = useTheme();
  const [uploadState, setUploadState] = useState("idle");
  const fileInputRef = useRef(null);
  const [heroSrc, setHeroSrc] = useState(null);

  useEffect(() => {
    if (!location.image) {
      setHeroSrc(null);
      return;
    }
    let cancelled = false;
    fetchImage(location.image).then((url) => {
      if (!cancelled) setHeroSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [location.image]);

  const hasHero = !!heroSrc;
  const pos = [location.coordinates.latitude, location.coordinates.longitude];

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadState("uploading");
    const body = new FormData();
    body.append("photo", file);
    body.append("locationId", String(location.locationId));
    try {
      const res = await fetch("/upload", { method: "POST", body });
      const data = await res.json();
      setUploadState(data.ok ? "success" : "error");
    } catch {
      setUploadState("error");
    }
  }

  const titleCard = (
    <div className={`cc-title-card${hasHero ? " cc-title-card--shadow" : ""}`}>
      <div
        className="cc-badge"
        style={{ background: location.themeColor ?? theme.accent }}
        data-testid="location-badge"
      >
        {index}
      </div>
      <div>
        <div className="cc-location-title">{location.title}</div>
        {location.name?.value && (
          <div className="cc-location-name">{location.name.value}</div>
        )}
        {location.address && (
          <div className="cc-location-address">{location.address}</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="cc-root">
      {hasHero ? (
        <div className="cc-hero-wrap">
          <img
            src={heroSrc}
            alt={location.name?.value || location.title}
            className="cc-hero-img"
          />
          <div className="cc-hero-title-wrap">{titleCard}</div>
        </div>
      ) : (
        <div className="cc-no-hero-wrap">{titleCard}</div>
      )}

      <div className="cc-section">
        <div className="cc-section-label">
          <BookOpen size={12} aria-hidden />
          Storyline
        </div>
        <MarkdownText
          text={location.storyline}
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.65,
            color: theme.text,
          }}
        />
      </div>

      <div className="cc-section">
        <div className="cc-section-label">
          <MapPin size={12} aria-hidden />
          Location
        </div>
        <MapContainer
          key={location.locationId}
          center={pos}
          zoom={16}
          style={{
            height: 180,
            borderRadius: 6,
            border: "1px solid var(--color-border)",
          }}
          zoomControl={false}
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <Marker position={pos} icon={pin} />
        </MapContainer>
        <div className="cc-map-coords">
          {location.coordinates.latitude}° N, {location.coordinates.longitude}°
          E
        </div>

        <div className="cc-challenge-box">
          <div className="cc-section-label">
            <Crosshair size={12} aria-hidden />
            Challenge
          </div>
          <MarkdownText
            text={location.challenge.description}
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.6,
              color: theme.text,
            }}
          />
        </div>

        {location.challenge.form && location.challenge.form.length > 0 && (
          <ChallengeForm
            form={location.challenge.form}
            locationId={location.locationId}
          />
        )}

        <div className="cc-photo-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          {uploadState === "success" ? (
            <div className="cc-photo-success">✓ Photo submitted</div>
          ) : (
            <>
              <button
                data-testid="submit-btn"
                onClick={() => fileInputRef.current.click()}
                disabled={uploadState === "uploading"}
                className={`cc-photo-btn cc-photo-btn--${uploadState}`}
              >
                {uploadState === "uploading" ? (
                  "Uploading…"
                ) : uploadState === "error" ? (
                  <>
                    <Camera
                      size={14}
                      aria-hidden
                      style={{ verticalAlign: "middle", marginRight: 4 }}
                    />{" "}
                    Try again
                  </>
                ) : (
                  <>
                    <Camera
                      size={14}
                      aria-hidden
                      style={{ verticalAlign: "middle", marginRight: 4 }}
                    />{" "}
                    Submit photo proof
                  </>
                )}
              </button>
              {uploadState === "error" && (
                <div className="cc-photo-error">
                  Upload failed. Please try again.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {!isLast && (
        <div className="cc-section--no-border">
          <div className="cc-section-label">
            <Compass size={12} aria-hidden />
            Your clue to your next destination
          </div>
          <p className="cc-breadcrumb">{location.breadcrumb}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run the test suite**

```
npm test
```

Expected: all tests pass. ChallengeCard tests use `data-testid="location-badge"` and `data-testid="submit-btn"` which are preserved.

- [ ] **Step 4: Visual smoke test**

Open a route page and step through challenge cards. Verify:

- Hero image layout correct (title card overlaps bottom of image)
- Location badge uses per-location colour if set, otherwise theme accent
- Map renders with correct border colour
- Breadcrumb clue animates in with `fadeInUp` (from global.css)
- Photo upload button and success/error states render correctly in all themes

- [ ] **Step 5: Commit**

```
git add src/components/ChallengeCard.css src/components/ChallengeCard.jsx
git commit -m "refactor: migrate ChallengeCard to className + fix hardcoded colours"
```
