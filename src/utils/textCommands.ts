import { CaptionStyle } from '../types';

const CAPTION_STYLES: CaptionStyle[] = ['mrbeast', 'hormozi', 'minimalist', 'impact', 'comic'];
const MUSIC_TRACKS: Record<string, string> = {
  'hype-1': 'viral hype', 'hype-2': 'beat drop energy', 'hype-3': 'trap anthem',
  'hype-4': 'phonk drift', 'hype-5': 'street pulse', 'hype-6': 'power surge',
  'hype-7': 'rush hour', 'hype-8': 'neon drive', 'hype-9': 'adrenaline',
  'lofi-1': 'sunday morning', 'epic-1': 'cinematic reveal'
};
const COLOR_GRADES = ['none', 'cinematic', 'warm_vintage', 'vibrant_pop', 'moody_cyber', 'film_noir', 'neon_nights', 'golden_hour'];
const TRANSITIONS = ['none', 'crossfade', 'glitch', 'flash', 'zoom', 'fade_black', 'slide_left', 'wipe_left', 'wipe_right', 'slide_right', 'circle_open', 'circle_close', 'dissolve', 'glow', 'pixelize'];

export function parseTextCommand(input: string): any {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;

  if (raw.includes('remove silence') || raw.includes('delete silence') || raw.includes('cut silence')) {
    return { type: 'remove_silence' };
  }
  if (raw.includes('remove cuts') || raw.includes('clear cuts') || raw.includes('delete cuts')) {
    return { type: 'remove_cuts' };
  }
  if (raw.includes('speed up') || raw.includes('faster')) {
    const match = raw.match(/(\d+\.?\d*)\s*x/);
    const factor = match ? parseFloat(match[1]) : 1.5;
    return { type: 'speed_up', factor: Math.min(Math.max(factor, 0.5), 4) };
  }
  if (raw.includes('slow down') || raw.includes('slower')) {
    const match = raw.match(/(\d+\.?\d*)\s*x/);
    const factor = match ? parseFloat(match[1]) : 0.75;
    return { type: 'speed_up', factor: Math.min(Math.max(factor, 0.25), 2) };
  }
  for (const style of CAPTION_STYLES) {
    if (raw.includes(style)) {
      return { type: 'change_caption_style', style };
    }
  }
  for (const [id, name] of Object.entries(MUSIC_TRACKS)) {
    if (raw.includes(name) || raw.includes(id)) {
      return { type: 'change_music', trackId: id };
    }
  }
  for (const grade of COLOR_GRADES) {
    if (raw.replace(/_/g, ' ').includes(grade.replace(/_/g, ' '))) {
      return { type: 'change_color_grade', grade };
    }
  }
  for (const t of TRANSITIONS) {
    if (raw.includes(t.replace(/_/g, ' '))) {
      return { type: 'add_transition', style: t };
    }
  }
  if (raw.includes('add zoom') || raw.includes('zoom in')) {
    const match = raw.match(/at\s+(\d+\.?\d*)/);
    const timestamp = match ? parseFloat(match[1]) : 0;
    const scaleMatch = raw.match(/(\d+\.?\d*)\s*x/);
    const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1.5;
    return { type: 'add_zoom', timestamp, scale: Math.min(Math.max(scale, 1.1), 3) };
  }
  if (raw.includes('add b-roll') || raw.includes('insert broll') || raw.includes('broll at')) {
    const match = raw.match(/at\s+(\d+\.?\d*)/);
    const timestamp = match ? parseFloat(match[1]) : 0;
    const durMatch = raw.match(/for\s+(\d+\.?\d*)/);
    const duration = durMatch ? parseFloat(durMatch[1]) : 3;
    return { type: 'add_broll', timestamp, duration };
  }
  if (raw.includes('voiceover') || raw.includes('text-to-speech') || raw.includes('tts')) {
    const textMatch = raw.match(/"([^"]+)"/) || raw.match(/say\s+"([^"]+)"/) || raw.match(/say\s+(.+)/);
    const text = textMatch ? textMatch[1] : raw.replace(/voiceover|text-to-speech|tts|say/g, '').trim() || 'Hello world';
    return { type: 'voiceover', text };
  }
  if (raw.includes('subtitles on')) return { type: 'toggle_effect', effect: 'enableSubtitles', value: true };
  if (raw.includes('subtitles off')) return { type: 'toggle_effect', effect: 'enableSubtitles', value: false };
  if (raw.includes('zooms on')) return { type: 'toggle_effect', effect: 'enableZooms', value: true };
  if (raw.includes('zooms off')) return { type: 'toggle_effect', effect: 'enableZooms', value: false };
  if (raw.includes('color on')) return { type: 'toggle_effect', effect: 'enableColorGrade', value: true };
  if (raw.includes('color off')) return { type: 'toggle_effect', effect: 'enableColorGrade', value: false };
  if (raw.includes('shake on')) return { type: 'toggle_effect', effect: 'shakeOnPunch', value: true };
  if (raw.includes('shake off')) return { type: 'toggle_effect', effect: 'shakeOnPunch', value: false };

  return null;
}

export function getCommandSuggestions(input: string): string[] {
  const raw = input.toLowerCase();
  const suggestions: string[] = [];
  if (raw.includes('remov') || raw.includes('cut') || raw.includes('delet')) {
    suggestions.push('Remove silence', 'Remove cuts', 'Clear all cuts');
  }
  if (raw.includes('zoom') || raw.includes('scale') || raw.includes('in')) {
    suggestions.push('Add zoom at 0s', 'Add zoom at 5s 1.5x');
  }
  if (raw.includes('caption') || raw.includes('style') || raw.includes('font')) {
    suggestions.push('Change caption style to mrbeast', 'Change caption style to minimalist');
  }
  if (raw.includes('music') || raw.includes('track') || raw.includes('audio')) {
    suggestions.push('Change music to hype-1', 'Change music to lofi-1');
  }
  if (raw.includes('color') || raw.includes('grade') || raw.includes('lut')) {
    suggestions.push('Change color grade to cinematic', 'Change color grade to vibrant_pop');
  }
  if (raw.includes('speed') || raw.includes('fast') || raw.includes('slow')) {
    suggestions.push('Speed up 1.5x', 'Slow down 0.75x');
  }
  if (raw.includes('broll') || raw.includes('b-roll') || raw.includes('overlay')) {
    suggestions.push('Add B-roll at 2s for 3s', 'Insert B-roll at 5s');
  }
  if (raw.includes('voice') || raw.includes('speak') || raw.includes('tts')) {
    suggestions.push('Voiceover: Check this out!', 'TTS: Welcome to my channel');
  }
  if (raw.includes('subtitle') || raw.includes('caption')) {
    suggestions.push('Subtitles on', 'Subtitles off');
  }
  if (raw.includes('transition') || raw.includes('effect')) {
    suggestions.push('Add transition glitch', 'Add transition flash');
  }
  return suggestions.slice(0, 5);
}
