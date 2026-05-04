# Task 02: Shared Type Definitions

**Files:**
- Create: `src/types/data.ts`
- Create: `src/types/theme.ts`
- Create: `src/types/auth.ts`
- Create: `src/types/worker.ts`

These types are the foundation every later task imports from. Define them all before touching any source file.

---

- [ ] **Step 1: Create `src/types/data.ts`**

Covers all shapes that come from YAML data files (locations, routes, cities, projects, app text).

```typescript
export type FormFieldType =
  | "boolean"
  | "string"
  | "number"
  | "radio"
  | "multiple"
  | "photo";

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  options?: string[];
  min?: number;
  max?: number;
}

export interface Challenge {
  name: string;
  description: string;
  notes?: string;
  form: FormField[];
}

export interface LocationName {
  label: string;
  value: string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Location {
  locationId: number;
  title: string;
  image?: string;
  name: LocationName;
  address?: string;
  coordinates: Coordinates;
  storyline: string;
  breadcrumb: string;
  challenge: Challenge;
  themeColor?: string;
}

export interface RouteDefinition {
  description: string;
  locations: string[];
}

export type RoutesData = Record<string, RouteDefinition>;

export interface City {
  id: string;
  name: string;
  image?: string;
  country: string;
  description?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  image?: string;
}

export interface ApplicationText {
  "app.title": string;
  "app.tagline": string;
}

export interface ProjectsText {
  items: Project[];
  "page.subtitle": string;
}

export interface CitiesText {
  items: City[];
}
```

---

- [ ] **Step 2: Create `src/types/theme.ts`**

```typescript
export interface Theme {
  fontFamily: string;
  background: string;
  surface: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  barBackground: string;
  barBorder: string;
  barText: string;
  barTextSecondary: string;
  progressTrack: string;
  progressFill: string;
  clueBackground: string;
  clueBorderColor: string;
}

export type ThemeName = "wireframe" | "app" | "GWC";
```

---

- [ ] **Step 3: Create `src/types/auth.ts`**

```typescript
export interface AuthState {
  projectId: string;
  teamName: string;
  contact: string | null;
  isAdmin: boolean;
}

export interface TokenPayload {
  project: string;
  teamName: string;
  contact: string;
  isAdmin: boolean;
  exp: number;
}
```

---

- [ ] **Step 4: Create `src/types/worker.ts`**

The `/// <reference>` directive brings `KVNamespace`, `R2Bucket`, and `Fetcher` into scope for files that import from this module.

```typescript
/// <reference types="@cloudflare/workers-types" />

export interface Env {
  AUTH_STORE: KVNamespace;
  AUTH_SECRET: string;
  PHOTOS: R2Bucket;
  ASSETS: Fetcher;
  GITHUB_REPO: string;
  GITHUB_PAT: string;
  FORM_SCRIPT_URL: string;
}
```

---

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

---

- [ ] **Step 6: Commit**

Stage: `src/types/data.ts`, `src/types/theme.ts`, `src/types/auth.ts`, `src/types/worker.ts`
Message: `chore: add shared TypeScript type definitions`
