import React, { useRef, useState, useEffect } from 'react';
import { VideoProject, MusicTrack, getCaptionStyles } from '../types';
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

  // MASTER SYNC LOOP - V30.4 (RESTORED BEST VERSION UI & LOGIC)
  useEffect(() => {
    let raf: number;
    let lastT = 0;
    const loop = (now: number) => {
      if (vRef.current && playing) {
        const t = vRef.current.currentTime;
        setTime(t);
        
        // Throttled UI logic
        if (now - lastT > 100) {
          // 1. Subtitles
          const s = project.subtitles?.find((i: any) => t >= i.start && t <= i.end);
          if (s?.id !== lastSubId) {
            setActiveSub(s || null);
            setLastSubId(s?.id || null);
            if (s && project.sfxPopEnabled) playViralSFX('pop');
          }
          
          // 2. Zooms
          let zScale = 1.0;
          if (enableZooms) {
            const zoom = project.zoomEffects?.find((z: any) => t >= z.timestamp && t <= z.timestamp + z.duration);
            zScale = zoom ? zoom.scale : (autoZoomPunch && s ? 1.22 : 1.0);
          }
          if (currentZoom !== zScale) setCurrentZoom(zScale);

          // 3. Loop Clip
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

  // AUDIO LOCK
  useEffect(() => {
    if (!aRef.current) return;
    if (activeMusicTrack && playing) {
      if (aRef.current.src !== activeMusicTrack.url) { aRef.current.src = activeMusicTrack.url; aRef.current.load(); }
      aRef.current.play().catch(() => {});
    } else {
      aRef.current.pause();
    }
  }, [playing, activeMusicTrack]);

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
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', paddingBottom: '100px', boxSizing: 'border-box' }}>
      <div style={{ background: '#0f172a', padding: '15px', borderRadius: '32px', border: '1px solid #1e293b' }}>
        
        {/* PREVIEW STAGE */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '280px', aspectRatio: '9/16', background: 'black', margin: '0 auto', borderRadius: '24px', overflow: 'hidden', border: '2px solid #334155' }}>
          <video 
            ref={vRef} src={project.videoUrl} playsInline muted 
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${currentZoom})`, transition: 'transform 0.2s' }}
            className={`${enableColorGrade && project.colorGrade !== 'none' ? `filter-${project.colorGrade}` : ''}`}
          />
          
          {/* TWO-TONE SUBTITLES */}
          {enableSubtitles && activeSub && (
            <div style={{ position: 'absolute', bottom: '80px', left: 0, right: 0, padding: '0 20px', textAlign: 'center', pointerEvents: 'none', zIndex: 50 }}>
              <div style={{ background: 'rgba(0,0,0,0.85)', padding: '12px 18px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <p style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', margin: 0, justifyContent: 'center' }}>
                  {fixDunikTypo(activeSub.text).toUpperCase().split(' ').map((w: string, i: number) => (
                    <span key={i} style={{ color: i % 2 === 0 ? '#FBFF00' : '#FF00FF', fontWeight: '900', fontSize: '15px', textShadow: '2px 2px 0px black' }}>{w}</span>
                  ))}
                </p>
              </div>
            </div>
          )}

          {!playing && (
            <div onClick={toggle} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 100 }}>
               <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', shadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
                  <div style={{ borderLeft: '20px solid white', borderTop: '12px solid transparent', borderBottom: '12px solid transparent', marginLeft: '5px' }} />
               </div>
            </div>
          )}
        </div>

        {/* CONTROLS */}
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px', WebkitOverflowScrolling: 'touch' }}>
          <button onClick={toggle} style={{ padding: '15px 30px', background: '#1e293b', color: 'white', borderRadius: '15px', border: 'none', fontWeight: '900', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>{playing ? 'PAUSE' : 'PLAY'}</button>
          <button onClick={() => onClipSelect(null)} style={{ padding: '15px 30px', background: !activeClipId ? '#8b5cf6' : '#1e293b', color: 'white', borderRadius: '15px', border: 'none', fontWeight: '900', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>FULL</button>
          {highlights.map((h: any) => (
            <button key={h.id} onClick={() => { onClipSelect(h.id); vRef.current!.currentTime = h.start; }} style={{ padding: '15px 30px', background: activeClipId === h.id ? '#8b5cf6' : '#1e293b', color: 'white', borderRadius: '15px', border: 'none', fontWeight: '900', fontSize: '10px', whiteSpace: 'nowrap', cursor: 'pointer' }}>{h.title.toUpperCase()}</button>
          ))}
        </div>
      </div>

      <div style={{ background: '#0f172a', padding: '25px', borderRadius: '28px', border: '1px solid #1e293b' }}>
        <div style={{ color: '#64748b', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '20px' }}>Select Music</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
          {FREE_MUSIC_TRACKS.map(t => (
            <button key={t.id} onClick={() => updateSettings({ selectedMusicTrackId: t.id })} style={{ padding: '15px', borderRadius: '15px', border: project.selectedMusicTrackId === t.id ? '2px solid #8b5cf6' : '1px solid #1e293b', background: '#020617', color: 'white', fontWeight: '800', textAlign: 'left', fontSize: '13px', cursor: 'pointer' }}>{t.name.toUpperCase()}</button>
          ))}
        </div>
      </div>
      <audio ref={aRef} loop style={{ display: 'none' }} />
    </div>
  );
}
