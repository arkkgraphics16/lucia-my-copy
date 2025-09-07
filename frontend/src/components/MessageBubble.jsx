// lucia-secure/frontend/src/components/MessageBubble.jsx

import React from 'react'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import '../styles/markdown.css'

// Robust: URLs linkified, single newlines -> <br>, no raw HTML allowed
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})

// Normalize any message shape into a string
function getText(content) {
  if (content == null) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map(getText).join('\n')
  if (typeof content === 'object') {
    if (typeof content.text === 'string') return content.text
    if (typeof content.message === 'string') return content.message
    if (Array.isArray(content.content)) return content.content.map(getText).join('\n')
    if (Array.isArray(content.parts)) return content.parts.map(getText).join('\n')
    try { return String(content) } catch { return '' }
  }
  return String(content)
}

export default function MessageBubble({ role = 'assistant', content }) {
  const isUser = role === 'user'
  const raw = getText(content)

  // Render markdown, add target/rel to links, then sanitize
  let rendered = md.render(raw || '')
  if (rendered) {
    rendered = rendered.replace(/<a /g, '<a target="_blank" rel="noopener" ')
  }

  const html = DOMPurify.sanitize(rendered || '')

  return (
    <div className={`bubble ${isUser ? 'user' : 'assistant'}`}>
      <div className="role">{isUser ? 'You' : 'Lucía'}</div>
      <div className="md" dangerouslySetInnerHTML={{ __html: html || '<p></p>' }} />
    </div>
  )
}
