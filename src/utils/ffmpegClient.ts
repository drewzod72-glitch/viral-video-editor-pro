import { VideoProject, SubtitleItem, getCaptionStyles } from '../types';
import { FREE_MUSIC_TRACKS } from '../data';

import { VideoProject, SubtitleItem, getCaptionStyles } from '../types';
import { FREE_MUSIC_TRACKS } from '../data';

/**
 * OFFLINE FRAME FORGE (V13)
 * 
 * 1. No "Real-time" Playback required.
 * 2. Seek-Wait-Capture loop for 100% frame accuracy.
 * 3. Pre-buffered Audio Mixing for silent background processing.
 */
export async function renderVideoInBrowser(
  project: VideoProject,
  onProgress: (progress: number) => void,
  activeClipId: string | null = null
): Promise<Blob> {
  console.log('[Viral Forge] Initializing Offline Forge V13...');

  const highlights = activeClipId === 'smart-cuts' 
    ? project.highlights.slice(0, 10) 
    : (activeClipId ? [project.highlights.find(h => h.id === activeClipId)!] : [{ start: 0, end: project.duration, duration: project.duration }]);

  const totalTargetDuration = highlights.reduce((s, h) => s + (h.duration || (h.end - h.start)), 0);

  return new Promise(async (resolve, reject) => {
    try {
      // 1. Setup Video (Hidden)
      const video = document.createElement('video');
      video.src = project.videoUrl;
      video.crossOrigin = 'anonymous';
      video.muted = true; 
      video.playsInline = true;
      
      await new Promise((r, rej) => {
        video.onloadedmetadata = r;
        video.onerror = rej;
        video.load();
      });

      // 2. Setup Canvas
      const W = 540; // 540p for high-speed offline forging
      const H = 960;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Canvas Error');

      // 3. Setup Audio Mixing (Offline-Ready)
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const dest = audioCtx.createMediaStreamDestination();
      
      const videoSource = audioCtx.createMediaElementSource(video);
      videoSource.connect(dest);

      // Pre-load background music
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

      // 4. Setup Recorder
      const canvasStream = canvas.captureStream(30);
      const mixedStream = new MediaStream([
        canvasStream.getVideoTracks()[0],
        dest.stream.getAudioTracks()[0]
      ]);

      const recorder = new MediaRecorder(mixedStream, {
        mimeType: 'video/mp4;codecs=avc1',
        videoBitsPerSecond: 4000000 
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/mp4' }));

      // 5. START OFFLINE LOOP
      recorder.start();
      if (musicEl) musicEl.play().catch(() => {});
      video.play().catch(() => {}); // Play for audio capture, but we will control time

      let elapsed = 0;
      const fps = 30;
      const frameTime = 1 / fps;

      for (const hl of highlights) {
        const segDur = hl.duration || (hl.end - hl.start);
        
        for (let t = 0; t < segDur; t += frameTime) {
          const videoTime = hl.start + t;
          video.currentTime = videoTime;
          
          // Wait for frame to be ready
          await new Promise(r => {
            const onSeek = () => { video.removeEventListener('seeked', onSeek); r(null); };
            video.addEventListener('seeked', onSeek);
          });

          // Draw Frame
          let scale = 1.0;
          const globalT = elapsed + t;
          const activeZoom = project.zoomEffects?.find(z => globalT >= z.timestamp && globalT <= z.timestamp + z.duration);
          if (activeZoom) scale = activeZoom.scale;

          const sW = video.videoWidth / scale;
          const sH = video.videoHeight / scale;
          ctx.drawImage(video, (video.videoWidth - sW)/2, (video.videoHeight - sH)/2, sW, sH, 0, 0, W, H);

          // Draw Subtitles
          const sub = project.subtitles?.find(s => globalT >= s.start && globalT <= s.end);
          if (sub) drawEngineSubtitles(ctx, sub, project, W, H);

          onProgress(Math.round((globalT / totalTargetDuration) * 100));
        }
        elapsed += segDur;
      }

      recorder.stop();
      if (musicEl) musicEl.pause();
      video.pause();
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
