 
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { AuthProvider, useAuth } from "../auth/AuthContext";

vi.mock("../auth/AuthContext", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual };
});

function Consumer() {
  const { activeAuth, login, logout } = useAuth();
  return (
    <>
      <span data-testid="team">{activeAuth?.teamName ?? "none"}</span>
      <span data-testid="project">{activeAuth?.projectId ?? "none"}</span>
      <button onClick={() => login("test_project", "Team A", "a@b.com")}>
        login
      </button>
      <button onClick={logout}>logout</button>
    </>
  );
}

beforeEach(() => {
  global.fetch = vi.fn();
});

test("calls GET /auth/me on mount and populates activeAuth", async () => {
  fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      ok: true,
      project: "test_project",
      teamName: "Team A",
      contact: "a@b.com",
    }),
  });
  render(
    <MemoryRouter>
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    </MemoryRouter>,
  );
  expect(fetch).toHaveBeenCalledWith("/auth/me");
  await act(async () => {}); // wait for state update
  expect(screen.getByTestId("team")).toHaveTextContent("Team A");
  expect(screen.getByTestId("project")).toHaveTextContent("test_project");
});

test("activeAuth is null when /auth/me returns 401", async () => {
  fetch.mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ ok: false }),
  });
  render(
    <MemoryRouter>
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    </MemoryRouter>,
  );
  await act(async () => {});
  expect(screen.getByTestId("team")).toHaveTextContent("none");
});

test("activeAuth is null when /auth/me fetch throws", async () => {
  fetch.mockRejectedValue(new Error("Network error"));
  render(
    <MemoryRouter>
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    </MemoryRouter>,
  );
  await act(async () => {});
  expect(screen.getByTestId("team")).toHaveTextContent("none");
});

test("login sets activeAuth directly (cookie is set by Worker)", async () => {
  fetch.mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ ok: false }),
  });
  render(
    <MemoryRouter>
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    </MemoryRouter>,
  );
  await act(async () => {});
  await act(async () => screen.getByText("login").click());
  expect(screen.getByTestId("team")).toHaveTextContent("Team A");
  expect(screen.getByTestId("project")).toHaveTextContent("test_project");
});

test("logout calls POST /auth/logout and clears activeAuth", async () => {
  fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      ok: true,
      project: "test_project",
      teamName: "Team A",
      contact: "a@b.com",
    }),
  });
  render(
    <MemoryRouter>
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    </MemoryRouter>,
  );
  await act(async () => {});
  fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  await act(async () => screen.getByText("logout").click());
  expect(fetch).toHaveBeenCalledWith("/auth/logout", { method: "POST" });
  expect(screen.getByTestId("team")).toHaveTextContent("none");
});
