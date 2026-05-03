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
  global.fetch = vi.fn();
  useAuth.mockReturnValue({ login: vi.fn() });
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
  fetch.mockReturnValue(new Promise(() => {}));
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
  fetch.mockResolvedValue({
    json: async () => ({ ok: false, error: "Incorrect password" }),
  });
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
  fetch.mockResolvedValue({
    json: async () => ({
      ok: false,
      error: "Too many attempts. Please wait a moment.",
    }),
  });
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
  useAuth.mockReturnValue({ login: loginMock });
  fetch.mockResolvedValue({
    json: async () => ({ ok: true, teamName: "Team A", contact: "a@b.com" }),
  });
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
  fetch.mockRejectedValue(new Error("Network error"));
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
