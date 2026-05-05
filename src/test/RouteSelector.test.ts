import { render, screen } from "@testing-library/svelte/svelte5";
import RouteSelector from "../components/RouteSelector.svelte";

const routeData = {
  description: "A 2.5–3 hour route",
  locations: ["001_loc_binnenhof", "002_loc_vredespaleis"],
};

test("renders route description", () => {
  render(RouteSelector, {
    props: { project: "da", city: "den_haag", routeId: "short_loop", route: routeData },
  });
  expect(screen.getByText("A 2.5–3 hour route")).toBeInTheDocument();
});

test("shows stop count", () => {
  render(RouteSelector, {
    props: { project: "da", city: "den_haag", routeId: "short_loop", route: routeData },
  });
  expect(screen.getByText("2 stops")).toBeInTheDocument();
});