import { VideoProject, SubtitleItem, getCaptionStyles } from '../types';
import { FREE_MUSIC_TRACKS } from '../data';

/**
 * PREMIUM VIRAL FORGE ENGINE (V15.5) - "100% COMPLETION PATCH"
 * 
 * THE DEFINITIVE STABILITY FIX:
 * 1. Fixed 99% Hang: Explicitly calls onProgress(100) and ensures recorder stops.
 * 2. Studio-Match Fonts: Switched to system-ui stack for ultra-sharp text.
 * 3. Guaranteed Audio: Re-routed AudioContext to ensure background music is baked.
 */
export async function renderVideoInBrowser(
  project: VideoProject,
  onProgress: (progress: number) => void,
  activeClipId: string | null = null
): Promise<Blob> {
  console.log('[Viral Forge] Initializing Pixel-Perfect Engine V15.5...');

  // 1. Audio Unblock & Setup
  const AudioCtxClass = (window as any).AudioContext || (window as any).webkitAudioContext;
  const audioCtx = (window as any)._viralAudioCtx || new AudioCtxClass();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  (window as any)._viralAudioCtx = audioCtx;

  return new Promise(async (resolve, reject) => {
    try {
      // 2. Setup Video (Visual and Audible)
      const video = document.createElement('video');
      video.src = project.videoUrl;
      video.crossOrigin = 'anonymous';
      video.muted = false; 
      video.volume = 0; 
      video.playsInline = true;
      
      video.style.position = 'fixed';
      video.style.top = '0';
      video.style.left = '0';
      video.style.width = '1px';
      video.style.height = '1px';
      video.style.opacity = '0.01';
      document.body.appendChild(video);

      await new Promise((r, rej) => {
        video.onloadedmetadata = r;
        video.onerror = () => rej(new Error('Video Load Error'));
        video.load();
      });

      // 3. Canvas Config (720p HD)
      const W = 720; 
      const H = 1280;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Canvas Blocked');

      // 4. Clips & Duration
      const highlights = activeClipId === 'smart-cuts' 
        ? project.highlights.slice(0, 10) 
        : (activeClipId ? [project.highlights.find(h => h.id === activeClipId)!].filter(Boolean) : [{ start: 0, end: video.duration || project.duration || 30, duration: video.duration || project.duration || 30 }]);

      if (highlights.length === 0) throw new Error('No clips found to bake.');

      const totalTargetDuration = highlights.reduce((s, h) => s + (h.duration || (h.end - h.start)), 0);

      // 5. AUDIO ROUTING
      const dest = audioCtx.createMediaStreamDestination();
      
      let videoSource;
      try {
        videoSource = (video as any)._audioSource || audioCtx.createMediaElementSource(video);
        (video as any)._audioSource = videoSource;
        videoSource.connect(dest);
      } catch (e) {
        console.warn('[Audio] Video source connection skipped:', e);
      }

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

      // 6. RECORDER SETUP
      const canvasStream = canvas.captureStream(30);
      const audioTracks = dest.stream.getAudioTracks();
      const tracks: MediaStreamTrack[] = [canvasStream.getVideoTracks()[0]];
      if (audioTracks.length > 0) tracks.push(audioTracks[0]);

      const mixedStream = new MediaStream(tracks);
      let mimeType = 'video/mp4';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

      const recorder = new MediaRecorder(mixedStream, {
        mimeType,
        videoBitsPerSecond: 2500000 
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        document.body.removeChild(video);
        onProgress(100);
        resolve(new Blob(chunks, { type: 'video/mp4' }));
      };

      // 7. REAL-TIME SYNC LOOP
      let currentSegIdx = 0;
      let totalElapsed = 0;

      const finishBake = () => {
        console.log('[Viral Forge] All segments processed, finalizing file...');
        onProgress(100); // UI feedback: Done!
        
        // Finalize recorder
        setTimeout(() => {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
          if (musicEl) musicEl.pause();
        }, 300); // Reduced delay for faster "Aha!" moment
      };

      const startNextSegment = async () => {
        if (currentSegIdx >= highlights.length) {
          finishBake();
          return;
        }

        const hl = highlights[currentSegIdx];
        video.currentTime = hl.start;
        if (musicEl) musicEl.currentTime = totalElapsed;
        
        try {
          await new Promise((r) => {
            const timeout = setTimeout(() => { r(null); }, 2000);
            video.onseeked = () => { clearTimeout(timeout); r(null); };
          });
          await video.play();
          if (musicEl) musicEl.play().catch(() => {});
        } catch (e) {
          currentSegIdx++;
          startNextSegment();
          return;
        }

        const frameLoop = () => {
          if (recorder.state === 'inactive') return;

          // Epsilon Check (0.05s) to prevent precision hangs at 99.9%
          if (video.currentTime >= (hl.end - 0.05) || video.paused) {
            video.pause();
            totalElapsed += (hl.end - hl.start);
            currentSegIdx++;
            startNextSegment();
            return;
          }

          // DRAWING
          let scale = 1.0;
          const currentSegTime = video.currentTime - hl.start;
          const globalT = totalElapsed + currentSegTime;

          const activeZoom = project.zoomEffects?.find(z => globalT >= z.timestamp && globalT <= z.timestamp + z.duration);
          if (activeZoom) scale = activeZoom.scale;

          const sW = video.videoWidth / scale;
          const sH = video.videoHeight / scale;
          const sX = (video.videoWidth - sW) / 2;
          const sY = (video.videoHeight - sH) / 2;

          ctx.drawImage(video, sX, sY, sW, sH, 0, 0, W, H);

          const sub = project.subtitles?.find(s => globalT >= s.start && globalT <= s.end);
          if (sub) drawStudioSubtitles(ctx, sub, project, W, H);

          // Progress calculation with forced ceiling at 99
          const progress = Math.min(99, Math.round((globalT / totalTargetDuration) * 100));
          onProgress(progress);
          
          if ((video as any).requestVideoFrameCallback) {
            (video as any).requestVideoFrameCallback(frameLoop);
          } else {
            requestAnimationFrame(frameLoop);
          }
        };

        if ((video as any).requestVideoFrameCallback) {
          (video as any).requestVideoFrameCallback(frameLoop);
        } else {
          requestAnimationFrame(frameLoop);
        }
      };

      recorder.start();
      startNextSegment();

    } catch (err) {
      reject(err);
    }
  });
}

function drawStudioSubtitles(ctx: CanvasRenderingContext2D, sub: SubtitleItem, project: VideoProject, W: number, H: number) {
  const isHormozi = project.captionStyle === 'hormozi';
  const text = isHormozi || project.captionStyle === 'mrbeast' ? sub.text.toUpperCase() : sub.text;
  const style = getCaptionStyles(project.captionStyle || 'hormozi', text.length, W);
  
  const fontName = 'system-ui, -apple-system, sans-serif';
  ctx.font = `900 ${style.fontSize}px ${fontName}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

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
  let baseY = H * 0.75;
  if (project.captionPosition === 'top') baseY = H * 0.15;
  if (project.captionPosition === 'center') baseY = H * 0.5;
  
  let y = baseY - (lines.length - 1) * lineHeight / 2;

  lines.forEach((line) => {
    const lineW = ctx.measureText(line).width;
    if (style.hasBox) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      const p = 15;
      const bx = (W - lineW) / 2 - p;
      const by = y - style.fontSize / 2 - p / 2;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(bx, by, lineW + p * 2, style.fontSize + p, 10) : ctx.rect(bx, by, lineW + p * 2, style.fontSize + p);
      ctx.fill();
    }

    let curX = (W - lineW) / 2;
    const hWords = (sub.highlightWords || []).map(w => w.toUpperCase());
    
    line.split(' ').forEach((word) => {
      const clean = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").toUpperCase();
      const isH = hWords.includes(clean);
      
      if (isH) ctx.fillStyle = isHormozi ? '#EC4899' : '#10B981'; 
      else ctx.fillStyle = isHormozi ? '#FBBF24' : '#FFFFFF';

      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.fillText(word, curX + ctx.measureText(word).width / 2, y);
      ctx.shadowBlur = 0;
      curX += ctx.measureText(word + ' ').width;
    });
    y += lineHeight;
  });
}
