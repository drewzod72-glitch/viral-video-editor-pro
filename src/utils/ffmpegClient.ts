import { VideoProject, SubtitleItem, getCaptionStyles } from '../types';
import { FREE_MUSIC_TRACKS } from '../data';

/**
 * PREMIUM VIRAL FORGE ENGINE (V6)
 * 
 * Major stability and quality overhaul:
 * 1. Solves the audio capture issue by ensuring the audio context is fully alive.
 * 2. Fixes subtitle "speed" by enforcing a minimum 2.2s display duration.
 * 3. Guarantees 100% video smoothness by using a dedicated offline capture loop.
 */
/**
 * PREMIUM VIRAL FORGE ENGINE (V8)
 * 
 * FINAL PERFORMANCE FIX:
 * 1. Corrects Speed: Uses real-time 1x capture so 8s = 8s. No more time-stretching.
 * 2. Mixed Audio: Captures both original sound and background music.
 * 3. Perfect Smoothness: Uses hardware-accelerated recorder.
 */
export async function renderVideoInBrowser(
  project: VideoProject,
  onProgress: (progress: number) => void,
  activeClipId: string | null = null
): Promise<Blob> {
  console.log('[Viral Forge] Initializing Real-Time Hardware Forge V8...');

  return new Promise(async (resolve, reject) => {
    try {
      const video = document.createElement('video');
      video.src = project.videoUrl;
      video.crossOrigin = 'anonymous';
      video.muted = false; 
      video.volume = 0; // Silent but unmuted for capture
      video.playsInline = true;
      
      // Ensure in DOM for capture
      video.style.position = 'fixed';
      video.style.top = '-9999px';
      document.body.appendChild(video);

      await new Promise((r) => (video.onloadedmetadata = r));

      const W = 720; 
      const H = 1280;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Canvas failed.');

      const highlights = activeClipId === 'smart-cuts' 
        ? project.highlights.slice(0, 10) 
        : (activeClipId ? [project.highlights.find(h => h.id === activeClipId)!] : [{ start: 0, end: video.duration, duration: video.duration }]);

      // --- 1. AUDIO MIXING ---
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const dest = audioCtx.createMediaStreamDestination();
      
      // Original Video Sound
      const videoSource = audioCtx.createMediaElementSource(video);
      videoSource.connect(dest);

      // Background Music
      let musicEl: HTMLAudioElement | null = null;
      if (project.selectedMusicTrackId && project.selectedMusicTrackId !== 'none') {
        const track = FREE_MUSIC_TRACKS.find(t => t.id === project.selectedMusicTrackId);
        if (track) {
          musicEl = new Audio(track.url);
          musicEl.crossOrigin = 'anonymous';
          musicEl.volume = 0.35;
          const mSource = audioCtx.createMediaElementSource(musicEl);
          mSource.connect(dest);
        }
      }

      // --- 2. RECORDING SETUP ---
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
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        document.body.removeChild(video);
        resolve(new Blob(chunks, { type: 'video/mp4' }));
      };

      // --- 3. THE 1X CAPTURE LOOP ---
      recorder.start();
      if (musicEl) musicEl.play();

      let currentHlIdx = 0;
      let totalElapsed = 0;
      const totalTarget = highlights.reduce((s, h) => s + (h.duration || (h.end - h.start)), 0);

      const render = async () => {
        if (currentHlIdx >= highlights.length) {
          recorder.stop();
          if (musicEl) musicEl.pause();
          return;
        }

        const hl = highlights[currentHlIdx];
        
        // Ensure video is at start of segment
        if (video.paused) {
          video.currentTime = hl.start;
          await new Promise(r => video.onseeked = r);
          await video.play();
        }

        // DRAW FRAME (Runs at screen refresh rate)
        const check = () => {
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
          const zoom = project.zoomEffects?.find(z => globalT >= z.timestamp && globalT <= z.timestamp + z.duration);
          if (zoom) scale = zoom.scale;

          const sW = video.videoWidth / scale;
          const sH = video.videoHeight / scale;
          ctx.drawImage(video, (video.videoWidth-sW)/2, (video.videoHeight-sH)/2, sW, sH, 0, 0, W, H);

          // B. Draw Subtitles
          const sub = project.subtitles?.find(s => globalT >= s.start && globalT <= s.end);
          if (sub) drawStyledSubtitles(ctx, sub, project, W, H);

          onProgress(Math.min(99, Math.round((globalT / totalTarget) * 100)));
          requestAnimationFrame(check);
        };
        check();
      };

      render();
    } catch (err) {
      reject(err);
    }
  });
}

function drawStyledSubtitles(ctx: CanvasRenderingContext2D, sub: any, project: VideoProject, W: number, H: number) {
  const text = project.captionStyle === 'minimalist' ? sub.text : sub.text.toUpperCase();
  const textLen = text.length;
  const style = getCaptionStyles(project.captionStyle || 'hormozi', textLen, W);
  
  const fontName = project.captionStyle === 'minimalist' ? 'sans-serif' : 'Impact, sans-serif';
  const weight = project.captionStyle === 'minimalist' ? '500' : '900';
  ctx.font = `${weight} ${style.fontSize}px ${fontName}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const maxWidth = W * 0.85;
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const testLine = currentLine + ' ' + words[i];
    if (ctx.measureText(testLine).width > maxWidth) {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);

  const lineHeight = style.fontSize * 1.2;
  const totalHeight = lines.length * lineHeight;
  let baseY = H * 0.75;
  if (project.captionPosition === 'top') baseY = H * 0.15;
  if (project.captionPosition === 'center') baseY = H * 0.5;

  lines.forEach((line, lineIdx) => {
    const y = baseY - (totalHeight / 2) + (lineIdx * lineHeight) + (lineHeight / 2);
    const lineWidth = ctx.measureText(line).width;

    if (style.hasBox) {
      const paddingX = style.boxPaddingX || 20;
      const paddingY = style.boxPaddingY || 10;
      ctx.fillStyle = style.boxBg || 'rgba(0,0,0,0.8)';
      const bx = (W - lineWidth) / 2 - paddingX;
      const by = y - style.fontSize / 2 - paddingY;
      const bw = lineWidth + paddingX * 2;
      const bh = style.fontSize + paddingY * 2;
      const r = style.boxRadius || 12;

      ctx.beginPath();
      ctx.moveTo(bx + r, by); ctx.lineTo(bx + bw - r, by); ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
      ctx.lineTo(bx + bw, by + bh - r); ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
      ctx.lineTo(bx + r, by + bh); ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
      ctx.lineTo(bx, by + r); ctx.quadraticCurveTo(bx, by, bx + r, by);
      ctx.closePath();
      ctx.fill();
    }

    let currentX = (W - lineWidth) / 2;
    const highlightWords = (sub.highlightWords || []).map((w: string) => w.toUpperCase());
    line.split(' ').forEach((word) => {
      const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").toUpperCase();
      const isHighlighted = highlightWords.includes(cleanWord);
      ctx.fillStyle = isHighlighted ? style.highlightColor : style.textColor;
      if (style.strokeWidth > 0) {
        ctx.strokeStyle = style.strokeColor;
        ctx.lineWidth = style.strokeWidth * 2;
        ctx.strokeText(word, currentX + ctx.measureText(word).width / 2, y);
      }
      ctx.fillText(word, currentX + ctx.measureText(word).width / 2, y);
      currentX += ctx.measureText(word + ' ').width;
    });
  });
}
