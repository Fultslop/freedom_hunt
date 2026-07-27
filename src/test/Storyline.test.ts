import { render, screen } from "@testing-library/svelte/svelte5";
import Storyline from "../components/Storyline.svelte";

test("extracts and renders the hook", () => {
  render(Storyline, { props: { text: "## Bans are not ==about books==.", elements: {} } });
  expect(document.querySelector(".story-hook mark")).toHaveTextContent("about books");
});

test("falls back to plain prose when there are no constructs", () => {
  render(Storyline, { props: { text: "Just a normal paragraph.", elements: {} } });
  expect(screen.getByText("Just a normal paragraph.")).toBeInTheDocument();
});

test("resolves a stats transclusion via the elements prop", () => {
  render(Storyline, {
    props: {
      text: "{{stats: x.yaml}}",
      elements: { "x.yaml": { items: [{ value: 1, label: "one" }] } },
    },
  });
  expect(document.querySelector(".story-stats")).toBeInTheDocument();
});

test("renders nothing when text is empty", () => {
  const { container } = render(Storyline, { props: { text: "", elements: {} } });
  expect(container.querySelector(".storyline-root")).not.toBeInTheDocument();
});

test("renders nothing when text is undefined", () => {
  const { container } = render(Storyline, { props: {} });
  expect(container.querySelector(".storyline-root")).not.toBeInTheDocument();
});
