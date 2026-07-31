import React, { useRef, useState, useEffect } from 'react';
import { VideoProject, MusicTrack, getCaptionStyles } from '../types';
import { FREE_MUSIC_TRACKS } from '../data';
import { playViralSFX } from '../utils/sfx';
import { ThumbnailGenerator } from './ThumbnailGenerator';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Sliders,
  Sparkles,
  Tv,
  Scissors,
  Music,
  Smartphone,
  Grid,
  Heart,
  MessageSquare,
  Bookmark,
  Share2,
  Disc,
  Wand2,
  TrendingUp,
  Video,
  Activity,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Zap
} from 'lucide-react';

const fixDunikTypo = (str: string): string => {
  if (!str) return str;
  return str.replace(/dunik/gi, (match) => {
    const map: Record<string, string> = { 'DUNIK': 'DUNK', 'dunik': 'dunk', 'Dunik': 'Dunk' };
    return map[match] || 'Dunk';
  });
};

interface VideoPlayerWorkspaceProps {
  project: VideoProject;
  activeMusicTrack: MusicTrack | null;
  activeClipId: string | null;
  onClipSelect: (clipId: string | null) => void;
  onUpdateProject: (updated: VideoProject) => void;
  requestedSeekTime?: number | null;
  onSeekConsumed?: () => void;
}

export default function VideoPlayerWorkspace({
  project,
  activeMusicTrack,
  activeClipId,
  onClipSelect,
  onUpdateProject,
  requestedSeekTime,
  onSeekConsumed,
}: VideoPlayerWorkspaceProps) {
  const { 
    enableSubtitles,
    enableZooms,
    enableColorGrade,
    musicVolume,
    jumpCuts,
    speedRamp,
    sfxSparks,
    emojiBounces,
    autoZoomPunch,
    shakeOnPunch,
    camRecorderHUD
  } = project;

  const setEnableSubtitles = (val: boolean) => onUpdateProject({ ...project, enableSubtitles: val });
  const setEnableZooms = (val: boolean) => onUpdateProject({ ...project, enableZooms: val });
  const setEnableColorGrade = (val: boolean) => onUpdateProject({ ...project, enableColorGrade: val });
  const setMusicVolume = (val: number) => onUpdateProject({ ...project, musicVolume: val });
  const setJumpCuts = (val: boolean) => onUpdateProject({ ...project, jumpCuts: val });
  const setSpeedRamp = (val: boolean) => onUpdateProject({ ...project, speedRamp: val });
  const setSfxSparks = (val: boolean) => onUpdateProject({ ...project, sfxSparks: val });
  const setEmojiBounces = (val: boolean) => onUpdateProject({ ...project, emojiBounces: val });
  const setAutoZoomPunch = (val: boolean) => onUpdateProject({ ...project, autoZoomPunch: val });
  const setCamRecorderHUD = (val: boolean) => onUpdateProject({ ...project, camRecorderHUD: val });
  const setShakeOnPunch = (val: boolean) => onUpdateProject({ ...project, shakeOnPunch: val });

  const videoRef = useRef<HTMLVideoElement>(null);
  const musicAudioRef = useRef<HTMLAudioElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const loadedMusicTrackIdRef = useRef<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(project.duration || 30);
  const [isMuted, setIsMuted] = useState(false);
  const [currentZoomScale, setCurrentZoomScale] = useState(1);
  const [activeSubtitle, setActiveSubtitle] = useState<any>(null);
  const [autoDucking, setAutoDucking] = useState(true);
  const [continuousMusic, setContinuousMusic] = useState<boolean>(true); 
  const [captionRotation, setCaptionRotation] = useState<number>(project.captionRotation || 0);
  const [stageWidth, setStageWidth] = useState<number>(281);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analyzeStep, setAnalyzeStep] = useState<number>(0);
  const [isShaking, setIsShaking] = useState<boolean>(false);

  const [transitionActive, setTransitionActive] = useState<boolean>(false);
  const [transitionType, setTransitionType] = useState<string>('none');

  const [clipEditTitle, setClipEditTitle] = useState<string>('');
  const [clipEditStart, setClipEditStart] = useState<number>(0);
  const [clipEditEnd, setClipEditEnd] = useState<number>(10);
  const [clipEditSpeed, setClipEditSpeed] = useState<number>(1.0);

  const lastActiveSubIdRef = useRef<string | null>(null);
  const lastZoomScaleRef = useRef<number>(1);

  const [mockupMode, setMockupMode] = useState<'none' | 'tiktok' | 'reels' | 'shorts'>('none');
  const [showSafeZone, setShowSafeZone] = useState<boolean>(false);
  const [likeCount, setLikeCount] = useState<number>(1284501); 
  const [showHeartPop, setShowHeartPop] = useState<{ x: number; y: number; id: number }[]>([]);

  const [musicSearchQuery, setMusicSearchQuery] = useState('');
  const [activeMoodFilter, setActiveMoodFilter] = useState<'all' | 'lofi' | 'hype' | 'chill' | 'cinematic'>('all');

  const filteredMusic = FREE_MUSIC_TRACKS.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(musicSearchQuery.toLowerCase()) || 
                         t.genre.toLowerCase().includes(musicSearchQuery.toLowerCase()) ||
                         t.artist.toLowerCase().includes(musicSearchQuery.toLowerCase());
    const matchesMood = activeMoodFilter === 'all' || t.intensity === activeMoodFilter;
    return matchesSearch && matchesMood;
  });

  useEffect(() => {
    if (!stageRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect && entry.contentRect.width > 0) setStageWidth(entry.contentRect.width);
      }
    });
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setCaptionRotation(project.captionRotation || 0);
  }, [project.captionRotation]);

  useEffect(() => {
    const activeC = project.highlights.find((c) => c.id === activeClipId);
    if (activeC) {
      setClipEditTitle(activeC.title || '');
      setClipEditStart(activeC.start);
      setClipEditEnd(activeC.end);
      setClipEditSpeed(activeC.speed || 1.0);
    }
  }, [activeClipId, project.highlights]);

  useEffect(() => {
    if (musicAudioRef.current) {
      let targetVolume = isMuted ? 0 : musicVolume;
      if (autoDucking && activeSubtitle && !isMuted) targetVolume = musicVolume * 0.25;
      musicAudioRef.current.volume = targetVolume;
    }
  }, [musicVolume, isMuted, activeSubtitle, autoDucking]);

  useEffect(() => {
    if (musicAudioRef.current) {
      if (activeMusicTrack) {
        const musicSrcUrl = activeMusicTrack.url;
        if (loadedMusicTrackIdRef.current !== activeMusicTrack.id) {
          musicAudioRef.current.src = musicSrcUrl;
          musicAudioRef.current.load();
          loadedMusicTrackIdRef.current = activeMusicTrack.id;
        }
      } else {
        musicAudioRef.current.pause();
        musicAudioRef.current.src = '';
        loadedMusicTrackIdRef.current = null;
      }
    }
  }, [activeMusicTrack]);

  useEffect(() => {
    if (musicAudioRef.current && activeMusicTrack) {
      const shouldPlayMusic = isPlaying || continuousMusic;
      if (shouldPlayMusic) musicAudioRef.current.play().catch(() => {});
      else musicAudioRef.current.pause();
    }
  }, [isPlaying, activeMusicTrack, continuousMusic]);

  const selectedClip = project.highlights.find((c) => c.id === activeClipId);
  const startLimit = selectedClip ? selectedClip.start : 0;
  const endLimit = selectedClip ? selectedClip.end : (project.duration || 30);

  const triggerTransition = (type?: string) => {
    const t = type || project.transitionStyle || 'flash';
    if (t === 'none') return;
    setTransitionType(t);
    setTransitionActive(true);
    if (project.sfxWhooshEnabled !== false) playViralSFX('swoosh');
    setTimeout(() => setTransitionActive(false), 450);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const audio = musicAudioRef.current;

    try {
      const AudioCtxClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!(window as any)._viralAudioCtx) (window as any)._viralAudioCtx = new AudioCtxClass();
      if ((window as any)._viralAudioCtx.state === 'suspended') (window as any)._viralAudioCtx.resume();
    } catch (e) {}

    if (video.paused) {
      if (video.currentTime < startLimit - 0.1 || video.currentTime >= endLimit - 0.1) video.currentTime = startLimit;
      if (audio && activeMusicTrack) {
        if (!audio.src || !audio.src.includes(activeMusicTrack.url)) {
           audio.src = activeMusicTrack.url;
           audio.load();
        }
        audio.currentTime = Math.max(0, video.currentTime - startLimit);
        audio.play().catch(() => {
           setTimeout(() => audio.play().catch(() => {}), 100);
        });
      }
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      if (audio) audio.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    setCurrentTime(t);

    if (activeClipId === 'smart-cuts' && project.highlights.length > 0) {
      const currentHlIdx = project.highlights.findIndex((hl) => t >= hl.start && t < hl.end);
      if (currentHlIdx !== -1) {
        const currentHl = project.highlights[currentHlIdx];
        if (t >= currentHl.end - 0.05) {
          if (currentHlIdx < project.highlights.length - 1) {
            const nextHl = project.highlights[currentHlIdx + 1];
            videoRef.current.currentTime = nextHl.start;
            triggerTransition(project.transitionStyle || 'flash');
            return;
          } else {
            videoRef.current.currentTime = project.highlights[0].start;
            videoRef.current.pause();
            setIsPlaying(false);
            return;
          }
        }
      }
    }

    if (activeClipId !== 'smart-cuts' && t >= endLimit) {
      videoRef.current.currentTime = startLimit;
      videoRef.current.pause();
      setIsPlaying(false);
      return;
    }

    if (isPlaying && enableSubtitles && jumpCuts && project.subtitles && project.subtitles.length > 0) {
      const activeSub = project.subtitles.find((sub) => t >= sub.start && t <= sub.end);
      if (!activeSub) {
        const nextSub = project.subtitles.filter((sub) => sub.start > t && sub.start < endLimit).sort((a, b) => a.start - b.start)[0];
        if (nextSub && (nextSub.start - t) > 0.25) {
          videoRef.current.currentTime = nextSub.start;
          triggerTransition(project.transitionStyle);
          return;
        }
      }
    }

    if (videoRef.current && isPlaying && speedRamp && project.subtitles) {
      const activeSub = project.subtitles.find((sub) => t >= sub.start && t <= sub.end);
      videoRef.current.playbackRate = activeSub ? (activeSub.highlightWords?.length ? 0.95 : 1.10) : 1.0;
    }

    if (enableSubtitles && project.subtitles) {
      const sub = project.subtitles.find((s) => t >= s.start && t <= s.end);
      setActiveSubtitle(sub || null);
    } else {
      setActiveSubtitle(null);
    }

    let targetZoom = 1;
    if (enableZooms) {
      const activeZoom = project.zoomEffects?.find((z) => t >= z.timestamp && t <= z.timestamp + z.duration);
      targetZoom = activeZoom ? activeZoom.scale : 1;
      if (currentZoomScale !== targetZoom) setCurrentZoomScale(targetZoom);
    }

    if (isPlaying && sfxSparks && activeSubtitle && activeSubtitle.id !== lastActiveSubIdRef.current) {
      lastActiveSubIdRef.current = activeSubtitle.id;
      playViralSFX(activeSubtitle.emoji ? 'bell' : 'pop');
      if (shakeOnPunch) {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 250);
      }
    } else if (!activeSubtitle) lastActiveSubIdRef.current = null;
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) setVideoDuration(videoRef.current.duration);
  };

  const runSmartBooster = () => {
    setIsAnalyzing(true);
    setAnalyzeStep(0);
    playViralSFX('whoosh');
    const steps = [
      () => setAnalyzeStep(1),
      () => setAnalyzeStep(2),
      () => setAnalyzeStep(3),
      () => {
        const fullDuration = videoDuration || 14;
        let enhancedSubtitles = [...(project.subtitles || [])];
        if (enhancedSubtitles.length > 0) {
          enhancedSubtitles[0].text = `🤫 THE SECRET TO ${enhancedSubtitles[0].text.toUpperCase()}`;
          enhancedSubtitles[0].highlightWords = ['SECRET'];
        }
        const mergedSubtitles: any[] = [];
        for (let i = 0; i < enhancedSubtitles.length; i++) {
          const sub = enhancedSubtitles[i];
          if (mergedSubtitles.length > 0) {
            const last = mergedSubtitles[mergedSubtitles.length - 1];
            if ((last.end - last.start) < 1.5 && (sub.end - last.start) < 4.0) {
              last.text += ' ' + sub.text;
              last.end = sub.end;
              continue;
            }
          }
          mergedSubtitles.push({...sub});
        }
        enhancedSubtitles = mergedSubtitles;
        const newHighlights = [];
        let cur = 0;
        let idx = 0;
        while (cur < fullDuration) {
          const step = 2.2 + Math.random();
          const end = Math.min(cur + step, fullDuration);
          newHighlights.push({
            id: `viral-cut-${idx}`,
            title: idx === 0 ? '🚨 THE HOOK' : `Scene ${idx + 1}`,
            start: cur,
            end: end,
            duration: end - cur,
            viralityScore: 100,
            description: "Viral Interrupt",
            whyEngaging: "High speed",
            speed: idx % 2 === 0 ? 1.08 : 1.0
          });
          cur = end;
          idx++;
        }
        const newZoomEffects = newHighlights.map((hl, i) => ({ timestamp: hl.start, scale: i % 2 === 0 ? 1.28 : 1.0, duration: hl.duration }));
        onUpdateProject({
          ...project,
          subtitles: enhancedSubtitles,
          highlights: newHighlights,
          zoomEffects: newZoomEffects,
          captionStyle: 'hormozi',
          colorGrade: 'vibrant_pop',
          viralityScore: 100,
          enableSubtitles: true,
          enableZooms: true,
          enableColorGrade: true,
          jumpCuts: true,
          speedRamp: true,
          sfxSparks: true,
          emojiBounces: true,
          autoZoomPunch: true,
          shakeOnPunch: true,
        });
        setIsAnalyzing(false);
        onClipSelect('smart-cuts');
      }
    ];
    setTimeout(steps[0], 650);
    setTimeout(steps[1], 1300);
    setTimeout(steps[2], 2000);
    setTimeout(steps[3], 2600);
  };

  const renderStyledText = () => {
    if (!activeSubtitle) return null;
    const { text, emoji, highlightWords = [] } = activeSubtitle;
    const correctedText = fixDunikTypo(text);
    const parts = correctedText.split(' ');
    const styles = getCaptionStyles(project.captionStyle || 'hormozi', correctedText.length, stageWidth);
    return (
      <div className="flex flex-col items-center justify-center text-center max-w-[90%] px-2 mx-auto">
        <div style={{ fontFamily: styles.fontFamily, textTransform: styles.textTransform, backgroundColor: styles.hasBox ? styles.boxBg : 'transparent', borderRadius: `${styles.boxRadius}px`, padding: styles.hasBox ? `${styles.boxPaddingY}px ${styles.boxPaddingX}px` : 0 }} className="flex flex-wrap items-center justify-center">
          {parts.map((word, idx) => {
            const clean = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").toLowerCase();
            const isH = highlightWords.some(h => clean.includes(h.toLowerCase()));
            return <span key={idx} style={{ fontSize: `${isH ? styles.highlightFontSize : styles.fontSize}px`, color: isH ? styles.highlightColor : styles.textColor, fontWeight: project.captionStyle === 'minimalist' ? 500 : 900 }} className="inline-block mx-1.5">{word}</span>;
          })}
          {emoji && <span className="ml-1 animate-bounce">{emoji}</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-3 flex flex-col bg-slate-950 border border-slate-900 rounded-2xl overflow-hidden shadow-2xl relative">
        <div className="bg-slate-900/80 p-3.5 border-b border-slate-905 flex items-center justify-between gap-3 text-xs backdrop-blur-md">
           <div className="flex items-center gap-2"><Smartphone className="w-4 h-4 text-brand-purple" /> <span className="font-extrabold uppercase font-display tracking-wider text-slate-200">Live Mockup</span></div>
           <div className="flex gap-2">
             {(['none', 'tiktok', 'reels', 'shorts'] as const).map(m => (
               <button key={m} onClick={() => setMockupMode(m)} className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${mockupMode === m ? 'bg-brand-purple text-white' : 'text-slate-400 hover:text-slate-200'}`}>{m}</button>
             ))}
           </div>
        </div>

        <div id="video-preview-stage" ref={stageRef} className="relative aspect-[9/16] h-[500px] max-h-[60vh] max-w-[281px] mx-auto flex items-center justify-center bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-900/80 my-4">
          <video ref={videoRef} src={project.videoUrl} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} playsInline style={{ transform: `scale(${currentZoomScale})` }} className={`w-full h-full object-cover transition-all duration-300 ${enableColorGrade && project.colorGrade !== 'none' ? `filter-${project.colorGrade}` : ''} ${isShaking ? 'animate-[rumble]' : ''}`} />
          {enableSubtitles && activeSubtitle && <div className={`absolute left-0 right-0 pointer-events-none flex items-center justify-center px-4 z-20 ${project.captionPosition === 'top' ? 'top-16' : project.captionPosition === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-28'}`}>{renderStyledText()}</div>}
          {!isPlaying && <div onClick={togglePlay} className="absolute inset-0 bg-slate-950/45 flex items-center justify-center cursor-pointer z-10"><div className="w-13 h-13 rounded-full bg-brand-purple text-white flex items-center justify-center shadow-2xl transform group-hover:scale-110"><Play className="w-5.5 h-5.5 fill-white translate-x-0.5" /></div></div>}
        </div>

        <div className="bg-slate-900/60 p-4 border-t border-slate-900 backdrop-blur-md">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] text-slate-400 font-mono w-10">{currentTime.toFixed(1)}s</span>
            <div className="flex-1 relative py-1"><input type="range" min={0} max={videoDuration || 30} step={0.05} value={currentTime} onChange={(e) => { videoRef.current!.currentTime = Number(e.target.value); setCurrentTime(Number(e.target.value)); }} className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-950 accent-brand-purple focus:outline-none" /></div>
            <span className="text-[10px] text-slate-400 font-mono w-10 text-right">{videoDuration.toFixed(1)}s</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-2"><button onClick={togglePlay} className="p-2.5 rounded-xl bg-slate-800 text-white">{isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</button><button onClick={() => { videoRef.current!.currentTime = startLimit; setCurrentTime(startLimit); }} className="p-2.5 rounded-xl bg-slate-800 text-slate-300"><RotateCcw className="w-4 h-4" /></button></div>
            <div className="flex gap-1 bg-slate-950 p-1 rounded-xl"><button onClick={() => onClipSelect(null)} className={`px-3 py-1 rounded-lg text-xs ${activeClipId === null ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>Full</button>{project.highlights.length > 0 && <button onClick={() => onClipSelect('smart-cuts')} className={`px-3 py-1 rounded-lg text-xs font-bold ${activeClipId === 'smart-cuts' ? 'bg-brand-purple text-white shadow-lg' : 'text-brand-cyan'}`}>AI Cuts</button>}</div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5"><Tv className="w-3.5 h-3.5 text-brand-purple" /> AI Subtitles</h3>
          <div className="grid grid-cols-2 gap-2">
            {(['mrbeast', 'hormozi', 'minimalist', 'impact', 'comic'] as const).map(style => (
              <button key={style} onClick={() => onUpdateProject({ ...project, captionStyle: style })} className={`p-2 rounded-xl text-left border text-xs capitalize transition-all ${project.captionStyle === style ? 'border-brand-purple bg-brand-purple/10 text-white font-semibold' : 'border-slate-800 bg-slate-950 text-slate-400'}`}>{style}</button>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5"><Music className="w-3.5 h-3.5 text-brand-cyan" /> Music Library</h3>
          <div className="max-h-[150px] overflow-y-auto space-y-1.5 custom-scrollbar">
            {FREE_MUSIC_TRACKS.map(t => (
              <button key={t.id} onClick={() => onUpdateProject({ ...project, selectedMusicTrackId: t.id })} className={`w-full text-left p-2 rounded-xl border transition-all ${project.selectedMusicTrackId === t.id ? 'border-brand-cyan bg-brand-cyan/10 text-brand-cyan' : 'border-transparent hover:bg-slate-800/40 text-slate-200'}`}><div className="text-xs font-bold truncate">{t.name}</div></button>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-4">
          <div className="flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-brand-cyan animate-pulse" /> AI Booster</h3><span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-brand-green font-mono font-bold">SCORE: {project.viralityScore}%</span></div>
          {isAnalyzing ? (
            <div className="bg-slate-950 p-4 rounded-xl border border-brand-cyan/25 space-y-3 relative overflow-hidden"><div className="w-full bg-slate-900 rounded-full h-1.5 mt-2 overflow-hidden"><div className="bg-brand-purple h-1.5 transition-all duration-300" style={{ width: `${(analyzeStep + 1) * 20}%` }} /></div></div>
          ) : (
            <button onClick={runSmartBooster} className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-cyan/95 via-brand-purple/95 to-brand-pink/95 text-white font-bold text-xs shadow-lg transition-all active:scale-95 group">⚡ AUTO-EDIT FOR MAXIMUM RETENTION</button>
          )}
        </div>
      </div>
      <audio ref={musicAudioRef} loop crossOrigin="anonymous" className="hidden" />
    </div>
  );
}
