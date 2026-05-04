 
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { ThemeProvider } from "../theme/ThemeContext";
import { TitleBarProvider, useTitleBar } from "../theme/TitleBarContext";
import { FontSizeProvider } from "../theme/FontSizeContext";
import TitleBar from "../components/TitleBar";

vi.mock("../auth/AuthContext", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "../auth/AuthContext";

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <ThemeProvider>
        <FontSizeProvider>
          <TitleBarProvider>
            {children}
          </TitleBarProvider>
        </FontSizeProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

function Setup({ config }: { config: { title?: string; progress?: { current: number; total: number } | null; backPath?: string | null } }) {
  useTitleBar(config);
  return <TitleBar />;
}

const base = { title: "Test", progress: null, backPath: null };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({ activeAuth: null, authLoading: false, isLoggingOut: false, login: vi.fn(), logout: vi.fn() });
});

test("renders title", () => {
  render(
    <Wrapper>
      <Setup
        config={{ title: "Peace Palace", progress: null, backPath: null }}
      />
    </Wrapper>,
  );
  expect(screen.getByText("Peace Palace")).toBeInTheDocument();
});

test("renders back button when backPath is set", () => {
  render(
    <Wrapper>
      <Setup config={{ ...base, backPath: "/foo" }} />
    </Wrapper>,
  );
  expect(screen.getByLabelText("Back")).toBeInTheDocument();
});

test("hides back button when backPath is null", () => {
  render(
    <Wrapper>
      <Setup config={base} />
    </Wrapper>,
  );
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
});

test("renders progress bar when progress is set", () => {
  render(
    <Wrapper>
      <Setup config={{ ...base, progress: { current: 2, total: 3 } }} />
    </Wrapper>,
  );
  expect(screen.getByTestId("progress-bar")).toBeInTheDocument();
});

test("hides progress bar when progress is null", () => {
  render(
    <Wrapper>
      <Setup config={base} />
    </Wrapper>,
  );
  expect(screen.queryByTestId("progress-bar")).not.toBeInTheDocument();
});

test("opens menu showing Profile and Themes items", () => {
  render(
    <Wrapper>
      <Setup config={base} />
    </Wrapper>,
  );
  fireEvent.click(screen.getByLabelText("Menu"));
  expect(screen.getByText("Profile")).toBeInTheDocument();
  expect(screen.getByText("Themes")).toBeInTheDocument();
});

test("clicking Themes drills into theme list", () => {
  render(
    <Wrapper>
      <Setup config={base} />
    </Wrapper>,
  );
  fireEvent.click(screen.getByLabelText("Menu"));
  fireEvent.click(screen.getByText("Themes"));
  expect(screen.getByText("wireframe")).toBeInTheDocument();
  expect(screen.getByText("app")).toBeInTheDocument();
  expect(screen.getByText("GWC")).toBeInTheDocument();
});

test("clicking back in Themes returns to root menu", () => {
  render(
    <Wrapper>
      <Setup config={base} />
    </Wrapper>,
  );
  fireEvent.click(screen.getByLabelText("Menu"));
  fireEvent.click(screen.getByText("Themes"));
  fireEvent.click(screen.getByLabelText("Back to menu"));
  expect(screen.getByText("Profile")).toBeInTheDocument();
  expect(screen.queryByText("wireframe")).not.toBeInTheDocument();
});

test("selecting a theme closes the menu", () => {
  render(
    <Wrapper>
      <Setup config={base} />
    </Wrapper>,
  );
  fireEvent.click(screen.getByLabelText("Menu"));
  fireEvent.click(screen.getByText("Themes"));
  fireEvent.click(screen.getByText("wireframe"));
  expect(screen.queryByText("Profile")).not.toBeInTheDocument();
});

test("clicking Profile drills into profile view", () => {
  vi.mocked(useAuth).mockReturnValue({
    activeAuth: { projectId: "test", teamName: "Team A", contact: "a@b.com", isAdmin: false },
    authLoading: false,
    isLoggingOut: false,
    login: vi.fn(),
    logout: vi.fn(),
  });
  render(
    <Wrapper>
      <Setup config={base} />
    </Wrapper>,
  );
  fireEvent.click(screen.getByLabelText("Menu"));
  fireEvent.click(screen.getByText("Profile"));
  expect(screen.getByText("Team A")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
});

test("clicking back in Profile returns to root menu", () => {
  render(
    <Wrapper>
      <Setup config={base} />
    </Wrapper>,
  );
  fireEvent.click(screen.getByLabelText("Menu"));
  fireEvent.click(screen.getByText("Profile"));
  fireEvent.click(screen.getByLabelText("Back to menu"));
  expect(screen.getByText("Themes")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /sign out/i }),
  ).not.toBeInTheDocument();
});

test("sign out calls logout and closes menu", async () => {
  const logoutMock = vi.fn();
  vi.mocked(useAuth).mockReturnValue({
    activeAuth: { projectId: "test", teamName: "Team A", contact: "", isAdmin: false },
    authLoading: false,
    isLoggingOut: false,
    login: vi.fn(),
    logout: logoutMock,
  });
  render(
    <Wrapper>
      <Setup config={base} />
    </Wrapper>,
  );
  fireEvent.click(screen.getByLabelText("Menu"));
  fireEvent.click(screen.getByText("Profile"));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
  });
  expect(logoutMock).toHaveBeenCalled();
  expect(screen.queryByText("Profile")).not.toBeInTheDocument();
});

test("progress fill is 6px tall", () => {
  render(
    <Wrapper>
      <Setup config={{ ...base, progress: { current: 2, total: 5 } }} />
    </Wrapper>,
  );
  expect(screen.getByTestId("progress-bar")).toHaveStyle({ height: "6px" });
});
