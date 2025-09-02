import React from 'react'

export default function Composer({ value, setValue, onSend, onCancel, busy }){
  function key(e){
    if(e.key==='Enter' && !e.shiftKey){
      e.preventDefault()
      if(!busy) onSend()
    }
  }
  return (
    <div className="composer">
      <textarea
        className="textarea"
        placeholder="Ask Lucía…"
        value={value}
        onChange={e=>setValue(e.target.value)}
        onKeyDown={key}
      />
      <div className="controls">
        {busy ? (
          <button className="action-btn cancel" onClick={onCancel} title="Cancel">
            {/* White X */}
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        ) : (
          <button className="action-btn send" onClick={onSend} disabled={!value.trim()} title="Send">
            {/* White arrow (paper plane) */}
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13"/>
              <path d="M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
