import { storylineMarked } from "../utils/storylineMarked";

test("wraps a ==marked== span in a <mark> tag", () => {
  const html = storylineMarked.parseInline("Book bans are not ==just about books==.");
  expect(html).toContain("<mark>just about books</mark>");
});

test("leaves an unclosed == as literal text", () => {
  const html = storylineMarked.parseInline("Half open == here");
  expect(html).toContain("==");
  expect(html).not.toContain("<mark>");
});

test("still supports ordinary bold and italic", () => {
  const html = storylineMarked.parseInline("**bold** and *italic*");
  expect(html).toContain("<strong>bold</strong>");
  expect(html).toContain("<em>italic</em>");
});

test("parse() renders block-level markdown normally, including headings", () => {
  const html = storylineMarked.parse("Intro.\n\n## A heading\n\nMore text.");
  expect(html).toContain("<h2>A heading</h2>");
  expect(html).toContain("<p>Intro.</p>");
});
