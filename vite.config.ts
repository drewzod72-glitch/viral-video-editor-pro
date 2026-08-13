import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Relative asset paths so the same bundle works on any host, including
  // subpath hosting like GitHub Pages (…github.io/viral-video-editor-pro/).
  base: './',
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    target: 'es2020', // Better compatibility for iPhone 11 (iOS 13+)
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    // Allow any host in dev so the app works through preview proxies
    // (e.g. Arena live preview, ngrok, LAN testing from a phone).
    // Dev-only; production is unaffected.
    allowedHosts: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  }
});
