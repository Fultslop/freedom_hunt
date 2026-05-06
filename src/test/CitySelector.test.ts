import { render, screen } from "@testing-library/svelte/svelte5";
import CitySelector from "../components/CitySelector.svelte";

const city = {
  id: "den_haag",
  name: "Den Haag",
  country: "Netherlands",
  description: "A great city",
  image: undefined,
};

test("renders city name", () => {
  render(CitySelector, { props: { project: "democrats_abroad", city } });
  expect(screen.getByText("Den Haag")).toBeInTheDocument();
});

test("renders city country", () => {
  render(CitySelector, { props: { project: "democrats_abroad", city } });
  expect(screen.getByText("Netherlands")).toBeInTheDocument();
});

test("renders city description", () => {
  render(CitySelector, { props: { project: "democrats_abroad", city } });
  expect(screen.getByText("A great city")).toBeInTheDocument();
});
