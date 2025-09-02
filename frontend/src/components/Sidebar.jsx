import React from 'react'
export default function Sidebar({open,onClose}){
  const chips = ['Summarize','Explain','Improve tone','List steps','Generate plan']
  return (
    <aside className={`sidebar ${open?'open':''}`}>
      <h4>Quick Prompts</h4>
      <div>{chips.map(c=><span key={c} className="chip" onClick={onClose}>{c}</span>)}</div>
      <h4 style={{marginTop:16}}>Slots</h4>
      <div className="chip">Account</div>
      <div className="chip">Project</div>
    </aside>
  )
}
