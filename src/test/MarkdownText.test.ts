import { render } from "@testing-library/svelte/svelte5";
import MarkdownText from "../components/MarkdownText.svelte";

test("renders markdown as HTML", () => {
  const { container } = render(MarkdownText, { props: { text: "**bold**" } });
  expect(container.querySelector("strong")).not.toBeNull();
});

test("renders nothing for null text", () => {
  const { container } = render(MarkdownText, { props: { text: null } });
  expect(container.querySelector(".markdown-text")).toBeNull();
});