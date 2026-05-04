import { marked } from "marked";
import "./MarkdownText.css";

interface MarkdownTextProps {
  text?: string;
  style?: React.CSSProperties;
}

export default function MarkdownText({ text, style }: MarkdownTextProps) {
  if (!text) return null;
  const html = marked.parse(text) as string;
  return (
    <div
      className="markdown-text"
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}