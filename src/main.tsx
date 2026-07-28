import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log('[System] Initializing React application...');

try {
  const container = document.getElementById('root');
  if (!container) {
    throw new Error('Root element not found in index.html');
  }

  const root = createRoot(container);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  
  console.log('[System] React application successfully mounted.');
} catch (err) {
  console.error('[Critical] App failed to mount:', err);
  // Show an emergency error screen if the React app crashes on boot
  document.body.innerHTML = `
    <div style="padding: 40px; color: white; background: #020617; font-family: sans-serif; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
      <h2 style="color: #f43f5e; font-weight: 900;">BOOT ERROR</h2>
      <p style="color: #94a3b8; margin: 10px 0 30px 0; font-size: 13px;">${(err as any).message || 'Memory limit reached.'}</p>
      <button onclick="location.reload()" style="padding: 14px 28px; background: #8b5cf6; color: white; border: none; border-radius: 16px; font-weight: 800; cursor: pointer;">RETRY LOAD</button>
    </div>
  `;
}
