import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log('[System] Initializing creation of root...');

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Root element #root not found in index.html');
  
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  console.log('[System] App successfully rendered to DOM.');
} catch (error) {
  console.error('[Critical] Failed to mount React app:', error);
  document.body.innerHTML = \`
    <div style="padding: 40px; color: white; background: #020617; font-family: sans-serif; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
      <h2 style="color: #f43f5e;">CRITICAL BOOT ERROR</h2>
      <p style="color: #64748b; max-width: 300px;">\${error.message}</p>
      <button onclick="location.reload()" style="margin-top: 20px; padding: 12px 24px; background: #8b5cf6; color: white; border: none; border-radius: 12px; font-weight: bold;">RETRY</button>
    </div>
  \`;
}
