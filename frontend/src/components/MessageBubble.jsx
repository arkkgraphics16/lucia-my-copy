// lucia-secure/frontend/src/components/MessageBubble.jsx

import React from 'react'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import '../styles/markdown.css'

// Markdown config: linkify URLs, single newlines become <br>, disallow raw HTML
const md = new MarkdownIt({ html: false, linkify: true, breaks: true })

function toText(x) {
  if (x == null) return ''
  if (typeof x === 'string') return x
  if (Array.isArray(x)) return x.map(toText).join('\n')
  if (typeof x === 'object') {
    if (typeof x.text === 'string') return x.text
    if (typeof x.message === 'string') return x.message
    if (Array.isArray(x.content)) return x.content.map(toText).join('\n')
    if (Array.isArray(x.parts)) return x.parts.map(toText).join('\n')
    try { return String(x) } catch { return '' }
  }
  return String(x)
}

export default function MessageBubble({ role = 'assistant', content, children }) {
  const isUser = role === 'user'

  // If children is a React node (e.g., your typing dots), render it directly.
  // If it's a string, or if children is empty, we’ll render markdown from text.
  let hasReactChildren = false
  let childIsString = false
  if (children !== undefined) {
    hasReactChildren = React.isValidElement(children) || (Array.isArray(children) && children.some(React.isValidElement))
    childIsString = typeof children === 'string'
  }

  // Preferred text source order: string children → content prop → empty
  const rawText = childIsString ? children : toText(content)

  let html = ''
  if (!hasReactChildren) {
    let rendered = md.render(rawText || '')
    if (rendered) {
      // open links in new tab safely
      rendered = rendered.replace(/<a /g, '<a target="_blank" rel="noopener" ')
    }
    html = DOMPurify.sanitize(rendered || '')
  }

  return (
    <div className={`bubble ${isUser ? 'user' : 'assistant'}`}>
      <div className="role">{isUser ? 'You' : 'Lucía'}</div>

      <div className="md">
        {hasReactChildren
          ? children // e.g., the typing indicator spans
          : <span dangerouslySetInnerHTML={{ __html: html || '<p></p>' }} />
        }
      </div>
    </div>
  )
}
