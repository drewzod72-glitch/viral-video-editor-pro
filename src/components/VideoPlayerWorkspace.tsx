import React, { useRef, useState, useEffect, useCallback } from 'react';
import { VideoProject, getCaptionStyles, AspectRatio, BrollClip } from '../types';
import { FREE_MUSIC_TRACKS, STOCK_FOOTAGE_BROLL } from '../data';
import { ThumbnailGenerator } from './ThumbnailGenerator';
import { playViralSFX } from '../utils/sfx';
import { LUT_PRESETS, TRANSITION_PRESETS } from '../utils/ffmpegWasmRenderer';
import { Play, Pause, SkipBack, SkipForward, Heart, MessageCircle, Share2, Music, Pause as PauseIcon, CheckCircle, Square, Flame, Coffee, Clapperboard, Disc, Wand2, Command, X } from 'lucide-react';
import { colors, borderRadius, INTER, statusColors, TRANSITION, tint } from '../utils/styles';

const fixDunikTypo = (str: string) => str?.replace(/dunik/gi, 'Dunk') || '';

const MOOD_CATEGORIES = [
  { key: 'hype', label: 'Hype', icon: <Flame size={14} color={statusColors.warning} />, color: statusColors.warning },
  { key: 'lofi', label: 'Lofi', icon: <Coffee size={14} color={statusColors.warning} />, color: statusColors.warning },
  { key: 'cinematic', label: 'Cinematic', icon: <Clapperboard size={14} color={colors.primary} />, color: colors.primary },
  { key: 'chill', label: 'Tech / Chill', icon: <Disc size={14} color={statusColors.cyan} />, color: statusColors.cyan },
] as const;

export default function VideoPlayerWorkspace({ project, activeMusicTrack, activeClipId, onClipSelect, onUpdateProject, aspectRatio, onUpdateAspectRatio, commandInput, onCommandChange, onCommandKeyDown, commandSuggestions, onCommandSubmit, voiceoverText, onGenerateVoiceover, isGeneratingVoiceover, brollClips, reframeAnalysis, onRunReframeAnalysis, isAnalyzingReframe, selectedReframe, onApplyReframe, imageGenPrompt, onImageGenPromptChange, imageGenModel, onImageGenModelChange, imageGenAspect, onImageGenAspectChange, isGeneratingImage, onGenerateImage, generatedImages, onSelectImage, blurRegions, onAddBlurRegion, onRemoveBlurRegion, enableFaceBlur, onToggleFaceBlur, exportQuality, onUpdateExportQuality, exportFormat, onUpdateExportFormat, onTriggerExport, onNewProject }: any) {
  if (!project) return null;

  const {
    enableSubtitles = true,
    enableZooms = true,
    musicVolume = 0.4,
    enableColorGrade = true,
    shakeOnPunch = true,
    autoZoomPunch = true
  } = project;

  const activeHighlights = project.highlights || [];
  const updateSettings = (up: any) => onUpdateProject({ ...project, ...up });

  const vRef = useRef<HTMLVideoElement>(null);
  const aRef = useRef<HTMLAudioElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeSub, setActiveSub] = useState<any>(null);
  const [lastSubId, setLastSubId] = useState<string | null>(null);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [volume, setVolume] = useState(musicVolume);
  const [showSafeZone, setShowSafeZone] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [musicMood, setMusicMood] = useState<string>('hype');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [thumbnails, setThumbnails] = useState<string[]>([]);

  // Refs for the master sync loop to avoid stale closures
  const playingRef = useRef(playing);
  const isDraggingRef = useRef(isDragging);
  const currentZoomRef = useRef(currentZoom);
  const projectRef = useRef(project);
  const activeClipIdRef = useRef(activeClipId);
  const lastSubIdRef = useRef(lastSubId);
  const activeHighlightsRef = useRef(activeHighlights);
  const enableZoomsRef = useRef(enableZooms);
  const autoZoomPunchRef = useRef(autoZoomPunch);
  const sfxPopEnabledRef = useRef(project.sfxPopEnabled);

  // Keep refs in sync with state
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);
  useEffect(() => { currentZoomRef.current = currentZoom; }, [currentZoom]);
  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => { activeClipIdRef.current = activeClipId; }, [activeClipId]);
  useEffect(() => { lastSubIdRef.current = lastSubId; }, [lastSubId]);
  useEffect(() => { activeHighlightsRef.current = activeHighlights; }, [activeHighlights]);
  useEffect(() => { enableZoomsRef.current = enableZooms; }, [enableZooms]);
  useEffect(() => { autoZoomPunchRef.current = autoZoomPunch; }, [autoZoomPunch]);
  useEffect(() => { sfxPopEnabledRef.current = project.sfxPopEnabled; }, [project.sfxPopEnabled]);

  const currentHighlight = activeClipId
    ? activeHighlights.find((h: any) => h.id === activeClipId)
    : null;
  const clipStart = currentHighlight?.start ?? 0;
  const clipEnd = currentHighlight?.end ?? duration;
  const clipDuration = clipEnd - clipStart || duration;

  const filteredTracks = FREE_MUSIC_TRACKS.filter(t => t.intensity === musicMood);

  // UI Heartbeat: force time update every 500ms for smooth slider
  useEffect(() => {
    const heartbeat = setInterval(() => {
      if (vRef.current && playingRef.current && !isDraggingRef.current) {
        setTime(vRef.current.currentTime);
      }
    }, 500);
    return () => clearInterval(heartbeat);
  }, []);

  // MASTER SYNC LOOP - uses refs to avoid stale closures and unnecessary restarts
  useEffect(() => {
    let raf: number;
    const loop = () => {
      const v = vRef.current;
      if (v && playingRef.current && !isDraggingRef.current) {
        const t = v.currentTime;
        setTime(t);

        const proj = projectRef.current;
        const s = proj.subtitles?.find((i: any) => t >= i.start && t <= i.end);
        if (s?.id !== lastSubIdRef.current) {
          setActiveSub(s || null);
          setLastSubId(s?.id || null);
          if (s && sfxPopEnabledRef.current) playViralSFX('pop', undefined, audioCtxRef.current || undefined);
        }

        let zScale = 1.0;
        if (enableZoomsRef.current) {
          const zoom = proj.zoomEffects?.find((z: any) => t >= z.timestamp && t <= z.timestamp + z.duration);
          zScale = zoom ? zoom.scale : (autoZoomPunchRef.current && s ? 1.22 : 1.0);
        }
        if (currentZoomRef.current !== zScale) setCurrentZoom(zScale);

        const highlights = activeHighlightsRef.current;
        const currentClip = activeClipIdRef.current;
        
        // If no specific clip selected, skip cut zones and play through highlights
        if (!currentClip && highlights.length > 0) {
          const sorted = [...highlights].sort((a: any, b: any) => a.start - b.start);
          let inCut = false;
          let nextStart = t;
          
          for (const h of sorted) {
            if (t >= h.start && t <= h.end) {
              inCut = false;
              break;
            }
            if (t > h.end) {
              nextStart = h.end;
            }
            if (t < h.start) {
              inCut = true;
              nextStart = h.start;
              break;
            }
          }
          
          if (inCut && nextStart > t) {
            v.currentTime = nextStart;
            setTime(nextStart);
          }
        } else {
          // Loop within current clip
          const hl = highlights.find((h: any) => h.id === currentClip);
          if (hl && t >= hl.end && (hl.end - hl.start) > 0.05) {
            v.currentTime = hl.start;
            setTime(hl.start);
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []); // Empty deps - loop runs forever, reads from refs

  // AUDIO LOCK - hard-locked music bus
  useEffect(() => {
    if (!aRef.current) return;
    if (activeMusicTrack && playing) {
      if (aRef.current.src !== activeMusicTrack.url) {
        aRef.current.src = activeMusicTrack.url;
        aRef.current.load();
      }
      aRef.current.volume = volume;
      aRef.current.play().catch(() => {});
    } else {
      aRef.current.pause();
    }
  }, [playing, activeMusicTrack, volume]);

  // Ensure AudioContext exists and is resumed for SFX
  useEffect(() => {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!audioCtxRef.current && AudioCtx) {
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, []);

  // Generate clip thumbnails when highlights or video URL changes
  useEffect(() => {
    if (!project.videoUrl || activeHighlights.length === 0) {
      setThumbnails([]);
      return;
    }

    let cancelled = false;
    const generateThumbnails = async () => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.preload = 'auto';
      video.src = project.videoUrl;

      const canvas = document.createElement('canvas');
      canvas.width = 40;
      canvas.height = 22;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const urls: string[] = [];

      try {
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = () => reject(new Error('Video load failed for thumbnails'));
        });

        for (const h of activeHighlights) {
          const midTime = (h.start + h.end) / 2;
          if (midTime < 0 || midTime > video.duration) continue;

          video.currentTime = midTime;
          await new Promise<void>((resolve) => {
            video.onseeked = () => resolve();
          });

          ctx.drawImage(video, 0, 0, 40, 22);
          urls.push(canvas.toDataURL('image/jpeg', 0.7));
        }
      } catch (e) {
        console.warn('[VideoPlayer] Thumbnail generation failed:', e);
      } finally {
        video.src = '';
        if (!cancelled) setThumbnails(urls);
      }
    };

    generateThumbnails();
    return () => { cancelled = true; };
  }, [project.videoUrl, activeHighlights.length, activeHighlights.map((h: any) => h.start).join(',')]);

  // Load video duration
  useEffect(() => {
    const v = vRef.current;
    if (!v) return;
    const onMeta = () => setDuration(v.duration);
    v.addEventListener('loadedmetadata', onMeta);
    return () => v.removeEventListener('loadedmetadata', onMeta);
  }, [project.videoUrl]);

  // Sync loop restart trigger when project changes
  useEffect(() => {
    // Force UI heartbeat when project updates (e.g., after AI edit)
    setTime(vRef.current?.currentTime ?? 0);
  }, [project.subtitles, project.highlights, activeClipId]);

  // Timeline scrubber
  const handleTimelineInteraction = useCallback((clientX: number) => {
    if (!timelineRef.current || !vRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const windowDuration = timelineZoom > 1 ? duration / timelineZoom : duration;
    const clampedWindow = Math.max(0.1, Math.min(duration, windowDuration));
    const windowStart = Math.max(0, Math.min(duration - clampedWindow, time - clampedWindow / 2));
    const newTime = windowStart + pct * clampedWindow;
    vRef.current.currentTime = Math.max(0, Math.min(duration, newTime));
    setTime(Math.max(0, Math.min(duration, newTime)));
  }, [clipStart, clipDuration, duration, time, timelineZoom]);

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    handleTimelineInteraction(e.clientX);
  }, [handleTimelineInteraction]);

  const handleTimelineTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    setIsDragging(true);
    handleTimelineInteraction(e.touches[0].clientX);
  }, [handleTimelineInteraction]);

  const handleTimelineTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      handleTimelineInteraction(e.touches[0].clientX);
    }
  }, [handleTimelineInteraction]);

  const handleTimelineTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const toggle = useCallback(async () => {
    if (!vRef.current) return;
    if (vRef.current.paused) {
      try {
        await vRef.current.play();
        setPlaying(true);
      } catch (e) {
        console.warn('[VideoPlayer] Play failed:', e);
        setPlaying(false);
      }
    } else {
      vRef.current.pause();
      setPlaying(false);
    }
  }, []);

  const skip = useCallback((delta: number) => {
    if (!vRef.current) return;
    const newTime = Math.max(0, Math.min(duration, vRef.current.currentTime + delta));
    vRef.current.currentTime = newTime;
    setTime(newTime);
  }, [duration]);

  const stepFrame = useCallback((direction: number) => {
    if (!vRef.current) return;
    const frameDuration = 1 / 30;
    const newTime = Math.max(0, Math.min(duration, vRef.current.currentTime + direction * frameDuration));
    vRef.current.currentTime = newTime;
    setTime(newTime);
  }, [duration]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          toggle();
          break;
        case 'arrowleft':
          e.preventDefault();
          if (e.shiftKey) {
            stepFrame(-1);
          } else {
            skip(-5);
          }
        case 'arrowright':
          e.preventDefault();
          if (e.shiftKey) {
            stepFrame(1);
          } else {
            skip(5);
          }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [toggle, skip]);

  const windowDuration = timelineZoom > 1 ? duration / timelineZoom : duration;
  const clampedWindow = Math.max(0.1, Math.min(duration, windowDuration));
  const windowStart = Math.max(0, Math.min(duration - clampedWindow, time - clampedWindow / 2));
  const progressPct = duration > 0 ? Math.max(0, Math.min(100, ((time - windowStart) / clampedWindow) * 100)) : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', paddingBottom: '40px' }}>
      {/* Preview Stage */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(24,24,27,0.95) 0%, rgba(9,9,11,0.98) 100%)',
        padding: '20px',
        borderRadius: '24px',
        border: '1px solid rgba(30,41,59,0.6)',
        backdropFilter: 'blur(16px)'
      }}>
        <button
          onClick={onTriggerExport}
          style={{
            width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
            background: 'linear-gradient(135deg, #EC4899, #db2777)',
            color: 'white', fontWeight: 900, fontSize: '12px',
            fontFamily: '"Inter", sans-serif', textTransform: 'uppercase',
            letterSpacing: '0.8px', cursor: 'pointer',
            boxShadow: '0 8px 30px rgba(236,72,153,0.3)',
            transition: 'all 0.2s',
            marginBottom: '14px'
          }}
        >
          BAKE FINAL
        </button>

        {/* Toolbar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '14px', flexWrap: 'wrap', gap: '8px'
        }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            {onNewProject && (
              <button
                onClick={onNewProject}
                style={{
                  padding: '5px 10px', borderRadius: '8px',
                  border: '1px solid rgba(30,41,59,0.5)',
                  background: 'rgba(9,9,11,0.4)',
                  color: '#a1a1aa',
                  fontSize: '9px', fontWeight: 700,
                  cursor: 'pointer', fontFamily: '"Inter", sans-serif',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#e2e8f0';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#a1a1aa';
                  e.currentTarget.style.background = 'rgba(9,9,11,0.4)';
                }}
              >
                + New
              </button>
            )}
            <button
              onClick={() => setShowSafeZone(!showSafeZone)}
              style={{
                padding: '5px 10px', borderRadius: '8px',
                border: showSafeZone ? '1px solid rgba(251,255,0,0.4)' : '1px solid rgba(30,41,59,0.5)',
                background: showSafeZone ? 'rgba(251,255,0,0.08)' : 'rgba(9,9,11,0.4)',
                color: showSafeZone ? '#fbff00' : '#a1a1aa',
                fontSize: '9px', fontWeight: 700,
                cursor: 'pointer', fontFamily: '"Inter", sans-serif',
                textTransform: 'uppercase', letterSpacing: '0.5px',
                transition: 'all 0.2s'
              }}
            >
              {showSafeZone ? '🟡 Safe Zone' : '⬜ Safe Zone'}
            </button>
            <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
              {(['9:16', '16:9', '1:1'] as AspectRatio[]).map((ar) => (
                <button
                  key={ar}
                  onClick={() => onUpdateAspectRatio(ar)}
                  style={{
                    padding: '5px 10px', borderRadius: '8px',
                    border: aspectRatio === ar ? '1px solid rgba(236,72,153,0.5)' : '1px solid rgba(30,41,59,0.5)',
                    background: aspectRatio === ar ? 'rgba(236,72,153,0.15)' : 'rgba(9,9,11,0.4)',
                    color: aspectRatio === ar ? '#EC4899' : '#a1a1aa',
                    fontSize: '9px', fontWeight: 700,
                    cursor: 'pointer', fontFamily: '"Inter", sans-serif',
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                    transition: 'all 0.2s'
                  }}
                >
                  {ar === '9:16' ? '📱' : ar === '16:9' ? '🖥' : '⬜'} {ar}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
              {(['mrbeast', 'hormozi', 'minimalist', 'impact', 'comic'] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => onUpdateProject({ captionStyle: style })}
                  style={{
                    padding: '5px 10px', borderRadius: '8px',
                    border: (project.captionStyle || 'hormozi') === style ? '1px solid rgba(236,72,153,0.5)' : '1px solid rgba(30,41,59,0.5)',
                    background: (project.captionStyle || 'hormozi') === style ? 'rgba(236,72,153,0.15)' : 'rgba(9,9,11,0.4)',
                    color: (project.captionStyle || 'hormozi') === style ? '#EC4899' : '#a1a1aa',
                    fontSize: '9px', fontWeight: 700,
                    cursor: 'pointer', fontFamily: '"Inter", sans-serif',
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                    transition: 'all 0.2s'
                  }}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, fontFamily: '"JetBrains Mono", monospace' }}>
          {(() => {
            const h = Math.floor(time / 3600);
            const m = Math.floor((time % 3600) / 60);
            const s = Math.floor(time % 60);
            const f = Math.floor((time % 1) * 30);
            const hd = Math.floor(duration / 3600);
            const md = Math.floor((duration % 3600) / 60);
            const sd = Math.floor(duration % 60);
            const fd = Math.floor((duration % 1) * 30);
            return (
              <>
                {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}:{String(f).padStart(2, '0')}
                {' / '}
                {String(hd).padStart(2, '0')}:{String(md).padStart(2, '0')}:{String(sd).padStart(2, '0')}:{String(fd).padStart(2, '0')}
              </>
            );
          })()}
          </div>
        </div>

        {/* Export Settings */}
        <div style={{
          display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center',
          marginBottom: '12px', padding: '10px 14px',
          background: 'rgba(9,9,11,0.6)', borderRadius: '12px',
          border: '1px solid rgba(30,41,59,0.5)'
        }}>
          <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginRight: '4px' }}>Export</span>
          <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
            {([
              { key: 'draft' as const, label: 'Draft' },
              { key: 'standard' as const, label: 'Standard' },
              { key: 'high' as const, label: 'High' },
              { key: 'pro' as const, label: 'Pro' },
            ]).map(q => (
              <button
                key={q.key}
                onClick={() => onUpdateExportQuality?.(q.key)}
                style={{
                  padding: '5px 10px', borderRadius: '8px', border: 'none',
                  background: exportQuality === q.key ? 'rgba(236,72,149,0.25)' : 'rgba(9,9,11,0.4)',
                  color: exportQuality === q.key ? '#EC4899' : '#a1a1aa',
                  fontWeight: 700, fontSize: '9px', cursor: 'pointer',
                  fontFamily: '"Inter", sans-serif', textTransform: 'uppercase',
                  letterSpacing: '0.5px', transition: 'all 0.2s'
                }}
              >
                {q.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {([
              { key: 'mp4' as const, label: 'MP4' },
              { key: 'webm' as const, label: 'WebM' },
              { key: 'mov' as const, label: 'MOV' },
            ]).map(f => (
              <button
                key={f.key}
                onClick={() => onUpdateExportFormat?.(f.key)}
                style={{
                  padding: '5px 10px', borderRadius: '8px', border: 'none',
                  background: exportFormat === f.key ? 'rgba(6,182,212,0.25)' : 'rgba(9,9,11,0.4)',
                  color: exportFormat === f.key ? '#22d3ee' : '#a1a1aa',
                  fontWeight: 700, fontSize: '9px', cursor: 'pointer',
                  fontFamily: '"Inter", sans-serif', textTransform: 'uppercase',
                  letterSpacing: '0.5px', transition: 'all 0.2s'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Smart Reframe AI */}
        <div style={{
          display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center',
          marginBottom: '12px', padding: '10px 14px',
          background: 'rgba(9,9,11,0.6)', borderRadius: '12px',
          border: '1px solid rgba(30,41,59,0.5)'
        }}>
          <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginRight: '4px' }}>Reframe AI</span>
          <button
            onClick={onRunReframeAnalysis}
            disabled={isAnalyzingReframe}
            style={{
              padding: '5px 10px', borderRadius: '8px', border: 'none',
              background: isAnalyzingReframe ? 'rgba(236,72,149,0.1)' : 'rgba(236,72,149,0.2)',
              color: isAnalyzingReframe ? '#a1a1aa' : '#EC4899',
              fontWeight: 700, fontSize: '9px', cursor: isAnalyzingReframe ? 'not-allowed' : 'pointer',
              fontFamily: '"Inter", sans-serif', textTransform: 'uppercase',
              letterSpacing: '0.5px', transition: 'all 0.2s'
            }}
          >
            {isAnalyzingReframe ? 'Analyzing...' : 'Analyze Reframe'}
          </button>
          {reframeAnalysis && (
            <>
              <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                {(['9:16', '16:9', '1:1'] as const).map((ar) => (
                  <button
                    key={ar}
                    onClick={() => onApplyReframe(ar)}
                    style={{
                      padding: '5px 10px', borderRadius: '8px', border: 'none',
                      background: selectedReframe === ar ? 'rgba(236,72,153,0.25)' : 'rgba(9,9,11,0.4)',
                      color: selectedReframe === ar ? '#EC4899' : '#a1a1aa',
                      fontWeight: 700, fontSize: '9px', cursor: 'pointer',
                      fontFamily: '"Inter", sans-serif', textTransform: 'uppercase',
                      letterSpacing: '0.5px', transition: 'all 0.2s'
                    }}
                  >
                    {ar} {Math.round(reframeAnalysis.recommended[ar]?.score || 0)}
                  </button>
                ))}
              </div>
              {selectedReframe && (
                <button
                  onClick={() => onApplyReframe(selectedReframe)}
                  style={{
                    padding: '5px 10px', borderRadius: '8px', border: 'none',
                    background: 'rgba(236,72,153,0.3)', color: '#EC4899',
                    fontWeight: 700, fontSize: '9px', cursor: 'pointer',
                    fontFamily: '"Inter", sans-serif', textTransform: 'uppercase',
                    letterSpacing: '0.5px', transition: 'all 0.2s'
                  }}
                >
                  Apply
                </button>
              )}
            </>
          )}
        </div>

        {/* AI Image Generation */}
        <div style={{
          display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center',
          marginBottom: '12px', padding: '10px 14px',
          background: 'rgba(9,9,11,0.6)', borderRadius: '12px',
          border: '1px solid rgba(30,41,59,0.5)'
        }}>
          <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginRight: '4px' }}>AI Image</span>
          <input
            type="text"
            value={imageGenPrompt}
            onChange={(e) => onImageGenPromptChange(e.target.value)}
            placeholder="Describe your image..."
            style={{
              flex: 1, minWidth: '120px', padding: '6px 10px',
              background: '#020617', border: '1px solid #27272a',
              borderRadius: '8px', color: '#e4e4e7',
              fontSize: '9px', fontFamily: '"Inter", sans-serif',
              outline: 'none'
            }}
          />
          <select
            value={imageGenModel}
            onChange={(e) => onImageGenModelChange(e.target.value)}
            style={{
              padding: '6px 10px', background: '#020617', border: '1px solid #27272a',
              borderRadius: '8px', color: '#e4e4e7', fontSize: '9px',
              fontFamily: '"Inter", sans-serif', cursor: 'pointer'
            }}
          >
            <option value="flux">Flux</option>
            <option value="dalle">DALL-E</option>
            <option value="sd">Stable Diffusion</option>
          </select>
          <select
            value={imageGenAspect}
            onChange={(e) => onImageGenAspectChange(e.target.value)}
            style={{
              padding: '6px 10px', background: '#020617', border: '1px solid #27272a',
              borderRadius: '8px', color: '#e4e4e7', fontSize: '9px',
              fontFamily: '"Inter", sans-serif', cursor: 'pointer'
            }}
          >
            <option value="1:1">1:1</option>
            <option value="9:16">9:16</option>
            <option value="16:9">16:9</option>
          </select>
          <button
            onClick={onGenerateImage}
            disabled={isGeneratingImage || !imageGenPrompt}
            style={{
              padding: '5px 10px', borderRadius: '8px', border: 'none',
              background: isGeneratingImage ? 'rgba(236,72,149,0.1)' : 'rgba(236,72,149,0.2)',
              color: isGeneratingImage ? '#a1a1aa' : '#EC4899',
              fontWeight: 700, fontSize: '9px', cursor: isGeneratingImage || !imageGenPrompt ? 'not-allowed' : 'pointer',
              fontFamily: '"Inter", sans-serif', textTransform: 'uppercase',
              letterSpacing: '0.5px', transition: 'all 0.2s'
            }}
          >
            {isGeneratingImage ? 'Generating...' : 'Generate'}
          </button>
        </div>
        {generatedImages && generatedImages.length > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
            gap: '8px', marginBottom: '12px'
          }}>
            {generatedImages.map((img) => (
              <button
                key={img.id}
                onClick={() => onSelectImage(img)}
                style={{
                  padding: '4px', borderRadius: '8px',
                  border: '2px solid #27272a',
                  background: '#020617',
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <img src={img.url} alt="" style={{ width: '100%', aspectRatio: '1', borderRadius: '4px', objectFit: 'cover' }} />
                <div style={{ fontSize: '7px', color: '#64748b', marginTop: '2px', textTransform: 'uppercase' }}>{img.model}</div>
              </button>
            ))}
          </div>
        )}

        {/* Face Blur */}
        <div style={{
          display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center',
          marginBottom: '12px', padding: '10px 14px',
          background: 'rgba(9,9,11,0.6)', borderRadius: '12px',
          border: '1px solid rgba(30,41,59,0.5)'
        }}>
          <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginRight: '4px' }}>Face Blur</span>
          <button
            onClick={onToggleFaceBlur}
            style={{
              padding: '5px 10px', borderRadius: '8px', border: 'none',
              background: enableFaceBlur ? 'rgba(236,72,149,0.25)' : 'rgba(9,9,11,0.4)',
              color: enableFaceBlur ? '#EC4899' : '#a1a1aa',
              fontWeight: 700, fontSize: '9px', cursor: 'pointer',
              fontFamily: '"Inter", sans-serif', textTransform: 'uppercase',
              letterSpacing: '0.5px', transition: 'all 0.2s'
            }}
          >
            {enableFaceBlur ? 'Blur On' : 'Blur Off'}
          </button>
          <button
            onClick={onAddBlurRegion}
            style={{
              padding: '5px 10px', borderRadius: '8px', border: 'none',
              background: 'rgba(236,72,149,0.2)',
              color: '#EC4899',
              fontWeight: 700, fontSize: '9px', cursor: 'pointer',
              fontFamily: '"Inter", sans-serif', textTransform: 'uppercase',
              letterSpacing: '0.5px', transition: 'all 0.2s'
            }}
          >
            + Add Blur Region
          </button>
          {blurRegions && blurRegions.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {blurRegions.map((region, idx) => (
                <span key={region.id} style={{
                  padding: '2px 8px', borderRadius: '6px',
                  background: 'rgba(9,9,11,0.4)', border: '1px solid #27272a',
                  color: '#a1a1aa', fontSize: '9px', fontWeight: 700,
                  fontFamily: '"Inter", sans-serif', textTransform: 'uppercase',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}>
                  #{idx + 1}
                  <button
                    onClick={() => onRemoveBlurRegion(region.id)}
                    style={{
                      background: 'transparent', border: 'none', color: '#f87171',
                      cursor: 'pointer', fontSize: '10px', fontWeight: 800, padding: 0,
                      display: 'flex', alignItems: 'center'
                    }}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Preview Canvas */}
        <div style={{
          position: 'relative', width: '100%', maxWidth: '960px',
          aspectRatio: '16/9', background: '#000',
          margin: '0 auto', borderRadius: '12px', overflow: 'hidden',
          border: '1px solid #27272a',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}>
          <video
            ref={vRef}
            src={project.videoUrl}
            playsInline
            muted
            onLoadedMetadata={() => {
              if (vRef.current) setDuration(vRef.current.duration || 0);
            }}
            onCanPlay={() => {
              if (vRef.current && vRef.current.paused) {
                setPlaying(false);
              }
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() => {
              console.warn('[VideoPlayer] Video failed to load:', project.videoUrl);
              setPlaying(false);
            }}
            style={{
              width: '100%', height: '100%', objectFit: 'contain',
              background: '#000'
            }}
            className={enableColorGrade && project.colorGrade !== 'none' ? `filter-${project.colorGrade}` : ''}
          />

          {/* Subtitles */}
          {enableSubtitles && activeSub && (
            <div style={{
              position: 'absolute', bottom: '40px', left: 0, right: 0,
              padding: '0 24px', textAlign: 'center',
              pointerEvents: 'none', zIndex: 50
            }}>
              {(() => {
                const style = getCaptionStyles(project.captionStyle || 'hormozi', activeSub.text.length, 960);
                return (
                  <div style={{
                    background: style.boxBg || 'rgba(0,0,0,0.88)',
                    padding: `${style.boxPaddingY ?? 10}px ${style.boxPaddingX ?? 16}px`,
                    borderRadius: `${style.boxRadius ?? 10}px`,
                    border: style.boxBorder ? `${style.boxBorderWidth ?? 1}px solid ${style.boxBorder}` : '1px solid rgba(255,255,255,0.06)',
                    display: 'inline-block'
                  }}>
                    <p style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', margin: 0, justifyContent: 'center' }}>
                      {fixDunikTypo(activeSub.text).toUpperCase().split(' ').map((w: string, i: number) => {
                        const isHighlight = activeSub.highlightWords?.some(
                          (kw: string) => w.toLowerCase().includes(kw.toLowerCase())
                        ) || i === 0;
                        const isMinimalist = project.captionStyle === 'minimalist';
                        return (
                          <span key={i} style={{
                            color: isHighlight ? (style.highlightColor || '#FBFF00') : (style.textColor || '#FFFFFF'),
                            fontWeight: isMinimalist ? 500 : 900,
                            fontSize: '18px',
                            textShadow: style.strokeWidth && style.strokeColor
                              ? `0 0 ${style.strokeWidth * 10}px ${style.strokeColor}`
                              : '2px 2px 0px black',
                            fontFamily: style.fontFamily,
                            letterSpacing: style.textTransform === 'uppercase' ? '-0.02em' : '0',
                            textTransform: style.textTransform
                          }}>{w}</span>
                        );
                      })}
                    </p>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Play/Pause overlay */}
          {!playing && (
            <div onClick={toggle} style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', zIndex: 100,
              transition: 'opacity 0.2s'
            }}>
              <div style={{
                width: '72px', height: '72px', borderRadius: '50%',
                background: 'rgba(236,72,149,0.9)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                border: '2px solid rgba(255,255,255,0.2)'
              }}>
                <div style={{
                  borderLeft: '22px solid white',
                  borderTop: '13px solid transparent',
                  borderBottom: '13px solid transparent',
                  marginLeft: '5px'
                }} />
              </div>
            </div>
          )}
        </div>

        {/* Thumbnails Row */}
        {thumbnails.length > 0 && (
          <div style={{
            display: 'flex', gap: '4px', overflowX: 'auto',
            marginBottom: '8px', padding: '4px 0',
            scrollbarWidth: 'thin', scrollbarColor: '#27272a transparent'
          }}>
            {thumbnails.map((src, i) => (
              <img
                key={i}
                src={src}
                alt=""
                style={{
                  width: '40px', height: '22px', borderRadius: '4px',
                  border: '1px solid rgba(30,41,59,0.5)',
                  flexShrink: 0, objectFit: 'cover'
                }}
              />
            ))}
          </div>
        )}

        {/* Zoom Controls */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          marginBottom: '8px'
        }}>
          <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Zoom</span>
          <button
            onClick={() => setTimelineZoom(Math.max(1, timelineZoom - 1))}
            style={{
              width: '24px', height: '24px', borderRadius: '6px',
              border: '1px solid #27272a', background: '#18181b',
              color: 'white', fontSize: '12px', fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s'
            }}
          >-</button>
          <span style={{ fontSize: '10px', color: '#a1a1aa', fontWeight: 700, minWidth: '32px', textAlign: 'center', fontFamily: '"JetBrains Mono", monospace' }}>
            {timelineZoom}x
          </span>
          <button
            onClick={() => setTimelineZoom(Math.min(10, timelineZoom + 1))}
            style={{
              width: '24px', height: '24px', borderRadius: '6px',
              border: '1px solid #27272a', background: '#18181b',
              color: 'white', fontSize: '12px', fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s'
            }}
          >+</button>
          <input
            type="range" min="1" max="10" step="1"
            value={timelineZoom}
            onChange={(e) => setTimelineZoom(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#EC4899', height: '4px', cursor: 'pointer' }}
          />
          {timelineZoom > 1 && (
            <button
              onClick={() => setTimelineZoom(1)}
              style={{
                padding: '4px 8px', borderRadius: '6px',
                border: '1px solid #27272a', background: '#18181b',
                color: '#a1a1aa', fontSize: '9px', fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.2s',
                textTransform: 'uppercase', letterSpacing: '0.5px'
              }}
            >Reset</button>
          )}
        </div>

        {/* Timeline Scrubber */}
        <div style={{ marginTop: '16px' }}>
          <div
            ref={timelineRef}
            onClick={handleTimelineClick}
            onTouchStart={handleTimelineTouchStart}
            onTouchMove={handleTimelineTouchMove}
            onTouchEnd={handleTimelineTouchEnd}
            style={{
              width: '100%', height: '32px',
              background: 'rgba(30,41,59,0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              border: '1px solid rgba(30,41,59,0.4)',
              touchAction: 'none'
            }}
          >
            {/* Progress fill */}
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${Math.max(0, Math.min(100, progressPct))}%`,
              background: 'linear-gradient(90deg, rgba(236,72,149,0.3), rgba(236,72,149,0.15))',
              borderRadius: '8px',
              transition: isDragging ? 'none' : 'width 0.1s linear'
            }} />

            {/* Clip markers */}
            {activeHighlights.map((h: any) => {
              const startPct = ((h.start - windowStart) / clampedWindow) * 100;
              const widthPct = ((h.end - h.start) / clampedWindow) * 100;
              if (startPct + widthPct < 0 || startPct > 100) return null;
              return (
                <div key={h.id} style={{
                  position: 'absolute', left: `${Math.max(0, startPct)}%`, top: 0, bottom: 0,
                  width: `${Math.min(100 - Math.max(0, startPct), widthPct)}%`,
                  borderLeft: activeClipId === h.id ? '2px solid #EC4899' : '1px solid rgba(236,72,149,0.3)',
                  background: activeClipId === h.id ? 'rgba(236,72,149,0.05)' : 'transparent'
                }} />
              );
            })}

            {/* Cut markers - show removed segments */}
            {(() => {
              const sorted = [...activeHighlights].sort((a, b) => a.start - b.start);
              const cuts: Array<{ start: number; end: number }> = [];
              let cursor = clipStart;
              for (const h of sorted) {
                if (h.start > cursor + 0.1) {
                  cuts.push({ start: cursor, end: h.start });
                }
                cursor = Math.max(cursor, h.end);
              }
              if (cursor < clipEnd - 0.1) {
                cuts.push({ start: cursor, end: clipEnd });
              }
              return cuts.map((c, i) => {
                const startPct = ((c.start - windowStart) / clampedWindow) * 100;
                const widthPct = ((c.end - c.start) / clampedWindow) * 100;
                if (startPct + widthPct < 0 || startPct > 100) return null;
                return (
                  <div key={`cut-${i}`} style={{
                  position: 'absolute', left: `${Math.max(0, startPct)}%`, top: 0, bottom: 0,
                  width: `${Math.min(100 - Math.max(0, startPct), widthPct)}%`,
                    background: 'rgba(239, 68, 68, 0.15)',
                    borderLeft: '1px dashed rgba(239, 68, 68, 0.4)',
                    borderRight: '1px dashed rgba(239, 68, 68, 0.4)'
                  }} />
                );
              });
            })()}

            {/* Playhead */}
            <div style={{
              position: 'absolute', left: `${progressPct}%`, top: 0, bottom: 0,
              width: '2px', background: '#EC4899',
              boxShadow: '0 0 8px rgba(236,72,149,0.6)',
              transform: 'translateX(-1px)'
            }} />
          </div>
        </div>

        {/* Controls */}
        <div style={{
          marginTop: '12px', display: 'flex', gap: '8px',
          alignItems: 'center', flexWrap: 'wrap'
        }}>
          <button onClick={toggle} style={{
            padding: '10px 20px', background: '#18181b', color: 'white',
            borderRadius: '10px', border: '1px solid #27272a',
            fontWeight: 700, fontSize: '11px', cursor: 'pointer',
            whiteSpace: 'nowrap', fontFamily: '"Inter", sans-serif',
            transition: 'all 0.2s', minWidth: '80px'
          }}>
            {playing ? '⏸ PAUSE' : '▶ PLAY'}
          </button>
          <button onClick={() => skip(-5)} style={{
            padding: '10px 14px', background: '#18181b', color: 'white',
            borderRadius: '10px', border: '1px solid #27272a',
            fontWeight: 700, fontSize: '10px', cursor: 'pointer',
            whiteSpace: 'nowrap', fontFamily: '"Inter", sans-serif',
            transition: 'all 0.2s'
          }}>
            ⏪ -5s
          </button>
          <button onClick={() => stepFrame(-1)} style={{
            padding: '6px 10px', background: '#18181b', color: '#a1a1aa',
            borderRadius: '8px', border: '1px solid #27272a',
            fontWeight: 700, fontSize: '9px', cursor: 'pointer',
            whiteSpace: 'nowrap', fontFamily: '"Inter", sans-serif',
            transition: 'all 0.2s'
          }}>
            ◀ Frame
          </button>
          <button onClick={() => stepFrame(1)} style={{
            padding: '6px 10px', background: '#18181b', color: '#a1a1aa',
            borderRadius: '8px', border: '1px solid #27272a',
            fontWeight: 700, fontSize: '9px', cursor: 'pointer',
            whiteSpace: 'nowrap', fontFamily: '"Inter", sans-serif',
            transition: 'all 0.2s'
          }}>
            Frame ▶
          </button>
          <button onClick={() => skip(5)} style={{
            padding: '10px 14px', background: '#18181b', color: 'white',
            borderRadius: '10px', border: '1px solid #27272a',
            fontWeight: 700, fontSize: '10px', cursor: 'pointer',
            whiteSpace: 'nowrap', fontFamily: '"Inter", sans-serif',
            transition: 'all 0.2s'
          }}>
            +5s ⏩
          </button>
          <button onClick={() => onClipSelect(null)} style={{
            padding: '10px 16px', background: !activeClipId ? 'rgba(236,72,149,0.2)' : '#18181b',
            color: 'white', borderRadius: '10px', border: '1px solid #27272a',
            fontWeight: 700, fontSize: '10px', cursor: 'pointer',
            whiteSpace: 'nowrap', fontFamily: '"Inter", sans-serif',
            transition: 'all 0.2s'
          }}>FULL</button>
          {activeHighlights.map((h: any) => (
            <button key={h.id} onClick={() => { onClipSelect(h.id); vRef.current!.currentTime = h.start; }} style={{
              padding: '10px 14px',
              background: activeClipId === h.id ? 'rgba(236,72,149,0.2)' : '#18181b',
              color: 'white', borderRadius: '10px', border: '1px solid #27272a',
              fontWeight: 700, fontSize: '9px', whiteSpace: 'nowrap',
              cursor: 'pointer', fontFamily: '"Inter", sans-serif',
              transition: 'all 0.2s',
              textTransform: 'uppercase', letterSpacing: '0.3px'
            }}>{h.title.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {/* AI Command Bar */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(24,24,27,0.95) 0%, rgba(9,9,11,0.98) 100%)',
        padding: '16px 20px', borderRadius: '24px',
        border: '1px solid rgba(30,41,59,0.6)',
        backdropFilter: 'blur(16px)'
      }}>
        <div style={{
          color: '#64748b', fontSize: '9px', fontWeight: 800,
          textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px'
        }}>
          AI Command Bar
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Wand2 size={14} color="#EC4899" style={{ position: 'absolute', left: '12px', zIndex: 2 }} />
            <input
              type="text"
              value={commandInput}
              onChange={onCommandChange}
              onKeyDown={onCommandKeyDown}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Type a command... e.g. 'change caption style to mrbeast', 'add zoom at 5s', 'remove silence', 'add broll at 2s', 'voiceover: hello'"
              style={{
                width: '100%', padding: '12px 12px 12px 36px',
                background: '#020617', border: '1px solid #27272a',
                borderRadius: '12px', color: '#e4e4e7',
                fontSize: '11px', fontFamily: '"Inter", sans-serif',
                outline: 'none', transition: 'all 0.2s'
              }}
            />
            <span style={{
              position: 'absolute', right: '10px',
              background: 'rgba(236,72,153,0.15)', color: '#EC4899',
              padding: '2px 8px', borderRadius: '6px',
              fontSize: '9px', fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '0.5px',
              fontFamily: '"Inter", sans-serif'
            }}>
              AI
            </span>
          </div>
          {showSuggestions && commandSuggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              marginTop: '4px', background: '#18181b',
              border: '1px solid #27272a', borderRadius: '10px',
              overflow: 'hidden', zIndex: 50,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }}>
              {commandSuggestions.slice(0, 5).map((suggestion, idx) => (
                <div
                  key={idx}
                  onMouseDown={(e) => { e.preventDefault(); onCommandSubmit(); }}
                  style={{
                    padding: '8px 12px', fontSize: '10px',
                    color: '#a1a1aa', cursor: 'pointer',
                    borderBottom: idx < Math.min(commandSuggestions.length, 5) - 1 ? '1px solid rgba(39,39,42,0.5)' : 'none',
                    fontFamily: '"Inter", sans-serif',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(236,72,153,0.08)';
                    e.currentTarget.style.color = '#e4e4e7';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#a1a1aa';
                  }}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Music Matrix */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(24,24,27,0.95) 0%, rgba(9,9,11,0.98) 100%)',
        padding: '20px', borderRadius: '24px',
        border: '1px solid rgba(30,41,59,0.6)',
        backdropFilter: 'blur(16px)'
      }}>
        <div style={{
          color: '#64748b', fontSize: '9px', fontWeight: 800,
          textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '14px'
        }}>
          Massive Sonic Matrix — Hard Locked
        </div>

        {/* Mood categories */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {MOOD_CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setMusicMood(cat.key)}
              style={{
                padding: '6px 12px', borderRadius: '10px',
                border: musicMood === cat.key ? `1px solid ${cat.color}` : '1px solid #27272a',
                background: musicMood === cat.key ? `${cat.color}15` : '#020617',
                color: musicMood === cat.key ? cat.color : '#a1a1aa',
                fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                fontFamily: '"Inter", sans-serif', textTransform: 'uppercase',
                letterSpacing: '0.5px', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: '4px'
              }}
              onMouseEnter={(e) => {
                if (musicMood !== cat.key) {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                  e.currentTarget.style.color = '#e4e4e7';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                }
              }}
              onMouseLeave={(e) => {
                if (musicMood !== cat.key) {
                  e.currentTarget.style.borderColor = '#27272a';
                  e.currentTarget.style.color = '#a1a1aa';
                  e.currentTarget.style.background = '#020617';
                }
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center' }}>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Track grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
          {filteredTracks.map((t) => (
            <button key={t.id} onClick={() => updateSettings({ selectedMusicTrackId: t.id })} style={{
              padding: '12px', borderRadius: '12px',
              border: project.selectedMusicTrackId === t.id ? '1px solid rgba(236,72,149,0.5)' : '1px solid #27272a',
              background: project.selectedMusicTrackId === t.id ? 'rgba(236,72,149,0.08)' : '#020617',
              color: 'white', fontWeight: 700, textAlign: 'left', fontSize: '11px',
              cursor: 'pointer', fontFamily: '"Inter", sans-serif',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              transition: 'all 0.2s', transform: 'translateY(0)'
            }}
            onMouseEnter={(e) => {
              if (project.selectedMusicTrackId !== t.id) {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
              }
            }}
            onMouseLeave={(e) => {
              if (project.selectedMusicTrackId !== t.id) {
                e.currentTarget.style.borderColor = '#27272a';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.background = '#020617';
              }
            }}
            >
              <div>
                <div>{t.name}</div>
                <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 500, marginTop: '1px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.genre}</div>
              </div>
              <span style={{
                fontSize: '9px', color: project.selectedMusicTrackId === t.id ? '#EC4899' : '#475569',
                fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px'
              }}>
                {project.selectedMusicTrackId === t.id ? '● Active' : '○'}
              </span>
            </button>
          ))}
        </div>

        {/* Volume slider */}
        <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Volume</span>
          <input
            type="range" min="0" max="1" step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: '#EC4899', height: '4px', cursor: 'pointer' }}
          />
          <span style={{
            fontSize: '11px', color: '#a1a1aa', fontWeight: 600,
            minWidth: '32px', textAlign: 'right', fontFamily: '"Inter", sans-serif'
          }}>
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>

      {/* B-Roll & Voiceover */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(24,24,27,0.95) 0%, rgba(9,9,11,0.98) 100%)',
        padding: '20px', borderRadius: '24px',
        border: '1px solid rgba(30,41,59,0.6)',
        backdropFilter: 'blur(16px)'
      }}>
        <div style={{
          color: '#64748b', fontSize: '9px', fontWeight: 800,
          textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '14px'
        }}>
          B-Roll & Voiceover
        </div>

        {/* B-Roll Clips */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            B-Roll Clips
          </div>
          {brollClips && brollClips.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
              {brollClips.map((clip) => (
                <div key={clip.id} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 10px', borderRadius: '10px',
                  border: '1px solid #27272a',
                  background: 'rgba(236,72,153,0.04)'
                }}>
                  <span style={{ fontSize: '9px', color: '#EC4899', fontWeight: 800, minWidth: '18px' }}>#{clip.id.slice(-4)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10px', color: '#e4e4e7', fontWeight: 600 }}>{clip.label}</div>
                    <div style={{ fontSize: '9px', color: '#64748b', fontFamily: '"JetBrains Mono", monospace' }}>
                      @ {clip.timestamp.toFixed(2)}s · {clip.duration.toFixed(1)}s
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (onUpdateProject) {
                        const updated = (brollClips || []).filter((c: BrollClip) => c.id !== clip.id);
                        onUpdateProject({ ...project, brollClips: updated });
                      }
                    }}
                    style={{
                      background: 'transparent', border: 'none', color: '#f87171',
                      cursor: 'pointer', fontSize: '12px', fontWeight: 800, padding: '2px 6px',
                      display: 'flex', alignItems: 'center'
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '10px', color: '#64748b' }}>
              No B-Roll clips added yet. Use the AI command bar to add B-Roll at specific timestamps.
            </div>
          )}
        </div>

        {/* Voiceover */}
        <div>
          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Voiceover Text
          </div>
          {voiceoverText ? (
            <div style={{
              padding: '10px 12px', borderRadius: '10px',
              border: '1px solid #27272a',
              background: '#020617',
              marginBottom: '10px'
            }}>
              <div style={{ fontSize: '11px', color: '#e4e4e7', lineHeight: 1.5 }}>
                {voiceoverText}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '10px' }}>
              No voiceover text set. Use the AI command bar with "voiceover: your text" to add one.
            </div>
          )}
          <button
            onClick={onGenerateVoiceover}
            disabled={isGeneratingVoiceover || !voiceoverText}
            style={{
              padding: '8px 16px', borderRadius: '10px',
              border: '1px solid #27272a',
              background: isGeneratingVoiceover ? 'rgba(236,72,153,0.1)' : 'rgba(236,72,153,0.2)',
              color: isGeneratingVoiceover ? '#a1a1aa' : '#EC4899',
              fontSize: '10px', fontWeight: 700, cursor: isGeneratingVoiceover || !voiceoverText ? 'not-allowed' : 'pointer',
              fontFamily: '"Inter", sans-serif', textTransform: 'uppercase',
              letterSpacing: '0.5px', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            {isGeneratingVoiceover ? (
              <>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#EC4899', animation: 'spin 1s linear infinite' }} />
                Generating...
              </>
            ) : (
              <>
                <Command size={12} />
                Generate Voiceover
              </>
            )}
          </button>
        </div>
      </div>

      {/* Color Grading & Effects */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(24,24,27,0.95) 0%, rgba(9,9,11,0.98) 100%)',
        padding: '20px', borderRadius: '24px',
        border: '1px solid rgba(30,41,59,0.6)',
        backdropFilter: 'blur(16px)'
      }}>
        <div style={{
          color: '#64748b', fontSize: '9px', fontWeight: 800,
          textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '14px'
        }}>
          Professional Color & Effects
        </div>

        {/* LUT Color Grading */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Color Grade (LUT)
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {Object.entries(LUT_PRESETS).map(([key, lut]) => (
              <button
                key={key}
                onClick={() => updateSettings({ colorGrade: key as any })}
                style={{
                  padding: '6px 12px', borderRadius: '8px',
                  border: project.colorGrade === key ? '1px solid rgba(236,72,149,0.5)' : '1px solid #27272a',
                  background: project.colorGrade === key ? 'rgba(236,72,149,0.08)' : '#020617',
                  color: project.colorGrade === key ? '#f9a8d4' : '#a1a1aa',
                  fontSize: '9px', fontWeight: 700, cursor: 'pointer',
                  fontFamily: '"Inter", sans-serif', textTransform: 'uppercase',
                  letterSpacing: '0.3px', transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (project.colorGrade !== key) {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.color = '#e4e4e7';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (project.colorGrade !== key) {
                    e.currentTarget.style.borderColor = '#27272a';
                    e.currentTarget.style.color = '#a1a1aa';
                    e.currentTarget.style.background = '#020617';
                  }
                }}
              >
                {lut.name}
              </button>
            ))}
          </div>
        </div>

        {/* Transitions */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Transition Style
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {Object.entries(TRANSITION_PRESETS).map(([key, trans]) => (
              <button
                key={key}
                onClick={() => updateSettings({ transitionStyle: key as any })}
                style={{
                  padding: '6px 12px', borderRadius: '8px',
                  border: project.transitionStyle === key ? '1px solid rgba(6,182,212,0.5)' : '1px solid #27272a',
                  background: project.transitionStyle === key ? 'rgba(6,182,212,0.08)' : '#020617',
                  color: project.transitionStyle === key ? '#22d3ee' : '#a1a1aa',
                  fontSize: '9px', fontWeight: 700, cursor: 'pointer',
                  fontFamily: '"Inter", sans-serif', textTransform: 'uppercase',
                  letterSpacing: '0.3px', transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (project.transitionStyle !== key) {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.color = '#e4e4e7';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (project.transitionStyle !== key) {
                    e.currentTarget.style.borderColor = '#27272a';
                    e.currentTarget.style.color = '#a1a1aa';
                    e.currentTarget.style.background = '#020617';
                  }
                }}
              >
                {trans.name}
              </button>
            ))}
          </div>
        </div>

        {/* Effect Toggles */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input type="checkbox" checked={project.enableZooms} onChange={(e) => updateSettings({ enableZooms: e.target.checked })} style={{ accentColor: '#EC4899' }} />
            Zooms
          </label>
          <label style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input type="checkbox" checked={project.shakeOnPunch} onChange={(e) => updateSettings({ shakeOnPunch: e.target.checked })} style={{ accentColor: '#EC4899' }} />
            Shake
          </label>
          <label style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input type="checkbox" checked={project.enableSubtitles} onChange={(e) => updateSettings({ enableSubtitles: e.target.checked })} style={{ accentColor: '#EC4899' }} />
            Subtitles
          </label>
          <label style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input type="checkbox" checked={project.enableColorGrade} onChange={(e) => updateSettings({ enableColorGrade: e.target.checked })} style={{ accentColor: '#EC4899' }} />
            Color Grade
          </label>
        </div>
      </div>

      {/* Segments / Smart Cuts */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(24,24,27,0.95) 0%, rgba(9,9,11,0.98) 100%)',
        padding: '20px', borderRadius: '24px',
        border: '1px solid rgba(30,41,59,0.6)',
        backdropFilter: 'blur(16px)'
      }}>
        <div style={{
          color: '#64748b', fontSize: '9px', fontWeight: 800,
          textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '14px'
        }}>
          Segments / Smart Cuts
        </div>

        <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Keep segments (everything else is cut)
        </div>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              const segs = (project.segments || []).map((s: any) => ({ ...s }));
              const newStart = parseFloat(prompt('Segment start (seconds):') || '0');
              const newEnd = parseFloat(prompt('Segment end (seconds):') || '5');
              if (!Number.isNaN(newStart) && !Number.isNaN(newEnd) && newEnd > newStart) {
                updateSettings({ segments: [...segs, { start: newStart, end: newEnd, speed: 1.0 }] });
              }
            }}
            style={{
              padding: '6px 12px', borderRadius: '8px',
              border: '1px solid #27272a',
              background: '#020617',
              color: 'white', fontSize: '9px', fontWeight: 700, cursor: 'pointer',
              fontFamily: '"Inter", sans-serif', textTransform: 'uppercase',
              letterSpacing: '0.3px', transition: 'all 0.2s'
            }}
          >
            + Add Segment
          </button>
          <button
            onClick={() => updateSettings({ segments: [] })}
            style={{
              padding: '6px 12px', borderRadius: '8px',
              border: '1px solid #27272a',
              background: '#020617',
              color: '#f87171', fontSize: '9px', fontWeight: 700, cursor: 'pointer',
              fontFamily: '"Inter", sans-serif', textTransform: 'uppercase',
              letterSpacing: '0.3px', transition: 'all 0.2s'
            }}
          >
            Clear All
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
          {(project.segments || []).map((seg: any, idx: number) => (
            <div key={idx} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 10px', borderRadius: '10px',
              border: '1px solid #27272a',
              background: 'rgba(236,72,149,0.04)'
            }}>
              <span style={{ fontSize: '9px', color: '#EC4899', fontWeight: 800, minWidth: '18px' }}>#{idx + 1}</span>
              <span style={{ fontSize: '10px', color: '#e4e4e7', fontFamily: '"JetBrains Mono", monospace', flex: 1 }}>
                {seg.start.toFixed(2)}s → {seg.end.toFixed(2)}s
                {seg.speed && seg.speed !== 1.0 ? ` (×${seg.speed.toFixed(2)})` : ''}
              </span>
              <button
                onClick={() => {
                  const next = (project.segments || []).filter((_: any, i: number) => i !== idx);
                  updateSettings({ segments: next });
                }}
                style={{
                  background: 'transparent', border: 'none', color: '#f87171',
                  cursor: 'pointer', fontSize: '12px', fontWeight: 800, padding: '2px 6px'
                }}
              >
                ✕
              </button>
            </div>
          ))}
          {(project.segments || []).length === 0 && (
            <div style={{ fontSize: '10px', color: '#64748b' }}>
              No segments defined. Using full timeline or highlights.
            </div>
          )}
        </div>
      </div>

      {/* Thumbnail Generator */}
      <ThumbnailGenerator
        project={project}
        currentTime={time}
        videoRef={vRef}
        onUpdateProject={onUpdateProject}
      />

      <audio ref={aRef} loop style={{ display: 'none' }} />
    </div>
  );
}
