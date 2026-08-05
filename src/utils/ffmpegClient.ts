import { VideoProject, getCaptionStyles } from '../types';
import { FREE_MUSIC_TRACKS } from '../data';
import { playViralSFX } from './sfx';

// ─── Renderer Configuration ───────────────────────────────────────────────
const FPS = 30;
const FRAME_INTERVAL_MS = 1000 / FPS;
const W = 1080;
const H = 1920;
const CANVAS_BITRATE = 10_000_000; // 10 Mbps for crisp 1080p text
const FRAME_CAPTURE_DELAY_MS = 80;  // time to let encoder grab frame after draw

// ─── Helpers ──────────────────────────────────────────────────────────────

function waitForSeeked(video: HTMLVideoElement, timeoutMs = 1500): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      video.removeEventListener('seeked', onSeeked);
      resolve(); // resolve anyway — frame may have already settled
    }, timeoutMs);
    video.addEventListener('seeked', onSeeked);
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getBestMimeType(): string {
  const candidates = [
    'video/webm; codecs=vp9',
    'video/webm; codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return '';
}

function supportsRequestFrame(): boolean {
  try {
    const c = document.createElement('canvas');
    const stream = c.captureStream(0);
    const track = stream.getVideoTracks()[0];
    const supported = track && typeof (track as any).requestFrame === 'function';
    stream.getTracks().forEach((t) => t.stop());
    return supported;
  } catch {
    return false;
  }
}

// ─── Main Renderer ─────────────────────────────────────────────────────────

export async function renderVideoInBrowser(
  project: VideoProject,
  onProgress: (progress: number) => void,
  activeClipId: string | null = null
): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    let cancelled = false;
    const abort = (err: unknown) => {
      if (cancelled) return;
      cancelled = true;
      reject(err);
    };

    try {
      // ── 1. LOAD SOURCE VIDEO ──────────────────────────────────────────
      const video = document.createElement('video');
      video.src = project.videoUrl;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.controls = false;
      video.crossOrigin = 'anonymous';

      await new Promise<void>((res, rej) => {
        const t = setTimeout(() => rej(new Error('Video load timeout (15s)')), 15000);
        video.onloadedmetadata = () => { clearTimeout(t); res(); };
        video.onerror = () => { clearTimeout(t); rej(new Error('Failed to load video source')); };
        video.load();
      });

      // ── 2. CANVAS + RECORDER SETUP ────────────────────────────────────
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      const mimeType = getBestMimeType();
      if (!mimeType) throw new Error('No supported MediaRecorder mimeType');

      const useRequestFrame = supportsRequestFrame();
      // captureStream(0) + manual requestFrame() is the frame-locked path.
      // Safari fallback: captureStream(FPS) auto-captures at the configured rate.
      const canvasStream = canvas.captureStream(useRequestFrame ? 0 : FPS);

      const recorder = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: CANVAS_BITRATE,
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      // ── 3. AUDIO BUS ──────────────────────────────────────────────────
      // Single AudioContext for the entire render. All audio flows through
      // this context → MediaStreamDestination → combined MediaStream.
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const audioDest = audioCtx.createMediaStreamDestination();

      // Video source audio
      const videoSource = audioCtx.createMediaElementSource(video);
      const videoGain = audioCtx.createGain();
      videoGain.gain.value = 1.0;
      videoSource.connect(videoGain);
      videoGain.connect(audioDest);

      // Background music
      let musicEl: HTMLAudioElement | null = null;
      if (project.selectedMusicTrackId && project.selectedMusicTrackId !== 'none') {
        const track = FREE_MUSIC_TRACKS.find((t) => t.id === project.selectedMusicTrackId);
        if (track) {
          musicEl = new Audio(track.url);
          musicEl.crossOrigin = 'anonymous';
          musicEl.loop = true;
          musicEl.preload = 'auto';
          musicEl.volume = project.musicVolume ?? 0.4;

          await new Promise<void>((res) => {
            const t = setTimeout(() => res(), 4000);
            musicEl!.oncanplaythrough = () => { clearTimeout(t); res(); };
            musicEl!.onerror = () => { clearTimeout(t); res(); };
            musicEl!.load();
          }).catch(() => {});

          const mSource = audioCtx.createMediaElementSource(musicEl);
          const musicGain = audioCtx.createGain();
          musicGain.gain.value = project.musicVolume ?? 0.4;
          mSource.connect(musicGain);
          musicGain.connect(audioDest);
          musicEl.play().catch(() => {});
        }
      }

      // Combine video + audio into one stream
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioDest.stream.getAudioTracks(),
      ]);

      // Ensure audio track is active before recording starts
      const audioTracks = combinedStream.getAudioTracks();
      if (audioTracks.length > 0 && audioTracks[0].readyState === 'ended') {
        audioTracks[0].enabled = true;
      }

      // ── 4. HIGHLIGHT SELECTION ────────────────────────────────────────
      const highlights = activeClipId === 'smart-cuts'
        ? project.highlights
        : activeClipId
          ? [project.highlights.find((h: any) => h.id === activeClipId)].filter(Boolean)
          : [{ start: 0, end: video.duration || 30, duration: video.duration || 30 }];

      const totalDuration = highlights.reduce(
        (s, h) => s + (h.duration || (h.end - h.start)),
        0
      );
      const totalFrames = Math.max(1, Math.floor(totalDuration * FPS));

      // ── 5. START RECORDER ─────────────────────────────────────────────
      if (audioCtx.state === 'suspended') await audioCtx.resume();

      recorder.start(100); // emit data every 100ms to keep buffer small

      // Wait for the first chunk to confirm the stream is producing data
      let firstChunkReceived = false;
      await new Promise<void>((res, rej) => {
        const timer = setTimeout(() => {
          if (!firstChunkReceived) {
            // No data yet — might still be OK if encoder is slow
            res();
          }
        }, 2000);

        const originalHandler = recorder.ondataavailable;
        recorder.ondataavailable = (e: BlobEvent) => {
          if (e.data.size > 0) {
            firstChunkReceived = true;
            clearTimeout(timer);
            res();
          }
          if (originalHandler) originalHandler(e);
        };
      });

      // ── 6. FRAME-LOCKED RENDER LOOP ───────────────────────────────────
      let currentFrame = 0;
      let lastSubId: string | null = null;

      const getGlobalTime = (frameIdx: number): number => {
        let remaining = frameIdx;
        for (const h of highlights) {
          const hDur = h.duration || (h.end - h.start);
          if (remaining < hDur * FPS) return h.start + remaining / FPS;
          remaining -= hDur * FPS;
        }
        return highlights[highlights.length - 1]?.end ?? 0;
      };

      const onSubtitleChange = (subId: string) => {
        if (project.sfxPopEnabled) {
          playViralSFX('pop', audioDest);
        }
        lastSubId = subId;
      };

      const renderNextFrame = async () => {
        if (cancelled || currentFrame >= totalFrames) {
          await finishRender();
          return;
        }

        const frameStartTime = performance.now();
        const globalT = getGlobalTime(currentFrame);

        // ── PAUSE + SEEK ────────────────────────────────────────────────
        video.pause();
        if (Math.abs(video.currentTime - globalT) > 0.02) {
          video.currentTime = globalT;
          await waitForSeeked(video, 1500);
        }

        // ── DRAW ────────────────────────────────────────────────────────
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(video, 0, 0, W, H);

        // Color grade overlay
        if (project.enableColorGrade && project.colorGrade && project.colorGrade !== 'none') {
          ctx.globalCompositeOperation = 'overlay';
          ctx.globalAlpha = 0.22;
          const gradeColors: Record<string, string> = {
            cinematic: '#1a3a5c',
            warm_vintage: '#5c3a1a',
            vibrant_pop: '#5c1a3a',
            moody_cyber: '#1a1a2e',
          };
          ctx.fillStyle = gradeColors[project.colorGrade] || 'transparent';
          ctx.fillRect(0, 0, W, H);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1.0;
        }

        // Zoom / shake
        let scale = 1.0;
        if (project.enableZooms) {
          const z = project.zoomEffects?.find(
            (e: any) => globalT >= e.timestamp && globalT <= e.timestamp + e.duration
          );
          if (z) scale = z.scale;
        }

        if (project.shakeOnPunch && scale > 1.05) {
          ctx.save();
          ctx.translate((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
          const zW = W / scale;
          const zH = H / scale;
          ctx.drawImage(video, (W - zW) / 2, (H - zH) / 2, zW, zH, 0, 0, W, H);
          ctx.restore();
        }

        // Subtitles
        const s = project.subtitles?.find(
          (i: any) => globalT >= i.start && globalT <= i.end
        );
        if (s && project.enableSubtitles) {
          const style = getCaptionStyles(project.captionStyle || 'hormozi', s.text.length, W);

          ctx.font = `900 ${style.fontSize}px ${style.fontFamily}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const x = W / 2;
          const y = H * 0.78;
          const words = s.text.toUpperCase().split(' ');
          const measured = words.map((w) => ctx.measureText(w).width);
          const spaceW = ctx.measureText(' ').width;
          const totalW = measured.reduce((a, b) => a + b, 0) + (words.length - 1) * spaceW;
          let curX = x - totalW / 2;

          ctx.shadowColor = 'black';
          ctx.shadowBlur = 20;
          ctx.shadowOffsetX = 5;
          ctx.shadowOffsetY = 5;

          if (style.hasBox && style.boxBg) {
            const boxPadX = style.boxPaddingX ?? 16;
            const boxPadY = style.boxPaddingY ?? 10;
            const boxW = totalW + boxPadX * 2;
            const boxH = style.fontSize + boxPadY * 2;
            ctx.fillStyle = style.boxBg || 'rgba(0,0,0,0.8)';
            ctx.beginPath();
            ctx.roundRect(x - boxW / 2, y - boxH / 2, boxW, boxH, style.boxRadius ?? 10);
            ctx.fill();
            if (style.boxBorder) {
              ctx.strokeStyle = style.boxBorder;
              ctx.lineWidth = style.boxBorderWidth ?? 1;
              ctx.stroke();
            }
          }

          words.forEach((w, i) => {
            const isH = s.highlightWords?.some(
              (kw: string) => w.toLowerCase().includes(kw.toLowerCase())
            ) || i === 0;
            ctx.fillStyle = isH
              ? (i % 2 === 0 ? '#FBFF00' : '#FF00FF')
              : (style.textColor || '#FFFFFF');
            ctx.fillText(w, curX + measured[i] / 2, y);
            curX += measured[i] + spaceW;
          });

          ctx.shadowBlur = 0;

          if (s.id !== lastSubId) onSubtitleChange(s.id);
        }

        // ── CAPTURE CONFIRMATION ────────────────────────────────────────
        // Ensure the browser has painted the frame to the canvas surface,
        // then signal the capture stream to grab this exact frame.
        await new Promise((r) => requestAnimationFrame(r));

        if (useRequestFrame) {
          const track = canvasStream.getVideoTracks()[0];
          if (track && typeof (track as any).requestFrame === 'function') {
            (track as any).requestFrame();
          }
        }

        // Wait for the encoder to consume the frame. Without this, the
        // MediaRecorder can drop frames or produce empty chunks.
        await wait(FRAME_CAPTURE_DELAY_MS);

        // ── PROGRESS ────────────────────────────────────────────────────
        const progress = Math.min(99, Math.round((currentFrame / totalFrames) * 100));
        onProgress(progress);

        // ── MEMORY CLEANUP (per frame) ──────────────────────────────────
        ctx.clearRect(0, 0, W, H);
        currentFrame++;

        // ── TIMING ─────────────────────────────────────────────────────
        const elapsed = performance.now() - frameStartTime;
        const targetInterval = 1000 / FPS;
        const remaining = targetInterval - elapsed;
        if (remaining > 0) {
          await wait(remaining);
        }

        renderNextFrame();
      };

      const finishRender = async () => {
        recorder.stop();

        await new Promise<void>((res) => {
          recorder.onstop = () => {
            const finalBlob = new Blob(chunks, { type: mimeType });

            // ── FULL MEMORY DISPOSAL ────────────────────────────────────
            video.pause();
            video.removeAttribute('src');
            video.load();
            video.remove();

            ctx.clearRect(0, 0, W, H);
            canvas.width = 0;
            canvas.height = 0;

            if (musicEl) {
              musicEl.pause();
              musicEl.src = '';
              musicEl.load();
            }
            videoGain.disconnect();
            videoSource.disconnect();
            audioCtx.close().catch(() => {});

            canvasStream.getTracks().forEach((t) => t.stop());
            combinedStream.getTracks().forEach((t) => t.stop());

            resolve(finalBlob);
          };
        });

        onProgress(100);
      };

      // Kick off
      renderNextFrame();

    } catch (err) {
      abort(err);
    }
  });
}

/**
 * @deprecated Kept for import compatibility. Throws to prevent accidental use.
 */
export async function renderVideoInBrowserLegacy(
  _project: VideoProject,
  _onProgress: (progress: number) => void,
  _activeClipId: string | null = null
): Promise<Blob> {
  throw new Error(
    'renderVideoInBrowserLegacy is removed. Use renderVideoInBrowser() for the zero-cost browser forge.'
  );
}
