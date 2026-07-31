import { VideoProject, SubtitleItem, getCaptionStyles } from '../types';
import { FREE_MUSIC_TRACKS } from '../data';

/**
 * OFFLINE FORGE ENGINE (V18) - STABILITY MASTER
 */
export async function renderVideoInBrowser(
  project: VideoProject,
  onProgress: (progress: number) => void,
  activeClipId: string | null = null
): Promise<Blob> {
  const AudioCtxClass = (window as any).AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioCtxClass();
  if (audioCtx.state === 'suspended') await audioCtx.resume();

  return new Promise(async (resolve, reject) => {
    try {
      const video = document.createElement('video');
      video.src = project.videoUrl;
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;
      
      await new Promise((r, rej) => {
        const t = setTimeout(() => r(null), 5000);
        video.onloadedmetadata = () => { clearTimeout(t); r(null); };
        video.onerror = rej;
        video.load();
      });

      const W = 720; 
      const H = 1280;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Canvas Error');

      const highlights = activeClipId === 'smart-cuts' 
        ? project.highlights.slice(0, 10) 
        : (activeClipId ? [project.highlights.find(h => h.id === activeClipId)!].filter(Boolean) : [{ start: 0, end: video.duration || project.duration || 30, duration: video.duration || project.duration || 30 }]);

      const totalTargetDuration = highlights.reduce((s, h) => s + (h.duration || (h.end - h.start)), 0);

      const dest = audioCtx.createMediaStreamDestination();
      try {
        const videoSource = audioCtx.createMediaElementSource(video);
        videoSource.connect(dest);
      } catch (e) {}

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

      const canvasStream = canvas.captureStream(30);
      const mixedStream = new MediaStream([canvasStream.getVideoTracks()[0], ...dest.stream.getAudioTracks()]);

      let mimeType = 'video/mp4';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

      const recorder = new MediaRecorder(mixedStream, { mimeType, videoBitsPerSecond: 3000000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/mp4' }));

      recorder.start();
      if (musicEl) musicEl.play().catch(() => {});
      
      let elapsed = 0;
      for (const hl of highlights) {
        const segDur = hl.duration || (hl.end - hl.start);
        for (let t = 0; t < segDur; t += (1/30)) {
          video.currentTime = hl.start + t;
          await new Promise(r => {
            video.addEventListener('seeked', () => r(null), { once: true });
            setTimeout(r, 200);
          });

          // Draw Video
          ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, W, H);

          // Draw Subtitles
          const globalT = elapsed + t;
          const sub = project.subtitles?.find(s => globalT >= s.start && globalT <= s.end);
          if (sub) {
            const style = getCaptionStyles(project.captionStyle || 'hormozi', sub.text.length, W);
            ctx.font = `900 ${style.fontSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillStyle = '#FBFF00';
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 4;
            ctx.fillText(sub.text.toUpperCase(), W/2, H*0.75);
          }
          onProgress(Math.round(((elapsed + t) / totalTargetDuration) * 100));
        }
        elapsed += segDur;
      }

      setTimeout(() => recorder.stop(), 500);
    } catch (err) { reject(err); }
  });
}
