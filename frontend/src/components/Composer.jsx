// lucia-secure/frontend/src/components/Composer.jsx
import React, { useEffect, useRef, useState } from 'react'
import '../styles/composer.css'

export default function Composer({ value, setValue, onSend, onCancel, busy }) {
  const wrapRef = useRef(null)
  const taRef = useRef(null)
  const [hasText, setHasText] = useState(Boolean(value?.trim()))

  // Enter to send (Shift+Enter for newline)
  function key(e){
    if (e.key === 'Enter' && !e.shiftKey){
      e.preventDefault()
      if (!busy && hasText) onSend()
    }
  }

  // Track input state
  useEffect(() => setHasText(Boolean((value || '').trim())), [value])

  // Auto–resize textarea up to 10 lines
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    const resize = () => {
      el.style.height = '0px'
      const max = parseFloat(getComputedStyle(el).getPropertyValue('--ta-max')) || 240
      el.style.height = Math.min(el.scrollHeight, max) + 'px'
    }
    resize()
    el.addEventListener('input', resize)
    return () => el.removeEventListener('input', resize)
  }, [])

  // Keep thread bottom padding in sync with composer height
  useEffect(() => {
    const root = document.documentElement
    const ro = new ResizeObserver(() => {
      const h = wrapRef.current?.offsetHeight || 72
      root.style.setProperty('--composer-h', `${h}px`)
    })
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => { ro.disconnect(); root.style.removeProperty('--composer-h') }
  }, [])

  // Mobile keyboards (iOS/Android): raise the bar above the keyboard
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    const onVV = () => {
      // amount the keyboard overlaps the viewport bottom
      const overlap = Math.max(0, (window.innerHeight - vv.height - vv.offsetTop))
      root.style.setProperty('--kb-safe', overlap + 'px')
    }
    onVV()
    vv.addEventListener('resize', onVV)
    vv.addEventListener('scroll', onVV)
    return () => {
      vv.removeEventListener('resize', onVV)
      vv.removeEventListener('scroll', onVV)
      root.style.removeProperty('--kb-safe')
    }
  }, [])

  return (
    <div ref={wrapRef} className="composer">
      <textarea
        ref={taRef}
        className="textarea"
        placeholder="Type a message..."
        value={value}
        onChange={e=>setValue(e.target.value)}
        onKeyDown={key}
      />
      <div className="controls">
        {busy ? (
          <button className="action-btn cancel" onClick={onCancel} title="Cancel">
            {/* red cancel (unchanged) */}
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        ) : (
          <button
            className={`send-icon${hasText ? ' active' : ''}`}
            onClick={onSend}
            disabled={!hasText}
            title="Send"
            aria-label="Send"
          >
            {/* minimalist right arrow, no background */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14"/>
              <path d="M13 5l7 7-7 7"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
