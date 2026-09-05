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
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'background:#020617;color:white;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;padding:20px;text-align:center;';
    errorDiv.innerHTML = `
      <h2 style="color:#f43f5e;margin-bottom:12px;">STUDIO BOOT ERROR</h2>
      <pre id="boot-error-text" style="background:#18181b;padding:16px;border-radius:12px;max-width:90vw;overflow:auto;font-size:12px;color:#fca5a5;white-space:pre-wrap;"></pre>
      <button onclick="location.reload()" style="background:#EC4899;color:white;padding:12px 24px;border:none;border-radius:12px;margin-top:20px;font-weight:700;">RETRY LOAD</button>
    `;
    const errorText = errorDiv.querySelector('#boot-error-text');
    if (errorText) errorText.textContent = (err as any)?.message || String(err);
    document.body.innerHTML = '';
    document.body.appendChild(errorDiv);
  }
}

window.addEventListener('error', (e) => {
  console.error('GLOBAL RUNTIME ERROR:', e.error);
  const err = e.error instanceof Error ? e.error : new Error(String(e.error));
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'background:#020617;color:white;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;padding:20px;text-align:center;';
  errorDiv.innerHTML = `
    <h2 style="color:#f43f5e;margin-bottom:12px;">RUNTIME ERROR</h2>
    <pre id="runtime-error-text" style="background:#18181b;padding:16px;border-radius:12px;max-width:90vw;overflow:auto;font-size:12px;color:#fca5a5;white-space:pre-wrap;"></pre>
    <button onclick="location.reload()" style="background:#EC4899;color:white;padding:12px 24px;border:none;border-radius:12px;margin-top:20px;font-weight:700;">RETRY LOAD</button>
  `;
  const errorText = errorDiv.querySelector('#runtime-error-text');
  if (errorText) errorText.textContent = `${err.name}: ${err.message}\n${err.stack || ''}`;
  document.body.innerHTML = '';
  document.body.appendChild(errorDiv);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('UNHANDLED PROMISE REJECTION:', e.reason);
  const reason = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'background:#020617;color:white;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;padding:20px;text-align:center;';
  errorDiv.innerHTML = `
    <h2 style="color:#f43f5e;margin-bottom:12px;">ASYNC ERROR</h2>
    <pre id="async-error-text" style="background:#18181b;padding:16px;border-radius:12px;max-width:90vw;overflow:auto;font-size:12px;color:#fca5a5;white-space:pre-wrap;"></pre>
    <button onclick="location.reload()" style="background:#EC4899;color:white;padding:12px 24px;border:none;border-radius:12px;margin-top:20px;font-weight:700;">RETRY LOAD</button>
  `;
  const errorText = errorDiv.querySelector('#async-error-text');
  if (errorText) errorText.textContent = `${reason.name}: ${reason.message}\n${reason.stack || ''}`;
  document.body.innerHTML = '';
  document.body.appendChild(errorDiv);
});
