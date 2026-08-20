export const theme = {
  colors: {
    primary: '#3b82f6',
    onPrimary: '#ffffff',
    secondary: '#6366f1',
    onSecondary: '#ffffff',
    accent: '#EC4899',
    onAccent: '#ffffff',
    background: '#0f0f0f',
    foreground: '#ffffff',
    card: '#1a1a1a',
    cardForeground: '#ffffff',
    muted: '#252525',
    mutedForeground: '#a1a1aa',
    border: '#333333',
    destructive: '#ef4444',
    onDestructive: '#ffffff',
    ring: '#3b82f6',
  },
  typography: {
    fontFamily: '"Inter", sans-serif',
    fontSizeBase: '16px',
    lineHeight: '1.5',
  },
  effects: {
    glow: '0 0 10px rgba(59,130,246,0.3)',
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
