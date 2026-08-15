export const theme = {
  colors: {
    primary: '#EC4899',
    onPrimary: '#000000',
    secondary: '#DB2777',
    onSecondary: '#FFFFFF',
    accent: '#2563EB',
    onAccent: '#FFFFFF',
    background: '#0F172A',
    foreground: '#FFFFFF',
    card: '#192134',
    cardForeground: '#FFFFFF',
    muted: '#201A32',
    mutedForeground: '#94A3B8',
    border: 'rgba(255,255,255,0.08)',
    destructive: '#DC2626',
    onDestructive: '#FFFFFF',
    ring: '#EC4899',
  },
  typography: {
    fontFamily: '"Inter", sans-serif',
    fontSizeBase: '16px',
    lineHeight: '1.5',
  },
  effects: {
    glow: '0 0 10px rgba(236,72,149,0.3)',
    transition: 'all 0.2s ease',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '20px',
    xl: '24px',
    '2xl': '32px',
  },
  borderRadius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    full: '9999px',
  },
  zIndex: {
    base: 0,
    dropdown: 10,
    sticky: 20,
    overlay: 40,
    modal: 100,
    toast: 1000,
  },
} as const;

export type Theme = typeof theme;
