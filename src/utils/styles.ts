import { CSSProperties, MouseEvent } from 'react';
import { theme } from './theme';
import type { Theme } from './theme';

export { theme };
export const colors = theme.colors;
export const spacing = theme.spacing;
export const borderRadius = theme.borderRadius;
export const typography = theme.typography;
export const effects = theme.effects;
export const zIndex = theme.zIndex;
export type { Theme };

export const statusColors = {
  success: '#22c55e',
  successDim: 'rgba(34, 197, 94, 0.1)',
  successText: '#4ade80',
  warning: '#f59e0b',
  warningDim: 'rgba(245, 158, 11, 0.1)',
  warningText: '#fbbf24',
  cyan: '#06b6d4',
  cyanDim: 'rgba(6, 182, 212, 0.08)',
  errorDim: 'rgba(239, 68, 68, 0.08)',
  errorText: '#fca5a5',
} as const;

export const TRANSITION = {
  fast: 'all 0.15s ease',
  smooth: 'all 0.2s ease',
  smoothSlow: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export const INTER = '"Inter", sans-serif';
export const MONO = '"JetBrains Mono", monospace';

export const tint = (hex: string, opacity: number): string => {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export const toHexWithAlpha = (hex: string, alpha: number): string => {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const glassCard = (opts?: { padding?: string; border?: boolean; radius?: string }): CSSProperties => ({
  background: `linear-gradient(180deg, ${tint(colors.background, 0.95)} 0%, ${tint(colors.card, 0.98)} 100%)`,
  border: opts?.border === false ? 'none' : `1px solid ${colors.border}`,
  borderRadius: opts?.radius || borderRadius.xl,
  backdropFilter: 'blur(16px)',
  ...(opts?.padding ? { padding: opts.padding } : {}),
});

export const btnPrimary = (opts?: { active?: boolean; disabled?: boolean; fullWidth?: boolean }): CSSProperties => ({
  background: opts?.active
    ? `linear-gradient(135deg, ${colors.secondary}, ${colors.primary})`
    : `linear-gradient(135deg, ${colors.accent}, ${colors.secondary})`,
  color: colors.onAccent,
  border: 'none',
  borderRadius: borderRadius.lg,
  fontWeight: 700,
  fontFamily: INTER,
  cursor: opts?.disabled ? 'not-allowed' : 'pointer',
  boxShadow: `0 8px 30px ${tint(colors.accent, 0.3)}`,
  opacity: opts?.disabled ? 0.5 : 1,
  width: opts?.fullWidth ? '100%' : undefined,
  transition: TRANSITION.smoothSlow,
});

export const btnPrimaryHover = (e: MouseEvent<HTMLButtonElement>) => {
  const btn = e.currentTarget;
  btn.style.transform = 'translateY(-2px) scale(1.03)';
  btn.style.boxShadow = `0 12px 40px ${tint(colors.accent, 0.4)}`;
};

export const btnPrimaryLeave = (e: MouseEvent<HTMLButtonElement>) => {
  const btn = e.currentTarget;
  btn.style.transform = 'translateY(0) scale(1)';
  btn.style.boxShadow = `0 8px 30px ${tint(colors.accent, 0.3)}`;
};

export const btnGhost = (opts?: { active?: boolean }): CSSProperties => ({
  background: 'transparent',
  color: opts?.active ? colors.foreground : colors.mutedForeground,
  border: `1px solid ${colors.border}`,
  borderRadius: borderRadius.md,
  fontWeight: 600,
  fontSize: '12px',
  fontFamily: INTER,
  cursor: 'pointer',
  transition: TRANSITION.smooth,
});

export const btnGhostHover = (e: MouseEvent<HTMLButtonElement>) => {
  const btn = e.currentTarget;
  btn.style.background = tint(colors.foreground, 0.04);
  btn.style.color = colors.foreground;
  btn.style.borderColor = tint(colors.foreground, 0.1);
};

export const btnGhostLeave = (e: MouseEvent<HTMLButtonElement>) => {
  const btn = e.currentTarget;
  btn.style.background = 'transparent';
  btn.style.color = colors.mutedForeground;
  btn.style.borderColor = colors.border;
};

export const btnToggle = (opts?: { active?: boolean; color?: string }): CSSProperties => {
  const c = opts?.color || colors.primary;
  const isActive = opts?.active || false;
  return {
    padding: `${parseInt(spacing.sm)}px ${parseInt(spacing.md)}px`,
    borderRadius: borderRadius.md,
    border: `1px solid ${isActive ? c : colors.border}`,
    background: isActive ? tint(c, 0.12) : 'rgba(2,6,23,0.4)',
    color: isActive ? c : colors.mutedForeground,
    fontSize: '11px',
    fontWeight: 700,
    fontFamily: INTER,
    cursor: 'pointer',
    transition: TRANSITION.smooth,
  };
};

export const tabButton = (opts?: { active?: boolean; activeColor?: string }): CSSProperties => {
  const c = opts?.activeColor || colors.primary;
  const isActive = opts?.active || false;
  return {
    flex: 1,
    padding: '10px',
    border: 'none',
    borderRadius: borderRadius.md,
    background: isActive ? tint(c, 0.18) : 'transparent',
    color: isActive ? colors.foreground : colors.mutedForeground,
    fontWeight: 800,
    fontSize: '11px',
    fontFamily: INTER,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    cursor: 'pointer',
    transition: TRANSITION.smooth,
    position: 'relative' as const,
  };
};

export const inputField = (opts?: { error?: boolean }): CSSProperties => ({
  width: '100%',
  background: 'rgba(2, 6, 23, 0.6)',
  border: `1px solid ${opts?.error ? colors.destructive : colors.border}`,
  borderRadius: borderRadius.md,
  padding: `${parseInt(spacing.md)}px ${parseInt(spacing.lg)}px`,
  color: colors.foreground,
  fontSize: '13px',
  outline: 'none',
  fontFamily: INTER,
  boxSizing: 'border-box' as const,
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
});

export const sectionLabel = (opts?: { color?: string }): CSSProperties => ({
  fontSize: '10px',
  fontWeight: 800,
  color: opts?.color || colors.mutedForeground,
  textTransform: 'uppercase',
  letterSpacing: '1.5px',
  fontFamily: INTER,
  marginBottom: spacing.sm,
});

export const badge = (opts?: { bg?: string; color?: string; size?: 'sm' | 'md' }): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: opts?.size === 'sm' ? '2px 8px' : '4px 10px',
  borderRadius: borderRadius.sm,
  fontSize: opts?.size === 'sm' ? '8px' : '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  fontFamily: INTER,
  backgroundColor: opts?.bg || tint(colors.primary, 0.1),
  color: opts?.color || colors.primary,
  border: `1px solid ${opts?.bg ? tint(opts.bg, 0.2) : tint(colors.primary, 0.2)}`,
});

export const statCard = (opts?: { active?: boolean; accent?: string }): CSSProperties => {
  const c = opts?.accent || colors.primary;
  const isActive = opts?.active || false;
  return {
    background: isActive ? tint(c, 0.08) : 'rgba(2,6,23,0.6)',
    padding: '14px',
    borderRadius: borderRadius.md,
    border: `1px solid ${isActive ? tint(c, 0.4) : colors.border}`,
    color: isActive ? c : colors.mutedForeground,
    fontSize: '11px',
    fontWeight: 700,
    fontFamily: INTER,
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: TRANSITION.smooth,
  };
};

export const iconButtonStyle = (opts?: { size?: number; color?: string; bg?: string }): CSSProperties => ({
  width: `${opts?.size || 32}px`,
  height: `${opts?.size || 32}px`,
  borderRadius: '50%',
  background: opts?.bg || 'rgba(0,0,0,0.35)',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: opts?.color || colors.foreground,
  flexShrink: 0,
  cursor: 'pointer',
});
