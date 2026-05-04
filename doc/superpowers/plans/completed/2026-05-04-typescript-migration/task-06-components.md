# Task 06: Components

**Files (rename .jsx → .tsx, remove PropTypes, 6 files):**
- `src/components/MarkdownText.jsx` → `.tsx`
- `src/components/CitySelector.jsx` → `.tsx`
- `src/components/RouteSelector.jsx` → `.tsx`
- `src/components/ChallengeForm.jsx` → `.tsx`
- `src/components/ChallengeCard.jsx` → `.tsx`
- `src/components/TitleBar.jsx` → `.tsx`

---

- [ ] **Step 1: Convert `src/components/MarkdownText.tsx`**

```typescript
import { marked } from "marked";
import "./MarkdownText.css";

interface MarkdownTextProps {
  text?: string;
  style?: React.CSSProperties;
}

export default function MarkdownText({ text, style }: MarkdownTextProps) {
  if (!text) return null;
  const html = marked.parse(text) as string;
  return (
    <div
      className="markdown-text"
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

---

- [ ] **Step 2: Convert `src/components/CitySelector.tsx`**

```typescript
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchImage } from "../assets/AssetManager";
import type { City } from "../types/data";
import "./CitySelector.css";

interface CitySelectorProps {
  project: string;
  city: City;
}

export default function CitySelector({ project, city }: CitySelectorProps) {
  const navigate = useNavigate();
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!city.image) return;
    let cancelled = false;
    fetchImage(city.image).then((url) => {
      if (!cancelled) setImageSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [city.image]);

  const handleNav = () => navigate(`/${project}/${city.id}`);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleNav}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleNav()}
      className="city-card"
    >
      {imageSrc ? (
        <img src={imageSrc} alt={city.name} className="city-card__image" />
      ) : null}
      <div>
        <div className="city-card__name">{city.name}</div>
        <div className="city-card__country">{city.country}</div>
        {city.description ? (
          <div className="city-card__description">{city.description}</div>
        ) : null}
      </div>
    </div>
  );
}
```

---

- [ ] **Step 3: Convert `src/components/RouteSelector.tsx`**

```typescript
import { useNavigate } from "react-router-dom";
import type { RouteDefinition } from "../types/data";
import "./RouteSelector.css";

interface RouteSelectorProps {
  project: string;
  city: string;
  routeId: string;
  route: RouteDefinition;
}

export default function RouteSelector({
  project,
  city,
  routeId,
  route,
}: RouteSelectorProps) {
  const navigate = useNavigate();
  const handleNav = () => navigate(`/${project}/${city}/${routeId}`);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleNav}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleNav()}
      className="route-card"
    >
      <div className="route-card__name">{routeId.replace(/_/g, " ")}</div>
      <div className="route-card__description">{route.description}</div>
      <div className="route-card__stops">
        {route.locations.length} stop{route.locations.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
```

---

- [ ] **Step 4: Convert `src/components/ChallengeForm.tsx`**

```typescript
import { useState, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import { Camera } from "lucide-react";
import type { FormField, FormFieldType } from "../types/data";
import "./ChallengeForm.css";

const VALID_TYPES: FormFieldType[] = [
  "string",
  "number",
  "boolean",
  "radio",
  "multiple",
  "photo",
];

function checkDefinition(field: FormField): string | null {
  if (!VALID_TYPES.includes(field.type)) return `unknown type "${field.type}"`;
  if (field.type === "radio" && (!field.options || field.options.length === 0))
    return "radio field missing options";
  if (
    field.type === "multiple" &&
    (!field.options || field.options.length === 0)
  )
    return "multiple field missing options";
  if (field.type === "multiple" && (field.min == null || field.max == null))
    return "multiple field missing min/max";
  if (
    field.type === "multiple" &&
    field.min !== undefined &&
    field.max !== undefined &&
    field.min > field.max
  )
    return "multiple field: min > max";
  return null;
}

type SubmitState = "idle" | "submitting" | "success" | "error";
type UploadState = "idle" | "uploading" | "success" | "error";
type FieldValues = Record<string, string | number | boolean | string[]>;

interface ChallengeFormProps {
  form: FormField[];
  locationId: number;
  routeId: string;
}

export default function ChallengeForm({
  form,
  locationId,
  routeId,
}: ChallengeFormProps) {
  const { activeAuth } = useAuth();
  const [values, setValues] = useState<FieldValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [maxWarning, setMaxWarning] = useState<string | null>(null);
  const maxWarningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasPhotoField = form.some((f) => f.type === "photo");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadState("uploading");
    const body = new FormData();
    body.append("photo", file);
    body.append("locationId", String(locationId));
    try {
      const res = await fetch("/upload", { method: "POST", body });
      const data = (await res.json()) as { ok: boolean };
      setUploadState(data.ok ? "success" : "error");
    } catch {
      setUploadState("error");
    }
  }

  function setValue(id: string, value: FieldValues[string]) {
    setValues((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    form.forEach((field) => {
      const defError = checkDefinition(field);
      if (defError) {
        newErrors[field.id] = defError;
        return;
      }
      if (field.type === "photo") return;
      const value = values[field.id];
      if (value === undefined || value === "" || value === null) {
        newErrors[field.id] = "Required";
      }
      if (field.type === "multiple" && Array.isArray(value)) {
        if (field.min !== undefined && value.length < field.min)
          newErrors[field.id] = `Select at least ${field.min}`;
        if (field.max !== undefined && value.length > field.max)
          newErrors[field.id] = `Select at most ${field.max}`;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitState("submitting");
    try {
      const res = await fetch("/form-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          routeId,
          teamName: activeAuth?.teamName ?? "",
          email: activeAuth?.contact ?? "",
          values,
        }),
      });
      const data = (await res.json()) as { ok: boolean };
      setSubmitState(data.ok ? "success" : "error");
    } catch {
      setSubmitState("error");
    }
  }

  function renderField(field: FormField) {
    if (field.type === "photo") return null;
    const error = errors[field.id];
    const value = values[field.id];

    if (field.type === "boolean") {
      return (
        <div key={field.id} className="cf-field">
          <label className="cf-checkbox-label">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => setValue(field.id, e.target.checked)}
              className="cf-checkbox"
            />
            {field.label}
          </label>
          {error ? <div className="cf-error">{error}</div> : null}
        </div>
      );
    }

    if (field.type === "radio" && field.options) {
      return (
        <div key={field.id} className="cf-field">
          <div className="cf-label">{field.label}</div>
          {field.options.map((opt) => (
            <label key={opt} className="cf-radio-label">
              <input
                type="radio"
                name={field.id}
                value={opt}
                checked={value === opt}
                onChange={() => setValue(field.id, opt)}
                className="cf-radio"
              />
              {opt}
            </label>
          ))}
          {error ? <div className="cf-error">{error}</div> : null}
        </div>
      );
    }

    if (field.type === "multiple" && field.options) {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div key={field.id} className="cf-field">
          <div className="cf-label">{field.label}</div>
          {field.options.map((opt) => (
            <label key={opt} className="cf-checkbox-label">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={(e) => {
                  let next: string[];
                  if (e.target.checked) {
                    if (
                      field.max !== undefined &&
                      selected.length >= field.max
                    ) {
                      const msg = `Max ${field.max} selection${field.max !== 1 ? "s" : ""}`;
                      setMaxWarning(msg);
                      if (maxWarningTimer.current)
                        clearTimeout(maxWarningTimer.current);
                      maxWarningTimer.current = setTimeout(
                        () => setMaxWarning(null),
                        2000,
                      );
                      return;
                    }
                    next = [...selected, opt];
                  } else {
                    next = selected.filter((s) => s !== opt);
                  }
                  setValue(field.id, next);
                }}
                className="cf-checkbox"
              />
              {opt}
            </label>
          ))}
          {maxWarning ? (
            <div className="cf-warning">{maxWarning}</div>
          ) : null}
          {error ? <div className="cf-error">{error}</div> : null}
        </div>
      );
    }

    return (
      <div key={field.id} className="cf-field">
        <label className="cf-label">{field.label}</label>
        <input
          type={field.type === "number" ? "number" : "text"}
          value={typeof value === "string" || typeof value === "number" ? value : ""}
          onChange={(e) =>
            setValue(
              field.id,
              field.type === "number" ? Number(e.target.value) : e.target.value,
            )
          }
          className={`cf-input${error ? " cf-input--error" : ""}`}
        />
        {error ? <div className="cf-error">{error}</div> : null}
      </div>
    );
  }

  if (submitState === "success") {
    return <div className="cf-success">Response submitted. Thank you!</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="cf-form">
      {form.map(renderField)}
      {hasPhotoField ? (
        <div className="cc-photo-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <button
            type="button"
            className={`cc-photo-btn${uploadState === "success" ? " cc-photo-btn--done" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadState === "uploading"}
          >
            <Camera size={18} />
            {uploadState === "idle" && "Upload photo"}
            {uploadState === "uploading" && "Uploading…"}
            {uploadState === "success" && "Photo uploaded"}
            {uploadState === "error" && "Upload failed — retry?"}
          </button>
        </div>
      ) : null}
      {submitState === "error" ? (
        <div className="cf-error-banner">Submission failed. Please try again.</div>
      ) : null}
      <button
        type="submit"
        disabled={submitState === "submitting"}
        className="cf-submit"
      >
        {submitState === "submitting" ? "Submitting…" : "Submit"}
      </button>
    </form>
  );
}
```

---

- [ ] **Step 5: Convert `src/components/ChallengeCard.tsx`**

```typescript
import { useState, useEffect } from "react";
import "leaflet/dist/leaflet.css";
import { useTheme } from "../theme/ThemeContext";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import MarkdownText from "./MarkdownText";
import ChallengeForm from "./ChallengeForm";
import { BookOpen, MapPin, Crosshair, Compass } from "lucide-react";
import { fetchImage } from "../assets/AssetManager";
import type { Location } from "../types/data";
import "./ChallengeCard.css";

const pin = L.divIcon({
  className: "",
  html: '<div style="width:14px;height:14px;background:#BF0A30;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>',
  iconAnchor: [7, 7],
});

interface ChallengeCardProps {
  location: Location;
  isLast: boolean;
  index: number;
  routeId: string;
}

export default function ChallengeCard({
  location,
  isLast,
  index,
  routeId,
}: ChallengeCardProps) {
  const { theme } = useTheme();
  const [heroSrc, setHeroSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!location.image) return;
    let cancelled = false;
    fetchImage(location.image).then((url) => {
      if (!cancelled) setHeroSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [location.image]);

  const hasHero = !!heroSrc;
  const pos: [number, number] = [
    location.coordinates.latitude,
    location.coordinates.longitude,
  ];

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
        {location.name?.value ? (
          <div className="cc-location-name">{location.name.value}</div>
        ) : null}
        {location.address ? (
          <div className="cc-location-address">{location.address}</div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="cc-root">
      {hasHero ? (
        <div className="cc-hero-wrap">
          <img
            src={heroSrc!}
            alt={location.name?.value || location.title}
            className="cc-hero-img"
          />
          {titleCard}
        </div>
      ) : (
        titleCard
      )}

      <div className="cc-body">
        <div className="cc-section cc-section--storyline">
          <div className="cc-section-icon">
            <BookOpen size={16} />
          </div>
          <MarkdownText text={location.storyline} />
        </div>

        <div className="cc-section cc-section--breadcrumb">
          <div className="cc-section-icon">
            <Compass size={16} />
          </div>
          <MarkdownText text={location.breadcrumb} />
        </div>

        <div className="cc-section cc-section--map">
          <div className="cc-section-icon">
            <MapPin size={16} />
          </div>
          <div className="cc-map-wrap">
            <MapContainer
              center={pos}
              zoom={15}
              scrollWheelZoom={false}
              className="cc-map"
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={pos} icon={pin} />
            </MapContainer>
          </div>
        </div>

        <div className="cc-section cc-section--challenge">
          <div className="cc-section-icon">
            <Crosshair size={16} />
          </div>
          <div className="cc-challenge-body">
            <MarkdownText text={location.challenge.description} />
            {location.challenge.form && location.challenge.form.length > 0 ? (
              <ChallengeForm
                form={location.challenge.form}
                locationId={location.locationId}
                routeId={routeId}
              />
            ) : null}
          </div>
        </div>

        {isLast ? (
          <div className="cc-finish-banner">
            You have completed the route!
          </div>
        ) : null}
      </div>
    </div>
  );
}
```

---

- [ ] **Step 6: Export `FontSize` from `FontSizeContext.tsx`**

Before converting TitleBar, `FontSize` must be exported from `FontSizeContext.tsx` (Task 05 added it as a non-exported type). Edit `src/theme/FontSizeContext.tsx`:

```typescript
// Before:
type FontSize = "small" | "medium" | "large";

// After:
export type FontSize = "small" | "medium" | "large";
```

---

- [ ] **Step 7: Convert `src/components/TitleBar.tsx`**

TitleBar has no external props (it reads everything from context). The conversion is purely removing PropTypes and adding typed imports.

```typescript
import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { TitleBarContext } from "../theme/TitleBarContext";
import { themes } from "../theme/themes";
import { useFontSize } from "../theme/FontSizeContext";
import { useAuth } from "../auth/AuthContext";
import type { ThemeName } from "../types/theme";
import type { FontSize } from "../theme/FontSizeContext";
import "./TitleBar.css";

export default function TitleBar() {
  const { theme, themeName, setThemeName } = useTheme();
  const { fontSize, setFontSize, SIZES } = useFontSize();
  const { titleBar } = useContext(TitleBarContext)!;
  const { title, progress, backPath } = titleBar;
  const { activeAuth, logout } = useAuth();
  const navigate = useNavigate();
  const [menuView, setMenuView] = useState<string | null>(null);

  function closeMenu() {
    setMenuView(null);
  }

  // ... rest of JSX unchanged from the .jsx source ...
}
```

**Important:** TitleBar's JSX body is large. Copy all JSX from the existing `TitleBar.jsx` unchanged — the only TypeScript additions are:
1. Remove `import PropTypes from "prop-types"` (TitleBar had no `.propTypes` anyway)
2. Add `import type { ThemeName }` (used in `setThemeName` calls)
3. Type the `useState<string | null>` for `menuView`
4. Add the `!` non-null assertion on `useContext(TitleBarContext)!` (context is always present in the app tree)

Note: imports use no file extension (extension-free imports), matching the convention in the existing codebase.

---

- [ ] **Step 8: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors. Common issues to watch for:
- `marked.parse()` returns `string | Promise<string>` in newer marked versions — cast with `as string` since we use the synchronous API.
- Leaflet's `L.divIcon` returns `DivIcon` which is assignable to `Icon` used by `<Marker>`.

---

- [ ] **Step 9: Run tests**

```bash
npm run test:run
```

Expected: all tests pass.

---

- [ ] **Step 10: Commit**

Stage: all 6 converted component files + the FontSizeContext.tsx export fix
Message: `refactor: convert components to TypeScript`
