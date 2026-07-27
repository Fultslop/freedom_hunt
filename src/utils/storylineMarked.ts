import { Marked } from "marked";

interface MarkToken {
  type: "mark";
  raw: string;
  text: string;
}

export const storylineMarked = new Marked();

storylineMarked.use({
  extensions: [
    {
      name: "mark",
      level: "inline",
      start(src: string): number | undefined {
        const index = src.indexOf("==");
        return index >= 0 ? index : undefined;
      },
      tokenizer(src: string): MarkToken | undefined {
        const match = /^==([^=]+)==/.exec(src);
        if (!match) {
          return undefined;
        }
        return { type: "mark", raw: match[0], text: match[1] };
      },
      renderer(token): string {
        const markToken = token as MarkToken;
        return `<mark>${markToken.text}</mark>`;
      },
    },
  ],
});
