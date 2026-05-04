import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import LoginPage from "../pages/LoginPage";
import { ThemeProvider } from "../theme/ThemeContext";

vi.mock("../auth/AuthContext", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "../auth/AuthContext";

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = vi.fn();
  vi.mocked(useAuth).mockReturnValue({ login: vi.fn(), activeAuth: null, authLoading: false, isLoggingOut: false, logout: vi.fn() });
});

function wrap() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/test_project"]}>
        <Routes>
          <Route path="/:project" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

test("renders team name, contact, and password fields", () => {
  wrap();
  expect(screen.getByPlaceholderText("Your team name")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Event password")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /join the hunt/i }),
  ).toBeInTheDocument();
});

test("shows Joining… and disables button while loading", async () => {
  vi.mocked(globalThis.fetch).mockReturnValue(new Promise(() => {}));
  wrap();
  fireEvent.change(screen.getByPlaceholderText("Your team name"), {
    target: { value: "Team A" },
  });
  fireEvent.change(screen.getByPlaceholderText("Event password"), {
    target: { value: "secret" },
  });
  fireEvent.click(screen.getByRole("button", { name: /join the hunt/i }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /joining/i })).toBeDisabled(),
  );
});

test("shows error message on failed login", async () => {
  vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "Incorrect password" }), { headers: { "Content-Type": "application/json" } }));
  wrap();
  fireEvent.change(screen.getByPlaceholderText("Your team name"), {
    target: { value: "Team A" },
  });
  fireEvent.change(screen.getByPlaceholderText("Event password"), {
    target: { value: "wrong" },
  });
  fireEvent.click(screen.getByRole("button", { name: /join the hunt/i }));
  await waitFor(() =>
    expect(screen.getByText(/incorrect password/i)).toBeInTheDocument(),
  );
});

test("shows rate limit message on 429", async () => {
  vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "Too many attempts. Please wait a moment." }), { headers: { "Content-Type": "application/json" } }));
  wrap();
  fireEvent.change(screen.getByPlaceholderText("Your team name"), {
    target: { value: "Team A" },
  });
  fireEvent.change(screen.getByPlaceholderText("Event password"), {
    target: { value: "wrong" },
  });
  fireEvent.click(screen.getByRole("button", { name: /join the hunt/i }));
  await waitFor(() =>
    expect(screen.getByText(/too many attempts/i)).toBeInTheDocument(),
  );
});

test("calls login() with projectId, teamName, and contact on success", async () => {
  const loginMock = vi.fn();
  vi.mocked(useAuth).mockReturnValue({ login: loginMock, activeAuth: null, authLoading: false, isLoggingOut: false, logout: vi.fn() });
  vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true, teamName: "Team A", contact: "a@b.com" }), { headers: { "Content-Type": "application/json" } }));
  wrap();
  fireEvent.change(screen.getByPlaceholderText("Your team name"), {
    target: { value: "Team A" },
  });
  fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
    target: { value: "a@b.com" },
  });
  fireEvent.change(screen.getByPlaceholderText("Event password"), {
    target: { value: "secret" },
  });
  fireEvent.click(screen.getByRole("button", { name: /join the hunt/i }));
  await waitFor(() =>
    expect(loginMock).toHaveBeenCalledWith(
      "test_project",
      "Team A",
      "a@b.com",
      false,
    ),
  );
});

test("shows connection error when fetch throws", async () => {
  vi.mocked(globalThis.fetch).mockRejectedValue(new Error("Network error"));
  wrap();
  fireEvent.change(screen.getByPlaceholderText("Your team name"), {
    target: { value: "Team A" },
  });
  fireEvent.change(screen.getByPlaceholderText("Event password"), {
    target: { value: "secret" },
  });
  fireEvent.click(screen.getByRole("button", { name: /join the hunt/i }));
  await waitFor(() =>
    expect(screen.getByText(/connection error/i)).toBeInTheDocument(),
  );
});
