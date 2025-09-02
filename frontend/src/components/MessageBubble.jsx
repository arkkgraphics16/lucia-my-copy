import React from 'react'
export default function MessageBubble({ role, children }){
  return (
    <div className={`bubble ${role==='assistant'?'assistant':'user'}`}>
      <div className="role">{role==='assistant'?'Lucía':'You'}</div>
      <div>{children}</div>
    </div>
  )
}
