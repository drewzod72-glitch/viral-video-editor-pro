/**
 * SINGLE SOURCE OF TRUTH for caption appearance.
 *
 * Both the live browser preview (src/types.ts -> getCaptionStyles, used by
 * the editor canvas) and the server-side FFmpeg renderer
 * (server.ts -> getFFmpegCaptionConfig, used to burn captions into the
 * final exported MP4) read their font sizes, colors, and vertical
 * position from this one table.
 *
 * Previously these lived as two hand-copied number tables that had
 * drifted apart (e.g. MrBeast "short" captions were 56px in the preview
 * but rendered at 63px in the exported video). Do not reintroduce a
 * second copy of these numbers anywhere — import this module instead.
 *
 * This file has zero dependencies (no React, no DOM, no Node APIs) so it
 * can be imported unmodified by both the Vite-bundled client and the
 * esbuild-bundled server.
 */

export type CaptionStyleName = 'mrbeast' | 'hormozi' | 'minimalist' | 'comic' | 'impact';

export interface CaptionStyleDefinition {
  /** Font size in px, measured at a 720px-wide reference frame. Caller multiplies by (frameWidth / 720). */
  sizeShort: number;   // textLen <= 25
  sizeMedium: number;  // 25 < textLen <= 45
  sizeLong: number;    // textLen > 45
  textColor: string;
  highlightColor: string;
  /** Stroke/outline width as a fraction of the resolved font size. 0 = no stroke. */
  strokeWidthRatio: number;
  strokeColor: string;
  hasBox: boolean;
  /** FFmpeg drawtext boxcolor syntax, e.g. '#0F172A@0.9'. Also used to derive the CSS preview box background. */
  boxColorFFmpeg?: string;
  boxColorCSS?: string;
  /** Padding around the text inside the box, in px at the 720px reference frame. */
  boxPaddingPx?: number;
  /** Vertical anchor as a fraction of frame height (0 = top, 1 = bottom). */
  yPositionFraction: number;
  /** CSS font-family stack used by the browser preview. The server maps each style to its closest bundled TTF (see FONT_FILE_FOR_STYLE below). */
  fontFamilyCSS: string;
  textTransform: 'uppercase' | 'none';
}

export const CAPTION_STYLES: Record<CaptionStyleName, CaptionStyleDefinition> = {
  mrbeast: {
    sizeShort: 56, sizeMedium: 42, sizeLong: 36,
    textColor: '#FFFFFF', highlightColor: '#10B981',
    strokeWidthRatio: 0.22, strokeColor: '#000000',
    hasBox: true, boxColorFFmpeg: '#0F172A@0.9', boxColorCSS: 'rgba(15, 23, 42, 0.9)',
    boxPaddingPx: 16,
    yPositionFraction: 0.72,
    fontFamilyCSS: '"Space Grotesk", "Arial Black", Arial, sans-serif',
    textTransform: 'uppercase',
  },
  hormozi: {
    sizeShort: 72, sizeMedium: 54, sizeLong: 48,
    textColor: '#FBBF24', highlightColor: '#EC4899',
    strokeWidthRatio: 0.24, strokeColor: '#000000',
    hasBox: false,
    yPositionFraction: 0.74,
    fontFamilyCSS: '"Oswald", "Impact", "Arial Black", sans-serif',
    textTransform: 'uppercase',
  },
  minimalist: {
    sizeShort: 35, sizeMedium: 35, sizeLong: 28,
    textColor: '#FFFFFF', highlightColor: '#06B6D4',
    strokeWidthRatio: 0, strokeColor: 'transparent',
    hasBox: true, boxColorFFmpeg: '#0F172A@0.78', boxColorCSS: 'rgba(15, 23, 42, 0.78)',
    boxPaddingPx: 19,
    yPositionFraction: 0.76,
    fontFamilyCSS: '"Inter", system-ui, sans-serif',
    textTransform: 'none',
  },
  comic: {
    sizeShort: 56, sizeMedium: 42, sizeLong: 34,
    textColor: '#FFFFFF', highlightColor: '#F43F5E',
    strokeWidthRatio: 0.22, strokeColor: '#000000',
    hasBox: false,
    yPositionFraction: 0.72,
    fontFamilyCSS: '"Outfit", "Arial Black", sans-serif',
    textTransform: 'uppercase',
  },
  impact: {
    sizeShort: 52, sizeMedium: 40, sizeLong: 32,
    textColor: '#22D3EE', highlightColor: '#EAB308',
    strokeWidthRatio: 0, strokeColor: 'transparent',
    hasBox: true, boxColorFFmpeg: '#000000@0.95', boxColorCSS: 'rgba(0, 0, 0, 0.95)',
    boxPaddingPx: 18,
    yPositionFraction: 0.74,
    fontFamilyCSS: '"JetBrains Mono", monospace',
    textTransform: 'uppercase',
  },
};

/**
 * Server-side TTF file name for each style — must exist in the bundled
 * fonts directory (server.ts's BUNDLED_FONTS_DIR, i.e. /fonts at the repo
 * root) for the exported video to match the preview's font-family exactly.
 *
 * NOTE on 'hormozi': the client preview's CSS font-family is "Impact",
 * a proprietary system font not distributed on Google Fonts. Rather than
 * depend on a real Impact.ttf (no legitimate free CDN source), this app
 * bundles Oswald Bold instead — a freely-licensed condensed bold face
 * that's a reasonable visual stand-in. This is a deliberate, permanent
 * choice (not a last-resort fallback), so the client preview's font-family
 * for the 'hormozi' style should also list Oswald ahead of "Impact" if you
 * want the editor preview to visually match the exported video exactly —
 * see CAPTION_STYLES.hormozi.fontFamilyCSS below.
 *
 * NOTE on 'minimalist': unlike every other style (all rendered at
 * font-weight 900 in the preview), the 'minimalist' style is deliberately
 * lighter — the preview renders it at font-weight 500 (see
 * VideoPlayerWorkspace.tsx's renderStyledText, which sets fontWeight: 500
 * specifically for this style) to match its "clean, quiet" visual
 * identity. The bundled font must be the matching weight — Inter Medium,
 * NOT Inter Bold — or the exported video will look noticeably heavier
 * than what the preview showed.
 */
export const FONT_FILE_FOR_STYLE: Record<CaptionStyleName, string> = {
  mrbeast: 'SpaceGrotesk-Bold.ttf',
  hormozi: 'Oswald-Bold.ttf',
  minimalist: 'Inter-Medium.ttf',
  comic: 'Outfit-Bold.ttf',
  impact: 'JetBrainsMono-Bold.ttf',
};

export function normalizeCaptionStyle(style: string | undefined | null): CaptionStyleName {
  const valid: CaptionStyleName[] = ['mrbeast', 'hormozi', 'minimalist', 'comic', 'impact'];
  return (valid as string[]).includes(style || '') ? (style as CaptionStyleName) : 'minimalist';
}

/** Resolves the reference (720px-wide) font size for a given style and caption text length. */
export function resolveFontSizeAt720(style: CaptionStyleName, textLen: number): number {
  const def = CAPTION_STYLES[style];
  if (textLen > 45) return def.sizeLong;
  if (textLen > 25) return def.sizeMedium;
  return def.sizeShort;
}

/**
 * Scales every size-dependent value for a target frame width.
 * @param style caption style name
 * @param textLen length of the caption text (used to pick short/medium/long bracket)
 * @param frameWidth actual output width in px (e.g. 1080 for a 9:16 short)
 */
export function resolveCaptionMetrics(style: CaptionStyleName, textLen: number, frameWidth: number) {
  const def = CAPTION_STYLES[style];
  const scale = frameWidth / 720;
  const fontSize = Math.round(resolveFontSizeAt720(style, textLen) * scale);
  return {
    ...def,
    fontSize,
    strokeWidth: Math.round(fontSize * def.strokeWidthRatio),
    boxPadding: def.boxPaddingPx ? Math.round(def.boxPaddingPx * scale) : 0,
  };
}
