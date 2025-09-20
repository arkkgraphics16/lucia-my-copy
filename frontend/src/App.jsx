// frontend/src/App.jsx
import React, { useEffect, useState } from 'react';
import './styles/tokens.css';
import './styles/app.css';
import './styles/limit.css';
import "./styles/typing.css";
import AppShell from './components/AppShell';
import ChatPage from './pages/ChatPage';
import { auth, db } from './firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import FiscalGate from './components/FiscalGate';

export default function App() {
  const [needsFiscal, setNeedsFiscal] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const off = auth.onAuthStateChanged((u) => {
      setAuthReady(true);
      if (!u) { setNeedsFiscal(false); return; }
      const ref = doc(db, "users", u.uid);
      // Listen if doc exists & has fiscal
      const unsub = onSnapshot(ref, (snap) => {
        if (!snap.exists()) { setNeedsFiscal(true); return; }
        const d = snap.data() || {};
        setNeedsFiscal(!(d.fiscalResidence && d.fiscalResidence.countryCode));
      }, () => setNeedsFiscal(true));
      return () => unsub && unsub();
    });
    return () => off();
  }, []);

  return (
    <AppShell>
      {authReady && auth.currentUser && needsFiscal ? (
        <FiscalGate onDone={() => setNeedsFiscal(false)} />
      ) : (
        <ChatPage />
      )}
    </AppShell>
  );
}
