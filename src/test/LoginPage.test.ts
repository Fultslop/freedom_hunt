import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import LoginPage from "../pages/LoginPage.svelte";
import { titleBarStore } from "../stores/titleBarStore";
import { TEAM_NAME_ADJECTIVES, TEAM_NAME_NOUNS } from "../utils/teamNameGenerator";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

beforeEach(() => {
  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });
  localStorage.clear();
  vi.clearAllMocks();
});

test("renders login form", () => {
  render(LoginPage, { props: { params: { project: "democrats_abroad" } } });
  expect(
    screen.getByRole("button", { name: /join the hunt/i }),
  ).toBeInTheDocument();
});

test("does not render a contact email field", () => {
  render(LoginPage, { props: { params: { project: "democrats_abroad" } } });
  expect(screen.queryByLabelText(/contact email/i)).not.toBeInTheDocument();
});

test("prefills a generated team name when nothing is saved for this project", () => {
  render(LoginPage, { props: { params: { project: "democrats_abroad" } } });
  const input = screen.getByLabelText("Team name") as HTMLInputElement;
  expect(input.value.split(" ")).toHaveLength(2);
});

test("prefills the saved team name from localStorage when present", () => {
  localStorage.setItem("teamName:democrats_abroad", "The Tulip Squad");
  render(LoginPage, { props: { params: { project: "democrats_abroad" } } });
  expect(screen.getByLabelText("Team name")).toHaveValue("The Tulip Squad");
});

test("regenerates the team name when the dice button is clicked", async () => {
  const spy = vi.spyOn(Math, "random").mockReturnValue(0);
  render(LoginPage, { props: { params: { project: "democrats_abroad" } } });
  const input = screen.getByLabelText("Team name") as HTMLInputElement;
  expect(input.value).toBe(`${TEAM_NAME_ADJECTIVES[0]} ${TEAM_NAME_NOUNS[0]}`);

  spy.mockReturnValue(0.999999);
  await fireEvent.click(
    screen.getByRole("button", { name: /suggest a new team name/i }),
  );
  expect(input.value).toBe(
    `${TEAM_NAME_ADJECTIVES[TEAM_NAME_ADJECTIVES.length - 1]} ${TEAM_NAME_NOUNS[TEAM_NAME_NOUNS.length - 1]}`,
  );
  spy.mockRestore();
});
