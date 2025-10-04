import React, { useEffect, useState } from 'react';
import { useAuthToken } from '../hooks/useAuthToken';
import StatusBar from './StatusBar';
import Sidebar from './Sidebar';

function AppShell({ children }) {
  // keep hook for future use; top-right header remains blank per spec
  const { user } = useAuthToken();
  const [open, setOpen] = useState(false);

  // Close the sidebar on navigation events or when resizing back to desktop
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const closeSidebar = () => setOpen(false);
    const handleResize = () => {
      if (window.innerWidth > 768) setOpen(false);
    };

    window.addEventListener('lucia:navigate-page', closeSidebar);
    window.addEventListener('lucia:switch-chat', closeSidebar);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('lucia:navigate-page', closeSidebar);
      window.removeEventListener('lucia:switch-chat', closeSidebar);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Lock body scroll + add escape key support when the sidebar is open
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const originalOverflow = document.body.style.overflow;
    if (open) {
      document.body.style.overflow = 'hidden';
    }

    if (typeof window === 'undefined' || !open) {
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="app-shell">
      <header className="header">
        <button
          type="button"
          className="btn sidebar-toggle"
          aria-expanded={open}
          aria-controls="app-shell-sidebar"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          onClick={() => setOpen((s) => !s)}
        >
          ☰
        </button>
        <div className="brand">
          <img src="/images/lucia-logo.svg" alt="Lucía" />
        <div className="brand-title">LUCIA <span className="dot"/></div>
        </div>
        <div className="header-actions">{/* intentionally empty */}</div>
      </header>

      <div className="layout">
        <Sidebar id="app-shell-sidebar" open={open} onClose={() => setOpen(false)} />
        <button
          type="button"
          className={`sidebar-scrim${open ? ' visible' : ''}`}
          aria-hidden={!open}
          aria-label="Close navigation"
          tabIndex={open ? 0 : -1}
          onClick={() => setOpen(false)}
        />
        <main className="main">
          <div className="top-strip"><StatusBar/></div>
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppShell;
