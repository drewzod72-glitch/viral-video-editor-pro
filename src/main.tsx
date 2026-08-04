import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const container = document.getElementById('root');

if (container) {
  try {
    const root = createRoot(container);
    root.render(<App />);
  } catch (err) {
    document.body.innerHTML = `
      <div style="background:#020617;color:white;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;">
        <h2 style="color:#f43f5e">STUDIO BOOT ERROR</h2>
        <button onclick="location.reload()" style="background:#8b5cf6;color:white;padding:12px 24px;border:none;border-radius:12px;margin-top:20px;">RETRY LOAD</button>
      </div>
    `;
  }
}
