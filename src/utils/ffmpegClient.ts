import { VideoProject, getCaptionStyles } from '../types';
import { FREE_MUSIC_TRACKS } from '../data';
import { playViralSFX } from './sfx';

// ─── Renderer Configuration ───────────────────────────────────────────────
const FPS = 30;
const W = 1080;
const H = 1920;
const CANVAS_BITRATE = 4_000_000; // 4 Mbps — stable on mobile, crisp text
const FRAME_CAPTURE_DELAY_MS = 12; // tiny paint settle, not a throttle
const SEEK_THRESHOLD = 0.15; // only seek if drift exceeds 150ms

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
      resolve();
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

// ─── Main Renderer ─────────────────────────────────────────────────────────

export async function renderVideoInBrowser(
  project: VideoProject,
  onProgress: (progress: number) => void,
  activeClipId: string | null = null
): Promise<{ blob: Blob; extension: string }> {
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

      await new Promise<void>((res, rej) => {
        const t = setTimeout(() => rej(new Error('Video load timeout (15s)')), 15000);
        video.onloadedmetadata = () => { clearTimeout(t); res(); };
        video.onerror = () => { clearTimeout(t); rej(new Error('Failed to load video source')); };
        video.load();
      });

      // ── 2. CANVAS + STREAM SETUP ─────────────────────────────────────
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      // iOS/Safari need MP4 for Photos compatibility.
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || '') || 
                    (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
      
      let mimeType: string;
      if (isIOS) {
        mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 
                   MediaRecorder.isTypeSupported('video/mp4; codecs=avc1') ? 'video/mp4; codecs=avc1' :
                   getBestMimeType();
      } else {
        mimeType = getBestMimeType();
      }
      
      if (!mimeType) throw new Error('No supported MediaRecorder mimeType');

      const fileExtension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
      const canvasStream = canvas.captureStream(FPS);

      // ── 3. AUDIO BUS ──────────────────────────────────────────────────
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const audioDest = audioCtx.createMediaStreamDestination();

      // Resume audio context immediately (user gesture already happened via button click)
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      // On iOS Safari, createMediaElementSource on a muted video produces silence.
      // Workaround: route audio through a separate Audio element so the source is unmuted.
      let videoAudioEl: HTMLAudioElement | null = null;
      let videoSource: AudioNode | null = null;
      let videoGain: GainNode | null = null;
      try {
        if (isIOS) {
          videoAudioEl = new Audio(project.videoUrl);
          videoAudioEl.muted = false;
          videoAudioEl.volume = 1.0;
          videoAudioEl.loop = false;
          videoAudioEl.preload = 'auto';
          videoAudioEl.play().catch(() => {});
          videoSource = audioCtx.createMediaElementSource(videoAudioEl);
        } else {
          videoSource = audioCtx.createMediaElementSource(video);
        }
        videoGain = audioCtx.createGain();
        videoGain.gain.value = 1.0;
        (videoSource as AudioNode).connect(videoGain as AudioNode);
        (videoGain as AudioNode).connect(audioDest);
      } catch (e) {
        console.warn('[Forge] Video audio routing skipped (CORS or unsupported source). Rendering video-only.');
      }

      let musicEl: HTMLAudioElement | null = null;
      if (project.selectedMusicTrackId && project.selectedMusicTrackId !== 'none') {
        const track = FREE_MUSIC_TRACKS.find((t) => t.id === project.selectedMusicTrackId);
        if (track) {
          musicEl = new Audio(track.url);
          musicEl.crossOrigin = 'anonymous';
          musicEl.loop = true;
          musicEl.preload = 'auto';
          musicEl.volume = 1.0; // Web Audio will control gain
          musicEl.currentTime = 0;

          // Pre-seek and pre-load
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
          
          // Audio Handshake: ensure music is actually producing sound
          await new Promise<void>((res) => {
            const onPlaying = () => {
              musicEl!.removeEventListener('playing', onPlaying);
              clearTimeout(timer);
              res();
            };
            const timer = setTimeout(() => {
              musicEl!.removeEventListener('playing', onPlaying);
              res();
            }, 2000);
            musicEl!.addEventListener('playing', onPlaying);
            // Ensure AudioContext is running before play()
            if (audioCtx.state === 'suspended') audioCtx.resume();
            musicEl!.play().catch(() => {
              clearTimeout(timer);
              res();
            });
          }).catch(() => {});
        }
      }

      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioDest.stream.getAudioTracks(),
      ]);

      // ── 4. HIGHLIGHT SELECTION ────────────────────────────────────────
      const highlights = activeClipId === 'smart-cuts'
        ? project.highlights
        : activeClipId
          ? [project.highlights.find((h: any) => h.id === activeClipId)].filter(Boolean)
          : [{ start: 0, end: video.duration || 30, duration: video.duration || 30 }];

      const totalDuration = (highlights as Array<{ duration?: number; start?: number; end?: number }>).reduce(
        (s, h) => s + (h.duration || ((h.end ?? 0) - (h.start ?? 0)) || 0),
        0
      );
      const totalFrames = Math.max(1, Math.floor(totalDuration * FPS));

      // ── 5. START RECORDER + WARM-UP ──────────────────────────────────
      const createRecorder = (stream: MediaStream) => {
        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: CANVAS_BITRATE,
        });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e: BlobEvent) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        return { recorder, chunks };
      };

      let recorder: MediaRecorder;
      let chunks: Blob[] = [];
      let useNoAudio = false;

      // Try with audio first
      try {
        const setup = createRecorder(combinedStream);
        recorder = setup.recorder;
        chunks = setup.chunks;
        recorder.start(100);

        // Light warm-up: 3 frames to prime encoder, no long sleeps
        for (let i = 0; i < 3; i++) {
          ctx.clearRect(0, 0, W, H);
          ctx.drawImage(video, 0, 0, W, H);
          await new Promise((r) => requestAnimationFrame(r));
        }

        // Start-Gate: wait for first chunk (3s)
        await new Promise<void>((res, rej) => {
          const timer = setTimeout(() => {
            if (chunks.length === 0) {
              rej(new Error('Start-Gate timeout: no data from combined stream.'));
            } else {
              res();
            }
          }, 3000);

          const checkGate = () => {
            if (chunks.length > 0) {
              clearTimeout(timer);
              res();
            }
          };

          const originalHandler = recorder.ondataavailable;
          recorder.ondataavailable = (e: BlobEvent) => {
            if (e.data.size > 0) checkGate();
            if (originalHandler) originalHandler.call(recorder, e);
          };
        });
      } catch (gateError: any) {
        console.warn('[Forge] Audio stream failed, falling back to video-only:', gateError?.message);
        useNoAudio = true;

        const noAudioStream = new MediaStream(canvasStream.getVideoTracks());
        const setup = createRecorder(noAudioStream);
        recorder = setup.recorder;
        chunks = setup.chunks;
        recorder.start(100);

        for (let i = 0; i < 3; i++) {
          ctx.clearRect(0, 0, W, H);
          ctx.drawImage(video, 0, 0, W, H);
          await new Promise((r) => requestAnimationFrame(r));
        }

        await new Promise<void>((res, rej) => {
          const timer = setTimeout(() => {
            if (chunks.length === 0) {
              rej(new Error('Stream-Legacy fallback failed: no data from canvas stream.'));
            } else {
              res();
            }
          }, 3000);

          const checkGate = () => {
            if (chunks.length > 0) {
              clearTimeout(timer);
              res();
            }
          };

          const originalHandler = recorder.ondataavailable;
          recorder.ondataavailable = (e: BlobEvent) => {
            if (e.data.size > 0) checkGate();
            if (originalHandler) originalHandler.call(recorder, e);
          };
        });
      }

      onProgress(1);

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
        if (project.sfxPopEnabled && !useNoAudio) {
          playViralSFX('pop', audioDest);
        }
        lastSubId = subId;
      };

      // Guard against zero-duration highlights causing infinite seek loops
      const safeHighlights = highlights.filter((h) => (h.duration || (h.end - h.start)) > 0.05);

      const renderNextFrame = async () => {
        try {
          if (cancelled || currentFrame >= totalFrames) {
            await finishRender();
            return;
          }

          const frameStartTime = performance.now();
          const globalT = getGlobalTime(currentFrame);

          // ── PAUSE + SEEK ────────────────────────────────────────────────
          // Only seek if drift exceeds threshold — avoids per-frame seeking jank
          if (Math.abs(video.currentTime - globalT) > SEEK_THRESHOLD) {
            video.pause();
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
          await new Promise((r) => requestAnimationFrame(r));
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
        } catch (frameErr) {
          console.error('[Forge] Frame error:', frameErr);
          if (!cancelled && currentFrame < totalFrames) {
            // Try to continue with next frame instead of crashing
            currentFrame++;
            renderNextFrame();
          } else {
            await finishRender();
          }
        }
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

            if (videoAudioEl) {
              videoAudioEl.pause();
              videoAudioEl.removeAttribute('src');
              videoAudioEl.load();
              videoAudioEl.remove();
            }

            ctx.clearRect(0, 0, W, H);
            canvas.width = 0;
            canvas.height = 0;

            if (musicEl) {
              musicEl.pause();
              musicEl.src = '';
              musicEl.load();
            }
            if (videoGain) videoGain.disconnect();
            if (videoSource) videoSource.disconnect();
            audioCtx.close().catch(() => {});

            canvasStream.getTracks().forEach((t) => t.stop());
            combinedStream.getTracks().forEach((t) => t.stop());

            resolve({ blob: finalBlob, extension: fileExtension });
          };
        });

        onProgress(100);
      };

      // Kick off the render loop
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
