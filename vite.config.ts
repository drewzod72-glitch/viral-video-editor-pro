import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const removeCrossoriginPlugin = () => ({
  name: 'remove-crossorigin',
  transformIndexHtml(html: string) {
    return html.replace(/\s*crossorigin/g, '');
  },
});

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    removeCrossoriginPlugin(),
  ],
  build: {
    target: 'es2020', // Better compatibility for iPhone 11 (iOS 13+)
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
