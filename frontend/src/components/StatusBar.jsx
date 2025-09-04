import React, { useEffect, useState } from 'react'
export default function StatusBar(){
  const [apiOk,setApiOk]=useState(false)
  const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
  useEffect(()=>{ let t=setInterval(async()=>{ try{ const r=await fetch(`${BASE}/healthz`); setApiOk(r.ok) }catch{ setApiOk(false) } }, 4000); (async()=>{ try{ const r=await fetch('http://localhost:8080/healthz'); setApiOk(r.ok) }catch{ setApiOk(false) } })(); return ()=>clearInterval(t) },[])
  return (<div className="status"><span className={`dot ${apiOk?'ok':'bad'}`}></span> API <span style={{marginLeft:12}} className="dot bad"></span> Auth</div>)
}
