import { VideoProject, SubtitleItem, getCaptionStyles } from '../types';
import { FREE_MUSIC_TRACKS } from '../data';

/**
 * OFFLINE FORGE ENGINE (V18.5) - STABILITY & SYNC MASTER
 * Fixed: Time-stretching bug (8s -> 22s) and Audio Sync.
 * Added: GainNode for Music to prevent Safari mutes.
 */
export async function renderVideoInBrowser(
  project: VideoProject,
  onProgress: (progress: number) => void,
  activeClipId: string | null = null
): Promise<Blob> {
  const AudioCtxClass = (window as any).AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioCtxClass();
  
  return new Promise(async (resolve, reject) => {
    try {
      const video = document.createElement('video');
      video.src = project.videoUrl;
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;
      
      await new Promise((r) => {
        video.onloadedmetadata = r;
        video.load();
      });

      const W = 720; 
      const H = 1280;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Canvas Error');

      const highlights = activeClipId === 'smart-cuts' 
        ? project.highlights 
        : (activeClipId ? [project.highlights.find(h => h.id === activeClipId)!].filter(Boolean) : [{ start: 0, end: video.duration || project.duration || 30, duration: video.duration || project.duration || 30 }]);

      if (highlights.length === 0) {
        highlights.push({ start: 0, end: video.duration, duration: video.duration });
      }

      const totalTargetDuration = highlights.reduce((s, h) => s + (h.duration || (h.end - h.start)), 0);

      // AUDIO SETUP
      const dest = audioCtx.createMediaStreamDestination();
      const videoSource = audioCtx.createMediaElementSource(video);
      const videoGain = audioCtx.createGain();
      videoGain.gain.value = 1.6; // Viral Boost
      videoSource.connect(videoGain);
      videoGain.connect(dest);

      let musicEl: HTMLAudioElement | null = null;
      if (project.selectedMusicTrackId && project.selectedMusicTrackId !== 'none') {
        const track = FREE_MUSIC_TRACKS.find(t => t.id === project.selectedMusicTrackId);
        if (track) {
          musicEl = new Audio(track.url);
          musicEl.crossOrigin = 'anonymous';
          musicEl.loop = true;
          const musicSource = audioCtx.createMediaElementSource(musicEl);
          const musicGain = audioCtx.createGain();
          musicGain.gain.value = project.musicVolume || 0.4;
          musicSource.connect(musicGain);
          musicGain.connect(dest);
        }
      }

      const canvasStream = canvas.captureStream(30);
      const mixedStream = new MediaStream([
        canvasStream.getVideoTracks()[0],
        ...dest.stream.getAudioTracks()
      ]);

      let mimeType = 'video/mp4';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

      const recorder = new MediaRecorder(mixedStream, { 
        mimeType, 
        videoBitsPerSecond: 5000000 
      });
      
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: mimeType });
        resolve(finalBlob);
      };

      // START RECORDING
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      recorder.start();
      if (musicEl) musicEl.play().catch(() => {});

      let currentHlIdx = 0;
      let elapsedInPreviousSegments = 0;

      const renderFrame = () => {
        const currentHl = highlights[currentHlIdx];
        if (!currentHl) {
          recorder.stop();
          if (musicEl) musicEl.pause();
          return;
        }

        // Check if segment ended
        if (video.currentTime >= currentHl.end || video.paused) {
          elapsedInPreviousSegments += (currentHl.end - currentHl.start);
          currentHlIdx++;
          if (currentHlIdx < highlights.length) {
            video.currentTime = highlights[currentHlIdx].start;
            video.play().catch(() => {});
            requestAnimationFrame(renderFrame);
          } else {
            recorder.stop();
            if (musicEl) musicEl.pause();
          }
          return;
        }

        const globalT = elapsedInPreviousSegments + (video.currentTime - currentHl.start);
        const sub = project.subtitles?.find(s => globalT >= s.start && globalT <= s.end);

        // 1. Calculate Active Zoom
        let currentScale = 1.0;
        if (project.enableZooms) {
          const zoom = project.zoomEffects?.find(z => globalT >= z.timestamp && globalT <= z.timestamp + z.duration);
          if (zoom) {
            currentScale = zoom.scale;
          } else if (project.autoZoomPunch && sub) {
            const idx = project.subtitles.findIndex(s => s.id === sub.id);
            currentScale = idx % 2 === 0 ? 1.22 : 1.0;
          }
        }

        // 2. Apply Color Grade
        if (project.enableColorGrade && project.colorGrade && project.colorGrade !== 'none') {
          if (project.colorGrade === 'vibrant_pop') ctx.filter = 'contrast(1.2) saturate(1.4)';
          else if (project.colorGrade === 'cinematic') ctx.filter = 'contrast(1.1) brightness(0.95)';
          else if (project.colorGrade === 'warm_vintage') ctx.filter = 'sepia(0.2) contrast(1.1)';
          else if (project.colorGrade === 'moody_cyber') ctx.filter = 'hue-rotate(-20deg) saturate(1.2) contrast(1.1)';
        } else {
          ctx.filter = 'none';
        }

        // 3. Draw Video with Zoom
        const zoomW = video.videoWidth / currentScale;
        const zoomH = video.videoHeight / currentScale;
        const zoomX = (video.videoWidth - zoomW) / 2;
        const zoomY = (video.videoHeight - zoomH) / 2;

        ctx.drawImage(video, zoomX, zoomY, zoomW, zoomH, 0, 0, W, H);
        ctx.filter = 'none';

        // Draw Subtitles
        if (sub) {
          const style = getCaptionStyles(project.captionStyle || 'hormozi', sub.text.length, W);
          ctx.font = `900 ${style.fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          const text = sub.text.toUpperCase();
          const words = text.split(' ');
          const x = W / 2;
          
          let y = H * 0.75;
          if (project.captionPosition === 'top') y = H * 0.15;
          else if (project.captionPosition === 'center') y = H * 0.5;

          if (style.hasBox) {
            ctx.fillStyle = style.boxBg || 'rgba(0,0,0,0.8)';
            const metrics = ctx.measureText(text);
            const padX = 20;
            const padY = 10;
            ctx.fillRect(x - metrics.width/2 - padX, y - style.fontSize/2 - padY, metrics.width + padX*2, style.fontSize + padY*2);
          }

          let currentX = x - ctx.measureText(text).width / 2;
          words.forEach((word, i) => {
            const isHighlight = sub.highlightWords?.some(hw => word.toLowerCase().includes(hw.toLowerCase())) || i === 0;
            ctx.fillStyle = isHighlight ? '#FBFF00' : (style.textColor || '#FFFFFF');
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 4;
            ctx.shadowOffsetY = 4;
            ctx.fillText(word, currentX + ctx.measureText(word).width / 2, y);
            ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
            currentX += ctx.measureText(word + ' ').width;
          });
        }

        onProgress(Math.min(99, Math.round((globalT / totalTargetDuration) * 100)));
        requestAnimationFrame(renderFrame);
      };

      video.currentTime = highlights[0].start;
      video.play().then(() => {
        requestAnimationFrame(renderFrame);
      }).catch(err => {
        reject(new Error("Video Playback Failed: Please interact with the studio first."));
      });

    } catch (err) { reject(err); }
  });
}
