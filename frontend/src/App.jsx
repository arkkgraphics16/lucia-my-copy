import React from 'react';
import './styles/tokens.css';
import './styles/app.css';
import './styles/limit.css';
import "./styles/typing.css"; 
import AppShell from './components/AppShell';
import ChatPage from './pages/ChatPage';

export default function App() {
  return (
    <AppShell>
      <ChatPage />
    </AppShell>
  );
}
