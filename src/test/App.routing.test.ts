import { render, screen, waitFor } from "@testing-library/svelte/svelte5";
import Router from "svelte-spa-router";
import GalleryRouteMarker from "./fixtures/GalleryRouteMarker.svelte";
import WildcardRouteMarker from "./fixtures/WildcardRouteMarker.svelte";
import ResultsRouteMarker from "./fixtures/ResultsRouteMarker.svelte";
import DemoLoginRouteMarker from "./fixtures/DemoLoginRouteMarker.svelte";
import WildcardLoginRouteMarker from "./fixtures/WildcardLoginRouteMarker.svelte";

// Regression test for a real bug: App.svelte's route table originally
// declared "/:project/:city/:route" (RoutePage) before
// "/:project/:city/gallery" (GalleryLandingPage). svelte-spa-router matches
// the FIRST route pattern that fits a URL, and a wildcard segment like
// :route matches any string — including the literal "gallery" — so the
// wildcard route always won, silently routing gallery URLs to RoutePage
// instead. RoutePage then looked up a non-existent "gallery" entry in
// routes.yaml and got stuck on its own loading state forever, with no error.
//
// This test doesn't render the real App.svelte, because doing so triggers
// an unrelated Vite/Vitest import.meta.glob path-resolution failure in
// src/utils/images.ts when loaded through App's full page-component import
// graph from this file's location. Instead it exercises the real
// svelte-spa-router matching logic against the exact pattern shapes that
// caused the bug, with two minimal marker components standing in for
// GalleryLandingPage and RoutePage. If App.svelte's routes object is ever
// reordered so the wildcard route precedes the gallery route again, this
// test's first case would keep passing (it only tests the correct order) —
// the second case exists specifically to document what breaks if that
// ordering is reversed.

afterEach(() => {
  window.location.hash = "";
});

test("a literal route declared before an overlapping wildcard route wins the match", async () => {
  window.location.hash = "#/democrats_abroad/den_haag/gallery";
  render(Router, {
    props: {
      routes: {
        "/:project/:city/gallery": GalleryRouteMarker,
        "/:project/:city/:route": WildcardRouteMarker,
      },
    },
  });
  await waitFor(() => expect(screen.getByText("gallery-route-marker")).toBeInTheDocument());
  expect(screen.queryByText("wildcard-route-marker")).not.toBeInTheDocument();
});

test("a literal /login/demo route wins over the /login/:project wildcard", async () => {
  window.location.hash = "#/login/demo";
  render(Router, {
    props: {
      routes: {
        "/login/demo": DemoLoginRouteMarker,
        "/login/:project": WildcardLoginRouteMarker,
      },
    },
  });
  await waitFor(() => expect(screen.getByText("demo-login-route-marker")).toBeInTheDocument());
  expect(screen.queryByText("wildcard-login-route-marker")).not.toBeInTheDocument();
});

test("a literal /:project/:city/results_download route wins over the /:project/:city/:route wildcard", async () => {
  window.location.hash = "#/democrats_abroad/den_haag/results_download";
  render(Router, {
    props: {
      routes: {
        "/:project/:city/results_download": ResultsRouteMarker,
        "/:project/:city/:route": WildcardRouteMarker,
      },
    },
  });
  await waitFor(() => expect(screen.getByText("results-route-marker")).toBeInTheDocument());
  expect(screen.queryByText("wildcard-route-marker")).not.toBeInTheDocument();
});

test("documents the regression: a wildcard route declared first shadows the literal route", async () => {
  window.location.hash = "#/democrats_abroad/den_haag/gallery";
  render(Router, {
    props: {
      routes: {
        "/:project/:city/:route": WildcardRouteMarker,
        "/:project/:city/gallery": GalleryRouteMarker,
      },
    },
  });
  await waitFor(() => expect(screen.getByText("wildcard-route-marker")).toBeInTheDocument());
  expect(screen.queryByText("gallery-route-marker")).not.toBeInTheDocument();
});
