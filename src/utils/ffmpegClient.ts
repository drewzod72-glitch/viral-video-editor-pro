import { VideoProject, SubtitleItem, getCaptionStyles } from '../types';
import { FREE_MUSIC_TRACKS } from '../data';

/**
 * PREMIUM VIRAL FORGE ENGINE (V4)
 * 
 * Engineered for maximum smoothness, high-fidelity audio mixing, 
 * and perfect multi-line subtitle wrapping.
 */
export async function renderVideoInBrowser(
  project: VideoProject,
  onProgress: (progress: number) => void,
  activeClipId: string | null = null
): Promise<Blob> {
  console.log('[Viral Forge] Initializing Premium Stability Engine V4...');

  return new Promise(async (resolve, reject) => {
    try {
      const video = document.createElement('video');
      video.src = project.videoUrl;
      video.crossOrigin = 'anonymous';
      video.muted = false; 
      video.volume = 0;
      video.playsInline = true;
      
      await new Promise((r) => (video.onloadedmetadata = r));

      const W = 720; 
      const H = 1280;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Hardware context failed.');

      const highlights = activeClipId === 'smart-cuts' 
        ? project.highlights.slice(0, 10) 
        : (activeClipId ? [project.highlights.find(h => h.id === activeClipId)!] : [{ start: 0, end: video.duration, duration: video.duration }]);

      // 1. SETUP AUDIO MIXING (High-Precision)
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      await audioCtx.resume(); // Ensure context is active
      const dest = audioCtx.createMediaStreamDestination();
      const videoSource = audioCtx.createMediaElementSource(video);
      
      const videoGain = audioCtx.createGain();
      videoGain.gain.value = 1.0; 
      videoSource.connect(videoGain);
      videoGain.connect(dest);

      let musicEl: HTMLAudioElement | null = null;
      if (project.selectedMusicTrackId && project.selectedMusicTrackId !== 'none') {
        const trackInfo = FREE_MUSIC_TRACKS.find(t => t.id === project.selectedMusicTrackId);
        if (trackInfo) {
          musicEl = new Audio();
          musicEl.src = trackInfo.url; 
          musicEl.crossOrigin = 'anonymous';
          musicEl.volume = 0.35; 
          const musicSource = audioCtx.createMediaElementSource(musicEl);
          musicSource.connect(dest);
        }
      }

      const canvasStream = canvas.captureStream(30);
      const mixedStream = new MediaStream([
        canvasStream.getVideoTracks()[0],
        dest.stream.getAudioTracks()[0]
      ]);

      const recorder = new MediaRecorder(mixedStream, {
        mimeType: 'video/mp4;codecs=avc1',
        videoBitsPerSecond: 8000000 
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/mp4' }));
      recorder.onerror = reject;

      recorder.start();
      if (musicEl) musicEl.play();

      let totalDuration = highlights.reduce((s, h) => s + (h.duration || (h.end - h.start)), 0);
      let elapsed = 0;
      const fps = 30;
      const frameTime = 1 / fps;

      for (const hl of highlights) {
        const segDur = hl.duration || (hl.end - hl.start);
        const startTime = hl.start;
        
        video.currentTime = startTime;
        await new Promise(r => { video.onseeked = r; });
        video.play().catch(() => {});

        for (let t = 0; t < segDur; t += frameTime) {
          const frameTargetTime = startTime + t;
          video.currentTime = frameTargetTime;
          
          await new Promise(r => {
            const onSeek = () => { video.removeEventListener('seeked', onSeek); r(null); };
            video.addEventListener('seeked', onSeek);
          });

          if (musicEl) {
            const expectedMusicTime = elapsed + t;
            if (Math.abs(musicEl.currentTime - expectedMusicTime) > 0.2) {
              musicEl.currentTime = expectedMusicTime;
            }
          }

          // A. CALCULATE ZOOM
          let scale = 1.0;
          const globalT = elapsed + t;
          const activeZoom = project.zoomEffects?.find(z => globalT >= z.timestamp && globalT <= z.timestamp + z.duration);
          if (activeZoom) scale = activeZoom.scale;

          const sW = video.videoWidth / scale;
          const sH = video.videoHeight / scale;
          const sX = (video.videoWidth - sW) / 2;
          const sY = (video.videoHeight - sH) / 2;

          // B. DRAW VIDEO
          ctx.drawImage(video, sX, sY, sW, sH, 0, 0, W, H);

          // C. DRAW PREMIUM SUBTITLES (Multi-line Wrapped)
          const sub = project.subtitles?.find(s => globalT >= s.start && globalT <= s.end);
          if (sub) {
            drawStyledSubtitles(ctx, sub, project, W, H);
          }

          onProgress(Math.round(((elapsed + t) / totalDuration) * 100));
        }
        elapsed += segDur;
      }

      recorder.stop();
      if (musicEl) musicEl.pause();
    } catch (err) {
      reject(err);
    }
  });
}

function drawStyledSubtitles(ctx: CanvasRenderingContext2D, sub: SubtitleItem, project: VideoProject, W: number, H: number) {
  const text = project.captionStyle === 'minimalist' ? sub.text : sub.text.toUpperCase();
  const textLen = text.length;
  const style = getCaptionStyles(project.captionStyle || 'hormozi', textLen, W);
  
  const fontName = project.captionStyle === 'minimalist' ? 'sans-serif' : 'Impact, sans-serif';
  const weight = project.captionStyle === 'minimalist' ? '500' : '900';
  ctx.font = `${weight} ${style.fontSize}px ${fontName}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 1. SMART LINE WRAPPING
  const maxWidth = W * 0.85;
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const testLine = currentLine + ' ' + words[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth) {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);

  // 2. POSITIONING
  const lineHeight = style.fontSize * 1.2;
  const totalHeight = lines.length * lineHeight;
  let baseY = H * 0.75;
  if (project.captionPosition === 'top') baseY = H * 0.15;
  if (project.captionPosition === 'center') baseY = H * 0.5;

  // 3. DRAW BOX & TEXT
  lines.forEach((line, lineIdx) => {
    const y = baseY - (totalHeight / 2) + (lineIdx * lineHeight) + (lineHeight / 2);
    const lineMetrics = ctx.measureText(line);
    const lineWidth = lineMetrics.width;

    if (style.hasBox) {
      const paddingX = style.boxPaddingX || 20;
      const paddingY = style.boxPaddingY || 10;
      ctx.fillStyle = style.boxBg || 'rgba(0,0,0,0.8)';
      const bx = (W - lineWidth) / 2 - paddingX;
      const by = y - style.fontSize / 2 - paddingY;
      const bw = lineWidth + paddingX * 2;
      const bh = style.fontSize + paddingY * 2;
      const r = style.boxRadius || 12;

      // Draw Rounded Box
      ctx.beginPath();
      ctx.moveTo(bx + r, by);
      ctx.lineTo(bx + bw - r, by);
      ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
      ctx.lineTo(bx + bw, by + bh - r);
      ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
      ctx.lineTo(bx + r, by + bh);
      ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
      ctx.lineTo(bx, by + r);
      ctx.quadraticCurveTo(bx, by, bx + r, by);
      ctx.closePath();
      ctx.fill();
    }

    // DRAW TEXT WORDS (with Highlight check)
    let currentX = (W - lineWidth) / 2;
    const highlightWords = (sub.highlightWords || []).map(w => w.toUpperCase());
    const lineWords = line.split(' ');

    lineWords.forEach((word) => {
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
