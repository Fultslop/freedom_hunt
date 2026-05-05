# Task 1: SwipeConfig type + theme wiring

Status: Completed

**Previous:** —  
**Next:** [Task 2 — Swipe action rewrite](task-02-swipe-action.md)

**Files:**
- Modify: `src/types/theme.ts`
- Modify: `src/theme/themes.ts`

---

- [ ] **Step 1: Add `SwipeConfig` to `src/types/theme.ts` and extend `Theme`**

Replace the file contents with:

```typescript
export interface SwipeConfig {
  mode: 'peek' | 'carousel' | 'snap';
  hint: number; // px of adjacent card visible at rest; always 0 for snap
}

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
  swipe: SwipeConfig;
}

export type ThemeName = "wireframe" | "app" | "GWC";
```

- [ ] **Step 2: Add `swipe` to each theme in `src/theme/themes.ts`**

Add the `swipe` field at the end of each theme object:

```typescript
wireframe: {
  // ... existing fields unchanged ...
  swipe: { mode: 'snap', hint: 0 },
},
app: {
  // ... existing fields unchanged ...
  swipe: { mode: 'carousel', hint: 16 },
},
GWC: {
  // ... existing fields unchanged ...
  swipe: { mode: 'peek', hint: 12 },
},
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run lint`

Expected: 0 errors. TypeScript will flag any `Theme` consumer that doesn't satisfy the new required `swipe` field — but since `themes.ts` is the only place `Theme` objects are created, there should be no errors.

- [ ] **Step 4: Commit**

```
git add src/types/theme.ts src/theme/themes.ts
git commit -m "feat: add SwipeConfig to Theme type and wire into themes"
```
