import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import JoinTeamPage from "../pages/JoinTeamPage.svelte";
import { titleBarStore } from "../stores/titleBarStore";
import { authStore } from "../stores/authStore";
import { get } from "svelte/store";
import { TEAM_NAME_ADJECTIVES, TEAM_NAME_NOUNS } from "../utils/teamNameGenerator";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("../utils/api", () => ({
  postLogin: vi.fn(),
}));

beforeEach(() => {
  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
});

test("redirects to /login/:project when there's no stashed password", async () => {
  const { push } = await import("svelte-spa-router");
  render(JoinTeamPage, { props: { params: { project: "democrats_abroad" } } });
  await waitFor(() => expect(push).toHaveBeenCalledWith("/login/democrats_abroad"));
});

test("prefills a generated team name when none is saved", () => {
  sessionStorage.setItem(
    "pendingHuntAuth",
    JSON.stringify({ project: "democrats_abroad", password: "secret" }),
  );
  render(JoinTeamPage, { props: { params: { project: "democrats_abroad" } } });
  const input = screen.getByLabelText("Team name") as HTMLInputElement;
  expect(input.value.split(" ")).toHaveLength(2);
});

test("prefills the saved team name from localStorage when present", () => {
  localStorage.setItem("teamName:democrats_abroad", "The Tulip Squad");
  sessionStorage.setItem(
    "pendingHuntAuth",
    JSON.stringify({ project: "democrats_abroad", password: "secret" }),
  );
  render(JoinTeamPage, { props: { params: { project: "democrats_abroad" } } });
  expect(screen.getByLabelText("Team name")).toHaveValue("The Tulip Squad");
});

test("regenerates the team name when the dice button is clicked", async () => {
  sessionStorage.setItem(
    "pendingHuntAuth",
    JSON.stringify({ project: "democrats_abroad", password: "secret" }),
  );
  const spy = vi.spyOn(Math, "random").mockReturnValue(0);
  render(JoinTeamPage, { props: { params: { project: "democrats_abroad" } } });
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

test("submits project + team name + stashed password, then navigates to the project", async () => {
  const api = await import("../utils/api");
  const { push } = await import("svelte-spa-router");
  vi.mocked(api.postLogin).mockResolvedValue({
    ok: true,
    teamName: "The Tulip Squad",
    isAdmin: false,
  });
  sessionStorage.setItem(
    "pendingHuntAuth",
    JSON.stringify({ project: "democrats_abroad", password: "secret" }),
  );
  render(JoinTeamPage, { props: { params: { project: "democrats_abroad" } } });
  await fireEvent.input(screen.getByLabelText("Team name"), {
    target: { value: "The Tulip Squad" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /join the hunt/i }));
  await waitFor(() => {
    expect(api.postLogin).toHaveBeenCalledWith({
      project: "democrats_abroad",
      teamName: "The Tulip Squad",
      password: "secret",
    });
    expect(localStorage.getItem("teamName:democrats_abroad")).toBe("The Tulip Squad");
    expect(sessionStorage.getItem("pendingHuntAuth")).toBeNull();
    expect(push).toHaveBeenCalledWith("/democrats_abroad");
    expect(get(authStore).activeAuth?.kind).toBe("participant");
  });
});

test("shows the server error and does not navigate on failed login", async () => {
  const api = await import("../utils/api");
  const { push } = await import("svelte-spa-router");
  vi.mocked(api.postLogin).mockResolvedValue({ ok: false, error: "Incorrect password" });
  sessionStorage.setItem(
    "pendingHuntAuth",
    JSON.stringify({ project: "democrats_abroad", password: "secret" }),
  );
  render(JoinTeamPage, { props: { params: { project: "democrats_abroad" } } });
  await fireEvent.click(screen.getByRole("button", { name: /join the hunt/i }));
  expect(await screen.findByText(/incorrect password/i)).toBeInTheDocument();
  expect(push).not.toHaveBeenCalled();
});
