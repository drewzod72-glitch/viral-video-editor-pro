import { VideoProject, SubtitleItem, getCaptionStyles } from '../types';

/**
 * PREMIUM HARDWARE-ACCELERATED ENGINE
 * 
 * Replicates the "Gemini Edit" look perfectly by using high-fidelity 
 * canvas rendering synchronized with the phone's native video chip.
 */
export async function renderVideoInBrowser(
  project: VideoProject,
  onProgress: (progress: number) => void,
  activeClipId: string | null = null
): Promise<Blob> {
  console.log('[Hardware Engine] Initializing Real-Time Forge...');

  return new Promise(async (resolve, reject) => {
    try {
      // 1. Setup Video & Canvas
      const video = document.createElement('video');
      video.src = project.videoUrl;
      video.crossOrigin = 'anonymous';
      video.muted = false; // Must be unmuted to capture audio on some browsers
      video.volume = 0;    // But keep it silent for the user
      video.playsInline = true;
      
      // CRITICAL: Must be in DOM for some browsers to allow captureStream
      video.style.position = 'fixed';
      video.style.top = '-9999px';
      video.style.left = '-9999px';
      video.style.width = '1px';
      video.style.height = '1px';
      document.body.appendChild(video);

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

      // 2. Setup Recording with Native Audio Capture
      const canvasStream = canvas.captureStream(30);
      
      // Capture audio directly from the video element's stream
      let audioTrack: MediaStreamTrack | null = null;
      try {
        const videoStream = (video as any).captureStream ? (video as any).captureStream() : (video as any).mozCaptureStream();
        audioTrack = videoStream.getAudioTracks()[0];
      } catch (e) {
        console.warn('[Audio] Direct capture failed, trying AudioContext...');
      }

      // Fallback to AudioContext if direct capture fails
      if (!audioTrack) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const dest = audioCtx.createMediaStreamDestination();
        const source = audioCtx.createMediaElementSource(video);
        source.connect(dest);
        audioTrack = dest.stream.getAudioTracks()[0];
      }

      const mixedStream = new MediaStream([
        canvasStream.getVideoTracks()[0],
        ...(audioTrack ? [audioTrack] : [])
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
      recorder.onerror = reject;

      // 3. START REAL-TIME BAKING
      recorder.start();
      
      let totalDuration = highlights.reduce((s, h) => s + (h.duration || (h.end - h.start)), 0);
      let currentSegmentIndex = 0;
      let startTime = Date.now();
      let elapsedInPreviousSegments = 0;

      const processFrame = async () => {
        if (currentSegmentIndex >= highlights.length) {
          recorder.stop();
          return;
        }

        const hl = highlights[currentSegmentIndex];
        const segDur = hl.duration || (hl.end - hl.start);
        
        if (video.paused) {
          video.currentTime = hl.start;
          try { await video.play(); } catch(e) {}
        }

        // Jump to next segment if current one ended
        if (video.currentTime >= hl.end || video.currentTime < hl.start) {
          elapsedInPreviousSegments += segDur;
          currentSegmentIndex++;
          if (currentSegmentIndex < highlights.length) {
            video.currentTime = highlights[currentSegmentIndex].start;
          }
          requestAnimationFrame(processFrame);
          return;
        }

        // DRAW
        // Calculate zoom
        let scale = 1.0;
        const currentGlobalT = elapsedInPreviousSegments + (video.currentTime - hl.start);
        const activeZoom = project.zoomEffects?.find(z => currentGlobalT >= z.timestamp && currentGlobalT <= z.timestamp + z.duration);
        if (activeZoom) scale = activeZoom.scale;

        const sW = video.videoWidth / scale;
        const sH = video.videoHeight / scale;
        const sX = (video.videoWidth - sW) / 2;
        const sY = (video.videoHeight - sH) / 2;

        ctx.drawImage(video, sX, sY, sW, sH, 0, 0, W, H);

        // Draw Subtitles
        const sub = project.subtitles?.find(s => currentGlobalT >= s.start && currentGlobalT <= s.end);
        if (sub) {
          drawStyledSubtitles(ctx, sub, project, W, H);
        }

        onProgress(Math.min(99, Math.round((currentGlobalT / totalDuration) * 100)));
        requestAnimationFrame(processFrame);
      };

      requestAnimationFrame(processFrame);

    } catch (err) {
      reject(err);
    }
  });
}

function drawStyledSubtitles(ctx: CanvasRenderingContext2D, sub: SubtitleItem, project: VideoProject, W: number, H: number) {
  const style = getCaptionStyles(project.captionStyle || 'hormozi', sub.text.length, W);
  
  // Font configuration
  const fontName = project.captionStyle === 'minimalist' ? 'sans-serif' : 'Impact, sans-serif';
  const weight = project.captionStyle === 'minimalist' ? '500' : '900';
  ctx.font = `${weight} ${style.fontSize}px ${fontName}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const text = style.textTransform === 'uppercase' ? sub.text.toUpperCase() : sub.text;
  const words = text.split(' ');
  
  // Calculate text dimensions
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = style.fontSize;
  
  // Position
  let y = H * 0.75;
  if (project.captionPosition === 'top') y = H * 0.15;
  if (project.captionPosition === 'center') y = H * 0.5;

  // Draw Background Box
  if (style.hasBox) {
    const paddingX = style.boxPaddingX || 20;
    const paddingY = style.boxPaddingY || 10;
    ctx.fillStyle = style.boxBg || 'rgba(0,0,0,0.8)';
    ctx.beginPath();
    const bx = (W - textWidth) / 2 - paddingX;
    const by = y - textHeight / 2 - paddingY;
    const bw = textWidth + paddingX * 2;
    const bh = textHeight + paddingY * 2;
    const r = style.boxRadius || 12;
    
    // Rounded rect
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

  // Draw Words with Highlighting
  let currentX = (W - textWidth) / 2;
  const highlightWords = (sub.highlightWords || []).map(w => w.toUpperCase());

  words.forEach((word, i) => {
    const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").toUpperCase();
    const isHighlighted = highlightWords.includes(cleanWord);
    
    ctx.fillStyle = isHighlighted ? style.highlightColor : style.textColor;
    
    // Stroke
    if (style.strokeWidth > 0) {
      ctx.strokeStyle = style.strokeColor;
      ctx.lineWidth = style.strokeWidth * 2;
      ctx.strokeText(word, currentX + ctx.measureText(word).width / 2, y);
    }
    
    ctx.fillText(word, currentX + ctx.measureText(word).width / 2, y);
    currentX += ctx.measureText(word + ' ').width;
  });
}
