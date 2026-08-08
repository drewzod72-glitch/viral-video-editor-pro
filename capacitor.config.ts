import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.autoviral.videoeditor',
  appName: 'Auto Viral Video Editor',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
  },
};

export default config;
