import { VideoProject, SubtitleItem, getCaptionStyles } from '../types';
import { FREE_MUSIC_TRACKS } from '../data';

/**
 * PRODUCTION-GRADE VIRAL FORGE ENGINE (V12)
 * 
 * THE DEFINITIVE BUILD:
 * 1. Solves the "Initializing" hang by checking readyState properly.
 * 2. Guaranteed Audio: Uses a persistent AudioContext and Gain Bridge.
 * 3. Perfect Text: Implements multi-line centering and Hormozi palette.
 * 4. Maximum Smoothness: Uses hardware-accelerated 30FPS real-time capture.
 */
export async function renderVideoInBrowser(
  project: VideoProject,
  onProgress: (progress: number) => void,
  activeClipId: string | null = null
): Promise<Blob> {
  console.log('[Viral Forge] Initializing Production Master V12...');

  // 1. REUSE GLOBAL AUDIO CONTEXT (Vital for iOS)
  const AudioCtxClass = (window as any).AudioContext || (window as any).webkitAudioContext;
  const audioCtx = (window as any)._viralAudioCtx || new AudioCtxClass();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  (window as any)._viralAudioCtx = audioCtx;

  return new Promise(async (resolve, reject) => {
    try {
      // 2. Setup Video Element
      const video = document.createElement('video');
      video.src = project.videoUrl;
      video.crossOrigin = 'anonymous';
      video.muted = false; 
      video.volume = 0; // Capture requires it to be technically unmuted
      video.playsInline = true;
      
      // Safety: Add to DOM
      video.style.position = 'fixed';
      video.style.top = '-9999px';
      document.body.appendChild(video);

      // --- FIX: INITIALIZING HANG ---
      if (video.readyState < 1) {
        await new Promise((r, rej) => {
          const timeout = setTimeout(() => rej(new Error('Video Load Timeout')), 10000);
          video.onloadedmetadata = () => { clearTimeout(timeout); r(null); };
          video.onerror = (e) => { clearTimeout(timeout); rej(e); };
          video.load();
        });
      }

      // 3. Setup Canvas (720p Mobile-Sharp)
      const W = 720; 
      const H = 1280;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Canvas Context Error');

      const highlights = activeClipId === 'smart-cuts' 
        ? project.highlights.slice(0, 10) 
        : (activeClipId ? [project.highlights.find(h => h.id === activeClipId)!] : [{ start: 0, end: video.duration, duration: video.duration }]);

      // 4. SETUP AUDIO MIXING
      const dest = audioCtx.createMediaStreamDestination();
      
      // Video Source
      const videoSource = audioCtx.createMediaElementSource(video);
      const vGain = audioCtx.createGain();
      vGain.gain.value = 1.0;
      videoSource.connect(vGain);
      vGain.connect(dest);

      // Background Music
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

      // 5. RECORDER SETUP
      const canvasStream = canvas.captureStream(30);
      const mixedStream = new MediaStream([
        canvasStream.getVideoTracks()[0],
        dest.stream.getAudioTracks()[0]
      ]);

      const recorder = new MediaRecorder(mixedStream, {
        mimeType: 'video/mp4;codecs=avc1',
        videoBitsPerSecond: 6000000 
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        document.body.removeChild(video);
        resolve(new Blob(chunks, { type: 'video/mp4' }));
      };
      recorder.onerror = reject;

      // 6. THE PRODUCTION RENDER LOOP
      recorder.start();
      if (musicEl) await musicEl.play().catch(() => {});

      let currentHlIdx = 0;
      let totalElapsed = 0;
      const totalTarget = highlights.reduce((s, h) => s + (h.duration || (h.end - h.start)), 0);

      const render = async () => {
        if (currentHlIdx >= highlights.length) {
          setTimeout(() => recorder.stop(), 500); // Small tail for audio
          if (musicEl) musicEl.pause();
          return;
        }

        const hl = highlights[currentHlIdx];
        video.currentTime = hl.start;
        await new Promise(r => video.onseeked = r);
        await video.play().catch(() => {});

        const frame = () => {
          if (video.currentTime >= hl.end || video.paused) {
            video.pause();
            totalElapsed += (hl.end - hl.start);
            currentHlIdx++;
            render();
            return;
          }

          // A. Draw Image
          let scale = 1.0;
          const globalT = totalElapsed + (video.currentTime - hl.start);
          const activeZoom = project.zoomEffects?.find(z => globalT >= z.timestamp && globalT <= z.timestamp + z.duration);
          if (activeZoom) scale = activeZoom.scale;

          const sW = video.videoWidth / scale;
          const sH = video.videoHeight / scale;
          const sX = (video.videoWidth - sW) / 2;
          const sY = (video.videoHeight - sH) / 2;
          
          ctx.save();
          ctx.drawImage(video, sX, sY, sW, sH, 0, 0, W, H);
          ctx.restore();

          // B. Draw Subtitles
          const sub = project.subtitles?.find(s => globalT >= s.start && globalT <= s.end);
          if (sub) {
            ctx.save();
            drawEngineSubtitles(ctx, sub, project, W, H);
            ctx.restore();
          }

          onProgress(Math.min(99, Math.round((globalT / totalTarget) * 100)));
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      };

      render();
    } catch (err) {
      reject(err);
    }
  });
}

function drawEngineSubtitles(ctx: CanvasRenderingContext2D, sub: SubtitleItem, project: VideoProject, W: number, H: number) {
  const style = getCaptionStyles(project.captionStyle || 'hormozi', sub.text.length, W);
  ctx.font = `900 ${style.fontSize}px Arial Black, system-ui, sans-serif`;
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
    
    // Rounded Box
    if (style.hasBox) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      const p = 15;
      const r = 10;
      const bx = (W - lineW) / 2 - p;
      const by = y - style.fontSize / 2 - p / 2;
      const bw = lineW + p * 2;
      const bh = style.fontSize + p;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, r);
      else ctx.rect(bx, by, bw, bh);
      ctx.fill();
    }

    // Text with viral highlights
    let curX = (W - lineW) / 2;
    const hWords = (sub.highlightWords || []).map(w => w.toUpperCase());
    
    line.split(' ').forEach((word) => {
      const isH = hWords.some(h => word.includes(h));
      ctx.fillStyle = isH ? '#FBFF00' : '#FFFFFF'; // Viral Yellow or White
      
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
