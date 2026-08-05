import React, { useRef, useState, useEffect, useCallback } from 'react';
import { VideoProject } from '../types';
import { FREE_MUSIC_TRACKS } from '../data';
import ThumbnailGenerator from './ThumbnailGenerator';

const fixDunikTypo = (str: string) => str?.replace(/dunik/gi, 'Dunk') || '';

const MOOD_CATEGORIES = [
  { key: 'hype', label: 'Hype', emoji: '🔥', color: '#ef4444' },
  { key: 'lofi', label: 'Lofi', emoji: '☕', color: '#f59e0b' },
  { key: 'cinematic', label: 'Cinematic', emoji: '🎬', color: '#8b5cf6' },
  { key: 'chill', label: 'Tech / Chill', emoji: '💿', color: '#06b6d4' },
] as const;

export default function VideoPlayerWorkspace({ project, activeMusicTrack, activeClipId, onClipSelect, onUpdateProject }: any) {
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

  const currentHighlight = activeClipId
    ? activeHighlights.find((h: any) => h.id === activeClipId)
    : null;
  const clipStart = currentHighlight?.start ?? 0;
  const clipEnd = currentHighlight?.end ?? duration;
  const clipDuration = clipEnd - clipStart || duration;

  const filteredTracks = FREE_MUSIC_TRACKS.filter(t => t.intensity === musicMood);

  // MASTER SYNC LOOP
  useEffect(() => {
    let raf: number;
    let lastT = 0;
    const loop = (now: number) => {
      if (vRef.current && playing && !isDragging) {
        const t = vRef.current.currentTime;
        setTime(t);

        if (now - lastT > 100) {
          const s = project.subtitles?.find((i: any) => t >= i.start && t <= i.end);
          if (s?.id !== lastSubId) {
            setActiveSub(s || null);
            setLastSubId(s?.id || null);
            if (s && project.sfxPopEnabled) playViralSFX('pop');
          }

          let zScale = 1.0;
          if (enableZooms) {
            const zoom = project.zoomEffects?.find((z: any) => t >= z.timestamp && t <= z.timestamp + z.duration);
            zScale = zoom ? zoom.scale : (autoZoomPunch && s ? 1.22 : 1.0);
          }
          if (currentZoom !== zScale) setCurrentZoom(zScale);

          const hl = activeHighlights.find((h: any) => h.id === activeClipId);
          if (hl && t >= hl.end) { vRef.current.currentTime = hl.start; }

          lastT = now;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, activeClipId, project.subtitles, lastSubId, enableZooms, autoZoomPunch, currentZoom, isDragging, activeHighlights]);

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

  // Load video duration
  useEffect(() => {
    const v = vRef.current;
    if (!v) return;
    const onMeta = () => setDuration(v.duration);
    v.addEventListener('loadedmetadata', onMeta);
    return () => v.removeEventListener('loadedmetadata', onMeta);
  }, [project.videoUrl]);

  // Timeline scrubber
  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !vRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = clipStart + pct * clipDuration;
    vRef.current.currentTime = newTime;
    setTime(newTime);
  }, [clipStart, clipDuration]);

  const toggle = useCallback(() => {
    if (!vRef.current) return;
    if (vRef.current.paused) {
      vRef.current.play();
      setPlaying(true);
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
          skip(-5);
          break;
        case 'arrowright':
          e.preventDefault();
          skip(5);
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [toggle, skip]);

  const progressPct = duration > 0 ? ((time - clipStart) / clipDuration) * 100 : 0;

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
        {/* Toolbar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '14px', flexWrap: 'wrap', gap: '8px'
        }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['iPhone SE', 'iPhone 14', 'Android'].map((device) => (
              <button
                key={device}
                onClick={() => {}}
                style={{
                  padding: '5px 10px', borderRadius: '8px',
                  border: '1px solid rgba(30,41,59,0.5)',
                  background: 'rgba(9,9,11,0.4)',
                  color: '#a1a1aa', fontSize: '9px', fontWeight: 700,
                  cursor: 'pointer', fontFamily: '"Inter", sans-serif',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                  transition: 'all 0.2s'
                }}
              >
                {device}
              </button>
            ))}
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
          </div>

          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, fontFamily: '"JetBrains Mono", monospace' }}>
            {String(Math.floor(time / 60)).padStart(2, '0')}:{String(Math.floor(time % 60)).padStart(2, '0')}
            {' / '}
            {String(Math.floor(duration / 60)).padStart(2, '0')}:{String(Math.floor(duration % 60)).padStart(2, '0')}
          </div>
        </div>

        {/* Social Simulator Frame */}
        <div style={{
          position: 'relative', width: '100%', maxWidth: '360px',
          aspectRatio: '9/16', background: '#000',
          margin: '0 auto', borderRadius: '20px', overflow: 'hidden',
          border: '2px solid #18181b',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)'
        }}>
          <video
            ref={vRef}
            src={project.videoUrl}
            playsInline
            muted
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              transform: `scale(${currentZoom})`,
              transition: 'transform 0.15s ease'
            }}
            className={enableColorGrade && project.colorGrade !== 'none' ? `filter-${project.colorGrade}` : ''}
          />

          {/* Safe Zone Guides */}
          {showSafeZone && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 40 }}>
              <div style={{ position: 'absolute', top: '8%', left: 0, right: 0, height: '1px', background: 'rgba(251,255,0,0.7)' }} />
              <div style={{ position: 'absolute', bottom: '18%', left: 0, right: 0, height: '1px', background: 'rgba(251,255,0,0.7)' }} />
              <div style={{ position: 'absolute', top: '8%', bottom: '18%', left: '8%', width: '1px', background: 'rgba(251,255,0,0.5)' }} />
              <div style={{ position: 'absolute', top: '8%', bottom: '18%', right: '8%', width: '1px', background: 'rgba(251,255,0,0.5)' }} />
              <div style={{ position: 'absolute', top: '8%', left: '8%', right: '8%', bottom: '18%', border: '1px dashed rgba(251,255,0,0.2)', borderRadius: '4px' }} />
              <div style={{ position: 'absolute', top: '10%', right: '10%', fontSize: '8px', color: 'rgba(251,255,0,0.9)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: '"Inter", sans-serif' }}>
                Safe Zone
              </div>
            </div>
          )}

          {/* Subtitles — Hormozi polished with Oswald + two-tone */}
          {enableSubtitles && activeSub && (
            <div style={{
              position: 'absolute', bottom: '80px', left: 0, right: 0,
              padding: '0 16px', textAlign: 'center',
              pointerEvents: 'none', zIndex: 50
            }}>
              <div style={{
                background: 'rgba(0,0,0,0.88)', padding: '10px 16px',
                borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)',
                display: 'inline-block'
              }}>
                <p style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', margin: 0, justifyContent: 'center' }}>
                  {fixDunikTypo(activeSub.text).toUpperCase().split(' ').map((w: string, i: number) => (
                    <span key={i} style={{
                      color: i % 2 === 0 ? '#FBFF00' : '#FF00FF',
                      fontWeight: 900, fontSize: '15px',
                      textShadow: '2px 2px 0px black',
                      fontFamily: '"Oswald", "Impact", sans-serif',
                      letterSpacing: '-0.02em'
                    }}>{w}</span>
                  ))}
                </p>
              </div>
            </div>
          )}

          {/* Play/Pause overlay */}
          {!playing && (
            <div onClick={toggle} style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', zIndex: 100,
              transition: 'opacity 0.2s'
            }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'rgba(139,92,246,0.9)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(8px)',
                border: '2px solid rgba(255,255,255,0.2)'
              }}>
                <div style={{
                  borderLeft: '18px solid white',
                  borderTop: '11px solid transparent',
                  borderBottom: '11px solid transparent',
                  marginLeft: '4px'
                }} />
              </div>
            </div>
          )}

          {/* Notch */}
          <div style={{
            position: 'absolute', top: '6px', left: '50%', transform: 'translateX(-50%)',
            width: '80px', height: '22px', background: '#000',
            borderRadius: '0 0 16px 16px', zIndex: 30
          }} />
        </div>

        {/* Timeline Scrubber */}
        <div style={{ marginTop: '16px' }}>
          <div
            ref={timelineRef}
            onClick={handleTimelineClick}
            style={{
              width: '100%', height: '32px',
              background: 'rgba(30,41,59,0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              border: '1px solid rgba(30,41,59,0.4)'
            }}
          >
            {/* Progress fill */}
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${Math.max(0, Math.min(100, progressPct))}%`,
              background: 'linear-gradient(90deg, rgba(139,92,246,0.3), rgba(139,92,246,0.15))',
              borderRadius: '8px',
              transition: isDragging ? 'none' : 'width 0.1s linear'
            }} />

            {/* Clip markers */}
            {activeHighlights.map((h: any) => {
              const startPct = ((h.start - clipStart) / clipDuration) * 100;
              const widthPct = ((h.end - h.start) / clipDuration) * 100;
              return (
                <div key={h.id} style={{
                  position: 'absolute', left: `${startPct}%`, top: 0, bottom: 0,
                  width: `${widthPct}%`,
                  borderLeft: activeClipId === h.id ? '2px solid #8b5cf6' : '1px solid rgba(139,92,246,0.3)',
                  background: activeClipId === h.id ? 'rgba(139,92,246,0.05)' : 'transparent'
                }} />
              );
            })}

            {/* Playhead */}
            <div style={{
              position: 'absolute', left: `${progressPct}%`, top: 0, bottom: 0,
              width: '2px', background: '#8b5cf6',
              boxShadow: '0 0 8px rgba(139,92,246,0.6)',
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
            padding: '10px 16px', background: !activeClipId ? 'rgba(139,92,246,0.2)' : '#18181b',
            color: 'white', borderRadius: '10px', border: '1px solid #27272a',
            fontWeight: 700, fontSize: '10px', cursor: 'pointer',
            whiteSpace: 'nowrap', fontFamily: '"Inter", sans-serif',
            transition: 'all 0.2s'
          }}>FULL</button>
          {activeHighlights.map((h: any) => (
            <button key={h.id} onClick={() => { onClipSelect(h.id); vRef.current!.currentTime = h.start; }} style={{
              padding: '10px 14px',
              background: activeClipId === h.id ? 'rgba(139,92,246,0.2)' : '#18181b',
              color: 'white', borderRadius: '10px', border: '1px solid #27272a',
              fontWeight: 700, fontSize: '9px', whiteSpace: 'nowrap',
              cursor: 'pointer', fontFamily: '"Inter", sans-serif',
              transition: 'all 0.2s',
              textTransform: 'uppercase', letterSpacing: '0.3px'
            }}>{h.title.toUpperCase()}</button>
          ))}
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
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Track grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
          {filteredTracks.map((t) => (
            <button key={t.id} onClick={() => updateSettings({ selectedMusicTrackId: t.id })} style={{
              padding: '12px', borderRadius: '12px',
              border: project.selectedMusicTrackId === t.id ? '1px solid rgba(139,92,246,0.5)' : '1px solid #27272a',
              background: project.selectedMusicTrackId === t.id ? 'rgba(139,92,246,0.08)' : '#020617',
              color: 'white', fontWeight: 700, textAlign: 'left', fontSize: '11px',
              cursor: 'pointer', fontFamily: '"Inter", sans-serif',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              transition: 'all 0.2s'
            }}>
              <div>
                <div>{t.name}</div>
                <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 500, marginTop: '1px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.genre}</div>
              </div>
              <span style={{
                fontSize: '9px', color: project.selectedMusicTrackId === t.id ? '#8b5cf6' : '#475569',
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
            style={{ flex: 1, accentColor: '#8b5cf6', height: '4px', cursor: 'pointer' }}
          />
          <span style={{
            fontSize: '11px', color: '#a1a1aa', fontWeight: 600,
            minWidth: '32px', textAlign: 'right', fontFamily: '"Inter", sans-serif'
          }}>
            {Math.round(volume * 100)}%
          </span>
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
