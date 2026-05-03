import { marked } from "marked";
import "./MarkdownText.css";

export default function MarkdownText({ text, style }) {
  if (!text) return null;
  const html = marked.parse(text);
  return (
    <div
      className="markdown-text"
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
