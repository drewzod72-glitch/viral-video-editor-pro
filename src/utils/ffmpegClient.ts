import { VideoProject, SubtitleItem, getCaptionStyles } from '../types';
import { FREE_MUSIC_TRACKS } from '../data';
import { playViralSFX } from './sfx';

/**
 * MASTER FORGE ENGINE V30.4 (BEST VERSION RESET)
 * Pro Quality: SFX Sync, Flash Transitions, Camera Rumble, and Two-Tone Hormozi.
 */
export async function renderVideoInBrowser(
  project: VideoProject,
  onProgress: (progress: number) => void,
  activeClipId: string | null = null
): Promise<Blob> {
  const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioCtx();
  
  return new Promise(async (resolve, reject) => {
    try {
      const video = document.createElement('video');
      video.src = project.videoUrl;
      video.crossOrigin = 'anonymous'; video.muted = true; video.playsInline = true;
      
      await new Promise((r) => {
        const t = setTimeout(r, 6000);
        video.onloadedmetadata = () => { clearTimeout(t); r(null); };
        video.load();
      });

      const W = 1080; const H = 1920;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d', { alpha: false });

      const highlights = activeClipId === 'smart-cuts' 
        ? project.highlights 
        : (activeClipId ? [project.highlights.find(h => h.id === activeClipId)!].filter(Boolean) : [{ start: 0, end: video.duration || 30, duration: video.duration || 30 }]);

      const totalDuration = highlights.reduce((s, h) => s + (h.duration || (h.end - h.start)), 0);

      // AUDIO SETUP
      const dest = audioCtx.createMediaStreamDestination();
      const vGain = audioCtx.createGain(); vGain.gain.value = 1.6;
      audioCtx.createMediaElementSource(video).connect(vGain); vGain.connect(dest);

      let mEl: HTMLAudioElement | null = null;
      if (project.selectedMusicTrackId && project.selectedMusicTrackId !== 'none') {
        const track = FREE_MUSIC_TRACKS.find(t => t.id === project.selectedMusicTrackId);
        if (track) {
          mEl = new Audio(track.url); mEl.crossOrigin = 'anonymous'; mEl.loop = true;
          await new Promise(r => { const t = setTimeout(r, 4000); mEl!.oncanplaythrough = r; mEl!.load(); });
          const mGain = audioCtx.createGain(); mGain.gain.value = project.musicVolume || 0.4;
          audioCtx.createMediaElementSource(mEl).connect(mGain); mGain.connect(dest);
        }
      }

      const recorder = new MediaRecorder(canvas.captureStream(30), { 
        mimeType: MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm',
        videoBitsPerSecond: 8000000 
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));

      if (audioCtx.state === 'suspended') await audioCtx.resume();
      recorder.start();
      if (mEl) mEl.play().catch(() => {});

      let currentIdx = 0; let elapsed = 0; let lastSId: string | null = null;

      const render = () => {
        const h = highlights[currentIdx];
        if (!h) { recorder.stop(); return; }

        if (video.currentTime >= h.end || video.paused) {
          elapsed += (h.end - h.start); currentIdx++;
          if (currentIdx < highlights.length) {
            video.currentTime = highlights[currentIdx].start;
            video.play().catch(() => {});
            playViralSFX('whoosh', dest);
          } else { recorder.stop(); return; }
        }

        const globalT = elapsed + (video.currentTime - h.start);
        
        // ZOOM & SHAKE
        let scale = 1.0;
        const z = project.zoomEffects?.find(e => globalT >= e.timestamp && globalT <= e.timestamp + e.duration);
        scale = z ? z.scale : (project.autoZoomPunch && (globalT % 2.2 < 0.4) ? 1.25 : 1.0);

        ctx.save();
        if (project.shakeOnPunch && scale > 1.1) ctx.translate((Math.random()-0.5)*15, (Math.random()-0.5)*15);
        const zW = video.videoWidth / scale; const zH = video.videoHeight / scale;
        ctx.drawImage(video, (video.videoWidth - zW)/2, (video.videoHeight - zH)/2, zW, zH, 0, 0, W, H);
        ctx.restore();

        // TEXT (TWO-TONE POP)
        const s = project.subtitles?.find(i => globalT >= i.start && globalT <= i.end);
        if (s && project.enableSubtitles) {
          if (s.id !== lastSId) { playViralSFX('pop', dest); lastSId = s.id; }
          const style = getCaptionStyles(project.captionStyle || 'hormozi', s.text.length, W);
          ctx.font = `900 ${style.fontSize}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const x = W / 2; let y = H * 0.75;
          ctx.shadowColor = 'black'; ctx.shadowBlur = 30; ctx.shadowOffsetX = 8; ctx.shadowOffsetY = 8;
          const words = s.text.toUpperCase().split(' ');
          let curX = x - ctx.measureText(s.text.toUpperCase()).width / 2;
          words.forEach((w, i) => {
            const isH = s.highlightWords?.some(kw => w.toLowerCase().includes(kw.toLowerCase())) || i === 0;
            ctx.fillStyle = isH ? (i % 2 === 0 ? '#FBFF00' : '#FF00FF') : '#FFFFFF';
            const wW = ctx.measureText(w).width;
            ctx.fillText(w, curX + wW / 2, y);
            curX += ctx.measureText(w + ' ').width;
          });
          ctx.shadowBlur = 0;
        }

        onProgress(Math.min(99, Math.round((globalT / totalDuration) * 100)));
        requestAnimationFrame(render);
      };

      video.currentTime = highlights[0].start;
      video.play().then(() => requestAnimationFrame(render)).catch(reject);
    } catch (err) { reject(err); }
  });
}
