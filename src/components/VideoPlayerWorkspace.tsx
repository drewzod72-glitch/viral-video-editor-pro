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
  Video,
  Zap,
  Flame,
  CheckCircle2
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

  // Social Simulator states
  const [mockupMode, setMockupMode] = useState<'none' | 'tiktok' | 'reels' | 'shorts'>('none');
  const [showSafeZone, setShowSafeZone] = useState<boolean>(false);
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);
  const [likeCount, setLikeCount] = useState<number>(1284501); 
  const [bookmarkCount, setBookmarkCount] = useState<number>(89243); 
  const [shareCount, setShareCount] = useState<number>(12410); 
  const [commentCount, setCommentCount] = useState<number>(4938); 
  const [showHeartPop, setShowHeartPop] = useState<{ x: number; y: number; id: number }[]>([]);

  // Music search
  const [musicSearchQuery, setMusicSearchQuery] = useState('');
  const [activeMoodFilter, setActiveMoodFilter] = useState<'all' | 'lofi' | 'hype' | 'chill' | 'cinematic'>('all');

  const filteredMusic = FREE_MUSIC_TRACKS.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(musicSearchQuery.toLowerCase()) || 
                         t.genre.toLowerCase().includes(musicSearchQuery.toLowerCase()) ||
                         t.artist.toLowerCase().includes(musicSearchQuery.toLowerCase());
    const matchesMood = activeMoodFilter === 'all' || t.intensity === activeMoodFilter;
    return matchesSearch && matchesMood;
  });

  const triggerTransition = (type?: string) => {
    const t = type || project.transitionStyle || 'flash';
    if (t === 'none') return;
    setTransitionType(t);
    setTransitionActive(true);
    if (project.sfxWhooshEnabled !== false) playViralSFX('swoosh');
    setTimeout(() => setTransitionActive(false), 450);
  };

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
    if (activeClipId && project.transitionStyle && project.transitionStyle !== 'none') {
      triggerTransition(project.transitionStyle);
    }
  }, [activeClipId, project.transitionStyle]);

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
        if (loadedMusicTrackIdRef.current !== activeMusicTrack.id) {
          musicAudioRef.current.src = activeMusicTrack.url;
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

  useEffect(() => {
    if (requestedSeekTime !== undefined && requestedSeekTime !== null && videoRef.current) {
      videoRef.current.currentTime = requestedSeekTime;
      setCurrentTime(requestedSeekTime);
      if (musicAudioRef.current) musicAudioRef.current.currentTime = Math.max(0, requestedSeekTime - startLimit);
      if (onSeekConsumed) onSeekConsumed();
    }
  }, [requestedSeekTime, onSeekConsumed, startLimit]);

  const handleApplyTrim = () => {
    const activeC = project.highlights.find((c) => c.id === activeClipId);
    if (!activeC) return;
    const updatedHighlights = project.highlights.map((cl) => {
      if (cl.id === activeClipId) {
        return {
          ...cl,
          title: fixDunikTypo(clipEditTitle || cl.title),
          start: Number(clipEditStart),
          end: Number(clipEditEnd),
          duration: Number(clipEditEnd) - Number(clipEditStart),
          speed: Number(clipEditSpeed)
        };
      }
      return cl;
    });
    onUpdateProject({ ...project, highlights: updatedHighlights });
    if (project.sfxPopEnabled !== false) playViralSFX('bell');
    triggerTransition(project.transitionStyle);
  };

  const handleDeleteClip = (clipIdToDelete: string) => {
    const updatedHighlights = project.highlights.filter((cl) => cl.id !== clipIdToDelete);
    onUpdateProject({ ...project, highlights: updatedHighlights });
    onClipSelect(null);
  };

  const handleAddCustomClip = () => {
    const newId = `clip_${Date.now()}`;
    const clipStart = Math.max(0, parseFloat(currentTime.toFixed(2)));
    const clipEnd = Math.min(videoDuration, parseFloat((currentTime + 5.0).toFixed(2)));
    const newClip = {
      id: newId,
      title: `Custom Cut ${project.highlights.length + 1}`,
      start: clipStart,
      end: clipEnd,
      duration: clipEnd - clipStart,
      viralityScore: 90,
      description: "User cut",
      whyEngaging: "Manual selection"
    };
    onUpdateProject({ ...project, highlights: [...project.highlights, newClip] });
    onClipSelect(newId);
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

  const restartVideo = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = startLimit;
      setCurrentTime(startLimit);
      if (musicAudioRef.current && activeMusicTrack) musicAudioRef.current.currentTime = 0;
      if (!videoRef.current.paused) videoRef.current.play().catch(() => {});
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
            setCurrentTime(nextHl.start);
            if (project.sfxWhooshEnabled !== false) playViralSFX('whoosh');
            triggerTransition(project.transitionStyle || 'flash');
            return;
          } else {
            videoRef.current.currentTime = project.highlights[0].start;
            setCurrentTime(project.highlights[0].start);
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
          setCurrentTime(nextSub.start);
          if (project.sfxWhooshEnabled !== false) playViralSFX('swoosh');
          triggerTransition(project.transitionStyle);
          return;
        }
      }
    }

    if (videoRef.current && isPlaying && speedRamp && project.subtitles) {
      const activeSub = project.subtitles.find((sub) => t >= sub.start && t <= sub.end);
      videoRef.current.playbackRate = activeSub ? (activeSub.highlightWords?.length ? 0.95 : 1.10) : 1.0;
    }

    if (musicAudioRef.current && !musicAudioRef.current.paused) {
      const expectedMusicTime = Math.max(0, t - startLimit);
      if (Math.abs(musicAudioRef.current.currentTime - expectedMusicTime) > 0.8) {
        musicAudioRef.current.currentTime = expectedMusicTime;
      }
    }

    let matchedSub = null;
    if (enableSubtitles && project.subtitles) {
      const activeSub = project.subtitles.find((sub) => t >= sub.start && t <= sub.end);
      matchedSub = activeSub || null;
      setActiveSubtitle((prev: any) => (prev?.id === activeSub?.id ? prev : activeSub || null));
    } else {
      setActiveSubtitle(null);
    }

    let targetZoom = 1;
    if (enableZooms) {
      if (project.zoomEffects && project.zoomEffects.length > 0) {
        const activeZoom = project.zoomEffects.find((z) => t >= z.timestamp && t <= z.timestamp + z.duration);
        targetZoom = activeZoom ? activeZoom.scale : 1;
      } else if (autoZoomPunch && matchedSub) {
        const subIdx = project.subtitles.findIndex((sub) => sub.id === matchedSub.id);
        targetZoom = subIdx % 2 === 0 ? 1.22 : 1.0;
      }
      if (currentZoomScale !== targetZoom) setCurrentZoomScale(targetZoom);
    } else if (currentZoomScale !== 1) {
      setCurrentZoomScale(1);
    }

    if (isPlaying && sfxSparks) {
      if (matchedSub && matchedSub.id !== lastActiveSubIdRef.current) {
        lastActiveSubIdRef.current = matchedSub.id;
        if (autoZoomPunch) {
          triggerTransition('flash');
          if (project.sfxWhooshEnabled !== false) playViralSFX('whoosh');
        } else {
          playViralSFX(matchedSub.emoji ? 'bell' : 'pop');
        }
        if (shakeOnPunch) {
          setIsShaking(true);
          setTimeout(() => setIsShaking(false), 250);
        }
      } else if (!matchedSub) lastActiveSubIdRef.current = null;
    }
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
      () => setAnalyzeStep(4),
      () => {
        const fullDuration = project.duration || 14;
        let enhancedSubtitles = [...(project.subtitles || [])];
        if (enhancedSubtitles.length > 0) {
          const firstSub = enhancedSubtitles[0].text.replace(/^🚨 |^🤫 |^WAIT! |^STOP! /g, '');
          enhancedSubtitles[0].text = `🤫 THE SECRET TO ${firstSub.toUpperCase()}`;
          enhancedSubtitles[0].highlightWords = ['SECRET'];
          enhancedSubtitles[0].emoji = '🔍';
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
    setTimeout(steps[4], 3200);
  };

  const renderStyledText = () => {
    if (!activeSubtitle) return null;
    const { text, emoji, highlightWords } = activeSubtitle;
    const correctedText = fixDunikTypo(text);
    const correctedHighlights = (highlightWords || []).map(w => fixDunikTypo(w));
    const parts = correctedText.split(' ');
    const styles = getCaptionStyles(project.captionStyle || 'hormozi', correctedText.length, stageWidth);
    return (
      <div className="flex flex-col items-center justify-center text-center max-w-[90%] px-2 mx-auto">
        <div style={{ fontFamily: styles.fontFamily, textTransform: styles.textTransform, transform: `rotate(${captionRotation}deg)`, backgroundColor: styles.hasBox ? styles.boxBg : 'transparent', border: styles.hasBox ? `${styles.boxBorderWidth}px solid ${styles.boxBorder}` : 'none', borderRadius: `${styles.boxRadius}px`, padding: styles.hasBox ? `${styles.boxPaddingY}px ${styles.boxPaddingX}px` : 0 }} className="flex flex-wrap items-center justify-center transition-all duration-150">
          {parts.map((word: string, idx: number) => {
            const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").toLowerCase();
            const isHighlighted = correctedHighlights?.some((w: string) => w.toLowerCase() === cleanWord || cleanWord.includes(w.toLowerCase()));
            return <span key={idx} style={{ fontSize: `${isHighlighted ? styles.highlightFontSize : styles.fontSize}px`, color: isHighlighted ? styles.highlightColor : styles.textColor, fontWeight: project.captionStyle === 'minimalist' ? 500 : 900 }} className="inline-block mx-1">{word}</span>;
          })}
          {emoji && <span style={{ fontSize: `${styles.fontSize * 1.1}px` }} className="ml-1 animate-bounce">{emoji}</span>}
        </div>
      </div>
    );
  };

  const handleStageDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const newHeart = { x: e.clientX - rect.left, y: e.clientY - rect.top, id: Date.now() };
    setShowHeartPop((prev) => [...prev, newHeart]);
    setTimeout(() => setShowHeartPop((prev) => prev.filter((h) => h.id !== newHeart.id)), 850);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-3 flex flex-col bg-slate-950 border border-slate-900 rounded-2xl overflow-hidden shadow-2xl relative">
        <div className="bg-slate-900/80 p-3.5 border-b border-slate-905 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs backdrop-blur-md">
          <div className="flex items-center gap-2"><Smartphone className="w-4 h-4 text-brand-purple" /> <span className="font-extrabold uppercase font-display tracking-wider text-slate-200">Live Mockup & Safe Zone Simulator</span></div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setShowSafeZone(!showSafeZone)} className={`px-3 py-1.5 rounded-lg font-semibold text-[11px] flex items-center gap-1.5 cursor-pointer transition-all border ${showSafeZone ? 'bg-brand-purple/20 text-brand-purple border-brand-purple/40 shadow-[0_0_12px_rgba(139,92,246,0.2)]' : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-900'}`}><Grid className="w-3.5 h-3.5" /> <span>Safe Zones Grid</span></button>
            <div className="h-4 w-px bg-slate-850 hidden sm:block"></div>
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
              {(['none', 'tiktok', 'reels', 'shorts'] as const).map((mode) => (
                <button key={mode} onClick={() => setMockupMode(mode)} className={`px-3 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all ${mockupMode === mode ? 'bg-brand-purple text-white shadow-md font-extrabold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'}`}>{mode}</button>
              ))}
            </div>
          </div>
        </div>

        <div id="video-preview-stage" ref={stageRef} onDoubleClick={handleStageDoubleClick} className="relative aspect-[9/16] h-[500px] max-h-[60vh] max-w-[281px] mx-auto flex items-center justify-center bg-zinc-950 rounded-2xl overflow-hidden select-none shadow-[0_8px_48px_rgba(0,0,0,0.95)] border border-slate-900/80 my-4 cursor-pointer">
          <video ref={videoRef} src={videoSrc} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} playsInline style={{ transform: !isShaking ? `scale(${currentZoomScale})` : undefined }} className={`w-full h-full object-cover transition-all duration-300 ${enableColorGrade && project.colorGrade !== 'none' ? `filter-${project.colorGrade}` : ''} ${isShaking ? 'animate-[rumble]' : ''}`} />
          {transitionActive && <div className={`absolute inset-0 z-40 pointer-events-none animate-${transitionType}-overlay`} />}
          {enableSubtitles && activeSubtitle && <div className={`absolute left-0 right-0 pointer-events-none flex items-center justify-center px-4 z-20 ${project.captionPosition === 'top' ? 'top-16' : project.captionPosition === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-28'}`}>{renderStyledText()}</div>}
          {showHeartPop.map((h) => <div key={h.id} style={{ left: h.x, top: h.y }} className="absolute pointer-events-none z-50 animate-heart-pop"><Heart className="w-16 h-16 text-brand-pink fill-brand-pink" /></div>)}
          {!isPlaying && <div onClick={togglePlay} className="absolute inset-0 bg-slate-950/45 flex items-center justify-center cursor-pointer group z-10"><div className="w-13 h-13 rounded-full bg-brand-purple text-white flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-all"><Play className="w-5.5 h-5.5 fill-white translate-x-0.5" /></div></div>}
        </div>

        <div className="bg-slate-900/60 p-4 border-t border-slate-900 backdrop-blur-md">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] text-slate-400 font-mono w-10">{currentTime.toFixed(1)}s</span>
            <div className="flex-1 relative py-1"><input type="range" min={0} max={videoDuration || 30} step={0.05} value={currentTime} onChange={(e) => { videoRef.current!.currentTime = Number(e.target.value); setCurrentTime(Number(e.target.value)); }} className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-950 accent-brand-purple focus:outline-none" /></div>
            <span className="text-[10px] text-slate-400 font-mono w-10 text-right">{videoDuration.toFixed(1)}s</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button onClick={togglePlay} className="p-2.5 rounded-xl bg-slate-800 text-white transition-all">{isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</button>
              <button onClick={restartVideo} className="p-2.5 rounded-xl bg-slate-800 text-slate-300"><RotateCcw className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-wrap items-center bg-slate-950 p-1 rounded-xl border border-slate-800/80 gap-1">
              <button onClick={() => onClipSelect(null)} className={`px-3 py-1 rounded-lg text-xs ${activeClipId === null ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>Full</button>
              {project.highlights.length > 0 && <button onClick={() => onClipSelect('smart-cuts')} className={`px-3 py-1 rounded-lg text-xs font-bold ${activeClipId === 'smart-cuts' ? 'bg-brand-purple text-white' : 'text-brand-cyan'}`}>AI Cuts</button>}
            </div>
          </div>
        </div>

        <div id="clip-cuts-trimmer-control" className="mt-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80 backdrop-blur-md">
           <div className="flex items-center justify-between mb-3">
             <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5"><Scissors className="w-3.5 h-3.5 text-brand-purple" /> Timeline Clips</h3>
             <button onClick={handleAddCustomClip} className="px-2.5 py-1 text-[10px] bg-brand-cyan/25 text-brand-cyan rounded-lg font-bold transition-all">+ Cut Moment</button>
           </div>
           {activeClipId && activeClipId !== 'smart-cuts' && (
             <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/60">
               <div className="space-y-1"><label className="text-[10px] text-slate-500 font-mono uppercase font-bold">Clip Hook Title</label><input type="text" value={clipEditTitle} onChange={(e) => setClipEditTitle(e.target.value)} className="w-full bg-slate-950 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 focus:border-brand-purple" /></div>
               <button onClick={handleApplyTrim} className="w-full py-1.5 rounded-lg bg-brand-purple text-white font-bold text-xs flex items-center justify-center gap-1.5">Apply Trim</button>
             </div>
           )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5"><Tv className="w-3.5 h-3.5 text-brand-purple" /> AI Subtitles</h3>
          <div className="flex items-center justify-between mb-4 bg-slate-950 p-2.5 rounded-xl border border-slate-800"><span className="text-xs text-slate-300">Display Captions</span><button onClick={() => setEnableSubtitles(!enableSubtitles)} className={`w-10 h-6 rounded-full p-1 transition-all ${enableSubtitles ? 'bg-brand-purple' : 'bg-slate-800'}`}><div className={`w-4 h-4 rounded-full bg-white transition-all ${enableSubtitles ? 'translate-x-4' : 'translate-x-0'}`} /></button></div>
          <div className="grid grid-cols-2 gap-2">
            {(['mrbeast', 'hormozi', 'minimalist', 'impact', 'comic'] as const).map((style) => (
              <button key={style} onClick={() => onUpdateProject({ ...project, captionStyle: style })} className={`p-2 rounded-xl text-left border text-xs capitalize transition-all ${project.captionStyle === style ? 'border-brand-purple bg-brand-purple/10 text-white font-semibold' : 'border-slate-800 bg-slate-950 text-slate-400'}`}>{style}</button>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-4"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Music className="w-3.5 h-3.5 text-brand-cyan" /> Sonic Library</h3><span className="text-[9px] bg-slate-950 px-2 py-0.5 rounded-full text-slate-500 font-bold">{FREE_MUSIC_TRACKS.length} TRACKS</span></div>
          <div className="space-y-3 mb-4"><div className="relative"><input type="text" placeholder="Search feeling..." value={musicSearchQuery} onChange={(e) => setMusicSearchQuery(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-9 py-2 text-xs focus:border-brand-cyan focus:outline-none transition-all placeholder:text-slate-700" /><Sliders className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" /></div></div>
          <div className="max-h-[250px] overflow-y-auto space-y-1.5 custom-scrollbar">
            {filteredMusic.map((t) => (
              <button key={t.id} onClick={() => { onUpdateProject({ ...project, selectedMusicTrackId: t.id }); if (musicAudioRef.current) { musicAudioRef.current.src = t.url; musicAudioRef.current.load(); if (isPlaying) musicAudioRef.current.play().catch(() => {}); } }} className={`w-full text-left p-2.5 rounded-xl border transition-all ${project.selectedMusicTrackId === t.id ? 'border-brand-cyan bg-brand-cyan/10' : 'border-transparent hover:bg-slate-800/40'}`}><div className={`text-xs font-bold truncate ${project.selectedMusicTrackId === t.id ? 'text-brand-cyan' : 'text-slate-200'}`}>{t.name}</div></button>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800/60 space-y-3"><div className="space-y-1.5"><div className="flex justify-between text-[11px] text-slate-400"><span>Music Level</span><span>{Math.round(musicVolume * 100)}%</span></div><input type="range" min={0} max={0.5} step={0.01} value={musicVolume} onChange={(e) => setMusicVolume(Number(e.target.value))} className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-brand-cyan" /></div></div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-4 font-sans">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-brand-cyan animate-pulse" /> AI Booster</h3><span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-brand-green font-mono font-bold">SCORE: {project.viralityScore}%</span></div>
          {isAnalyzing ? (
            <div className="bg-slate-950 p-4 rounded-xl border border-brand-cyan/25 space-y-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 h-[2px] bg-gradient-to-r from-brand-purple via-brand-cyan to-brand-green animate-[shimmer_1.5s_infinite]" style={{ width: '100%' }}></div>
              <div className="flex items-center gap-3"><div className="relative"><div className="w-10 h-10 rounded-full border-2 border-brand-cyan/30 border-t-brand-cyan animate-spin flex items-center justify-center"></div><Wand2 className="w-4 h-4 text-brand-cyan absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-bounce" /></div><div className="flex-1 min-w-0"><h4 className="text-xs font-semibold text-slate-200">Booster Active</h4><p className="text-[10px] text-slate-400 font-mono truncate">{analyzeStep === 0 ? "Analyzing..." : analyzeStep === 1 ? "Trimming..." : analyzeStep === 2 ? "Aligning..." : "Applying FX..."}</p></div></div>
              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden"><div className="bg-gradient-to-r from-brand-purple to-brand-cyan h-1.5 transition-all duration-300" style={{ width: `${(analyzeStep + 1) * 20}%` }} /></div>
            </div>
          ) : (
            <button onClick={runSmartBooster} className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-cyan/95 via-brand-purple/95 to-brand-pink/95 hover:from-brand-cyan hover:to-brand-pink text-white font-bold text-xs flex items-center justify-center gap-2 shadow-[0_4px_20px_-4px_rgba(236,72,153,0.3)] transition-all duration-300 active:scale-95 group cursor-pointer"><Wand2 className="w-4 h-4 group-hover:rotate-12 transition-transform duration-300" /> ⚡ AUTO-EDIT FOR MAXIMUM RETENTION</button>
          )}

          <div className="space-y-2.5 pt-2">
            <label className="block text-[10px] text-slate-500 font-mono uppercase">Engagement Rails</label>
            {[
              { label: 'Jump-Cut Silences', val: jumpCuts, set: setJumpCuts },
              { label: 'Attention Speed Ramping', val: speedRamp, set: setSpeedRamp },
              { label: 'Smart SFX Sparks', val: sfxSparks, set: setSfxSparks },
              { label: 'Emoji Bouncy Overlays', val: emojiBounces, set: setEmojiBounces },
              { label: 'Dramatic Retention Zooms', val: enableZooms, set: setEnableZooms },
              { label: 'Auto-Angle Zoom Punches', val: autoZoomPunch, set: setAutoZoomPunch },
              { label: 'Camera Punch Rumble', val: shakeOnPunch, set: setShakeOnPunch },
              { label: 'Color Grading Filters', val: enableColorGrade, set: setEnableColorGrade }
            ].map((rail) => (
              <div key={rail.label} className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-950 transition-all hover:border-slate-800"><div className="space-y-0.5"><span className="text-[11px] text-slate-200 font-semibold block">{rail.label}</span></div><button onClick={() => rail.set(!rail.val)} className={`w-8 h-4.5 rounded-full p-0.5 transition-all duration-200 cursor-pointer ${rail.val ? 'bg-brand-cyan' : 'bg-slate-800'}`}><div className={`w-3.5 h-3.5 rounded-full bg-white transition-all duration-200 ${rail.val ? 'translate-x-3.5' : 'translate-x-0'}`} /></button></div>
            ))}
          </div>
        </div>
      </div>
      <audio ref={musicAudioRef} loop crossOrigin="anonymous" className="hidden" />
    </div>
  );
}
