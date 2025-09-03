import React, { useRef, useState } from 'react';
import MessageBubble from '../components/MessageBubble';
import Composer from '../components/Composer';

const GREETING =
  "L.U.C.I.A. — Logical Understanding & Clarification of Interpersonal Agendas. She tells you what they want, what they’re hiding, and what will actually work. Her value is context and strategy, not therapy. You are responsible for decisions.";

function ChatPage(){
  const [msgs,setMsgs]=useState([{ id:'m0', role:'assistant', content: GREETING }]);
  const [text,setText]=useState('');
  const [busy,setBusy]=useState(false);
  const ctrl = useRef(null);

  async function send(){
    const content = text.trim();
    if(!content) return;
    setText(''); setBusy(true);
    setMsgs(m => [...m, {id:`u${Date.now()}`, role:'user', content}, {id:`a${Date.now()}`, role:'assistant', content:'…typing'}]);

    ctrl.current = new AbortController();
    const signal = ctrl.current.signal;
    try{
      await new Promise((res,rej) => {
        const t = setTimeout(() => res(), 600);
        signal.addEventListener?.('abort', () => { clearTimeout(t); rej(new Error('aborted')); });
      });
      setMsgs(m => m.slice(0,-1).concat({id:`a${Date.now()}`, role:'assistant', content:`Echo: ${content}`}));
    }catch{
      setMsgs(m => m.slice(0,-1).concat({id:`a${Date.now()}`, role:'assistant', content:'(canceled)'}));
    }finally{
      setBusy(false);
    }
  }
  function cancel(){ ctrl.current?.abort?.(); setBusy(false); }

  return (
    <>
      <div className="thread">
        {msgs.map(x => <MessageBubble key={x.id} role={x.role}>{x.content}</MessageBubble>)}
      </div>
      <Composer value={text} setValue={setText} onSend={send} onCancel={cancel} busy={busy}/>
    </>
  );
}
export default ChatPage;

import { useEffect } from "react";
import { onQuickPrompt } from "../lib/bus";

function useQuickPrompt(setText){
  useEffect(()=>{
    const off = onQuickPrompt((t)=> setText(String(t||"")));
    return off;
  },[setText]);
}
