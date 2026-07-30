import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte/svelte5";
import DepthWordmark from "../components/DepthWordmark.svelte";
import { themeStore } from "../stores/themeStore";

describe("DepthWordmark", () => {
  it("renders two lines when no project is given", () => {
    const { container } = render(DepthWordmark, { props: {} });
    expect(container.querySelectorAll(".depth-wordmark__line")).toHaveLength(2);
  });

  it("renders a third, more-indented line when a project is given", () => {
    const { container } = render(DepthWordmark, { props: { project: "Democrats Abroad" } });
    const lines = container.querySelectorAll(".depth-wordmark__line");
    expect(lines).toHaveLength(3);
    expect(lines[2].textContent).toBe("Democrats Abroad");
  });

  it("applies the sheen class only to the deepest visible line", () => {
    themeStore.setThemeName("app");
    const { container } = render(DepthWordmark, { props: { project: "Democrats Abroad" } });
    const lines = container.querySelectorAll(".depth-wordmark__line");
    expect(lines[0].classList.contains("depth-wordmark__line--sheen")).toBe(false);
    expect(lines[1].classList.contains("depth-wordmark__line--sheen")).toBe(false);
    expect(lines[2].classList.contains("depth-wordmark__line--sheen")).toBe(true);
  });

  it("gates sheen off entirely when intro.sheen is false", () => {
    themeStore.setThemeName("GWC");
    const { container } = render(DepthWordmark, { props: { project: "Democrats Abroad" } });
    expect(container.querySelector(".depth-wordmark__line--sheen")).toBeNull();
  });
});
