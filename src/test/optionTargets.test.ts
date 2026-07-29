import { resolvePageUrl } from "../utils/optionTargets";

test("resolves 'title' to the city page", () => {
  expect(resolvePageUrl("title", { project: "demo", city: "new_york" })).toBe(
    "/demo/new_york",
  );
});

test("resolves 'project' to the project page", () => {
  expect(resolvePageUrl("project", { project: "demo", city: "new_york" })).toBe("/demo");
});

test("resolves 'gallery' to the gallery page", () => {
  expect(resolvePageUrl("gallery", { project: "demo", city: "new_york" })).toBe(
    "/demo/new_york/gallery",
  );
});

test("resolves 'results' to the results-download page", () => {
  expect(resolvePageUrl("results", { project: "demo", city: "new_york" })).toBe(
    "/demo/new_york/results_download",
  );
});

test("resolves 'start_route' to the route page using ctx.route", () => {
  expect(
    resolvePageUrl("start_route", {
      project: "demo",
      city: "new_york",
      route: "brooklyn_route",
    }),
  ).toBe("/demo/new_york/brooklyn_route");
});
