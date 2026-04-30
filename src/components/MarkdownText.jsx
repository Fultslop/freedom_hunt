import { marked } from 'marked'

export default function MarkdownText({ text, style }) {
  if (!text) return null
  const html = marked.parse(text)
  return (
    <div
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
