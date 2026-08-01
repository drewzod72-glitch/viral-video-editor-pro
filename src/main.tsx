import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log('[System] Initializing Viral Forge...');

const container = document.getElementById('root');

if (container) {
  try {
    const root = createRoot(container);
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
    console.log('[System] App Mounted.');
  } catch (err) {
    console.error('[Critical] Render Crash:', err);
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; background: #020617; color: white; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <h1 style="color: #f43f5e;">HARDWARE REJECT</h1>
        <p style="color: #94a3b8;">The studio could not initialize on this device memory.</p>
        <button onclick="location.reload()" style="padding: 12px 24px; background: #8b5cf6; color: white; border: none; border-radius: 12px; font-weight: bold;">RETRY STUDIO</button>
      </div>
    `;
  }
}
