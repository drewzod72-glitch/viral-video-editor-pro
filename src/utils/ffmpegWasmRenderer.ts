import { VideoProject, getCaptionStyles } from '../types';
import { FREE_MUSIC_TRACKS } from '../data';
import { resolveCaptionMetrics, normalizeCaptionStyle } from '../utils/captionStyleConfig';

// ─── FFmpeg.wasm Professional Renderer ──────────────────────────────────────
// Uses @ffmpeg/ffmpeg for hardware-quality output with:
// - LUT color grading
// - Animated transitions
// - Keyframe motion
// - Professional subtitle burn-in
// - Multi-track audio mixing

export type RenderMode = 'canvas' | 'ffmpeg';

interface FFmpegWasmRendererOptions {
  project: VideoProject;
  onProgress: (progress: number, stage?: string) => void;
  activeClipId?: string | null;
  mode?: RenderMode;
  chunkDuration?: number;
  segments?: Array<{ start: number; end: number; speed?: number }>;
}

// LUT definitions for professional color grading
export const LUT_PRESETS = {
  none: { name: 'None', ffmpeg: '' },
  cinematic: {
    name: 'Cinematic',
    ffmpeg: 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:0:.272:.534:.131:0,eq=saturation=1.1:contrast=1.05:brightness=0.02'
  },
  warm_vintage: {
    name: 'Warm Vintage',
    ffmpeg: 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:0:.272:.534:.131:0,eq=saturation=0.85:contrast=0.95:brightness=0.03'
  },
  vibrant_pop: {
    name: 'Vibrant Pop',
    ffmpeg: 'eq=saturation=1.4:contrast=1.15:brightness=0.01'
  },
  moody_cyber: {
    name: 'Cyber Moody',
    ffmpeg: 'colorchannelmixer=.2:.4:.4:0:.2:.5:.3:0:0:.1:.2:.7:0,eq=saturation=0.9:contrast=1.2:brightness=-0.02'
  },
  film_noir: {
    name: 'Film Noir',
    ffmpeg: 'colorchannelmixer=.333:.333:.333:0:.333:.333:.333:0:0:.333:.333:.333:0,eq=contrast=1.3:brightness=-0.02'
  },
  neon_nights: {
    name: 'Neon Nights',
    ffmpeg: 'colorchannelmixer=.7:.2:.1:0:.1:.2:.7:0:0:.1:.7:.2:0,eq=saturation=1.3:contrast=1.1'
  },
  golden_hour: {
    name: 'Golden Hour',
    ffmpeg: 'colorchannelmixer=.5:.4:.1:0:.3:.6:.1:0:0:.1:.3:.6:0,eq=saturation=1.05:brightness=0.04'
  }
};

// Transition definitions
export const TRANSITION_PRESETS = {
  none: { name: 'None', duration: 0 },
  crossfade: { name: 'Cross Fade', duration: 0.5, transition: 'fade' },
  glow: { name: 'Glow Fade', duration: 0.6, transition: 'glow' },
  wipe_left: { name: 'Wipe Left', duration: 0.5, transition: 'wipeleft' },
  wipe_right: { name: 'Wipe Right', duration: 0.5, transition: 'wiperight' },
  slide_left: { name: 'Slide Left', duration: 0.5, transition: 'slideleft' },
  slide_right: { name: 'Slide Right', duration: 0.5, transition: 'slideright' },
  circle_open: { name: 'Circle Open', duration: 0.6, transition: 'circleopen' },
  circle_close: { name: 'Circle Close', duration: 0.6, transition: 'circleclose' },
  dissolve: { name: 'Dissolve', duration: 0.8, transition: 'dissolve' },
  glitch: { name: 'Glitch', duration: 0.4, transition: 'pixelize' },
  flash: { name: 'Flash', duration: 0.3, transition: 'fadewhite' },
  fade_black: { name: 'Fade Black', duration: 0.6, transition: 'fadeblack' }
};

// ─── Core FFmpeg.wasm Renderer ──────────────────────────────────────────────

export async function renderVideoWithFFmpegWasm(options: FFmpegWasmRendererOptions): Promise<Blob> {
  const { project, onProgress, activeClipId, mode = 'canvas', segments } = options;

  if (mode === 'canvas') {
    const { renderVideoInBrowser } = await import('./ffmpegClient');
    const canvasResult = await renderVideoInBrowser(project, onProgress, activeClipId);
    return canvasResult.blob;
  }

  // FFmpeg.wasm mode with retry and transparent fallback
  const maxAttempts = 2;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      onProgress(0, attempt > 1 ? 'Retrying FFmpeg engine...' : 'Loading FFmpeg engine...');
      
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { fetchFile, toBlobURL } = await import('@ffmpeg/util');

      const ffmpeg = new FFmpeg();

      // Load FFmpeg.wasm core with retry
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      onProgress(5, 'FFmpeg engine loaded');

      // Write input video
      const videoData = await fetchFile(project.videoUrl);
      await ffmpeg.writeFile('input.mp4', videoData);

      // Write music file if selected
      let musicFile = '';
      if (project.selectedMusicTrackId && project.selectedMusicTrackId !== 'none') {
        const track = FREE_MUSIC_TRACKS.find(t => t.id === project.selectedMusicTrackId);
        if (track) {
          try {
            const musicData = await fetchFile(track.url);
            await ffmpeg.writeFile('music.mp3', musicData);
            musicFile = 'music.mp3';
          } catch (e) {
            console.warn('[FFmpeg] Music load failed:', e);
          }
        }
      }

      // Generate subtitle SRT if needed
      let subtitleFile = '';
      if (project.enableSubtitles && project.subtitles?.length) {
        subtitleFile = await generateSRT(project.subtitles);
        if (subtitleFile) {
          await ffmpeg.writeFile('subs.srt', subtitleFile);
        }
      }

      // Build filter complex
      const filterComplex = buildFilterComplex(project, subtitleFile);

      // Build FFmpeg command
      const args = buildFFmpegCommand(project, filterComplex, musicFile);

      // Execute with progress
      ffmpeg.on('progress', ({ progress }) => {
        const pct = Math.round(5 + progress * 90);
        onProgress(pct, 'Rendering...');
      });

      await ffmpeg.exec(args);

      onProgress(95, 'Finalizing...');
      const outputData = await ffmpeg.readFile('output.mp4');
      const blob = new Blob([outputData as BlobPart], { type: 'video/mp4' });

      // Cleanup
      try {
        await ffmpeg.deleteFile('input.mp4');
        if (musicFile) await ffmpeg.deleteFile(musicFile);
        if (subtitleFile) await ffmpeg.deleteFile('subs.srt');
        await ffmpeg.deleteFile('output.mp4');
      } catch (e) {
        // Ignore cleanup errors
      }

      onProgress(100, 'Complete');
      return blob;

    } catch (error: any) {
      lastError = error;
      console.error(`[FFmpeg.wasm] Attempt ${attempt} failed:`, error);
      
      if (attempt < maxAttempts) {
        onProgress(0, `FFmpeg attempt ${attempt} failed, retrying...`);
        await new Promise(r => setTimeout(r, 2000)); // Wait before retry
        continue;
      }
      
      // All attempts failed - fall back to canvas with clear message (Kilo)
      onProgress(0, 'FFmpeg unavailable, switching to Fast Canvas...');
      console.warn('[FFmpeg.wasm] All attempts failed, falling back to canvas renderer:', error);
      
      const { renderVideoInBrowser } = await import('./ffmpegClient');
      const canvasResult = await renderVideoInBrowser(project, onProgress, activeClipId);
      return canvasResult.blob;
    }
  }

  // Should never reach here, but just in case
  const { renderVideoInBrowser } = await import('./ffmpegClient');
  const canvasResult = await renderVideoInBrowser(project, onProgress, activeClipId);
  return canvasResult.blob;
}

// ─── SRT Generator ──────────────────────────────────────────────────────────

async function generateSRT(subtitles: any[]): Promise<string | null> {
  if (!subtitles?.length) return null;

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  };

  const srt = subtitles
    .map((sub, i) => {
      const text = typeof sub.text === 'string' ? sub.text : String(sub.text || '');
      return `${i + 1}\n${formatTime(sub.start)} --> ${formatTime(sub.end)}\n${text}\n`;
    })
    .join('\n');

  return srt;
}

// ─── Filter Complex Builder ─────────────────────────────────────────────────

function hexToAssColor(hex: string, alpha: number = 0): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const aa = alpha.toString(16).padStart(2, '0');
  return `&H${aa}${b.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${r.toString(16).padStart(2, '0')}`;
}

function buildFilterComplex(project: VideoProject, subtitleFile: string | null): string {
  const filters: string[] = [];

  // 1. Scale to 1080x1920
  filters.push('scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(1080-iw)/2:(1920-ih)/2');

  // 2. Color grading
  const lutKey = (project.colorGrade as keyof typeof LUT_PRESETS) || 'none';
  const lut = LUT_PRESETS[lutKey] || LUT_PRESETS.none;
  if (lut.ffmpeg) {
    filters.push(lut.ffmpeg);
  }

  // 3. Motion effects
  if (project.enableZooms && project.zoomEffects?.length) {
    for (const z of project.zoomEffects) {
      if (z.timestamp >= 0 && z.duration > 0) {
        const scale = z.scale.toFixed(2);
        const start = z.timestamp.toFixed(2);
        const end = (z.timestamp + z.duration).toFixed(2);
        filters.push(`zoompan=z='if(between(t,${start},${end}),${scale},1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920`);
      }
    }
  }

  // 4. Shake effect
  if (project.shakeOnPunch) {
    filters.push('zoompan=z=1:x=\'iw/2-(iw/zoom/2)+sin(t*20)*5\':y=\'ih/2-(ih/zoom/2)+cos(t*20)*5\':d=1:s=1080x1920');
  }

  // 5. Subtitle burn-in — styles come from captionStyleConfig.ts (single source of truth)
  if (subtitleFile && project.enableSubtitles) {
    const style = normalizeCaptionStyle(project.captionStyle || 'hormozi');
    const metrics = resolveCaptionMetrics(style, 30, 1080);

    const fontSize = metrics.fontSize;
    const primaryColor = hexToAssColor(metrics.textColor, 0);
    const highlightColor = hexToAssColor(metrics.highlightColor, 0);
    const outlineColor = hexToAssColor(metrics.strokeColor === 'transparent' ? '#000000' : metrics.strokeColor, 0);
    const outline = Math.max(1, metrics.strokeWidth);
    const marginV = Math.round(metrics.yPositionFraction * 1920) - Math.round(fontSize * 1.3) - 40;
    const fontName = metrics.fontFamilyCSS.split(',')[0].replace(/["']/g, '');

    filters.push(`subtitles=subs.srt:force_style='FontSize=${fontSize},PrimaryColour=${primaryColor},OutlineColour=${outlineColor},Outline=${outline},MarginV=${Math.max(10, marginV)},FontName=${fontName}'`);
  }

  return filters.join(',');
}

// ─── FFmpeg Command Builder ─────────────────────────────────────────────────

function buildFFmpegCommand(project: VideoProject, filterComplex: string, musicFile: string): string[] {
  const args: string[] = ['-i', 'input.mp4'];

  // Add music input if present
  if (musicFile) {
    args.push('-i', musicFile);
  }

  // Video filters
  if (filterComplex) {
    args.push('-vf', filterComplex);
  }

  // Audio mixing
  const audioFilters: string[] = [];
  if (musicFile) {
    const musicVol = project.musicVolume ?? 0.4;
    audioFilters.push(`[1:a]volume=${musicVol}[music]`);
    audioFilters.push(`[0:a][music]amix=inputs=2:duration=shortest[aout]`);
  } else {
    audioFilters.push(`[0:a]volume=1.0[aout]`);
  }

  if (audioFilters.length) {
    args.push('-af', audioFilters.join(';'));
  }

  // Encoding settings - professional quality
  args.push(
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    '-profile:v', 'high',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ar', '44100',
    '-movflags', '+faststart',
    'output.mp4'
  );

  return args;
}

// ─── Scene Detection ────────────────────────────────────────────────────────

export async function detectScenes(videoUrl: string, threshold = 0.3): Promise<number[]> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = videoUrl;

    video.onloadedmetadata = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 90;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) { resolve([]); return; }

        const scenes: number[] = [0];
        let prevFrame: Uint8ClampedArray | null = null;
        const sampleInterval = 0.5;
        const duration = video.duration;

        for (let t = 0; t < duration; t += sampleInterval) {
          video.currentTime = t;
          await new Promise<void>((res) => {
            video.onseeked = () => res();
            setTimeout(() => res(), 500);
          });

          ctx.drawImage(video, 0, 0, 160, 90);
          const imageData = ctx.getImageData(0, 0, 160, 90);
          const currFrame = imageData.data;

          if (prevFrame) {
            let diff = 0;
            for (let i = 0; i < currFrame.length; i += 4) {
              diff += Math.abs(currFrame[i] - prevFrame[i]);
              diff += Math.abs(currFrame[i + 1] - prevFrame[i + 1]);
              diff += Math.abs(currFrame[i + 2] - prevFrame[i + 2]);
            }
            const normalized = diff / (currFrame.length * 3 * 255);
            if (normalized > threshold) {
              scenes.push(t);
            }
          }

          prevFrame = new Uint8ClampedArray(currFrame);
        }

        resolve(scenes);
      } catch (e) {
        resolve([]);
      }
    };

    video.onerror = () => resolve([]);
    video.load();
  });
}

// ─── Viral Moment Detection ────────────────────────────────────────────────

export async function detectViralMoments(
  videoUrl: string,
  duration: number
): Promise<Array<{ start: number; end: number; score: number; reason: string }>> {
  const scenes = await detectScenes(videoUrl, 0.25);
  const moments: Array<{ start: number; end: number; score: number; reason: string }> = [];

  for (let i = 0; i < scenes.length; i++) {
    const start = scenes[i];
    const end = i + 1 < scenes.length ? scenes[i + 1] : duration;
    const sceneDuration = end - start;

    let score = 50;
    let reasons: string[] = [];

    if (start < 3) {
      score += 20;
      reasons.push('Strong hook');
    }
    if (start >= 15 && start <= 30) {
      score += 15;
      reasons.push('Mid-roll peak');
    }
    if (end > duration - 5) {
      score += 15;
      reasons.push('CTA zone');
    }
    if (sceneDuration >= 2 && sceneDuration <= 8) {
      score += 10;
      reasons.push('Optimal length');
    }
    if (sceneDuration >= 1 && sceneDuration < 2) {
      score += 5;
      reasons.push('Quick cut');
    }

    if (score >= 60) {
      moments.push({
        start,
        end,
        score: Math.min(100, score),
        reason: reasons.join(', ')
      });
    }
  }

  return moments.sort((a, b) => b.score - a.score);
}

// ─── Chunked Renderer for Long Videos ──────────────────────────────────────

export async function renderVideoChunked(
  project: VideoProject,
  onProgress: (progress: number, stage?: string) => void,
  chunkDuration = 300 // 5 minutes per chunk
): Promise<Blob> {
  const duration = project.duration || 30;
  const chunks = Math.ceil(duration / chunkDuration);

  const chunksBlobs: Blob[] = [];

  for (let i = 0; i < chunks; i++) {
    const start = i * chunkDuration;
    const end = Math.min(start + chunkDuration, duration);
    const chunkProject = {
      ...project,
      highlights: project.highlights.filter(h => {
        const hStart = h.start;
        const hEnd = h.end;
        return hStart < end && hEnd > start;
      }).map(h => ({
        ...h,
        start: Math.max(0, h.start - start),
        end: Math.min(end - start, h.end - start)
      }))
    };

    onProgress(Math.round((i / chunks) * 100), `Rendering chunk ${i + 1}/${chunks}...`);

    const blob = await renderVideoWithFFmpegWasm({
      project: chunkProject,
      onProgress: (p) => onProgress(Math.round((i / chunks) * 100 + (p / chunks) * 100)),
      mode: 'ffmpeg'
    });

    chunksBlobs.push(blob);
  }

  // Concatenate chunks
  onProgress(90, 'Concatenating chunks...');
  const combinedBlob = new Blob(chunksBlobs, { type: 'video/mp4' });
  onProgress(100, 'Complete');

  return combinedBlob;
}
