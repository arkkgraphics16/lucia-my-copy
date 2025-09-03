import React from 'react'
import { emitQuickPrompt } from '../lib/bus'

export default function Sidebar({open,onClose}){
  // Required prompt (exact text):
  const firstPrompt = "I don’t even know what I’ve gotten myself into. Give me light on this."

  const chips = [
    firstPrompt,
    'Summarize',
    'Explain',
    'Improve tone',
    'List steps',
    'Generate plan'
  ]

  const clickChip = (text) => {
    emitQuickPrompt(text)
    onClose?.()
  }

  return (
    <aside className={`sidebar ${open?'open':''}`}>
      <h4>Quick Prompts</h4>
      <div>
        {chips.map(c =>
          <span key={c} className="chip" onClick={()=>clickChip(c)}>{c}</span>
        )}
      </div>
      <h4 style={{marginTop:16}}>Slots</h4>
      <div className="chip">Account</div>
      <div className="chip">Project</div>
    </aside>
  )
}
