# Task 06 — ProtectedRoute (cookie-based)

**Files:**

- Create: `src/auth/ProtectedRoute.jsx`
- Create: `src/test/ProtectedRoute.test.jsx`

---

- [ ] **Step 1: Write the failing tests**

Create `src/test/ProtectedRoute.test.jsx`:

```jsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import ProtectedRoute from "../auth/ProtectedRoute";

vi.mock("../auth/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../pages/LoginPage", () => ({
  default: () => <div>Login Page</div>,
}));

import { useAuth } from "../auth/AuthContext";

function wrap(projectId, element) {
  return render(
    <MemoryRouter initialEntries={[`/${projectId}`]}>
      <Routes>
        <Route path="/:project" element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

test("renders children when authenticated for the correct project", () => {
  useAuth.mockReturnValue({
    activeAuth: { projectId: "my_project", teamName: "Team A", contact: "" },
  });
  wrap(
    "my_project",
    <ProtectedRoute>
      <div>Protected Content</div>
    </ProtectedRoute>,
  );
  expect(screen.getByText("Protected Content")).toBeInTheDocument();
});

test("renders LoginPage when not authenticated", () => {
  useAuth.mockReturnValue({ activeAuth: null });
  wrap(
    "my_project",
    <ProtectedRoute>
      <div>Protected Content</div>
    </ProtectedRoute>,
  );
  expect(screen.getByText("Login Page")).toBeInTheDocument();
  expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
});

test("renders LoginPage when authenticated for a different project", () => {
  useAuth.mockReturnValue({
    activeAuth: { projectId: "other_project", teamName: "Team A", contact: "" },
  });
  wrap(
    "my_project",
    <ProtectedRoute>
      <div>Protected Content</div>
    </ProtectedRoute>,
  );
  expect(screen.getByText("Login Page")).toBeInTheDocument();
  expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/test/ProtectedRoute.test.jsx
```

Expected: all 3 tests FAIL (module not found).

- [ ] **Step 3: Create src/auth/ProtectedRoute.jsx**

```jsx
import { useParams } from "react-router-dom";
import { useAuth } from "./AuthContext";
import LoginPage from "../pages/LoginPage";

export default function ProtectedRoute({ children }) {
  const { project } = useParams();
  const { activeAuth } = useAuth();
  if (!activeAuth || activeAuth.projectId !== project) return <LoginPage />;
  return children;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/test/ProtectedRoute.test.jsx
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/auth/ProtectedRoute.jsx src/test/ProtectedRoute.test.jsx
git commit -m "feat: add ProtectedRoute component (cookie-based auth check)"
```
