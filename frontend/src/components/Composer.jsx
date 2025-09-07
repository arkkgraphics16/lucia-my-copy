// lucia-secure/frontend/src/components/Composer.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react'
import '../styles/composer.css'

export default function Composer({ value, setValue, onSend, onCancel, busy }) {
  const wrapRef = useRef(null)
  const taRef   = useRef(null)
  const [hasText, setHasText] = useState(Boolean(value?.trim()))

  // ---- helpers -------------------------------------------------------------
  const resizeTA = useCallback(() => {
    const el = taRef.current
    if (!el) return
    // Force reflow then clamp to max; guarantee it can shrink when empty
    el.style.height = '0px'
    const max = parseFloat(getComputedStyle(el).getPropertyValue('--ta-max')) || 240
    const min = 48 // matches CSS min-height
    const next = Math.max(min, Math.min(el.scrollHeight, max))
    el.style.height = next + 'px'
  }, [])

  function key(e){
    if (e.key === 'Enter' && !e.shiftKey){
      e.preventDefault()
      if (!busy && hasText) onSend()
    }
  }

  // ---- state + effects -----------------------------------------------------
  useEffect(() => setHasText(Boolean((value || '').trim())), [value])

  // Resize on user input (grows smoothly)
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    const onInput = () => resizeTA()
    el.addEventListener('input', onInput)
    // Initial size (first mount)
    resizeTA()
    return () => el.removeEventListener('input', onInput)
  }, [resizeTA])

  // IMPORTANT: also resize when value changes programmatically
  // (e.g., after send we clear the field → shrink back)
  useEffect(() => {
    // wait one frame so DOM has the new value
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

  // Lift above mobile keyboard (iOS/Android)
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

  // ---- render --------------------------------------------------------------
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
            {/* Custom tri-arrow (outlined) with inner V, no background */}
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor"
                 strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {/* outer triangle */}
              <path d="M3 12 L21 4 L21 20 Z"/>
              {/* inner V */}
              <path d="M9 12 L21 4 M9 12 L21 20"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
