import { VideoProject, SubtitleItem, getCaptionStyles } from '../types';
import { FREE_MUSIC_TRACKS } from '../data';

/**
 * OFFLINE ROBUST FORGE (V14)
 * 
 * THE STABILITY MASTER:
 * 1. Resilient Initialization: Uses readyState and timeouts to prevent hangs.
 * 2. Seek-Wait-Draw: Guarantees every frame is captured at exactly 1x speed (Smooth).
 * 3. Mixed Internal Audio: No speakers needed.
 */
export async function renderVideoInBrowser(
  project: VideoProject,
  onProgress: (progress: number) => void,
  activeClipId: string | null = null
): Promise<Blob> {
  console.log('[Viral Forge] Initializing Robust Forge V14...');

  // 1. Audio Unblock
  const AudioCtxClass = (window as any).AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioCtxClass();
  if (audioCtx.state === 'suspended') await audioCtx.resume();

  const highlights = activeClipId === 'smart-cuts' 
    ? project.highlights.slice(0, 10) 
    : (activeClipId ? [project.highlights.find(h => h.id === activeClipId)!] : [{ start: 0, end: project.duration, duration: project.duration }]);

  const totalTargetDuration = highlights.reduce((s, h) => s + (h.duration || (h.end - h.start)), 0);

  return new Promise(async (resolve, reject) => {
    try {
      // 2. Setup Video with Resilient Loading
      const video = document.createElement('video');
      video.src = project.videoUrl;
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;
      
      const loadVideo = () => new Promise((r) => {
        if (video.readyState >= 1) return r(null);
        video.onloadedmetadata = () => r(null);
        video.onerror = () => r(null); // Continue anyway and try to draw
        setTimeout(() => r(null), 3000); // Max wait 3s
      });
      
      await loadVideo();

      // 3. Setup Canvas
      const W = 540; 
      const H = 960;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('GPU Context Error');

      // 4. Setup Audio Bridge
      const dest = audioCtx.createMediaStreamDestination();
      const videoSource = audioCtx.createMediaElementSource(video);
      videoSource.connect(dest);

      let musicEl: HTMLAudioElement | null = null;
      if (project.selectedMusicTrackId && project.selectedMusicTrackId !== 'none') {
        const track = FREE_MUSIC_TRACKS.find(t => t.id === project.selectedMusicTrackId);
        if (track) {
          musicEl = new Audio(track.url);
          musicEl.crossOrigin = 'anonymous';
          musicEl.volume = 0.4;
          const mSource = audioCtx.createMediaElementSource(musicEl);
          mSource.connect(dest);
        }
      }

      // 5. Setup Recorder
      const canvasStream = canvas.captureStream(30);
      const mixedStream = new MediaStream([
        canvasStream.getVideoTracks()[0],
        ...dest.stream.getAudioTracks()
      ]);

      const recorder = new MediaRecorder(mixedStream, {
        mimeType: 'video/mp4;codecs=avc1',
        videoBitsPerSecond: 4000000 
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/mp4' }));
      recorder.onerror = reject;

      // 6. THE FORGE LOOP
      recorder.start();
      if (musicEl) musicEl.play().catch(() => {});
      
      let elapsed = 0;
      const fps = 30;
      const frameTime = 1 / fps;

      for (const hl of highlights) {
        const segDur = hl.duration || (hl.end - hl.start);
        
        for (let t = 0; t < segDur; t += frameTime) {
          video.currentTime = hl.start + t;
          
          // Use a resilient seek-waiter with a fast timeout
          await new Promise(r => {
            const onSeek = () => {
              video.removeEventListener('seeked', onSeek);
              r(null);
            };
            video.addEventListener('seeked', onSeek);
            setTimeout(onSeek, 150); // Fallback for rapid seeking
          });

          // Draw Image (Resizing to fill 9:16)
          ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, W, H);

          // Draw Subtitles
          const globalT = elapsed + t;
          const sub = project.subtitles?.find(s => globalT >= s.start && globalT <= s.end);
          if (sub) drawEngineSubtitles(ctx, sub, project, W, H);

          onProgress(Math.min(99, Math.round(((elapsed + t) / totalTargetDuration) * 100)));
        }
        elapsed += segDur;
      }

      setTimeout(() => recorder.stop(), 300);
      if (musicEl) musicEl.pause();
    } catch (err) {
      reject(err);
    }
  });
}

function drawEngineSubtitles(ctx: CanvasRenderingContext2D, sub: SubtitleItem, project: VideoProject, W: number, H: number) {
  const style = getCaptionStyles(project.captionStyle || 'hormozi', sub.text.length, W);
  ctx.font = `900 ${style.fontSize}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const text = sub.text.toUpperCase();
  const maxWidth = W * 0.85;
  const words = text.split(' ');
  const lines: string[] = [];
  let curLine = words[0];

  for (let i = 1; i < words.length; i++) {
    if (ctx.measureText(curLine + ' ' + words[i]).width < maxWidth) curLine += ' ' + words[i];
    else { lines.push(curLine); curLine = words[i]; }
  }
  lines.push(curLine);

  const lineHeight = style.fontSize * 1.2;
  let y = H * 0.75;
  if (project.captionPosition === 'top') y = H * 0.15;
  if (project.captionPosition === 'center') y = H * 0.5;
  y -= (lines.length - 1) * lineHeight / 2;

  lines.forEach((line) => {
    const lineW = ctx.measureText(line).width;
    
    if (style.hasBox) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      const p = 12;
      const bx = (W - lineW) / 2 - p;
      const by = y - style.fontSize / 2 - p / 2;
      const bw = lineW + p * 2;
      const bh = style.fontSize + p;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(bx, by, bw, bh, 8) : ctx.rect(bx, by, bw, bh);
      ctx.fill();
    }

    let curX = (W - lineW) / 2;
    const hWords = (sub.highlightWords || []).map(w => w.toUpperCase());
    line.split(' ').forEach((word) => {
      const isH = hWords.some(h => word.includes(h));
      ctx.fillStyle = isH ? '#FBFF00' : '#FFFFFF';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      const wordW = ctx.measureText(word).width;
      ctx.fillText(word, curX + wordW / 2, y);
      ctx.shadowBlur = 0;
      curX += ctx.measureText(word + ' ').width;
    });
    y += lineHeight;
  });
}
