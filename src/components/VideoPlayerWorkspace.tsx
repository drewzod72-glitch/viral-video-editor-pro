import React, { useRef, useState, useEffect, useCallback } from 'react';
import { VideoProject } from '../types';
import { FREE_MUSIC_TRACKS } from '../data';
import { ThumbnailGenerator } from './ThumbnailGenerator';
import { playViralSFX } from '../utils/sfx';

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

  // States
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

  // Sync Refs (Kilo Fix)
  const playingRef = useRef(playing);
  const isDraggingRef = useRef(isDragging);
  const zoomRef = useRef(currentZoom);
  const projectRef = useRef(project);
  const activeClipIdRef = useRef(activeClipId);
  const highlightsRef = useRef(activeHighlights);
  const lastSubIdRef = useRef(lastSubId);

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);
  useEffect(() => { zoomRef.current = currentZoom; }, [currentZoom]);
  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => { activeClipIdRef.current = activeClipId; }, [activeClipId]);
  useEffect(() => { highlightsRef.current = activeHighlights; }, [activeHighlights]);
  useEffect(() => { lastSubIdRef.current = lastSubId; }, [lastSubId]);

  const currentHighlight = activeClipId
    ? activeHighlights.find((h: any) => h.id === activeClipId)
    : null;
  const clipStart = currentHighlight?.start ?? 0;
  const clipEnd = currentHighlight?.end ?? duration;
  const clipDuration = clipEnd - clipStart || duration;

  const filteredTracks = FREE_MUSIC_TRACKS.filter(t => t.intensity === musicMood);

  // UI Heartbeat Interval (Kilo Fix)
  useEffect(() => {
    const heartbeat = setInterval(() => {
      if (vRef.current && playingRef.current && !isDraggingRef.current) {
        setTime(vRef.current.currentTime);
      }
    }, 500);
    return () => clearInterval(heartbeat);
  }, []);

  // MASTER SYNC LOOP - Empty Dependency Array (Kilo Fix)
  useEffect(() => {
    let raf: number;
    let lastLoopT = 0;
    const loop = (now: number) => {
      const v = vRef.current;
      if (v && playingRef.current && !isDraggingRef.current) {
        const t = v.currentTime;
        // setTime(t); // Moved to heartbeat for performance/stability

        if (now - lastLoopT > 100) {
          const proj = projectRef.current;
          const s = proj.subtitles?.find((i: any) => t >= i.start && t <= i.end);
          
          if (s?.id !== lastSubIdRef.current) {
            setActiveSub(s || null);
            setLastSubId(s?.id || null);
            lastSubIdRef.current = s?.id || null;
            if (s && proj.sfxPopEnabled) playViralSFX('pop');
          }

          let zScale = 1.0;
          if (proj.enableZooms) {
            const zoom = proj.zoomEffects?.find((z: any) => t >= z.timestamp && t <= z.timestamp + z.duration);
            zScale = zoom ? zoom.scale : (proj.autoZoomPunch && s ? 1.22 : 1.0);
          }
          if (zoomRef.current !== zScale) {
            setCurrentZoom(zScale);
            zoomRef.current = zScale;
          }

          const hl = highlightsRef.current.find((h: any) => h.id === activeClipIdRef.current);
          if (hl && t >= hl.end) { v.currentTime = hl.start; }

          lastLoopT = now;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // AUDIO LOCK
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

  useEffect(() => {
    const v = vRef.current;
    if (!v) return;
    const onMeta = () => setDuration(v.duration);
    v.addEventListener('loadedmetadata', onMeta);
    return () => v.removeEventListener('loadedmetadata', onMeta);
  }, [project.videoUrl]);

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

  const progressPct = duration > 0 ? ((time - clipStart) / clipDuration) * 100 : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', paddingBottom: '40px' }}>
      <div style={{ background: 'rgba(9,9,11,0.6)', padding: '24px', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <button
            onClick={() => setShowSafeZone(!showSafeZone)}
            style={{
              padding: '8px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
              background: showSafeZone ? 'rgba(251,255,0,0.1)' : 'rgba(255,255,255,0.02)',
              color: showSafeZone ? '#fbff00' : '#a1a1aa',
              fontSize: '11px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            {showSafeZone ? '🟡 Safe Zone Active' : '⬜ Show Safe Zones'}
          </button>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, fontFamily: 'monospace' }}>
            {Math.floor(time)}s / {Math.floor(duration)}s
          </div>
        </div>

        {/* 9:16 Studio Stage */}
        <div style={{
          position: 'relative', width: '100%', maxWidth: '340px', aspectRatio: '9/16',
          background: '#000', margin: '0 auto', borderRadius: '24px', overflow: 'hidden',
          border: '4px solid #18181b', boxShadow: '0 30px 60px rgba(0,0,0,0.6)'
        }}>
          <video
            ref={vRef} src={project.videoUrl} playsInline muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${currentZoom})`, transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
            className={enableColorGrade && project.colorGrade !== 'none' ? `filter-${project.colorGrade}` : ''}
          />

          {/* Social Mockup Rail */}
          <div style={{ position: 'absolute', right: '12px', bottom: '120px', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', zIndex: 60, pointerEvents: 'none' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #444, #111)', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px' }}>❤️</div>
              <div style={{ fontSize: '10px', fontWeight: 900 }}>842K</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px' }}>💬</div>
              <div style={{ fontSize: '10px', fontWeight: 900 }}>12K</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px' }}>↗️</div>
              <div style={{ fontSize: '10px', fontWeight: 900 }}>Share</div>
            </div>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'conic-gradient(#333, #000, #333)', border: '4px solid #222', animation: 'spin 3s linear infinite' }} />
          </div>

          <div style={{ position: 'absolute', left: '16px', bottom: '32px', zIndex: 60, pointerEvents: 'none', maxWidth: '70%' }}>
            <div style={{ fontWeight: 900, fontSize: '14px', marginBottom: '4px' }}>@viral_director</div>
            <div style={{ fontSize: '12px', opacity: 0.9 }}>{project.title} #viral #ai #edit</div>
          </div>

          {showSafeZone && (
            <div style={{ position: 'absolute', inset: '10% 8% 20% 8%', border: '1px dashed rgba(251,255,0,0.3)', borderRadius: '8px', pointerEvents: 'none' }} />
          )}

          {enableSubtitles && activeSub && (
            <div style={{ position: 'absolute', bottom: '100px', left: 0, right: 0, padding: '0 20px', textAlign: 'center', pointerEvents: 'none', zIndex: 50 }}>
              <div style={{ background: 'rgba(0,0,0,0.85)', padding: '12px 20px', borderRadius: '16px', display: 'inline-block', border: '1px solid rgba(255,255,255,0.1)' }}>
                <p style={{ margin: 0, fontWeight: 900, fontSize: '18px', color: '#FBFF00', textShadow: '2px 2px 0px black', fontFamily: 'Impact, sans-serif' }}>
                  {fixDunikTypo(activeSub.text).toUpperCase()}
                </p>
              </div>
            </div>
          )}

          {!playing && (
            <div onClick={toggle} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 100 }}>
              <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(139,92,246,0.6)' }}>
                <div style={{ borderLeft: '20px solid white', borderTop: '12px solid transparent', borderBottom: '12px solid transparent', marginLeft: '6px' }} />
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: '24px' }}>
          <div ref={timelineRef} onClick={handleTimelineClick} style={{ width: '100%', height: '40px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', cursor: 'pointer', position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${progressPct}%`, background: 'rgba(139,92,246,0.2)', transition: 'width 0.1s linear' }} />
            <div style={{ position: 'absolute', left: `${progressPct}%`, top: 0, bottom: 0, width: '2px', background: '#8b5cf6', boxShadow: '0 0 10px #8b5cf6' }} />
          </div>
        </div>

        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={toggle} style={{ padding: '12px 24px', background: '#18181b', color: 'white', borderRadius: '12px', border: '1px solid #27272a', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }}>
            {playing ? '⏸ PAUSE' : '▶ PLAY'}
          </button>
          <button onClick={() => onClipSelect(null)} style={{ padding: '12px 20px', background: !activeClipId ? '#8b5cf6' : '#18181b', color: 'white', borderRadius: '12px', border: 'none', fontWeight: 800, fontSize: '11px', cursor: 'pointer' }}>FULL VIDEO</button>
          {activeHighlights.map((h: any) => (
            <button key={h.id} onClick={() => { onClipSelect(h.id); vRef.current!.currentTime = h.start; }} style={{ padding: '12px 20px', background: activeClipId === h.id ? '#8b5cf6' : '#18181b', color: 'white', borderRadius: '12px', border: 'none', fontWeight: 800, fontSize: '11px', cursor: 'pointer' }}>
              {h.title.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: 'rgba(9,9,11,0.6)', padding: '24px', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {MOOD_CATEGORIES.map(cat => (
            <button key={cat.key} onClick={() => setMusicMood(cat.key)} style={{ padding: '10px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: musicMood === cat.key ? cat.color : 'transparent', color: 'white', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', maxHeight: '240px', overflowY: 'auto' }}>
          {filteredTracks.map((t) => (
            <button key={t.id} onClick={() => updateSettings({ selectedMusicTrackId: t.id })} style={{ padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', background: project.selectedMusicTrackId === t.id ? 'rgba(139,92,246,0.1)' : 'rgba(0,0,0,0.2)', color: 'white', textAlign: 'left', cursor: 'pointer' }}>
              <div style={{ fontWeight: 800, fontSize: '13px' }}>{t.name}</div>
              <div style={{ fontSize: '10px', opacity: 0.5 }}>{t.genre}</div>
            </button>
          ))}
        </div>
      </div>

      <ThumbnailGenerator project={project} currentTime={time} videoRef={vRef} onUpdateProject={onUpdateProject} />
      <audio ref={aRef} loop style={{ display: 'none' }} />
    </div>
  );
}
