import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';

// Immediately apply cached theme attributes before React render to eliminate any initial flash
try {
  if (typeof localStorage !== 'undefined') {
    const rawThemeId = localStorage.getItem('prism_theme_id');
    let savedBg = localStorage.getItem('prism_theme_bg');
    let savedMode = localStorage.getItem('prism_theme_mode');

    // Dynamically resolve system mode before initial paint
    if (rawThemeId === 'system' && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const isLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      savedMode = isLight ? 'light' : 'dark';
      savedBg = isLight ? '#F8FAFC' : '#090A0F';
    }

    if (savedBg) {
      document.documentElement.style.setProperty('--prism-bg', savedBg);
      document.documentElement.style.backgroundColor = savedBg;
    }
    if (savedMode === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.documentElement.style.colorScheme = 'light';
      const meta = document.getElementById('prism-color-scheme') as HTMLMetaElement | null;
      if (meta) meta.content = 'light';
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
      const meta = document.getElementById('prism-color-scheme') as HTMLMetaElement | null;
      if (meta) meta.content = 'dark';
    }
  }
} catch {
  // Ignore in restricted environments
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
