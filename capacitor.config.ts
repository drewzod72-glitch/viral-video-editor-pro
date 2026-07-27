import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.autoviral.videoeditor',
  appName: 'Auto Viral Video Editor',
  webDir: 'dist',
  // In a native build, VITE_API_BASE_URL (see .env.example) must point at
  // your deployed Express/FFmpeg backend — there is no "same origin" to
  // fall back to inside a native shell the way there is on the web.
  server: {
    // androidScheme 'https' avoids mixed-content issues talking to your
    // backend and to Gemini's API from within the WebView.
    androidScheme: 'https',
  },
};

export default config;
