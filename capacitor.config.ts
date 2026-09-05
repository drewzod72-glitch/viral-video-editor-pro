import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.autoviral.videoeditor',
  appName: 'Auto Viral Video Editor',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#0f0f0f',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      spinnerColor: '#EC4899',
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#0f0f0f',
    },
    Keyboard: {
      resize: 'body',
    },
    Filesystem: {
      url: 'http://localhost',
    },
    Share: {
      enabled: true,
    },
  },
};

export default config;
