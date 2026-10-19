import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress WebSocket and HMR errors in AI Studio iframe environment (HMR is disabled in this environment)
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const msg = event?.message || '';
    if (
      msg.includes('WebSocket') ||
      msg.includes('ws://') ||
      msg.includes('wss://') ||
      msg.includes('vite:hmr') ||
      msg.includes('failed to fetch /@vite/client')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = String(event?.reason || '');
    if (
      reason.includes('WebSocket') ||
      reason.includes('ws://') ||
      reason.includes('wss://') ||
      reason.includes('vite:hmr') ||
      reason.includes('failed to fetch /@vite/client')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);
