// lucia-secure/frontend/src/components/MessageBubble.jsx

import React from 'react'
import '../styles/markdown.css'

/** -------- helpers -------- */
function getText(content) {
  if (content == null) return ''
  if (typeof content === 'string') return content

  // Arrays of segments (OpenAI / custom)
  if (Array.isArray(content)) {
    return content.map(getText).join('\n')
  }

  // Objects with common text holders
  if (typeof content === 'object') {
    if (typeof content.text === 'string') return content.text
    if (typeof content.message === 'string') return content.message
    if (Array.isArray(content.content)) return content.content.map(getText).join('\n')
    if (Array.isArray(content.parts)) return content.parts.map(getText).join('\n')
    // last resort: stringify primitives
    try { return String(content) } catch { return '' }
  }

  return String(content)
}

function escapeHtml(t) {
  return String(t).replace(/[&<>"]/g, c => (
    ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c])
  ))
}

/** tiny, safe markdown (bold/italics/headings/quotes/code/links + line breaks) */
function mdToHtml(src = '') {
  let s = String(src).replace(/\r\n/g, '\n')

  // stash code fences
  const blocks = []
  s = s.replace(/```([\s\S]*?)```/g, (_, code) => {
    const i = blocks.push(`<pre class="md-code"><code>${escapeHtml(code)}</code></pre>`) - 1
    return `@@CODE${i}@@`
  })

  // stash inline code
  const inlines = []
  s = s.replace(/`([^`]+?)`/g, (_, code) => {
    const i = inlines.push(`<code class="md-inline">${escapeHtml(code)}</code>`) - 1
    return `@@INLINE${i}@@`
  })

  // escape everything else
  s = escapeHtml(s)

  // headings
  s = s
    .replace(/^######\s?(.*)$/gm, '<h6 class="md-h6">$1</h6>')
    .replace(/^#####\s?(.*)$/gm, '<h5 class="md-h5">$1</h5>')
    .replace(/^####\s?(.*)$/gm, '<h4 class="md-h4">$1</h4>')
    .replace(/^###\s?(.*)$/gm,  '<h3 class="md-h3">$1</h3>')
    .replace(/^##\s?(.*)$/gm,   '<h2 class="md-h2">$1</h2>')
    .replace(/^#\s?(.*)$/gm,    '<h1 class="md-h1">$1</h1>')

  // blockquotes
  s = s.replace(/^>\s?(.*)$/gm, '<blockquote class="md-quote">$1</blockquote>')

  // emphasis
  s = s.replace(/\*\*\*([\s\S]+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  s = s.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>').replace(/__([\s\S]+?)__/g, '<strong>$1</strong>')
  s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>').replace(/_([^_\n]+)_/g, '<em>$1</em>')

  // links
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')

  // paragraphs + single line breaks
  s = s
    .split(/\n{2,}/)
    .map(block => (/^\s*<(h\d|blockquote|pre)/.test(block)
      ? block
      : `<p>${block.replace(/\n/g, '<br/>')}</p>`
    ))
    .join('\n')

  // restore code
  s = s.replace(/@@CODE(\d+)@@/g, (_, i) => blocks[Number(i)])
  s = s.replace(/@@INLINE(\d+)@@/g, (_, i) => inlines[Number(i)])

  return s
}

/** -------- component -------- */
export default function MessageBubble({ role = 'assistant', content }) {
  const isUser = role === 'user'
  const raw = getText(content)
  let html = mdToHtml(raw)
  if (!html || !html.trim()) html = `<p>${escapeHtml(raw)}</p>`  // safety fallback

  return (
    <div className={`bubble ${isUser ? 'user' : 'assistant'}`}>
      <div className="role">{isUser ? 'You' : 'Lucía'}</div>
      <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
