import { VideoProject, getCaptionStyles } from '../types';
import { FREE_MUSIC_TRACKS } from '../data';
import { playViralSFX } from './sfx';

// ─── Renderer Configuration ───────────────────────────────────────────────
const FPS = 30;
let W = 1080;
let H = 1920;
const CANVAS_BITRATE_MAP: Record<string, number> = {
  draft: 1_000_000, // 1 Mbps
  standard: 2_000_000, // 2 Mbps
  high: 4_000_000, // 4 Mbps — stable on mobile, crisp text
  pro: 8_000_000, // 8 Mbps
};
const FRAME_CAPTURE_DELAY_MS = 12; // tiny paint settle, not a throttle
const SEEK_THRESHOLD = 0.15; // only seek if drift exceeds 150ms

// ─── Helpers ──────────────────────────────────────────────────────────────

function waitForSeeked(el: HTMLVideoElement | HTMLAudioElement, timeoutMs = 1500): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      el.removeEventListener('seeked', onSeeked);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      el.removeEventListener('seeked', onSeeked);
      resolve();
    }, timeoutMs);
    el.addEventListener('seeked', onSeeked);
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
  activeClipId: string | null = null,
  segments?: Array<{ start: number; end: number; speed?: number }>,
  aspectRatio: '9:16' | '16:9' | '1:1' = '9:16',
  exportQuality?: VideoProject['exportQuality'],
  exportFormat?: VideoProject['exportFormat']
): Promise<{ blob: Blob; extension: string; valid: boolean }> {
  return new Promise(async (resolve, reject) => {
    let cancelled = false;
    const abort = (err: unknown) => {
      if (cancelled) return;
      cancelled = true;
      reject(err);
    };

    try {
      // Feature detection
      if (typeof MediaRecorder === 'undefined') {
        throw new Error('MediaRecorder API not supported in this browser');
      }

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
      if (aspectRatio === '16:9') {
        W = 1920;
        H = 1080;
      } else if (aspectRatio === '1:1') {
        W = 1080;
        H = 1080;
      } else {
        W = 1080;
        H = 1920;
      }

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      // iOS/Safari need MP4 for Photos compatibility.
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || '') || 
                    (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
      
      const effectiveFormat = exportFormat === 'mov' ? 'mp4' : (exportFormat || 'mp4');
      
      let mimeType: string;
      if (effectiveFormat === 'webm') {
        mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9') ? 'video/webm; codecs=vp9' :
                   MediaRecorder.isTypeSupported('video/webm; codecs=vp8') ? 'video/webm; codecs=vp8' :
                   MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' :
                   getBestMimeType();
      } else if (isIOS) {
        mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 
                   MediaRecorder.isTypeSupported('video/mp4; codecs=avc1') ? 'video/mp4; codecs=avc1' :
                   getBestMimeType();
      } else {
        mimeType = getBestMimeType();
      }
      
      if (!mimeType) throw new Error('No supported MediaRecorder mimeType');

      const fileExtension = effectiveFormat;
      const canvasStream = canvas.captureStream(FPS);

      // ── 3. AUDIO BUS ──────────────────────────────────────────────────
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (typeof AudioCtx !== 'function') throw new Error('AudioContext not supported');
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


      // ── 5. START RECORDER + WARM-UP ──────────────────────────────────
      const qualityBitrate = CANVAS_BITRATE_MAP[exportQuality || 'high'] || CANVAS_BITRATE_MAP['high'];
      
      const createRecorder = (stream: MediaStream) => {
        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: qualityBitrate,
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

      // ── 6. SMOOTH NATURAL-PLAYBACK RENDER LOOP ─────────────────────────
      // Select highlights based on activeClipId (same logic as before)
      const selectedHighlights = activeClipId === 'smart-cuts'
        ? project.highlights
        : activeClipId
          ? [project.highlights.find((h: any) => h.id === activeClipId)].filter(Boolean)
          : [{ start: 0, end: video.duration || 30, duration: video.duration || 30 }];
      
      // Guard against zero-duration highlights causing infinite loops
      const safeHighlights = selectedHighlights.filter((h) => (h.duration || (h.end - h.start)) > 0.05);
      
      // If no valid highlights, render full video
      if (safeHighlights.length === 0) {
        safeHighlights.push({ start: 0, end: video.duration || 30, duration: video.duration || 30 });
      }
      
      // Recalculate total frames based on selected highlights (includes transition frames)
      const totalDuration = safeHighlights.reduce(
        (s, h) => s + (h.duration || (h.end - h.start)),
        0
      );
      const transitionFrames = safeHighlights.length > 1 ? (safeHighlights.length - 1) * 16 : 0; // 8 fade in + 8 fade out per transition
      const totalFrames = Math.max(1, Math.floor(totalDuration * FPS) + transitionFrames);

      let currentFrame = 0;
      let lastSubId: string | null = null;
      let cancelled = false;

      const onSubtitleChange = (subId: string) => {
        if (project.sfxPopEnabled && !useNoAudio) {
          playViralSFX('pop', audioDest);
        }
        lastSubId = subId;
      };

      const renderSegment = async (h: any): Promise<number> => {
        const segStart = h.start;
        const segEnd = h.end;
        const segDuration = h.duration || (h.end - h.start);
        const segFrames = Math.max(1, Math.floor(segDuration * FPS));
        
        // Seek to segment start (both video and audio element on iOS)
        video.pause();
        video.currentTime = segStart;
        if (videoAudioEl) {
          videoAudioEl.currentTime = segStart;
        }
        await waitForSeeked(video, 1000);
        if (videoAudioEl) {
          await waitForSeeked(videoAudioEl, 1000);
        }
        
        // Small settle time after seek
        await wait(100);
        
        // Play video naturally for this segment
        await video.play().catch(() => {});
        if (videoAudioEl) {
          await videoAudioEl.play().catch(() => {});
        }
        
        let framesDrawn = 0;
        const segmentStartTime = performance.now();
        
        for (let f = 0; f < segFrames; f++) {
          if (cancelled) break;
          
          const expectedTime = segStart + (f / FPS);
          const actualTime = video.currentTime;
          
          // If video drifts too far ahead or behind, re-sync both video and audio
          if (Math.abs(actualTime - expectedTime) > 0.3) {
            video.pause();
            video.currentTime = expectedTime;
            if (videoAudioEl) {
              videoAudioEl.currentTime = expectedTime;
            }
            await waitForSeeked(video, 800);
            if (videoAudioEl) {
              await waitForSeeked(videoAudioEl, 800);
            }
            await video.play().catch(() => {});
            if (videoAudioEl) {
              await videoAudioEl.play().catch(() => {});
            }
          }
          
          // Wait for video to be ready
          if (video.readyState < 2) {
            await new Promise((r) => {
              video.addEventListener('loadeddata', r, { once: true });
              setTimeout(r, 500);
            });
          }
          
          const globalT = video.currentTime;
          
          // ── DRAW FRAME ─────────────────────────────────────────────────
          ctx.clearRect(0, 0, W, H);
          ctx.drawImage(video, 0, 0, W, H);

          // Color grade overlay (canvas 2D composite, not CSS filter)
          if (project.enableColorGrade && project.colorGrade && project.colorGrade !== 'none') {
            ctx.globalCompositeOperation = 'overlay';
            ctx.globalAlpha = 0.22;
            const gradeColors: Record<string, string> = {
              cinematic: '#1a3a5c',
              warm_vintage: '#5c3a1a',
              vibrant_pop: '#5c1a3a',
              moody_cyber: '#1a1a2e',
              film_noir: '#000000',
              neon_nights: '#1a0a2e',
              golden_hour: '#5c4a1a',
            };
            ctx.fillStyle = gradeColors[project.colorGrade] || 'transparent';
            ctx.fillRect(0, 0, W, H);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1.0;
          }

          // Blur regions
          if (project.blurRegions?.length) {
            for (const blur of project.blurRegions) {
              ctx.save();
              ctx.filter = `blur(${blur.blurAmount}px)`;
              ctx.drawImage(
                video,
                (blur.x / 100) * W,
                (blur.y / 100) * H,
                (blur.width / 100) * W,
                (blur.height / 100) * H,
                (blur.x / 100) * W,
                (blur.y / 100) * H,
                (blur.width / 100) * W,
                (blur.height / 100) * H
              );
              ctx.restore();
            }
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

          // Subtitles - using getCaptionStyles for consistent colors
          const s = project.subtitles?.find(
            (i: any) => globalT >= i.start && globalT <= i.end
          );
          if (s && project.enableSubtitles) {
            const style = getCaptionStyles(project.captionStyle || 'hormozi', s.text.length, W);

            ctx.font = `900 ${style.fontSize}px ${style.fontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const x = W / 2;
            const y = H * (style.yPositionFraction || 0.78);
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
                ? (style.highlightColor || '#FBFF00')
                : (style.textColor || '#FFFFFF');
              ctx.fillText(w, curX + measured[i] / 2, y);
              curX += measured[i] + spaceW;
            });

            ctx.shadowBlur = 0;

            if (s.id !== lastSubId) onSubtitleChange(s.id);
          }

          // ── CAPTURE FRAME ────────────────────────────────────────────────
          await new Promise((r) => requestAnimationFrame(r));
          await wait(FRAME_CAPTURE_DELAY_MS);

          // ── PROGRESS ────────────────────────────────────────────────────
          currentFrame++;
          framesDrawn++;
          const overallProgress = Math.min(95, Math.round((currentFrame / totalFrames) * 100));
          onProgress(overallProgress);

          // Small timing buffer to keep FPS steady
          const frameElapsed = performance.now() - segmentStartTime;
          const expectedElapsed = (f / FPS) * 1000;
          const remaining = expectedElapsed - frameElapsed;
          if (remaining > 0) {
            await wait(remaining);
          }
        }
        
        // Pause video at end of segment (but keep audio playing for smooth transitions)
        video.pause();
        // Note: intentionally NOT pausing videoAudioEl so audio continues through fades
        return framesDrawn;
      };

      // Render each highlight segment with fade transitions
      for (let i = 0; i < safeHighlights.length; i++) {
        if (cancelled) break;
        
        // Fade in from black at start of first segment or after a cut
        if (i > 0) {
          for (let fade = 0; fade < 8; fade++) {
            ctx.fillStyle = `rgba(0,0,0,${1 - fade / 8})`;
            ctx.fillRect(0, 0, W, H);
            await new Promise((r) => requestAnimationFrame(r));
            await wait(FRAME_CAPTURE_DELAY_MS);
            currentFrame++;
          }
        }
        
        await renderSegment(safeHighlights[i]);
        
        // Fade to black between segments (except last)
        if (i < safeHighlights.length - 1) {
          for (let fade = 0; fade < 8; fade++) {
            ctx.fillStyle = `rgba(0,0,0,${fade / 8})`;
            ctx.fillRect(0, 0, W, H);
            await new Promise((r) => requestAnimationFrame(r));
            await wait(FRAME_CAPTURE_DELAY_MS);
            currentFrame++;
          }
        }
      }

      // ── FINALIZE ─────────────────────────────────────────────────────
        const finishRender = async (): Promise<{ blob: Blob; extension: string; valid: boolean }> => {
          video.pause();
          recorder.stop();

          const result = await new Promise<{ blob: Blob; extension: string; valid: boolean }>((res) => {
            recorder.onstop = () => {
              const finalBlob = new Blob(chunks, { type: mimeType });

              // Validate output before returning (Kilo reliability)
              const isValid = finalBlob.size > 500_000;
              if (!isValid) {
                console.warn('[Forge] Output validation failed: blob too small', finalBlob.size);
              }

              // ── FULL MEMORY DISPOSAL ────────────────────────────────────
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

              res({ blob: finalBlob, extension: fileExtension, valid: isValid });
            };
          });

          onProgress(100);
          return result;
        };

        const result = await finishRender();
        if (!result.valid) {
          throw new Error('Browser render produced an invalid output file (too small).');
        }
        resolve(result);

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
