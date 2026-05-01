# Task 08 — App.jsx: wire AuthProvider + ProtectedRoute

**Files:**
- Modify: `src/App.jsx`

---

- [ ] **Step 1: Add imports to src/App.jsx**

Add these two imports after the existing imports:

```jsx
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
```

- [ ] **Step 2: Wrap with AuthProvider**

Wrap the contents of `BrowserRouter` with `AuthProvider`:

```jsx
          <BrowserRouter>
            <AuthProvider>
              <ThemeBodySync />
              <TitleBar />
              <Routes>
                <Route path="/" element={<AppPage />} />
                <Route path="/:project" element={<ProtectedRoute><ProjectPage /></ProtectedRoute>} />
                <Route path="/:project/:city" element={<ProtectedRoute><CityPage /></ProtectedRoute>} />
                <Route path="/:project/:city/:route" element={<ProtectedRoute><RoutePage /></ProtectedRoute>} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
```

- [ ] **Step 3: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass. If any TitleBar tests fail because `useAuth` is not available, they will be fixed in Task 09 when TitleBar is updated.

- [ ] **Step 4: Start the dev server and verify the login gate works end-to-end**

```bash
npm run dev
```

Navigate to `http://localhost:5173/democrats_abroad` in the browser. Since the dev Worker isn't running, `GET /auth/me` will 404 and `activeAuth` will be null. Verify the LoginPage renders. Then navigate to `/` — AppPage should render without a login gate.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire AuthProvider and ProtectedRoute into App"
```
