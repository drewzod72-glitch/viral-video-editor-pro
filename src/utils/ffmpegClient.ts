import { VideoProject, SubtitleItem, getCaptionStyles } from '../types';
import { FREE_MUSIC_TRACKS } from '../data';

const getProxyUrl = (originalUrl: string) => {
  return `/api/music-proxy?url=${encodeURIComponent(originalUrl)}`;
};

/**
 * OFFLINE FORGE ENGINE (V18.6) - SAFARI MUSIC STABILITY
 * Fixed: Safari CORS block on music (via Proxy)
 * Fixed: Race condition where music plays before loading
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
      
      const highlights = activeClipId === 'smart-cuts' 
        ? project.highlights 
        : (activeClipId ? [project.highlights.find(h => h.id === activeClipId)!].filter(Boolean) : [{ start: 0, end: video.duration || project.duration || 30, duration: video.duration || project.duration || 30 }]);

      const totalTargetDuration = highlights.reduce((s, h) => s + (h.duration || (h.end - h.start)), 0);

      // AUDIO SETUP
      const dest = audioCtx.createMediaStreamDestination();
      const videoSource = audioCtx.createMediaElementSource(video);
      const videoGain = audioCtx.createGain();
      videoGain.gain.value = 1.6;
      videoSource.connect(videoGain);
      videoGain.connect(dest);

      let musicEl: HTMLAudioElement | null = null;
      if (project.selectedMusicTrackId && project.selectedMusicTrackId !== 'none') {
        const track = FREE_MUSIC_TRACKS.find(t => t.id === project.selectedMusicTrackId);
        if (track) {
          musicEl = new Audio();
          musicEl.crossOrigin = 'anonymous';
          musicEl.src = getProxyUrl(track.url); // USE PROXY
          musicEl.loop = true;
          
          // WAIT FOR MUSIC BEFORE STARTING
          await new Promise((res, rej) => {
            const timeout = setTimeout(() => rej(new Error("Music Timeout")), 10000);
            musicEl!.oncanplaythrough = () => { clearTimeout(timeout); res(null); };
            musicEl!.onerror = () => { clearTimeout(timeout); rej(new Error("Music Load Error")); };
            musicEl!.load();
          });

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
        
        // CROP & ZOOM LOGIC
        let currentScale = 1.0;
        if (project.enableZooms) {
          const zoom = project.zoomEffects?.find(z => globalT >= z.timestamp && globalT <= z.timestamp + z.duration);
          if (zoom) currentScale = zoom.scale;
        }

        const zoomW = video.videoWidth / currentScale;
        const zoomH = video.videoHeight / currentScale;
        const zoomX = (video.videoWidth - zoomW) / 2;
        const zoomY = (video.videoHeight - zoomH) / 2;

        ctx.drawImage(video, zoomX, zoomY, zoomW, zoomH, 0, 0, W, H);

        // SUBTITLES
        const sub = project.subtitles?.find(s => globalT >= s.start && globalT <= s.end);
        if (sub) {
          const style = getCaptionStyles(project.captionStyle || 'hormozi', sub.text.length, W);
          ctx.font = `900 ${style.fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillStyle = '#FBFF00';
          ctx.shadowColor = 'black';
          ctx.shadowBlur = 8;
          
          let y = H * 0.75;
          if (project.captionPosition === 'top') y = H * 0.15;
          else if (project.captionPosition === 'center') y = H * 0.5;

          ctx.fillText(sub.text.toUpperCase(), W/2, y);
        }

        onProgress(Math.min(99, Math.round((globalT / totalTargetDuration) * 100)));
        requestAnimationFrame(renderFrame);
      };

      video.currentTime = highlights[0].start;
      video.play().then(() => {
        requestAnimationFrame(renderFrame);
      }).catch(err => reject(err));

    } catch (err) { reject(err); }
  });
}
