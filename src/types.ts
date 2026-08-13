import { resolveCaptionMetrics, normalizeCaptionStyle } from './utils/captionStyleConfig';

export type VideoNiche = 'fitness' | 'education' | 'comedy' | 'motivation' | 'cooking' | 'tech' | 'pets' | 'unboxing' | 'sales' | 'general';

export type CaptionStyle = 'mrbeast' | 'hormozi' | 'minimalist' | 'impact' | 'comic';

export interface MusicTrack {
  id: string;
  name: string;
  artist: string;
  url: string;
  genre: string;
  intensity: 'lofi' | 'hype' | 'chill' | 'cinematic';
}

export interface HighlightClip {
  id: string;
  title: string;
  start: number;
  end: number;
  duration: number;
  viralityScore: number;
  description: string;
  whyEngaging: string;
  speed?: number;
}

export interface SubtitleItem {
  id: string;
  text: string;
  start: number;
  end: number;
  emoji?: string;
  highlightWords?: string[]; // words to highlight
}

export interface VideoProject {
  id: string;
  name: string;
  type: 'sample' | 'custom';
  videoUrl: string;
  duration: number; // in seconds
  originalDuration?: number; // original raw footage duration before edits
  userDescription?: string; // original user-provided description of the video
  niche: VideoNiche;
  title: string;
  alternativeTitles?: string[];
  description: string;
  tags: string[];
  viralityScore: number; // 0 - 100
  viralityCriteria: {
    hook: number;
    pacing: number;
    emotion: number;
    visualContrast: number;
  };
  viralityFeedback: string[];
  highlights: HighlightClip[];
  cuts?: Array<{ id: string; start: number; end: number; reason: string }>;
  subtitles: SubtitleItem[];
  captionStyle: CaptionStyle;
  selectedMusicTrackId: string;
  colorGrade: 'none' | 'cinematic' | 'warm_vintage' | 'vibrant_pop' | 'moody_cyber' | 'film_noir' | 'neon_nights' | 'golden_hour';
  zoomEffects: Array<{ timestamp: number; scale: number; duration: number }>;
  captionRotation?: number;
  captionPosition?: 'top' | 'center' | 'bottom';
  createdAt: string;
  endingCTA?: string;
  thumbnailRecommendation?: string;
  engineMode?: 'live-gemini' | 'simulated-engine' | 'edge-rules';
  transitionStyle?: 'none' | 'crossfade' | 'glitch' | 'flash' | 'zoom' | 'fade_black' | 'slide_left' | 'wipe_left' | 'wipe_right' | 'slide_right' | 'circle_open' | 'circle_close' | 'dissolve' | 'glow' | 'pixelize';
  
  // UNIFIED PERSISTENT SETTINGS
  enableSubtitles: boolean;
  enableZooms: boolean;
  enableColorGrade: boolean;
  musicVolume: number;
  jumpCuts: boolean;
  speedRamp: boolean;
  sfxSparks: boolean;
  emojiBounces: boolean;
  autoZoomPunch: boolean;
  shakeOnPunch: boolean;
  camRecorderHUD: boolean;

  sfxWhooshEnabled?: boolean;
  sfxPopEnabled?: boolean;
  sfxImpactEnabled?: boolean;
  sfxWhooshUrl?: string;
  sfxPopUrl?: string;
  sfxImpactUrl?: string;
  imitationOptions?: {
    archetype: string;
    referenceSource: string;
    copyInstructions: string;
  } | null;
}

export interface CaptionStyleConfig {
  fontFamily: string;
  fontSize: number;
  highlightFontSize: number;
  textTransform: 'uppercase' | 'none';
  lineHeight: string;
  letterSpacing: string;
  strokeWidth: number;
  strokeColor: string;
  textColor: string;
  highlightColor: string;
  shadow: string;
  hasBox: boolean;
  boxBg?: string;
  boxBorder?: string;
  boxBorderWidth?: number;
  boxPaddingX?: number;
  boxPaddingY?: number;
  boxRadius?: number;
  /** Vertical anchor as a fraction of frame height (0 = top, 1 = bottom). */
  yPositionFraction?: number;
}

/**
 * Resolves the exact caption appearance for the browser preview.
 *
 * IMPORTANT: this reads from src/utils/captionStyleConfig.ts — the same
 * table the server-side FFmpeg renderer uses (see server.ts ->
 * getFFmpegCaptionConfig). If you need to change how a caption style
 * looks, edit captionStyleConfig.ts, not this function — otherwise the
 * exported video will stop matching what the user sees in the editor.
 */
export function getCaptionStyles(style: string, textLen: number, W: number): CaptionStyleConfig {
  const scale = W / 720;
  const normalizedStyle = normalizeCaptionStyle(style);
  const metrics = resolveCaptionMetrics(normalizedStyle, textLen, W);

  const config: CaptionStyleConfig = {
    fontFamily: metrics.fontFamilyCSS,
    fontSize: metrics.fontSize,
    highlightFontSize: Math.round(metrics.fontSize * 1.15),
    textTransform: metrics.textTransform,
    lineHeight: `${Math.round(metrics.fontSize * 1.3)}px`,
    letterSpacing: `${Math.round(-1 * scale)}px`,
    strokeWidth: metrics.strokeWidth,
    strokeColor: metrics.strokeColor,
    textColor: metrics.textColor,
    highlightColor: metrics.highlightColor,
    shadow: metrics.strokeWidth > 0
      ? `0 ${Math.round(3 * scale)}px ${Math.round(6 * scale)}px rgba(0,0,0,0.85)`
      : `${Math.round(3 * scale)}px ${Math.round(3 * scale)}px 0px rgba(0,0,0,1)`,
    hasBox: metrics.hasBox,
    yPositionFraction: metrics.yPositionFraction,
  };

  if (metrics.hasBox) {
    config.boxBg = metrics.boxColorCSS;
    config.boxBorder = 'rgba(255, 255, 255, 0.08)';
    config.boxBorderWidth = Math.round(1 * scale);
    config.boxPaddingX = metrics.boxPadding;
    config.boxPaddingY = Math.round(metrics.boxPadding * 0.7);
    config.boxRadius = Math.round(10 * scale);
  }

  return config;
}
