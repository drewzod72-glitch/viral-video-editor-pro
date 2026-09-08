export interface Scene {
  start: number;
  end: number;
  score: number;
  type: 'talking_head' | 'broll' | 'text_overlay' | 'transition' | 'unknown';
}

export interface HookAnalysis {
  score: number;
  hasMotion: boolean;
  hasFace: boolean;
  hasText: boolean;
  brightness: number;
  contrast: number;
  recommendation: string;
}

export interface RetentionPrediction {
  timestamp: number;
  predictedDropoff: number;
  reason: string;
  suggestion: string;
}

export interface AutoZoomSuggestion {
  timestamp: number;
  duration: number;
  scale: number;
  reason: string;
}

export interface BRollSuggestion {
  timestamp: number;
  duration: number;
  keyword: string;
  stockUrl: string;
  confidence: number;
}

function sampleFrame(video: HTMLVideoElement, time: number): Promise<ImageData | null> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) { resolve(null); return; }

    const onSeeked = () => {
      ctx.drawImage(video, 0, 0, 160, 90);
      try {
        const data = ctx.getImageData(0, 0, 160, 90);
        resolve(data);
      } catch {
        resolve(null);
      }
    };
    video.currentTime = time;
    video.addEventListener('seeked', onSeeked, { once: true });
    setTimeout(() => resolve(null), 1000);
  });
}

function computeBrightness(data: ImageData): number {
  let sum = 0;
  const pixels = data.data;
  for (let i = 0; i < pixels.length; i += 4) {
    sum += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
  }
  return sum / (pixels.length / 4);
}

function computeContrast(data: ImageData): number {
  const brightness = computeBrightness(data);
  let sum = 0;
  const pixels = data.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const pixelBrightness = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
    sum += Math.abs(pixelBrightness - brightness);
  }
  return sum / (pixels.length / 4);
}

function detectMotion(prev: ImageData | null, curr: ImageData): number {
  if (!prev) return 0;
  let diff = 0;
  const prevPixels = prev.data;
  const currPixels = curr.data;
  for (let i = 0; i < prevPixels.length; i += 4) {
    diff += Math.abs(prevPixels[i] - currPixels[i]);
    diff += Math.abs(prevPixels[i + 1] - currPixels[i + 1]);
    diff += Math.abs(prevPixels[i + 2] - currPixels[i + 2]);
  }
  return diff / (prevPixels.length / 4);
}

export async function analyzeScenes(videoUrl: string, duration: number): Promise<Scene[]> {
  const video = document.createElement('video');
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Video load timeout')), 15000);
    video.onloadedmetadata = () => { clearTimeout(t); resolve(); };
    video.onerror = () => { clearTimeout(t); reject(new Error('Failed to load video')); };
    video.load();
  });

  const scenes: Scene[] = [];
  const sampleCount = Math.min(20, Math.floor(duration));
  const step = duration / (sampleCount + 1);
  let prevFrame: ImageData | null = null;

  for (let i = 0; i < sampleCount; i++) {
    const t = (i + 1) * step;
    const frame = await sampleFrame(video, t);
    if (!frame) continue;

    const motion = detectMotion(prevFrame, frame);
    const brightness = computeBrightness(frame);
    const contrast = computeContrast(frame);

    let type: Scene['type'] = 'unknown';
    let score = 50;

    if (motion > 30 && brightness > 80 && brightness < 200) {
      type = 'talking_head';
      score = 70 + motion * 0.5;
    } else if (motion > 20 && brightness > 100) {
      type = 'broll';
      score = 60 + motion * 0.3;
    } else if (contrast > 40) {
      type = 'text_overlay';
      score = 80;
    } else if (motion < 5) {
      type = 'transition';
      score = 30;
    }

    scenes.push({
      start: t,
      end: Math.min(t + step, duration),
      score: Math.min(100, score),
      type,
    });

    prevFrame = frame;
  }

  video.remove();
  return scenes;
}

export async function analyzeHook(videoUrl: string): Promise<HookAnalysis> {
  const video = document.createElement('video');
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Video load timeout')), 15000);
    video.onloadedmetadata = () => { clearTimeout(t); resolve(); };
    video.onerror = () => { clearTimeout(t); reject(new Error('Failed to load video')); };
    video.load();
  });

  const hookEnd = Math.min(3, video.duration || 3);
  const samples = 5;
  const step = hookEnd / (samples + 1);
  let totalMotion = 0;
  let totalBrightness = 0;
  let totalContrast = 0;
  let faceDetected = false;
  let prevFrame: ImageData | null = null;

  for (let i = 0; i < samples; i++) {
    const t = (i + 1) * step;
    const frame = await sampleFrame(video, t);
    if (!frame) continue;

    totalMotion += detectMotion(prevFrame, frame);
    totalBrightness += computeBrightness(frame);
    totalContrast += computeContrast(frame);
    prevFrame = frame;

    if (totalMotion > 15 && totalBrightness > 100) {
      faceDetected = true;
    }
  }

  video.remove();

  const avgMotion = totalMotion / samples;
  const avgBrightness = totalBrightness / samples;
  const avgContrast = totalContrast / samples;

  let score = 50;
  if (avgMotion > 20) score += 20;
  if (faceDetected) score += 20;
  if (avgContrast > 30) score += 10;
  if (avgBrightness > 80 && avgBrightness < 200) score += 10;

  score = Math.min(100, Math.max(0, score));

  let recommendation = 'Hook could be stronger.';
  if (score >= 80) recommendation = 'Strong hook — keep it.';
  else if (score >= 60) recommendation = 'Decent hook — consider adding text overlay in first frame.';
  else if (faceDetected) recommendation = 'Face detected but motion is low — add a jump cut or zoom.';

  return {
    score,
    hasMotion: avgMotion > 15,
    hasFace: faceDetected,
    hasText: avgContrast > 40,
    brightness: avgBrightness,
    contrast: avgContrast,
    recommendation,
  };
}

export function predictRetention(scenes: Scene[], duration: number): RetentionPrediction[] {
  const predictions: RetentionPrediction[] = [];
  const segmentDuration = duration / 10;

  for (let i = 0; i < 10; i++) {
    const timestamp = i * segmentDuration;
    const segmentScenes = scenes.filter(s => s.start >= timestamp && s.start < timestamp + segmentDuration);
    const avgScore = segmentScenes.length > 0
      ? segmentScenes.reduce((sum, s) => sum + s.score, 0) / segmentScenes.length
      : 50;

    let predictedDropoff = 100 - avgScore;
    let reason = 'Low visual interest';
    let suggestion = 'Add zoom or text overlay';

    if (avgScore >= 70) {
      predictedDropoff = 10;
      reason = 'Strong engagement';
      suggestion = 'Keep as is';
    } else if (avgScore >= 50) {
      predictedDropoff = 25;
      reason = 'Moderate engagement';
      suggestion = 'Consider adding B-roll or transition';
    }

    if (i > 0 && i % 3 === 0) {
      predictedDropoff += 15;
      reason = 'Attention drop pattern detected';
      suggestion = 'Insert hook or question to regain attention';
    }

    predictions.push({
      timestamp,
      predictedDropoff: Math.min(100, predictedDropoff),
      reason,
      suggestion,
    });
  }

  return predictions;
}

export function suggestAutoZooms(scenes: Scene[]): AutoZoomSuggestion[] {
  const suggestions: AutoZoomSuggestion[] = [];

  scenes.forEach((scene, idx) => {
    if (scene.type === 'talking_head' && scene.score >= 70) {
      suggestions.push({
        timestamp: scene.start,
        duration: 1.5,
        scale: 1.3,
        reason: 'Talking head detected — subtle zoom keeps engagement',
      });
    } else if (scene.type === 'broll' && scene.score >= 60) {
      suggestions.push({
        timestamp: scene.start,
        duration: 2.0,
        scale: 1.5,
        reason: 'B-roll moment — slow zoom adds cinematic feel',
      });
    }
  });

  return suggestions.slice(0, 5);
}

export function matchBRoll(transcript: string, stockLibrary: { id: string; url: string; label: string; category: string }[]): BRollSuggestion[] {
  const suggestions: BRollSuggestion[] = [];
  const keywords = [
    { word: 'kitchen', category: 'food' },
    { word: 'cook', category: 'food' },
    { word: 'phone', category: 'tech' },
    { word: 'computer', category: 'tech' },
    { word: 'code', category: 'tech' },
    { word: 'gym', category: 'fitness' },
    { word: 'workout', category: 'fitness' },
    { word: 'nature', category: 'lifestyle' },
    { word: 'city', category: 'urban' },
    { word: 'money', category: 'business' },
    { word: 'business', category: 'business' },
    { word: 'people', category: 'social' },
    { word: 'laugh', category: 'social' },
  ];

  const lowerTranscript = transcript.toLowerCase();
  const words = lowerTranscript.split(/\s+/);
  const wordTimestamps: { word: string; index: number }[] = words.map((w, i) => ({ word: w, index: i }));

  keywords.forEach(({ word, category }) => {
    const matches = wordTimestamps.filter(w => w.word.includes(word));
    if (matches.length > 0) {
      const matchIndex = matches[0].index;
      const totalWords = words.length;
      const timestamp = (matchIndex / totalWords) * 60;

      const stock = stockLibrary.find(s => s.category === category);
      if (stock) {
        suggestions.push({
          timestamp,
          duration: 3,
          keyword: word,
          stockUrl: stock.url,
          confidence: matches.length / totalWords,
        });
      }
    }
  });

  return suggestions.slice(0, 5);
}
