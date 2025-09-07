// lucia-secure/frontend/src/components/Composer.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react'
import '../styles/composer.css'

export default function Composer({ value, setValue, onSend, onCancel, busy }) {
  const wrapRef = useRef(null)
  const taRef   = useRef(null)
  const [hasText, setHasText] = useState(Boolean(value?.trim()))

  // Resize logic – grows with content, SHRINKS back to min when empty
  const resizeTA = useCallback(() => {
    const el = taRef.current
    if (!el) return
    const styles = getComputedStyle(el)
    const min = parseFloat(styles.getPropertyValue('--ta-min')) || 48
    const max = parseFloat(styles.getPropertyValue('--ta-max')) || 240

    el.style.height = 'auto'                     // allow shrink
    const next = Math.max(min, Math.min(el.scrollHeight, max))
    el.style.height = next + 'px'

    // guarantee shrink when empty (iOS/Safari safe)
    if (!el.value.trim()) el.style.height = min + 'px'
  }, [])

  function key(e){
    if (e.key === 'Enter' && !e.shiftKey){
      e.preventDefault()
      if (!busy && hasText) onSend()
    }
  }

  useEffect(() => setHasText(Boolean((value || '').trim())), [value])

  useEffect(() => {
    const el = taRef.current
    if (!el) return
    const onInput = () => resizeTA()
    el.addEventListener('input', onInput)
    resizeTA()
    return () => el.removeEventListener('input', onInput)
  }, [resizeTA])

  // Also shrink on any programmatic value change (after send → '')
  useEffect(() => {
    const id = requestAnimationFrame(resizeTA)
    return () => cancelAnimationFrame(id)
  }, [value, resizeTA])

  // Keep thread bottom padding synced to composer height
  useEffect(() => {
    const root = document.documentElement
    const ro = new ResizeObserver(() => {
      const h = wrapRef.current?.offsetHeight || 72
      root.style.setProperty('--composer-h', `${h}px`)
    })
    wrapRef.current && ro.observe(wrapRef.current)
    return () => { ro.disconnect(); root.style.removeProperty('--composer-h') }
  }, [])

  // Lift above mobile keyboard
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    const onVV = () => {
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
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        ) : (
          <button
            className={`send-pill${hasText ? ' active' : ''}`}
            onClick={onSend}
            disabled={!hasText}
            title="Send"
            aria-label="Send"
          >
            {/* Blue circle with WHITE right-pointing triangle */}
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="12" className="pill-bg" />
              <polygon points="9,7 9,17 17,12" className="pill-arrow" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
