import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const container = document.getElementById('root');

if (container) {
  try {
    const root = createRoot(container);
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  } catch (err) {
    console.error('STUDIO BOOT ERROR:', err);
    document.body.innerHTML = `
      <div style="background:#020617;color:white;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;padding:20px;text-align:center;">
        <h2 style="color:#f43f5e;margin-bottom:12px;">STUDIO BOOT ERROR</h2>
        <pre style="background:#18181b;padding:16px;border-radius:12px;max-width:90vw;overflow:auto;font-size:12px;color:#fca5a5;white-space:pre-wrap;">${(err as any)?.message || String(err)}</pre>
        <button onclick="location.reload()" style="background:#8b5cf6;color:white;padding:12px 24px;border:none;border-radius:12px;margin-top:20px;font-weight:700;">RETRY LOAD</button>
      </div>
    `;
  }
}

window.addEventListener('error', (e) => {
  console.error('GLOBAL RUNTIME ERROR:', e.error);
  document.body.innerHTML = `
    <div style="background:#020617;color:white;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;padding:20px;text-align:center;">
      <h2 style="color:#f43f5e;margin-bottom:12px;">RUNTIME ERROR</h2>
      <pre style="background:#18181b;padding:16px;border-radius:12px;max-width:90vw;overflow:auto;font-size:12px;color:#fca5a5;white-space:pre-wrap;">${(e as any)?.message || String(e)}</pre>
      <button onclick="location.reload()" style="background:#8b5cf6;color:white;padding:12px 24px;border:none;border-radius:12px;margin-top:20px;font-weight:700;">RETRY LOAD</button>
    </div>
  `;
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('UNHANDLED PROMISE REJECTION:', e.reason);
  document.body.innerHTML = `
    <div style="background:#020617;color:white;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;padding:20px;text-align:center;">
      <h2 style="color:#f43f5e;margin-bottom:12px;">ASYNC ERROR</h2>
      <pre style="background:#18181b;padding:16px;border-radius:12px;max-width:90vw;overflow:auto;font-size:12px;color:#fca5a5;white-space:pre-wrap;">${(e as any)?.reason || String(e)}</pre>
      <button onclick="location.reload()" style="background:#8b5cf6;color:white;padding:12px 24px;border:none;border-radius:12px;margin-top:20px;font-weight:700;">RETRY LOAD</button>
    </div>
  `;
});
