import React, { useRef, useState, useEffect } from 'react';
import { VideoProject, getCaptionStyles } from '../types';
import { FREE_MUSIC_TRACKS } from '../data';
import { playViralSFX } from '../utils/sfx';

const fixDunikTypo = (str: string) => str?.replace(/dunik/gi, 'Dunk') || '';

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
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [activeSub, setActiveSub] = useState<any>(null);
  const [lastSubId, setLastSubId] = useState<string | null>(null);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [volume, setVolume] = useState(musicVolume);
  const [showSafeZone, setShowSafeZone] = useState(false);

  // MASTER SYNC LOOP
  useEffect(() => {
    let raf: number;
    let lastT = 0;
    const loop = (now: number) => {
      if (vRef.current && playing) {
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
  }, [playing, activeClipId, project.subtitles, lastSubId, enableZooms, autoZoomPunch, currentZoom]);

  // AUDIO LOCK - hard-locked music bus
  useEffect(() => {
    if (!aRef.current) return;
    if (activeMusicTrack && playing) {
      if (aRef.current.src !== activeMusicTrack.url) { aRef.current.src = activeMusicTrack.url; aRef.current.load(); }
      aRef.current.volume = volume;
      aRef.current.play().catch(() => {});
    } else {
      aRef.current.pause();
    }
  }, [playing, activeMusicTrack, volume]);

  const toggle = () => {
    if (!vRef.current) return;
    if (vRef.current.paused) {
      vRef.current.play();
      setPlaying(true);
    } else {
      vRef.current.pause();
      setPlaying(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', paddingBottom: '40px', boxSizing: 'border-box' }}>
      {/* PREVIEW STAGE */}
      <div style={{ background: 'linear-gradient(180deg, rgba(24,24,27,0.9) 0%, rgba(9,9,11,0.95) 100%)', padding: '20px', borderRadius: '24px', border: '1px solid rgba(30,41,59,0.6)', backdropFilter: 'blur(16px)' }}>

        {/* Device Frame Selector */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['iPhone SE', 'iPhone 14', 'Android'].map((device) => (
              <button
                key={device}
                onClick={() => {}}
                style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(30,41,59,0.5)', background: 'rgba(9,9,11,0.4)', color: '#a1a1aa', fontSize: '10px', fontWeight: 700, cursor: 'pointer', fontFamily: '"Inter", sans-serif', textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'all 0.2s' }}
              >
                {device}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowSafeZone(!showSafeZone)}
            style={{ padding: '6px 12px', borderRadius: '8px', border: showSafeZone ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(30,41,59,0.5)', background: showSafeZone ? 'rgba(139,92,246,0.15)' : 'rgba(9,9,11,0.4)', color: showSafeZone ? '#c4b5fd' : '#a1a1aa', fontSize: '10px', fontWeight: 700, cursor: 'pointer', fontFamily: '"Inter", sans-serif', textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'all 0.2s' }}
          >
            {showSafeZone ? '🟡 Safe Zone ON' : '⬜ Safe Zone'}
          </button>
        </div>

        {/* Social Simulator Frame */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '360px', aspectRatio: '9/16', background: '#000', margin: '0 auto', borderRadius: '24px', overflow: 'hidden', border: '3px solid #18181b', boxShadow: '0 25px 80px rgba(0,0,0,0.6)' }}>
          <video
            ref={vRef} src={project.videoUrl} playsInline muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${currentZoom})`, transition: 'transform 0.15s ease' }}
            className={`${enableColorGrade && project.colorGrade !== 'none' ? `filter-${project.colorGrade}` : ''}`}
          />

          {/* Safe Zone Guides */}
          {showSafeZone && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 40 }}>
              {/* Top safe zone (below status bar ~8%) */}
              <div style={{ position: 'absolute', top: '8%', left: 0, right: 0, height: '1px', background: 'rgba(251,255,0,0.6)' }} />
              {/* Bottom safe zone (above nav ~18%) */}
              <div style={{ position: 'absolute', bottom: '18%', left: 0, right: 0, height: '1px', background: 'rgba(251,255,0,0.6)' }} />
              {/* Side safe zones (~8% each side) */}
              <div style={{ position: 'absolute', top: '8%', bottom: '18%', left: '8%', width: '1px', background: 'rgba(251,255,0,0.4)' }} />
              <div style={{ position: 'absolute', top: '8%', bottom: '18%', right: '8%', width: '1px', background: 'rgba(251,255,0,0.4)' }} />
              {/* Grid overlay */}
              <div style={{ position: 'absolute', top: '8%', left: '8%', right: '8%', bottom: '18%', border: '1px dashed rgba(251,255,0,0.25)', borderRadius: '4px' }} />
              {/* Labels */}
              <div style={{ position: 'absolute', top: '10%', right: '10%', fontSize: '9px', color: 'rgba(251,255,0,0.8)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: '"Inter", sans-serif' }}>SAFE ZONE</div>
            </div>
          )}

          {/* TWO-TONE SUBTITLES */}
          {enableSubtitles && activeSub && (
            <div style={{ position: 'absolute', bottom: '80px', left: 0, right: 0, padding: '0 16px', textAlign: 'center', pointerEvents: 'none', zIndex: 50 }}>
              <div style={{ background: 'rgba(0,0,0,0.88)', padding: '10px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', margin: 0, justifyContent: 'center' }}>
                  {fixDunikTypo(activeSub.text).toUpperCase().split(' ').map((w: string, i: number) => (
                    <span key={i} style={{ color: i % 2 === 0 ? '#FBFF00' : '#FF00FF', fontWeight: 900, fontSize: '14px', textShadow: '2px 2px 0px black', fontFamily: '"Inter", sans-serif' }}>{w}</span>
                  ))}
                </p>
              </div>
            </div>
          )}

          {/* Play/Pause Overlay */}
          {!playing && (
            <div onClick={toggle} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 100 }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(139,92,246,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
                <div style={{ borderLeft: '18px solid white', borderTop: '11px solid transparent', borderBottom: '11px solid transparent', marginLeft: '4px' }} />
              </div>
            </div>
          )}

          {/* Device notch indicator */}
          <div style={{ position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', width: '80px', height: '24px', background: '#000', borderRadius: '0 0 16px 16px', zIndex: 30 }} />
        </div>

        {/* CONTROLS */}
        <div style={{ marginTop: '16px', display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', WebkitOverflowScrolling: 'touch' }}>
          <button onClick={toggle} style={{ padding: '12px 24px', background: '#18181b', color: 'white', borderRadius: '12px', border: '1px solid #27272a', fontWeight: 700, fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: '"Inter", sans-serif', transition: 'all 0.2s' }}>{playing ? 'PAUSE' : 'PLAY'}</button>
          <button onClick={() => onClipSelect(null)} style={{ padding: '12px 24px', background: !activeClipId ? 'rgba(139,92,246,0.2)' : '#18181b', color: 'white', borderRadius: '12px', border: '1px solid #27272a', fontWeight: 700, fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: '"Inter", sans-serif', transition: 'all 0.2s' }}>FULL</button>
          {highlights.map((h: any) => (
            <button key={h.id} onClick={() => { onClipSelect(h.id); vRef.current!.currentTime = h.start; }} style={{ padding: '12px 20px', background: activeClipId === h.id ? 'rgba(139,92,246,0.2)' : '#18181b', color: 'white', borderRadius: '12px', border: '1px solid #27272a', fontWeight: 700, fontSize: '10px', whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: '"Inter", sans-serif', transition: 'all 0.2s' }}>{h.title.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {/* MUSIC SELECTOR */}
      <div style={{ background: 'linear-gradient(180deg, rgba(24,24,27,0.9) 0%, rgba(9,9,11,0.95) 100%)', padding: '20px', borderRadius: '24px', border: '1px solid rgba(30,41,59,0.6)', backdropFilter: 'blur(16px)' }}>
        <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '14px' }}>Music Bus — Hard Locked</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
          {FREE_MUSIC_TRACKS.map(t => (
            <button key={t.id} onClick={() => updateSettings({ selectedMusicTrackId: t.id })} style={{ padding: '14px', borderRadius: '12px', border: project.selectedMusicTrackId === t.id ? '1px solid rgba(139,92,246,0.5)' : '1px solid #27272a', background: project.selectedMusicTrackId === t.id ? 'rgba(139,92,246,0.1)' : '#020617', color: 'white', fontWeight: 700, textAlign: 'left', fontSize: '12px', cursor: 'pointer', fontFamily: '"Inter", sans-serif', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s' }}>
              <span>{t.name}</span>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.genre}</span>
            </button>
          ))}
        </div>

        {/* Volume slider */}
        <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Volume</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: '#8b5cf6', height: '4px', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 600, minWidth: '32px', textAlign: 'right', fontFamily: '"Inter", sans-serif' }}>{Math.round(volume * 100)}%</span>
        </div>
      </div>

      <audio ref={aRef} loop style={{ display: 'none' }} />
    </div>
  );
}
