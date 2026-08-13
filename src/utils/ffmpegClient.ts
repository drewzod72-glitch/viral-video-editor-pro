import { VideoProject, getCaptionStyles } from '../types';
import { FREE_MUSIC_TRACKS } from '../data';
import { playViralSFX } from './sfx';

const FPS = 30;
const W = 1080;
const H = 1920;
const CANVAS_BITRATE = 4_000_000; // 4 Mbps per Kilo
const FRAME_CAPTURE_DELAY_MS = 12; // 12 ms per Kilo

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getBestMimeType(): string {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const candidates = isIOS 
    ? ['video/mp4; codecs=avc1', 'video/mp4', 'video/webm; codecs=vp9', 'video/webm']
    : ['video/webm; codecs=vp9', 'video/webm; codecs=vp8', 'video/webm', 'video/mp4'];
  
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return isIOS ? 'video/mp4' : 'video/webm';
}

export async function renderVideoInBrowser(
  project: VideoProject,
  onProgress: (progress: number) => void,
  activeClipId: string | null = null
): Promise<{ blob: Blob; extension: string }> {
  return new Promise(async (resolve, reject) => {
    let cancelled = false;
    const abort = (err: unknown) => { if (!cancelled) { cancelled = true; reject(err); } };

    try {
      const video = document.createElement('video');
      video.src = project.videoUrl;
      video.muted = true; video.playsInline = true; video.crossOrigin = 'anonymous';
      await new Promise((res, rej) => {
        video.onloadedmetadata = res;
        video.onerror = () => rej(new Error('Failed to load video source'));
        video.load();
      });

      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Canvas context unavailable');

      const canvasStream = canvas.captureStream(FPS);
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') await audioCtx.resume(); // Resume immediately

      const audioDest = audioCtx.createMediaStreamDestination();

      const videoSource = audioCtx.createMediaElementSource(video);
      const videoGain = audioCtx.createGain();
      videoGain.gain.value = 1.0;
      videoSource.connect(videoGain); videoGain.connect(audioDest);

      let musicEl: HTMLAudioElement | null = null;
      if (project.selectedMusicTrackId && project.selectedMusicTrackId !== 'none') {
        const track = FREE_MUSIC_TRACKS.find((t) => t.id === project.selectedMusicTrackId);
        if (track) {
          musicEl = new Audio(track.url); 
          musicEl.crossOrigin = 'anonymous'; 
          musicEl.loop = true;
          musicEl.currentTime = 0; 
          musicEl.volume = 1.0; // Music volume to 1.0 per Kilo
          const mSource = audioCtx.createMediaElementSource(musicEl);
          const musicGain = audioCtx.createGain();
          musicGain.gain.value = project.musicVolume ?? 0.4;
          mSource.connect(musicGain); mSource.connect(audioDest);
          // musicEl.play() will happen during handshake
        }
      }

      // ── SYNCED AUDIO BUS ──
      const audioTracks = audioDest.stream.getAudioTracks();
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...(audioTracks.length > 0 ? audioTracks : [])
      ]);

      const mimeType = getBestMimeType();
      const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
      let recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: CANVAS_BITRATE });
      let chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      // Audio Handshake Handlers
      const musicPlayPromise = musicEl ? new Promise<void>((res) => {
        if (!musicEl) return res();
        const onPlaying = () => {
          musicEl.removeEventListener('playing', onPlaying);
          res();
        };
        musicEl.addEventListener('playing', onPlaying);
        musicEl.play().catch(() => res());
        setTimeout(res, 2000); // 2s per Kilo
      }) : Promise.resolve();

      // Start Recorder
      recorder.start(100);

      // Trimmed Warm-Up (3 frames) per Kilo
      for (let i = 0; i < 3; i++) {
        ctx.clearRect(0, 0, W, H); ctx.drawImage(video, 0, 0, W, H);
        await new Promise(r => requestAnimationFrame(r));
      }

      // Wait for Music Handshake
      await musicPlayPromise;

      // Zero-Failure Handshake Gating (3s) per Kilo
      let firstChunkReceived = false;
      await new Promise<void>((res) => {
        const timer = setTimeout(() => {
          if (!firstChunkReceived) {
            console.warn('Switching to Stream-Legacy mode...');
            recorder.stop();
            const legacyStream = new MediaStream([...canvasStream.getVideoTracks()]);
            recorder = new MediaRecorder(legacyStream, { mimeType, videoBitsPerSecond: CANVAS_BITRATE });
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
            recorder.start(100);
          }
          res();
        }, 3000);
        const original = recorder.ondataavailable;
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) { firstChunkReceived = true; clearTimeout(timer); res(); }
          if (original) original(e);
        };
      });

      const hl = activeClipId ? project.highlights.find(h => h.id === activeClipId) : null;
      const start = hl?.start ?? 0;
      const end = hl?.end ?? video.duration;
      const totalFrames = Math.floor((end - start) * FPS);

      let currentFrame = 0;
      const render = async () => {
        if (cancelled || currentFrame >= totalFrames) { recorder.stop(); return; }
        const t = start + (currentFrame / FPS);
        video.currentTime = t;
        
        if (musicEl && Math.abs(musicEl.currentTime - (currentFrame / FPS)) > 0.1) {
          musicEl.currentTime = currentFrame / FPS;
        }

        await new Promise(r => { 
          const onSeeked = () => { video.removeEventListener('seeked', onSeeked); r(null); };
          video.addEventListener('seeked', onSeeked);
          setTimeout(onSeeked, 800); 
        });
        
        ctx.clearRect(0, 0, W, H); ctx.drawImage(video, 0, 0, W, H);
        
        const s = project.subtitles?.find(i => t >= i.start && t <= i.end);
        if (s && project.enableSubtitles) {
          const style = getCaptionStyles(project.captionStyle || 'hormozi', s.text.length, W);
          ctx.font = `900 ${style.fontSize}px ${style.fontFamily}`;
          ctx.textAlign = 'center'; ctx.shadowColor = 'black'; ctx.shadowBlur = 20;
          ctx.fillStyle = '#FFFFFF'; ctx.fillText(s.text.toUpperCase(), W / 2, H * 0.78);
        }

        onProgress(Math.round((currentFrame / totalFrames) * 100));
        currentFrame++;
        
        await wait(FRAME_CAPTURE_DELAY_MS); 
        requestAnimationFrame(render);
      };

      recorder.onstop = () => {
        resolve({ blob: new Blob(chunks, { type: mimeType }), extension });
        if (musicEl) { musicEl.pause(); musicEl.src = ''; }
        audioCtx.close().catch(() => {});
        onProgress(100);
      };

      render();
    } catch (err) { abort(err); }
  });
}
