import React, { useRef, useState, useEffect } from 'react';
import { VideoProject, MusicTrack, getCaptionStyles, CaptionStyleConfig } from '../types';
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
  Maximize2,
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

// Helper to fix the "DUNIK" -> "DUNK" typo in subtitles, titles, names, descriptions
const fixDunikTypo = (str: string): string => {
  if (!str) return str;
  return str.replace(/dunik/gi, (match) => {
    if (match === match.toUpperCase()) return 'DUNK';
    if (match === match.toLowerCase()) return 'dunk';
    if (match[0] === match[0].toUpperCase()) return 'Dunk';
    return 'Dunk';
  });
};

interface VideoPlayerWorkspaceProps {
  project: VideoProject;
  activeMusicTrack: MusicTrack | null;
  musicVolume: number;
  setMusicVolume: (v: number) => void;
  enableSubtitles: boolean;
  setEnableSubtitles: (b: boolean) => void;
  enableZooms: boolean;
  setEnableZooms: (b: boolean) => void;
  enableColorGrade: boolean;
  setEnableColorGrade: (b: boolean) => void;
  activeClipId: string | null;
  onClipSelect: (clipId: string | null) => void;
  onUpdateProject: (updated: VideoProject) => void;
  requestedSeekTime?: number | null;
  onSeekConsumed?: () => void;
}

export default function VideoPlayerWorkspace({
  project,
  activeMusicTrack,
  musicVolume,
  setMusicVolume,
  enableSubtitles,
  setEnableSubtitles,
  enableZooms,
  setEnableZooms,
  enableColorGrade,
  setEnableColorGrade,
  activeClipId,
  onClipSelect,
  onUpdateProject,
  requestedSeekTime,
  onSeekConsumed,
}: VideoPlayerWorkspaceProps) {
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
  const [continuousMusic, setContinuousMusic] = useState<boolean>(true); // keeps music playing during edits by default
  const [captionRotation, setCaptionRotation] = useState<number>(project.captionRotation || 0);
  const [stageWidth, setStageWidth] = useState<number>(281);

  // Cinematic horizontal transit effects transition states
  const [transitionActive, setTransitionActive] = useState<boolean>(false);
  const [transitionType, setTransitionType] = useState<'none' | 'crossfade' | 'glitch' | 'flash' | 'zoom' | 'fade_black' | 'slide_left'>('none');

  // Interactive Clip specific trimming and addition states
  const [clipEditTitle, setClipEditTitle] = useState<string>('');
  const [clipEditStart, setClipEditStart] = useState<number>(0);
  const [clipEditEnd, setClipEditEnd] = useState<number>(10);
  const [clipEditSpeed, setClipEditSpeed] = useState<number>(1.0);

  const triggerTransition = (type?: 'none' | 'crossfade' | 'glitch' | 'flash' | 'zoom' | 'fade_black' | 'slide_left') => {
    const t = type || project.transitionStyle || 'flash';
    if (t === 'none') return;
    setTransitionType(t);
    setTransitionActive(true);
    if (project.sfxWhooshEnabled !== false) {
      playViralSFX('swoosh');
    }
    setTimeout(() => {
      setTransitionActive(false);
    }, 450);
  };

  // Sync local UI states with project object
  const jumpCuts = project.jumpCuts !== false;
  const speedRamp = project.speedRamp !== false;
  const sfxSparks = project.sfxSparks !== false;
  const emojiBounces = project.emojiBounces !== false;
  const autoZoomPunch = project.autoZoomPunch !== false;
  const camRecorderHUD = project.camRecorderHUD === true;
  const shakeOnPunch = project.shakeOnPunch !== false;

  const setJumpCuts = (val: boolean) => onUpdateProject({ ...project, jumpCuts: val });
  const setSpeedRamp = (val: boolean) => onUpdateProject({ ...project, speedRamp: val });
  const setSfxSparks = (val: boolean) => onUpdateProject({ ...project, sfxSparks: val });
  const setEmojiBounces = (val: boolean) => onUpdateProject({ ...project, emojiBounces: val });
  const setAutoZoomPunch = (val: boolean) => onUpdateProject({ ...project, autoZoomPunch: val });
  const setCamRecorderHUD = (val: boolean) => onUpdateProject({ ...project, camRecorderHUD: val });
  const setShakeOnPunch = (val: boolean) => onUpdateProject({ ...project, shakeOnPunch: val });

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analyzeStep, setAnalyzeStep] = useState<number>(0);
  const [isShaking, setIsShaking] = useState<boolean>(false);

  // Sound effects change boundary trackers
  const lastActiveSubIdRef = useRef<string | null>(null);
  const lastZoomScaleRef = useRef<number>(1);

  // ResizeObserver to track container stage size
  useEffect(() => {
    if (!stageRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect && entry.contentRect.width > 0) {
          setStageWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);

  // Social Simulator Interactive States
  const [mockupMode, setMockupMode] = useState<'none' | 'tiktok' | 'reels' | 'shorts'>('none');
  const [showSafeZone, setShowSafeZone] = useState<boolean>(false);
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);
  const [likeCount, setLikeCount] = useState<number>(1284501); 
  const [bookmarkCount, setBookmarkCount] = useState<number>(89243); 
  const [shareCount, setShareCount] = useState<number>(12410); 
  const [commentCount, setCommentCount] = useState<number>(4938); 
  const [showHeartPop, setShowHeartPop] = useState<{ x: number; y: number; id: number }[]>([]);

  // Music Search & Filter States
  const [musicSearchQuery, setMusicSearchQuery] = useState('');
  const [activeMoodFilter, setActiveMoodFilter] = useState<'all' | 'lofi' | 'hype' | 'chill' | 'cinematic'>('all');

  const filteredMusic = FREE_MUSIC_TRACKS.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(musicSearchQuery.toLowerCase()) || 
                         t.genre.toLowerCase().includes(musicSearchQuery.toLowerCase()) ||
                         t.artist.toLowerCase().includes(musicSearchQuery.toLowerCase());
    const matchesMood = activeMoodFilter === 'all' || t.intensity === activeMoodFilter;
    return matchesSearch && matchesMood;
  });

  // Sync state when project changes
  useEffect(() => {
    setCaptionRotation(project.captionRotation || 0);
  }, [project.captionRotation]);

  // Sync selected clip fields for interactive trimming sliders
  useEffect(() => {
    const activeC = project.highlights.find((c) => c.id === activeClipId);
    if (activeC) {
      setClipEditTitle(activeC.title || '');
      setClipEditStart(activeC.start);
      setClipEditEnd(activeC.end);
      setClipEditSpeed(activeC.speed || 1.0);
    }
  }, [activeClipId, project.highlights]);

  // Trigger cinematic transition upon clip selection switch!
  useEffect(() => {
    if (activeClipId && project.transitionStyle && project.transitionStyle !== 'none') {
      triggerTransition(project.transitionStyle);
    }
  }, [activeClipId, project.transitionStyle]);

  // Sync background music when track, volume, or voice subtitle status changes
  useEffect(() => {
    if (musicAudioRef.current) {
      let targetVolume = isMuted ? 0 : musicVolume;
      if (autoDucking && activeSubtitle && !isMuted) {
        targetVolume = musicVolume * 0.25; // Duck down by 75% during speech/subtitles
      }
      musicAudioRef.current.volume = targetVolume;
    }
  }, [musicVolume, isMuted, activeSubtitle, autoDucking]);

  // Load or change background audio track
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

  // Synchronize background track play/pause states
  useEffect(() => {
    if (musicAudioRef.current && activeMusicTrack) {
      const shouldPlayMusic = isPlaying || continuousMusic;
      if (shouldPlayMusic) {
        musicAudioRef.current.play().catch((err) => {
          console.warn("Autoplay was prevented by browser security gesture constraint:", err);
        });
      } else {
        musicAudioRef.current.pause();
      }
    }
  }, [isPlaying, activeMusicTrack, continuousMusic]);

  // Restrict loops within selected highlight clip if applicable
  const selectedClip = project.highlights.find((c) => c.id === activeClipId);
  const startLimit = selectedClip ? selectedClip.start : 0;
  const endLimit = selectedClip ? selectedClip.end : (project.duration || 30);

  // Handle external requested time seeks
  useEffect(() => {
    if (requestedSeekTime !== undefined && requestedSeekTime !== null && videoRef.current) {
      console.log(`[Video Player Workspace] Seekeing to requested timestamp: ${requestedSeekTime}s`);
      videoRef.current.currentTime = requestedSeekTime;
      setCurrentTime(requestedSeekTime);
      if (musicAudioRef.current) {
        musicAudioRef.current.currentTime = Math.max(0, requestedSeekTime - startLimit);
      }
      if (onSeekConsumed) {
        onSeekConsumed();
      }
    }
  }, [requestedSeekTime, onSeekConsumed, startLimit]);

  // USER CLINICAL CLIP TRIMMING & DYNAMIC HIGHLIGHT SEPARATION HANDLERS
  const handleApplyTrim = () => {
    const activeC = project.highlights.find((c) => c.id === activeClipId);
    if (!activeC) return;
    if (Number(clipEditStart) >= Number(clipEditEnd)) {
      alert("Trim start time must be strictly before trim end time!");
      return;
    }
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

    onUpdateProject({
      ...project,
      highlights: updatedHighlights
    });

    if (project.sfxPopEnabled !== false) {
      playViralSFX('bell');
    }
    triggerTransition(project.transitionStyle);
  };

  const handleDeleteClip = (clipIdToDelete: string) => {
    const updatedHighlights = project.highlights.filter((cl) => cl.id !== clipIdToDelete);
    onUpdateProject({
      ...project,
      highlights: updatedHighlights
    });
    onClipSelect(null);
    if (project.sfxWhooshEnabled !== false) {
      playViralSFX('swoosh');
    }
  };

  const handleAddCustomClip = () => {
    const newId = `clip_${Date.now()}`;
    const clipStart = Math.max(0, parseFloat(currentTime.toFixed(2)));
    const clipEnd = Math.min(videoDuration, parseFloat((currentTime + 5.0).toFixed(2)));
    
    const newClip = {
      id: newId,
      title: `Custom Cut Moment ${project.highlights.length + 1}`,
      start: clipStart,
      end: clipEnd,
      duration: clipEnd - clipStart,
      viralityScore: 90,
      description: "User defined custom cut segment",
      whyEngaging: "Targeted segment extraction for relevant viral layout."
    };

    onUpdateProject({
      ...project,
      highlights: [...project.highlights, newClip]
    });

    onClipSelect(newId);
    if (project.sfxPopEnabled !== false) {
      playViralSFX('bell');
    }
    triggerTransition(project.transitionStyle);
  };

  const videoSrc = project.videoUrl;

  // Handle play/pause toggle in synchronous user touch event context for peak iOS/TikTok performance
  const togglePlay = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const audio = musicAudioRef.current;

    // 1. UNLOCK AUDIO (PERMANENT)
    try {
      const AudioCtxClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!(window as any)._viralAudioCtx) {
        (window as any)._viralAudioCtx = new AudioCtxClass();
      }
      if ((window as any)._viralAudioCtx.state === 'suspended') {
        (window as any)._viralAudioCtx.resume();
      }
    } catch (e) {}

    if (video.paused) {
      if (video.currentTime < startLimit - 0.1 || video.currentTime >= endLimit - 0.1) {
        video.currentTime = startLimit;
      }
      
      // 2. FORCE MUSIC SYNC
      if (audio && activeMusicTrack) {
        // Ensure source is set
        if (!audio.src || !audio.src.includes(activeMusicTrack.url)) {
          audio.src = activeMusicTrack.url;
          audio.load();
        }
        audio.currentTime = Math.max(0, video.currentTime - startLimit);
        audio.play().catch(() => {
          // If blocked, we try again on a small delay
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

  // NEW: Immediate Seek on Clip Selection change
  useEffect(() => {
    if (videoRef.current) {
      console.log(`[Clip Switch] Jumping to start: ${startLimit}s`);
      videoRef.current.currentTime = startLimit;
      setCurrentTime(startLimit);
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [activeClipId, startLimit]);

  const restartVideo = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = startLimit;
      setCurrentTime(startLimit);
      
      const audio = musicAudioRef.current;
      if (audio && activeMusicTrack) {
        audio.currentTime = 0;
      }
      
      if (!videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
        if (audio && activeMusicTrack) {
          audio.play().catch(() => {});
        }
      }
    }
  };

  // Highly optimized unified timeupdate callback. Avoids the 60 FPS requestAnimationFrame React re-render choke.
  // Updates UI state at the native browser-optimized frequency (4-15Hz depending on hardware), ensuring perfect
  // performance and zero video freezes/timeline stutters on TikTok in-app, Safari, or embedded platforms.
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    setCurrentTime(t);

    // Smart-cuts Highlights compilation jump-skipper
    if (activeClipId === 'smart-cuts' && project.highlights && project.highlights.length > 0) {
      const hls = project.highlights;
      const currentHlIdx = hls.findIndex((hl) => t >= hl.start && t < hl.end);

      if (currentHlIdx !== -1) {
        const currentHl = hls[currentHlIdx];
        if (t >= currentHl.end - 0.05) {
          if (currentHlIdx < hls.length - 1) {
            const nextHl = hls[currentHlIdx + 1];
            videoRef.current.currentTime = nextHl.start;
            setCurrentTime(nextHl.start);
            if (project.sfxWhooshEnabled !== false) {
              playViralSFX('whoosh');
            }
            triggerTransition(project.transitionStyle || 'flash');
            return;
          } else {
            videoRef.current.currentTime = hls[0].start;
            setCurrentTime(hls[0].start);
            videoRef.current.pause();
            setIsPlaying(false);
            if (musicAudioRef.current) {
              musicAudioRef.current.pause();
              musicAudioRef.current.currentTime = 0;
            }
            return;
          }
        }
      } else {
        const nextAhead = hls.find((hl) => hl.start > t);
        if (nextAhead) {
          videoRef.current.currentTime = nextAhead.start;
          setCurrentTime(nextAhead.start);
          if (project.sfxWhooshEnabled !== false) {
            playViralSFX('whoosh');
          }
          triggerTransition(project.transitionStyle || 'flash');
          return;
        } else {
          videoRef.current.currentTime = hls[0].start;
          setCurrentTime(hls[0].start);
          return;
        }
      }
    }

    if (activeClipId !== 'smart-cuts') {
      // Limit playback range to highlights bounds
      if (t >= endLimit) {
        videoRef.current.currentTime = startLimit;
        videoRef.current.pause();
        setIsPlaying(false);
        if (musicAudioRef.current) {
          musicAudioRef.current.pause();
          musicAudioRef.current.currentTime = 0;
        }
        return;
      }
    }

    // 1. AI JUMP CUTS GAP SKIPPER (Silence Dead-Space Silencer)
    if (isPlaying && enableSubtitles && jumpCuts && project.subtitles && project.subtitles.length > 0) {
      const activeSub = project.subtitles.find((sub) => t >= sub.start && t <= sub.end);
      if (!activeSub) {
        // We are in a silence gap! Let's find the nearest next subtitle ahead
        const nextSub = project.subtitles
          .filter((sub) => sub.start > t && sub.start < endLimit)
          .sort((a, b) => a.start - b.start)[0];
        if (nextSub && (nextSub.start - t) > 0.25) {
          // Instantly jump cut across silence to the exact syllable start point!
          videoRef.current.currentTime = nextSub.start;
          setCurrentTime(nextSub.start);
          if (project.sfxWhooshEnabled !== false) {
            playViralSFX('swoosh'); // whoosh over silence gap
          }
          if (project.transitionStyle && project.transitionStyle !== 'none') {
            triggerTransition(project.transitionStyle);
          }
          return;
        }
      }
    }

    // 2. AI PACING SPEED RAMP CONTROLLER
    if (videoRef.current) {
      if (activeClipId === 'smart-cuts' && project.highlights && project.highlights.length > 0) {
        const hls = project.highlights;
        const currentHl = hls.find((hl) => t >= hl.start && t < hl.end);
        if (currentHl && currentHl.speed !== undefined) {
          videoRef.current.playbackRate = Number(currentHl.speed);
        } else {
          videoRef.current.playbackRate = 1.0;
        }
      } else if (isPlaying && speedRamp && project.subtitles) {
        const activeSub = project.subtitles.find((sub) => t >= sub.start && t <= sub.end);
        if (activeSub) {
          // Slow down slightly on highlighted highly visual punchy words, run talks 1.10x faster to retain short attention spans!
          const hasHighlights = activeSub.highlightWords && activeSub.highlightWords.length > 0;
          videoRef.current.playbackRate = hasHighlights ? 0.95 : 1.10;
        } else {
          videoRef.current.playbackRate = 1.0;
        }
      } else {
        videoRef.current.playbackRate = 1.0;
      }
    }

    // Align background audio block with the video track to prevent relative playback drift
    // We use a high tolerance (0.8s) to prevent any frequent programmatic audio seeking,
    // which is the primary cause of stuttering, choppy sound, and audio pops. Since the
    // browser's playback clocks are highly stable, this operates as a safe drift guard.
    if (musicAudioRef.current && !musicAudioRef.current.paused) {
      const expectedMusicTime = Math.max(0, t - startLimit);
      if (Math.abs(musicAudioRef.current.currentTime - expectedMusicTime) > 0.8) {
        musicAudioRef.current.currentTime = expectedMusicTime;
      }
    }

    // Apply Subtitle overlays with localized boundary checking (Only triggers React state update when boundary is crossed)
    let matchedSub = null;
    if (enableSubtitles && project.subtitles) {
      const activeSub = project.subtitles.find((sub) => t >= sub.start && t <= sub.end);
      matchedSub = activeSub || null;
      setActiveSubtitle((prev: any) => {
        if (prev?.id === activeSub?.id) return prev;
        return activeSub || null;
      });
    } else if (activeSubtitle !== null) {
      setActiveSubtitle(null);
    }

    // Apply Zoom Effects with localized boundary checking (Only triggers React state update when transition boundary is crossed)
    let targetZoom = 1;
    if (enableZooms) {
      if (project.zoomEffects && project.zoomEffects.length > 0) {
        const activeZoom = project.zoomEffects.find(
          (z) => t >= z.timestamp && t <= z.timestamp + z.duration
        );
        targetZoom = activeZoom ? activeZoom.scale : 1;
      } else if (autoZoomPunch && matchedSub && project.subtitles) {
        const subIdx = project.subtitles.findIndex((sub) => sub.id === matchedSub.id);
        if (subIdx !== -1) {
          // Even indices get beautiful 1.22x lens zoom punch, odd indices get reset to wide 1.0x!
          targetZoom = subIdx % 2 === 0 ? 1.22 : 1.0;
        }
      }
      if (currentZoomScale !== targetZoom) {
        setCurrentZoomScale(targetZoom);
      }
    } else if (currentZoomScale !== 1) {
      setCurrentZoomScale(1);
    }

    // 3. AI SFX SPARKS TRIGGER (Edge-triggered chime pop triggers on active subtitle or zoom transition)
    if (isPlaying && sfxSparks) {
      if (matchedSub && matchedSub.id !== lastActiveSubIdRef.current) {
        const isNewBoundary = lastActiveSubIdRef.current !== null;
        lastActiveSubIdRef.current = matchedSub.id;
        
        // Context-aware checking for fashion / professional luxury niche
        const isFashion = (project.niche as string) === 'fashion' || (project.niche as string) === 'beauty' || (project.title && (project.title.toLowerCase().includes('zendaya') || project.title.toLowerCase().includes('fashion') || project.title.toLowerCase().includes('runway') || project.title.toLowerCase().includes('model')));

        // Dynamic angle alternations & pop transitions
        if (autoZoomPunch && isNewBoundary) {
          // Trigger a beautiful optical-flash transition & instant whoosh sound to simulate professional camera cuts
          triggerTransition('flash');
          if (project.sfxWhooshEnabled !== false) {
            playViralSFX('whoosh');
          }
        } else {
          // Spot emoji pop sound or metallic bell sound (or camera shutter clicks for fashion runway)
          const containsEmoji = matchedSub.emoji || matchedSub.text.match(/[\u{1F300}-\u{1F6FF}]/u);
          if (isFashion) {
            if (project.sfxPopEnabled !== false) {
              playViralSFX('shutter');
            }
          } else {
            if (containsEmoji) {
              if (project.sfxPopEnabled !== false) {
                playViralSFX('bell');
              }
            } else {
              if (project.sfxPopEnabled !== false) {
                playViralSFX('pop');
              }
            }
          }
        }

        // Apply physical visual tilting/rumble camera shake on high-energy words or emojis!
        if (shakeOnPunch) {
          const hasHighlights = matchedSub.highlightWords && matchedSub.highlightWords.length > 0;
          const hasEmoji = matchedSub.emoji || /[\u{1F300}-\u{1F6FF}]/u.test(matchedSub.text);
          if (hasHighlights || hasEmoji) {
            setIsShaking(true);
            setTimeout(() => {
              setIsShaking(false);
            }, 250);
          }
        }
      } else if (!matchedSub) {
        lastActiveSubIdRef.current = null;
      }

      if (!autoZoomPunch && targetZoom !== lastZoomScaleRef.current) {
        if (project.sfxWhooshEnabled !== false) {
          playViralSFX('whoosh');
        }
        lastZoomScaleRef.current = targetZoom;
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const realDur = videoRef.current.duration;
      setVideoDuration(realDur);

      // Smart autonomous project scaling to match real raw physical video length
      const currentProjDur = project.duration || 30;
      if (realDur && realDur > 0 && Math.abs(currentProjDur - realDur) > 0.5) {
        console.log(`[Smart Autonomous AI] Auto-adjusting project from ${currentProjDur}s to raw file's physical speed duration: ${realDur}s`);
        const scale = realDur / currentProjDur;

        const adjustedHighlights = project.highlights.map((h) => {
          const newStart = Number((h.start * scale).toFixed(1));
          const newEnd = Number(Math.min(realDur, h.end * scale).toFixed(1));
          return {
            ...h,
            start: newStart,
            end: newEnd,
            duration: Number((newEnd - newStart).toFixed(1))
          };
        });

        const adjustedSubtitles = (project.subtitles || []).map((s) => {
          const newStart = Number((s.start * scale).toFixed(2));
          const newEnd = Number(Math.min(realDur, s.end * scale).toFixed(2));
          return {
            ...s,
            start: newStart,
            end: newEnd
          };
        });

        const adjustedZoomEffects = (project.zoomEffects || []).map((z) => {
          return {
            ...z,
            timestamp: Number((z.timestamp * scale).toFixed(1)),
            duration: Number((z.duration * scale).toFixed(1))
          };
        });

        onUpdateProject({
          ...project,
          duration: realDur,
          highlights: adjustedHighlights,
          subtitles: adjustedSubtitles,
          zoomEffects: adjustedZoomEffects
        });
      }
    }
  };

  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
      setCurrentTime(val);
    }
    if (musicAudioRef.current) {
      musicAudioRef.current.currentTime = Math.max(0, val - startLimit);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const runSmartBooster = () => {
    setIsAnalyzing(true);
    setAnalyzeStep(0);
    playViralSFX('whoosh');

    const steps = [
      () => { setAnalyzeStep(1); playViralSFX('pop'); },
      () => { setAnalyzeStep(2); playViralSFX('swoosh'); },
      () => { setAnalyzeStep(3); playViralSFX('pop'); },
      () => { setAnalyzeStep(4); playViralSFX('bell'); },
      () => {
        // --- UNSTOPPABLE VIRAL ENGINEERING (V4) ---
        // Protocol: Maximize Dopamine & Force Algorithm Rewatches.
        
        const fullDuration = project.duration || 14;
        let enhancedSubtitles = [...(project.subtitles || [])];
        
        // 1. PSYCHOLOGICAL HOOK (The Investigator Archetype)
        if (enhancedSubtitles.length > 0) {
          const firstSub = enhancedSubtitles[0].text.replace(/^🚨 |^🤫 |^WAIT! |^STOP! /g, '');
          enhancedSubtitles[0].text = `🤫 THE SECRET TO ${firstSub.toUpperCase()}`;
          enhancedSubtitles[0].highlightWords = ['SECRET'];
          enhancedSubtitles[0].emoji = '🔍';
        }

        // 1.5. SLOW DOWN CAPTIONS (Merge short ones for readability)
        const mergedSubtitles: any[] = [];
        for (let i = 0; i < enhancedSubtitles.length; i++) {
          const sub = enhancedSubtitles[i];
          if (mergedSubtitles.length > 0) {
            const last = mergedSubtitles[mergedSubtitles.length - 1];
            // If the last subtitle was very short (less than 1.5s), merge it with the current one
            if ((last.end - last.start) < 1.5 && (sub.end - last.start) < 4.0) {
              last.text += ' ' + sub.text;
              last.end = sub.end;
              if (sub.emoji) last.emoji = sub.emoji;
              continue;
            }
          }
          mergedSubtitles.push({...sub});
        }
        enhancedSubtitles = mergedSubtitles;

        // 2. INFINITY LOOP CTA (The Bridge)
        const loopCTA = {
          id: `loop-${Date.now()}`,
          text: "AND THAT IS WHY...",
          start: fullDuration - 1.2,
          end: fullDuration,
          emoji: "🔁",
          highlightWords: ["WHY"]
        };
        enhancedSubtitles.push(loopCTA);

        // 3. THE HEARTBEAT PACING (Slower for Readability)
        const newHighlights = [];
        let cur = 0;
        let idx = 0;
        while (cur < fullDuration) {
          const step = 2.2 + (Math.random() * 0.5); 
          const end = Math.min(cur + step, fullDuration);
          newHighlights.push({
            id: `viral-cut-${idx}-${Date.now()}`,
            title: idx === 0 ? '🚨 THE HOOK' : `Scene ${idx + 1}`,
            start: cur,
            end: end,
            duration: end - cur,
            viralityScore: 99,
            description: "Dopamine-Pattern Interrupt",
            whyEngaging: "Visual state reset to maintain high hold.",
            speed: idx % 2 === 0 ? 1.08 : 1.0 
          });
          cur = end;
          idx++;
        }

        // 4. PERSPECTIVE PUNCHES (Tension Zooming)
        const newZoomEffects = newHighlights.map((hl, i) => ({
          timestamp: hl.start,
          scale: i % 2 === 0 ? 1.28 : 1.0, // Aggressive punch-ins
          duration: hl.duration
        }));

        // 5. EMOTIONAL COLOR GRADING & MUSIC SYNC
        setIsAnalyzing(false);
        setJumpCuts(true);
        setSpeedRamp(true);
        setSfxSparks(true);
        setEmojiBounces(true);
        setEnableZooms(true);
        setEnableColorGrade(true);
        setEnableSubtitles(true);

        // Auto-select music based on niche if not already set
        let autoMusicId = project.selectedMusicTrackId;
        if (autoMusicId === 'none' || !autoMusicId) {
          if (project.niche === 'fitness') autoMusicId = 'gym-hustle-1';
          else if (project.niche === 'tech') autoMusicId = 'lux-1';
          else if (project.niche === 'cooking') autoMusicId = 'cooking-zen-1';
          else autoMusicId = 'lofi-1';
        }

        onUpdateProject({
          ...project,
          subtitles: enhancedSubtitles,
          colorGrade: project.niche === 'tech' ? 'moody_cyber' : 'vibrant_pop',
          viralityScore: 100,
          captionStyle: 'hormozi', // Best performing for retention (Pink accents)
          selectedMusicTrackId: autoMusicId,
          highlights: newHighlights,
          zoomEffects: newZoomEffects,
          transitionStyle: 'flash',
          viralityFeedback: [
            "🏆 UNSTOPPABLE: Captions slowed down for readability.",
            "🔥 HOOKED: Investigator archetype injected (0.5s).",
            "📈 ALGORITHM BEATEN: 2.2s Heartbeat rhythm applied."
          ]
        });
        
        playViralSFX('laser');
        onClipSelect('smart-cuts');
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(() => {});
            setIsPlaying(true);
          }
        }, 500);
      }
    ];

    setTimeout(steps[0], 650);
    setTimeout(steps[1], 1300);
    setTimeout(steps[2], 2000);
    setTimeout(steps[3], 2600);
    setTimeout(steps[4], 3200);
  };

  // Helper keyword renderer for trendy captions
  const renderStyledText = () => {
    if (!activeSubtitle) return null;
    const { text, emoji, highlightWords } = activeSubtitle;
    const correctedText = fixDunikTypo(text);
    const correctedHighlights = (highlightWords || []).map(w => fixDunikTypo(w));
    const parts = correctedText.split(' ');
    const textLen = correctedText.length;

    // Use our beautiful mathematical shared scaling configuration!
    const styles = getCaptionStyles(project.captionStyle || 'hormozi', textLen, stageWidth);

    const containerStyle: React.CSSProperties = {
      fontFamily: styles.fontFamily,
      textTransform: styles.textTransform,
      letterSpacing: styles.letterSpacing,
      transform: `rotate(${captionRotation}deg)`,
      transition: 'transform 0.15s ease',
    };

    if (styles.hasBox) {
      containerStyle.backgroundColor = styles.boxBg;
      containerStyle.border = `${styles.boxBorderWidth}px solid ${styles.boxBorder}`;
      containerStyle.borderRadius = `${styles.boxRadius}px`;
      containerStyle.padding = `${styles.boxPaddingY}px ${styles.boxPaddingX}px`;
      containerStyle.boxShadow = styles.shadow;
    }

    return (
      <div className="flex flex-col items-center justify-center text-center select-none max-w-[90%] w-auto px-2 mx-auto">
        <div 
          style={containerStyle}
          className={`flex flex-wrap items-center justify-center transition-all duration-150 max-w-full text-center mx-auto ${
            emojiBounces && (emoji || correctedHighlights.length > 0) 
              ? 'scale-105 filter drop-shadow-[0_0_15px_rgba(236,72,153,0.35)]' 
              : ''
          }`}
        >
          {parts.map((word: string, idx: number) => {
            const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").toLowerCase();
            const isHighlighted = correctedHighlights?.some((w: string) => 
              w.toLowerCase() === cleanWord || cleanWord.includes(w.toLowerCase())
            );

            // Determine word-specific dynamic styles based on canonical grid proportions
            const wordFontSize = isHighlighted ? styles.highlightFontSize : styles.fontSize;
            const wordColor = isHighlighted ? styles.highlightColor : styles.textColor;

            const wordStyle: React.CSSProperties = {
              fontSize: `${wordFontSize}px`,
              color: wordColor,
              lineHeight: styles.lineHeight,
              fontWeight: project.captionStyle === 'minimalist' ? 500 : 900,
            };

            // Apply stroke/outline using WebkitTextStroke if applicable
            if (styles.strokeWidth > 0) {
              wordStyle.WebkitTextStroke = `${styles.strokeWidth}px ${styles.strokeColor}`;
              wordStyle.paintOrder = 'stroke fill';
            }

            // Apply textShadow when background container is not drawn
            if (styles.shadow && !styles.hasBox) {
              wordStyle.textShadow = styles.shadow;
            }

            // Extra styling
            let extraClasses = '';
            if (isHighlighted && project.captionStyle === 'mrbeast') {
              extraClasses = 'scale-105 font-extrabold animate-pulse';
            } else if (isHighlighted && project.captionStyle === 'hormozi') {
              extraClasses = 'scale-105 font-black';
            }

            return (
              <span 
                key={idx} 
                style={wordStyle}
                className={`${extraClasses} transition-all duration-100 inline-block break-words ${idx < parts.length - 1 ? 'mr-1.5' : ''}`}
              >
                {word}
              </span>
            );
          })}
          {emoji && (
            <span 
              style={{ fontSize: `${styles.fontSize * 1.1}px`, animationDuration: '1.5s' }} 
              className="ml-1 animate-bounce inline-block"
            >
              {emoji}
            </span>
          )}
        </div>
      </div>
    );
  };

  const handleStageDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Auto toggle Like state to true if not already liked
    if (!isLiked) {
      setIsLiked(true);
      setLikeCount(prev => prev + 1);
    }

    // Spawn a new heart popup with dynamic random tilt
    const newHeart = {
      x,
      y,
      id: Date.now() + Math.random(),
    };
    
    setShowHeartPop((prev) => [...prev, newHeart]);
    
    // Auto-clean heart popup after animation completes
    setTimeout(() => {
      setShowHeartPop((prev) => prev.filter((h) => h.id !== newHeart.id));
    }, 850);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Video Studio screen */}
      <div className="lg:col-span-3 flex flex-col bg-slate-950 border border-slate-900 rounded-2xl overflow-hidden shadow-2xl relative">
        
        {/* Real-Time Social Platform Preview Selector Control Bar */}
        <div className="bg-slate-900/80 p-3.5 border-b border-slate-905 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-brand-purple" />
            <span className="font-extrabold uppercase font-display tracking-wider text-slate-200">
              Live Mockup & Safe Zone Simulator
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Safe Zone Grid Toggle Button */}
            <button
              type="button"
              onClick={() => setShowSafeZone(!showSafeZone)}
              className={`px-3 py-1.5 rounded-lg font-semibold text-[11px] flex items-center gap-1.5 cursor-pointer transition-all border ${
                showSafeZone
                  ? 'bg-brand-purple/20 text-brand-purple border-brand-purple/40 shadow-[0_0_12px_rgba(139,92,246,0.2)]'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Safe Zones Grid</span>
              <span className={`w-1.5 h-1.5 rounded-full ${showSafeZone ? 'bg-brand-purple animate-pulse' : 'bg-slate-600'}`} />
            </button>

            <div className="h-4 w-px bg-slate-850 hidden sm:block"></div>

            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
              {([
                { id: 'none', label: 'Off', icon: '🎬' },
                { id: 'tiktok', label: 'TikTok', icon: '🎵' },
                { id: 'reels', label: 'Reels', icon: '📸' },
                { id: 'shorts', label: 'Shorts', icon: '📺' }
              ] as const).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    setMockupMode(mode.id);
                  }}
                  className={`px-3 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all ${
                    mockupMode === mode.id
                      ? 'bg-brand-purple text-white shadow-md font-extrabold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                >
                  <span className="mr-1">{mode.icon}</span>
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute top-18 left-3 z-10 flex gap-2 pointer-events-none">
          <span className="bg-slate-900/95 text-[10px] text-slate-300 px-2.5 py-1 rounded-full font-mono font-medium border border-slate-800/80 flex items-center gap-1.5 backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse"></span>
            Auto Trim Highlights
          </span>
          {activeClipId && (
            <span className="bg-brand-purple/95 text-xs text-white px-2.5 py-1 rounded-full font-display border border-brand-purple/10 flex items-center gap-1">
              <Scissors className="w-3.5 h-3.5" />
              Active Highlight: {selectedClip?.title}
            </span>
          )}
        </div>

        {/* Video Stage and Subtitle overlays container */}
        <div 
          id="video-preview-stage" 
          ref={stageRef}
          onDoubleClick={handleStageDoubleClick}
          className="relative aspect-[9/16] h-[500px] max-h-[60vh] max-w-[281px] mx-auto flex items-center justify-center bg-zinc-950 rounded-2xl overflow-hidden select-none shadow-[0_8px_48px_rgba(0,0,0,0.95)] border border-slate-900/80 my-4 cursor-pointer"
        >
          <video
            ref={videoRef}
            src={videoSrc}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            playsInline
            style={{
              '--zoom-scale': currentZoomScale,
              transform: !isShaking ? `scale(${currentZoomScale})` : undefined,
              transition: 'transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)',
            } as React.CSSProperties}
            className={`w-full h-full object-cover transition-all duration-300
              ${enableColorGrade && project.colorGrade !== 'none' ? `filter-${project.colorGrade}` : ''}
              ${isShaking ? 'animate-[rumble]' : ''}
            `}
          />

          {/* Camcorder Retro Camera Outline HUD Overlay */}
          {camRecorderHUD && (
            <div className="absolute inset-0 z-30 pointer-events-none border border-brand-cyan/20 flex flex-col justify-between p-3 font-mono text-[9px] text-cyan-400/90 tracking-wide uppercase">
              {/* Top Bar */}
              <div className="flex justify-between items-center bg-black/40 px-1.5 py-1 rounded backdrop-blur-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse inline-block" />
                  <span className="font-bold">REC 1080P</span>
                </div>
                <div>
                  <span>AUTO SPEED: {speedRamp ? '1.10X' : '1.0X'}</span>
                </div>
              </div>
              
              {/* Focus Corners */}
              <div className="absolute inset-4 border border-dashed border-white/5 rounded-md">
                {/* Target Sights */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/30" />
                  <div className="absolute w-4 h-0.5 bg-white/5" />
                  <div className="absolute h-4 w-0.5 bg-white/5" />
                </div>
                
                {/* Custom corners */}
                <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-400" />
                <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-cyan-400" />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-cyan-400" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-cyan-400" />
              </div>

              {/* Bottom Bar */}
              <div className="flex justify-between items-center bg-black/40 px-1.5 py-1 rounded backdrop-blur-xs mt-auto">
                <span>CH1-GATE: ACTIVE</span>
                <span>RETENTION: 98%</span>
              </div>
            </div>
          )}

          {/* Interactive Cinematic Transition Effects Overlay */}
          {transitionActive && transitionType !== 'none' && (
            <div 
              className={`absolute inset-0 z-40 pointer-events-none transition-all ${
                transitionType === 'flash' ? 'animate-flash-overlay' :
                transitionType === 'fade_black' ? 'animate-fade-black-overlay' :
                transitionType === 'glitch' ? 'animate-glitch-overlay' :
                transitionType === 'zoom' ? 'animate-zoom-overlay bg-black/10' :
                transitionType === 'crossfade' ? 'animate-fade-overlay bg-slate-950/40 backdrop-blur-xs' :
                transitionType === 'slide_left' ? 'animate-slide-overlay' : ''
              }`} 
            />
          )}

          {/* Subtitles Overlay (shifted or centered based on the designated Caption Position Layout) */}
          {enableSubtitles && activeSubtitle && (
            <div className={`absolute left-0 right-0 pointer-events-none flex items-center justify-center px-4 z-20 transition-all duration-300 ${
              project.captionPosition === 'top' 
                ? 'top-16' 
                : project.captionPosition === 'center' 
                  ? 'top-1/2 -translate-y-1/2' 
                  : mockupMode !== 'none' ? 'bottom-28' : 'bottom-12'
            }`}>
              {renderStyledText()}
            </div>
          )}

          {/* Double-tap Floating heart popup animations */}
          {showHeartPop.map((h) => (
            <div
              key={h.id}
              style={{ left: h.x, top: h.y }}
              className="absolute pointer-events-none z-50 transform"
            >
              <div className="absolute -translate-x-1/2 -translate-y-1/2 animate-heart-pop">
                <Heart className="w-16 h-16 text-brand-pink fill-brand-pink filter drop-shadow-[0_0_15px_rgba(236,72,153,0.85)]" />
              </div>
            </div>
          ))}

          {/* Safe Zone Alignment Guides lines */}
          {showSafeZone && (
            <div className="absolute inset-0 border border-dashed border-brand-pink/40 pointer-events-none z-30 flex flex-col justify-between p-3">
              <div className="flex justify-between items-center bg-black/90 py-1 px-1.5 rounded border border-brand-pink/25 text-[8px] font-mono text-brand-pink leading-none">
                <span>⚠️ HEADER AREA (TOP 18%)</span>
                <span>COVERED</span>
              </div>
              
              <div className="self-center flex flex-col items-center justify-center text-[10px] text-slate-400 font-mono select-none bg-black/85 px-3 py-1.5 rounded-lg border border-slate-800">
                <span className="text-[7px] text-brand-green font-extrabold uppercase tracking-wider">✓ IDEAL SAFE ZONE</span>
                <span className="text-[8px] text-slate-500 font-medium">Text Kept Here is Safe</span>
              </div>

              <div className="flex justify-between items-center bg-black/90 py-1 px-1.5 rounded border border-brand-pink/25 text-[8px] font-mono text-brand-pink leading-none">
                <span>⚠️ CONTROLS EXCLUSION (BOTTOM 25%)</span>
                <span>COVERED</span>
              </div>
            </div>
          )}

          {/* TikTok Platform Mockup Layer */}
          {mockupMode === 'tiktok' && (
            <div className="absolute inset-0 pointer-events-none z-30 flex flex-col justify-between text-white p-3 font-sans text-xs">
              {/* Header Tab labels */}
              <div className="flex justify-center gap-4 text-[11px] font-bold text-slate-300 pt-1 pointer-events-auto">
                <span className="hover:text-white cursor-pointer select-none">Following</span>
                <div className="relative">
                  <span className="text-white select-none font-black">For You</span>
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4.5 h-[3px] bg-white rounded-full"></span>
                </div>
              </div>

              {/* Help Guidance for interaction */}
              {!isPlaying && (
                <div className="absolute inset-x-0 top-1/3 text-center pointer-events-none select-none flex flex-col items-center">
                  <span className="text-[9.5px] bg-black/75 text-slate-200 font-bold px-3 py-1 rounded-full border border-slate-800 backdrop-blur-sm animate-pulse shadow-xl">
                    💡 Double-Tap Video Screen to Like!
                  </span>
                </div>
              )}

              {/* Right panel action lists */}
              <div className="absolute right-1.5 bottom-16 flex flex-col items-center gap-3.5 pointer-events-auto z-40">
                {/* Creator Avatar */}
                <div className="relative mb-1 shadow-lg">
                  <div className="w-9 h-9 rounded-full border border-white bg-slate-950 p-[1.5px] overflow-hidden">
                    <div className="w-full h-full rounded-full bg-gradient-to-tr from-brand-purple via-brand-cyan to-brand-pink flex items-center justify-center text-[10px] font-black text-white">
                      DV
                    </div>
                  </div>
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-brand-pink border border-slate-950 flex items-center justify-center font-black text-white text-[9px] cursor-pointer hover:scale-115 transition-all">
                    +
                  </span>
                </div>

                {/* Like Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsLiked(!isLiked);
                    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
                  }}
                  className="flex flex-col items-center cursor-pointer group"
                >
                  <div className="p-1 rounded-full bg-black/25 group-hover:bg-black/40 transition-all">
                    <Heart 
                      className={`w-6 h-6 stroke-white stroke-[2.5px] transition-all duration-300 ${
                        isLiked 
                          ? 'fill-brand-pink text-brand-pink scale-120 filter drop-shadow-[0_0_8px_rgba(236,72,153,0.7)]' 
                          : 'fill-transparent hover:scale-110'
                      }`} 
                    />
                  </div>
                  <span className="text-[9px] font-sans font-black text-slate-200 text-center tracking-tighter">
                    {(likeCount / 1000000).toFixed(1)}M
                  </span>
                </button>

                {/* Comments Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCommentCount(prev => prev + 1);
                  }}
                  className="flex flex-col items-center cursor-pointer group"
                >
                  <div className="p-1 rounded-full bg-black/25 group-hover:bg-black/40 transition-all">
                    <MessageSquare className="w-6 h-6 text-white stroke-[2.5px] hover:scale-110 transition-transform" />
                  </div>
                  <span className="text-[9px] font-sans font-black text-slate-200 text-center tracking-tighter">
                    {(commentCount / 1000).toFixed(1)}K
                  </span>
                </button>

                {/* Bookmark Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsBookmarked(!isBookmarked);
                    setBookmarkCount(prev => isBookmarked ? prev - 1 : prev + 1);
                  }}
                  className="flex flex-col items-center cursor-pointer group"
                >
                  <div className="p-1 rounded-full bg-black/25 group-hover:bg-black/40 transition-all">
                    <Bookmark 
                      className={`w-6 h-6 stroke-white stroke-[2.5px] transition-all duration-300 ${
                        isBookmarked 
                          ? 'fill-brand-yellow text-brand-yellow scale-120 filter drop-shadow-[0_0_8px_rgba(234,179,8,0.7)]' 
                          : 'fill-transparent hover:scale-110'
                      }`} 
                    />
                  </div>
                  <span className="text-[9px] font-sans font-black text-slate-200 text-center tracking-tighter">
                    {(bookmarkCount / 1000).toFixed(1)}K
                  </span>
                </button>

                {/* Share Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShareCount(prev => prev + 1);
                  }}
                  className="flex flex-col items-center cursor-pointer group"
                >
                  <div className="p-1 rounded-full bg-black/25 group-hover:bg-black/40 transition-all">
                    <Share2 className="w-6 h-6 text-white stroke-[2.5px] hover:scale-110 transition-transform" />
                  </div>
                  <span className="text-[9px] font-sans font-black text-slate-200 text-center tracking-tighter">
                    {(shareCount / 1000).toFixed(1)}K
                  </span>
                </button>

                {/* Disk Vinyl spinning */}
                <div className="mt-1">
                  <div className={`w-7.5 h-7.5 rounded-full border border-slate-700 bg-slate-950 p-1 flex items-center justify-center ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '4.5s' }}>
                    <div className="w-full h-full rounded-full bg-brand-cyan/20 flex items-center justify-center p-0.5">
                      <Disc className="w-full h-full text-brand-cyan" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom detail card text cover */}
              <div className="absolute bottom-3 left-2 right-12 text-left pointer-events-auto z-40 flex flex-col gap-1 select-none">
                <div className="flex items-center gap-1 font-extrabold text-white">
                  <span className="hover:underline cursor-pointer">@viral_creator</span>
                  <span className="bg-brand-cyan text-[8px] text-black px-1 rounded-full tracking-tighter font-black font-sans uppercase">✓ VERIFIED</span>
                </div>
                <p className="text-[10px] text-slate-100 font-normal leading-normal select-text">
                  Replicating smooth subtitles alignment for TikTok feeds. 🔥📈 #editing #viral #fyp
                </p>
                <div className="flex items-center gap-1.5 text-[9px] text-slate-300 bg-black/40 py-0.5 px-2 rounded-full border border-white/5 max-w-fit overflow-hidden">
                  <Music className="w-3 h-3 text-brand-purple shrink-0" />
                  <span className="text-[8.5px] whitespace-nowrap">Original Audio • 60fps Safe</span>
                </div>
              </div>
            </div>
          )}

          {/* Instagram Reels Platform Mockup Layer */}
          {mockupMode === 'reels' && (
            <div className="absolute inset-0 pointer-events-none z-30 flex flex-col justify-between text-white p-3 font-sans text-xs">
              <div className="flex justify-between items-center w-full pt-1 pointer-events-auto">
                <span className="font-extrabold text-[13.5px] font-display text-white select-none">Reels</span>
                <div className="p-1 hover:bg-black/30 rounded-full cursor-pointer">
                  <Sliders className="w-3.5 h-3.5 text-white" />
                </div>
              </div>

              {/* Right side buttons */}
              <div className="absolute right-1.5 bottom-12 flex flex-col items-center gap-3.5 pointer-events-auto z-40">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsLiked(!isLiked);
                    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
                  }}
                  className="flex flex-col items-center cursor-pointer"
                >
                  <div className="p-1 rounded-full bg-black/20 hover:bg-black/40 transition-all">
                    <Heart className={`w-5.5 h-5.5 ${isLiked ? 'fill-rose-600 text-rose-600 stroke-rose-600 scale-115' : 'text-white'}`} />
                  </div>
                  <span className="text-[9px] font-semibold text-slate-200">
                    {(likeCount / 1000).toFixed(0)}K
                  </span>
                </button>

                <button
                  type="button"
                  className="flex flex-col items-center"
                >
                  <div className="p-1 rounded-full bg-black/20 hover:bg-black/40">
                    <MessageSquare className="w-5.5 h-5.5 text-white" />
                  </div>
                  <span className="text-[9px] font-semibold text-slate-200">{(commentCount / 120).toFixed(0)}</span>
                </button>

                <button
                  type="button"
                  className="flex flex-col items-center"
                >
                  <div className="p-1 rounded-full bg-black/20 hover:bg-black/40">
                    <Share2 className="w-5.5 h-5.5 text-white -rotate-12" />
                  </div>
                  <span className="text-[9px] font-semibold text-slate-200">Send</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsBookmarked(!isBookmarked);
                    setBookmarkCount(prev => isBookmarked ? prev - 1 : prev + 1);
                  }}
                  className="flex flex-col items-center"
                >
                  <div className="p-1 rounded-full bg-black/20 hover:bg-black/40">
                    <Bookmark className={`w-5.5 h-5.5 ${isBookmarked ? 'fill-amber-400 text-amber-400 stroke-amber-400' : 'text-white'}`} />
                  </div>
                  <span className="text-[9px] font-semibold text-slate-200">Save</span>
                </button>
              </div>

              {/* Bottom Details Section */}
              <div className="absolute bottom-3 left-2 right-12 text-left pointer-events-auto z-40 flex flex-col gap-1 text-[11px] select-none">
                <div className="flex items-center gap-1.5 font-bold">
                  <div className="w-5.5 h-5.5 rounded-full bg-brand-purple flex items-center justify-center text-[9px] text-white font-black">DV</div>
                  <span className="text-white hover:underline cursor-pointer text-[10.5px]">viral_creator</span>
                  <span className="text-[8px] border border-white/50 px-1 rounded hover:bg-white/15 text-white leading-none">Follow</span>
                </div>
                <p className="text-[9.5px] text-zinc-100 max-w-[190px] leading-relaxed">
                  Instagram reels overlay guidelines. 📸⚡ #creatoreconomy
                </p>
                <div className="flex items-center gap-1 text-[8px] text-zinc-400">
                  <Music className="w-2.5 h-2.5 text-slate-400" />
                  <span>Original sound • viral_creator</span>
                </div>
              </div>
            </div>
          )}

          {/* YouTube Shorts Platform Mockup Layer */}
          {mockupMode === 'shorts' && (
            <div className="absolute inset-0 pointer-events-none z-30 flex flex-col justify-between text-white p-3 font-sans text-xs">
              <div className="flex justify-between items-center w-full pt-1">
                <div className="flex items-center gap-1 text-white text-[10px] font-extrabold bg-red-600/95 px-2 py-0.5 rounded shadow-md select-none">
                  <span>● SHORTS</span>
                </div>
              </div>

              {/* Right panel items */}
              <div className="absolute right-1.5 bottom-12 flex flex-col items-center gap-3.5 pointer-events-auto z-40">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsLiked(!isLiked);
                    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
                  }}
                  className="flex flex-col items-center cursor-pointer"
                >
                  <div className="p-2 rounded-full bg-black/30 hover:bg-black/55 text-white">
                    <Heart className={`w-5 h-5 ${isLiked ? 'fill-rose-500 text-rose-500 stroke-rose-500 scale-110' : 'text-white'}`} />
                  </div>
                  <span className="text-[9px] font-bold text-slate-200 mt-0.5">
                    {(likeCount / 1000).toFixed(0)}K
                  </span>
                </button>

                <button
                  type="button"
                  className="flex flex-col items-center"
                >
                  <div className="p-2 rounded-full bg-black/30 hover:bg-black/55 text-white">
                    <Heart className="w-5 h-5 text-white rotate-180" />
                  </div>
                  <span className="text-[9px] font-bold text-slate-200 mt-0.5">Dislike</span>
                </button>

                <button
                  type="button"
                  className="flex flex-col items-center"
                >
                  <div className="p-2 rounded-full bg-black/30 hover:bg-black/55 text-white">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[9px] font-bold text-slate-200 mt-0.5">{(commentCount / 80).toFixed(0)}</span>
                </button>

                <button
                  type="button"
                  className="flex flex-col items-center"
                >
                  <div className="p-2 rounded-full bg-black/30 hover:bg-black/55 text-white">
                    <Share2 className="w-5 h-5 text-white scale-x-[-1]" />
                  </div>
                  <span className="text-[9px] font-semibold text-slate-200 mt-0.5">Share</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsBookmarked(!isBookmarked);
                    setBookmarkCount(prev => isBookmarked ? prev - 1 : prev + 1);
                  }}
                  className="flex flex-col items-center cursor-pointer"
                >
                  <div className="p-2 rounded-full bg-black/30 hover:bg-black/55 text-white">
                    <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-amber-400 text-amber-400' : 'text-white'}`} />
                  </div>
                  <span className="text-[9px] font-semibold text-slate-200 mt-0.5">Save</span>
                </button>
              </div>

              {/* Bottom Subscriptions information */}
              <div className="absolute bottom-3 left-2 right-12 text-left pointer-events-auto z-40 flex flex-col gap-1.5 leading-none select-none">
                <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                  <span className="font-extrabold text-white">@viral_creator</span>
                  <span className="bg-red-600 text-[8.5px] text-white font-heavy px-2 py-0.5 rounded uppercase font-black">SUBSCRIBE</span>
                </div>
                <p className="text-[9.5px] text-slate-200 font-normal leading-normal select-text">
                  YouTube shorts vertical layout safe bounds testing.
                </p>
                <div className="flex items-center gap-1 text-[8px] text-slate-400 bg-black/35 py-0.5 px-2 rounded">
                  <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                  <span>Original audio • @viral_creator</span>
                </div>
              </div>
            </div>
          )}

          {/* Audio mix player element */}
          <audio
            ref={musicAudioRef}
            loop
            crossOrigin="anonymous"
            onPlay={(e) => {
              const targetV = isMuted ? 0 : (autoDucking && activeSubtitle ? musicVolume * 0.25 : musicVolume);
              e.currentTarget.volume = targetV;
            }}
            onPlaying={(e) => {
              const targetV = isMuted ? 0 : (autoDucking && activeSubtitle ? musicVolume * 0.25 : musicVolume);
              e.currentTarget.volume = targetV;
            }}
            className="hidden"
          />

          {/* Tap-to-play subtle container */}
          {!isPlaying && (
            <div
              onClick={togglePlay}
              className="absolute inset-0 bg-slate-950/45 hover:bg-slate-950/25 flex items-center justify-center cursor-pointer group transition-all duration-200 z-10"
            >
              <div className="w-13 h-13 rounded-full bg-brand-purple hover:bg-brand-pink text-white flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-all duration-200">
                <Play className="w-5.5 h-5.5 fill-white translate-x-0.5" />
              </div>
            </div>
          )}
        </div>

        {/* Studio Timeline Control Dashboard */}
        <div className="bg-slate-900/60 p-4 border-t border-slate-900 backdrop-blur-md">
          {/* Custom track visual bar */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] text-slate-400 font-mono w-10">
              {currentTime.toFixed(1)}s
            </span>
            <div className="flex-1 relative group py-1">
              {/* Highlight segment guides */}
              {project.highlights.map((clip) => {
                const percentageStart = (clip.start / videoDuration) * 100;
                const percentageWidth = ((clip.end - clip.start) / videoDuration) * 100;
                return (
                  <div
                    key={clip.id}
                    title={`Highlight Moment: ${clip.title}`}
                    className={`absolute top-0 bottom-0 pointer-events-none rounded-sm border-x border-slate-950/60 transition-all duration-200 ${
                      activeClipId === clip.id ? 'bg-brand-purple/20' : 'bg-slate-700/20'
                    }`}
                    style={{ left: `${percentageStart}%`, width: `${percentageWidth}%` }}
                  />
                );
              })}

              <input
                type="range"
                min={0}
                max={videoDuration || 30}
                step={0.05}
                value={currentTime}
                onChange={handleTimelineChange}
                className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-950 accent-brand-purple focus:outline-none"
              />
            </div>
            <span className="text-[10px] text-slate-400 font-mono w-10 text-right">
              {videoDuration.toFixed(1)}s
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                className="p-2.5 rounded-xl bg-slate-800 text-white hover:bg-brand-purple/20 hover:text-brand-purple transition-all duration-150"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
              </button>
              <button
                type="button"
                onClick={restartVideo}
                className="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition-all duration-150"
                title="Restart playback"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <div className="h-4 w-px bg-slate-800 mx-1"></div>
              <button
                type="button"
                onClick={toggleMute}
                className="p-2.5 rounded-xl text-slate-400 hover:text-slate-200 transition-all duration-150"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Quick multi version select templates */}
            <div className="flex flex-wrap items-center bg-slate-950 p-1 rounded-xl border border-slate-800/80 gap-1">
              <button
                type="button"
                onClick={() => onClipSelect(null)}
                className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200 ${
                  activeClipId === null
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Full Video
              </button>
              {project.highlights.length > 0 && (
                <button
                  type="button"
                  onClick={() => onClipSelect('smart-cuts')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 flex items-center gap-1 ${
                    activeClipId === 'smart-cuts'
                      ? 'bg-gradient-to-r from-brand-purple to-brand-cyan text-white shadow-lg shadow-brand-purple/20'
                      : 'text-brand-cyan/90 hover:text-cyan-300 hover:bg-slate-900/40'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  AI Smart Cuts
                </button>
              )}
              {project.highlights.map((cl, idx) => (
                <button
                  key={cl.id}
                  type="button"
                  onClick={() => onClipSelect(cl.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200 ${
                    activeClipId === cl.id
                       ? 'bg-brand-purple text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Clip {idx + 1} ({cl.duration.toFixed(0)}s)
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CLINICAL TRIMMER & CUTS COMPILER SECTION */}
        <div id="clip-cuts-trimmer-control" className="mt-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-sans">
              <Scissors className="w-3.5 h-3.5 text-brand-purple animate-pulse" />
              Timeline Clip Cuts & Trimming
            </h3>
            <button
              onClick={handleAddCustomClip}
              type="button"
              className="px-2.5 py-1 text-[10px] bg-brand-cyan/25 hover:bg-brand-cyan/40 text-brand-cyan border border-brand-cyan/20 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>+</span> Cut New Moment
            </button>
          </div>

          {activeClipId === 'smart-cuts' ? (
            <div className="space-y-4 bg-slate-950/70 p-4 rounded-xl border border-brand-cyan/25 font-sans animate-[fadeIn_0.2s_ease-out]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-brand-cyan font-mono font-black uppercase bg-brand-cyan/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Zap className="w-3 h-3 fill-current" />
                  AI Compilation Mode Active
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {project.highlights.length} Clips Selected
                </span>
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed">
                You are currently previewing the <strong>AI Smart Cuts Compilation</strong>. Our pipeline has automatically discarded dead-space and silent segments, extracted high-retention viral hooks, and queued up dynamic overlays.
              </p>

              {/* Transition Style Selector */}
              <div className="space-y-2 bg-slate-900/40 p-3 rounded-lg border border-slate-800">
                <label className="text-[10px] text-slate-400 font-mono uppercase font-bold block">
                  ⚙️ Cut Transition Effect Style
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                  {[
                    { style: 'flash', label: '⚡ Optical Flash' },
                    { style: 'glitch', label: '👾 Retro Glitch' },
                    { style: 'zoom', label: '🔍 Focal Zoom' },
                    { style: 'fade_black', label: '⚫ Dip to Black' }
                  ].map((item) => (
                    <button
                      key={item.style}
                      type="button"
                      onClick={() => {
                        onUpdateProject({
                          ...project,
                          transitionStyle: item.style as any
                        });
                        playViralSFX('bell');
                        triggerTransition(item.style as any);
                      }}
                      className={`py-1.5 px-2 rounded-lg text-[10.5px] font-semibold text-center border cursor-pointer transition-all ${
                        project.transitionStyle === item.style
                          ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/40'
                          : 'bg-slate-950 text-slate-400 border-slate-850 hover:text-slate-200'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-slate-500 leading-normal">
                  Transition effects are dynamically synchronized and injected at each trim juncture on export.
                </p>
              </div>

              {/* Total combined length summary */}
              <div className="flex items-center justify-between text-[11px] bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/40">
                <span className="text-slate-400 font-medium">Combined Export Duration:</span>
                <span className="text-brand-cyan font-mono font-black text-xs">
                  {project.highlights.reduce((sum, cl) => sum + cl.duration, 0).toFixed(2)}s
                </span>
              </div>
            </div>
          ) : activeClipId ? (
            <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/60 font-sans animate-[fadeIn_0.2s_ease-out]">
              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                <span className="text-[10px] text-brand-purple font-mono font-bold uppercase bg-brand-purple/10 px-1.5 py-0.5 rounded">
                  Editing Segment
                </span>
                <button
                  onClick={() => handleDeleteClip(activeClipId)}
                  type="button"
                  className="text-[10px] text-red-400 hover:text-red-300 transition-all font-semibold cursor-pointer underline decoration-dotted"
                  title="Remove this clip/cut completely from high-retention highlights"
                >
                  Delete and Exclude This Segment
                </button>
              </div>

              {/* Title parameter */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-mono uppercase font-bold block">Clip Title / Hook Descriptor</label>
                <input
                  type="text"
                  maxLength={50}
                  value={clipEditTitle}
                  onChange={(e) => setClipEditTitle(e.target.value)}
                  className="w-full bg-slate-950 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 focus:border-brand-purple focus:outline-none placeholder-slate-600"
                  placeholder="e.g. Dynamic Punch Hook"
                />
              </div>

              {/* Speed Multiplier parameter */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-mono uppercase font-bold block">
                  🚀 Pacing Speed (Autonomous Slow-Motion/Pacing)
                </label>
                <select
                  value={clipEditSpeed}
                  onChange={(e) => setClipEditSpeed(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 focus:border-brand-purple focus:outline-none cursor-pointer font-sans"
                >
                  <option value={0.50}>0.50x - Aesthetic Slow-Motion (Shoe Reveal Climax)</option>
                  <option value={0.75}>0.75x - Cinematic Focus (Texture / Label details)</option>
                  <option value={1.00}>1.00x - Normal Speed (Speech & Commentary)</option>
                  <option value={1.25}>1.25x - Attention Snap (High-Energy Hook)</option>
                </select>
              </div>

              {/* Range sliders */}
              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-slate-400">Trim In (Starts)</span>
                    <span className="text-slate-300 font-bold">{clipEditStart.toFixed(2)}s</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setClipEditStart(Math.max(0, parseFloat((clipEditStart - 0.1).toFixed(2))))}
                      className="text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-400 p-1 px-1.5 rounded border border-slate-850 cursor-pointer font-bold select-none"
                    >
                      -0.1s
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={clipEditEnd - 0.2}
                      step={0.05}
                      value={clipEditStart}
                      onChange={(e) => setClipEditStart(parseFloat(parseFloat(e.target.value).toFixed(2)))}
                      className="flex-1 h-1 bg-slate-900 rounded appearance-none cursor-pointer accent-brand-purple"
                    />
                    <button
                      type="button"
                      onClick={() => setClipEditStart(Math.min(clipEditEnd - 0.2, parseFloat((clipEditStart + 0.1).toFixed(2))))}
                      className="text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-400 p-1 px-1.5 rounded border border-slate-850 cursor-pointer font-bold select-none"
                    >
                      +0.1s
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-slate-400">Trim Out (Ends)</span>
                    <span className="text-slate-300 font-bold">{clipEditEnd.toFixed(2)}s</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setClipEditEnd(Math.max(clipEditStart + 0.2, parseFloat((clipEditEnd - 0.1).toFixed(2))))}
                      className="text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-400 p-1 px-1.5 rounded border border-slate-850 cursor-pointer font-bold select-none"
                    >
                      -0.1s
                    </button>
                    <input
                      type="range"
                      min={clipEditStart + 0.2}
                      max={videoDuration}
                      step={0.05}
                      value={clipEditEnd}
                      onChange={(e) => setClipEditEnd(parseFloat(parseFloat(e.target.value).toFixed(2)))}
                      className="flex-1 h-1 bg-slate-900 rounded appearance-none cursor-pointer accent-brand-pink"
                    />
                    <button
                      type="button"
                      onClick={() => setClipEditEnd(Math.min(videoDuration, parseFloat((clipEditEnd + 0.1).toFixed(2))))}
                      className="text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-400 p-1 px-1.5 rounded border border-slate-850 cursor-pointer font-bold select-none"
                    >
                      +0.1s
                    </button>
                  </div>
                </div>
              </div>

              {/* Total segment duration display */}
              <div className="flex items-center justify-between text-[10px] bg-slate-900/60 p-2 rounded-lg border border-slate-800/40">
                <span className="text-slate-400">Target Render Length</span>
                <span className="text-brand-cyan font-mono font-bold">
                  {(clipEditEnd - clipEditStart).toFixed(2)}s
                </span>
              </div>

              {/* Action save buttons */}
              <button
                type="button"
                onClick={handleApplyTrim}
                className="w-full py-1.5 rounded-lg bg-brand-purple hover:bg-brand-purple/90 text-white font-bold text-xs shadow-lg transition-all focus:outline-none flex items-center justify-center gap-1.5 mt-1 cursor-pointer"
              >
                <Scissors className="w-3.5 h-3.5" />
                Apply Precise Trim to Clip
              </button>
            </div>
          ) : (
            <div className="bg-slate-950/40 p-5 rounded-xl border border-slate-800 text-center font-sans">
              <Scissors className="w-5 h-5 text-slate-500 mx-auto mb-2 opacity-60 animate-bounce" />
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Select any individual <strong>Highlight Clip</strong> from the selector buttons above to trim its boundaries with millisecond precision, customize its subtitles range, or remove irrelevant components.
              </p>
              {project.highlights.length > 0 && (
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {project.highlights.map((cl, i) => (
                    <button
                      key={cl.id}
                      onClick={() => onClipSelect(cl.id)}
                      className="px-2 py-1 text-[9.5px] font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 cursor-pointer transition-all"
                    >
                      Trim Clip {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* CLICKBAIT THUMBNAIL SUITE */}
        <div className="mt-6">
          <ThumbnailGenerator
            project={project}
            currentTime={currentTime}
            videoRef={videoRef}
            onUpdateProject={onUpdateProject}
          />
        </div>
      </div>

      {/* Video FX Controller Panel */}
      <div className="space-y-4">
        {/* Captions selector styling */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <Tv className="w-3.5 h-3.5 text-brand-purple" />
            AI Subtitle Overlay
          </h3>

          <div className="flex items-center justify-between mb-4 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-300">Display Captions</span>
            <button
              type="button"
              onClick={() => setEnableSubtitles(!enableSubtitles)}
              className={`w-10 h-6 rounded-full p-1 transition-all duration-200 ${
                enableSubtitles ? 'bg-brand-purple' : 'bg-slate-800'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-all duration-200 ${
                  enableSubtitles ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Dynamic Style preset selectors */}
          {enableSubtitles && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[11px] text-slate-500 font-mono uppercase">Caption Style Preset</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['mrbeast', 'hormozi', 'minimalist', 'impact', 'comic'] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => {
                        onUpdateProject({ ...project, captionStyle: style });
                      }}
                      className={`p-2 rounded-xl text-left border text-xs capitalize transition-all duration-200 ${
                        project.captionStyle === style
                          ? 'border-brand-purple bg-brand-purple/10 text-white font-semibold'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-semibold">{style}</div>
                      <span className="text-[10px] text-slate-500 font-normal">
                        {style === 'mrbeast' && 'Neon Border'}
                        {style === 'hormozi' && 'Bold yellow'}
                        {style === 'minimalist' && 'Subtle shadow'}
                        {style === 'impact' && 'Fixed monospace'}
                        {style === 'comic' && 'Yellow & Pink Bubble'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Angle/Tilt Adjuster Section */}
              <div className="space-y-2 pt-3 border-t border-slate-800/60">
                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span className="font-mono uppercase text-slate-500 font-bold">Caption Angle / Tilt</span>
                  <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${captionRotation === 0 ? 'text-brand-green bg-brand-green/10' : 'text-brand-purple bg-brand-purple/10'}`}>
                    {captionRotation === 0 ? 'Straight (0°)' : `${captionRotation}°`}
                  </span>
                </div>
                
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={-15}
                    max={15}
                    step={1}
                    value={captionRotation}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCaptionRotation(val);
                      onUpdateProject({ ...project, captionRotation: val });
                    }}
                    className="flex-1 h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-brand-purple"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCaptionRotation(0);
                      onUpdateProject({ ...project, captionRotation: 0 });
                    }}
                    className="text-[10px] bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white font-bold px-1.5 py-0.5 rounded cursor-pointer transition-all border border-slate-800"
                  >
                    Reset
                  </button>
                </div>
                
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCaptionRotation(-3);
                      onUpdateProject({ ...project, captionRotation: -3 });
                    }}
                    className="text-[9px] bg-slate-950 hover:bg-slate-800 text-slate-400 py-1 rounded border border-slate-800 font-mono cursor-pointer"
                  >
                    Tilt Left (-3°)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCaptionRotation(0);
                      onUpdateProject({ ...project, captionRotation: 0 });
                    }}
                    className="text-[9px] bg-slate-950 hover:bg-slate-800 text-slate-400 py-1 rounded border border-slate-800 font-mono cursor-pointer"
                  >
                    Straight
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCaptionRotation(3);
                      onUpdateProject({ ...project, captionRotation: 3 });
                    }}
                    className="text-[9px] bg-slate-950 hover:bg-slate-800 text-slate-400 py-1 rounded border border-slate-800 font-mono cursor-pointer"
                  >
                    Tilt Right (+3°)
                  </button>
                </div>
              </div>

              {/* Caption Position Layout Selector */}
              <div className="space-y-2 pt-3 border-t border-slate-800/60">
                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span className="font-mono uppercase text-slate-500 font-bold">Caption Layout Position</span>
                  <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded text-brand-cyan bg-brand-cyan/10 capitalize">
                    {project.captionPosition || 'bottom'} safe-zone
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: 'top', label: '⬆️ Top Row' },
                    { id: 'center', label: '↔️ Center Focus' },
                    { id: 'bottom', label: '⬇️ Lower Third' }
                  ].map((pos) => (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() => {
                        onUpdateProject({ ...project, captionPosition: pos.id as any });
                      }}
                      className={`text-[9.5px] py-1 rounded border font-semibold cursor-pointer transition-all duration-150 ${
                        (project.captionPosition || 'bottom') === pos.id
                          ? 'border-brand-purple bg-brand-purple/10 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                      }`}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CINEMATIC TRANSITIONS CONTROLLER CARD */}
        <div id="cinematic-transitions-control" className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5 font-sans">
            <span className="text-brand-pink text-xs animate-[bounce_1.5s_infinite]">🎞️</span>
            Cinematic Transition Effects
          </h3>

          <div className="space-y-4 font-sans">
            <p className="text-[10px] text-slate-500 leading-normal">
              Apply smooth motion cuts/wipes and color overlay animations to bridge consecutive clips or fast-forwarded silence gaps.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'none', label: '🚷 Cuts Only', desc: 'Instant frame clips jump' },
                { id: 'flash', label: '⚡ Optical Flash', desc: 'White cinematic light glow' },
                { id: 'glitch', label: '👾 Digital Glitch', desc: 'Chromatic velocity skew' },
                { id: 'zoom', label: '🔍 Zoom Punch', desc: 'Forward focal lens pump' },
                { id: 'fade_black', label: '🕶️ Dip to Black', desc: 'Elegantly dim to slate' },
                { id: 'slide_left', label: '↔️ Motion Swipe', desc: 'Rapid velocity slide cover' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onUpdateProject({ ...project, transitionStyle: item.id as any });
                    triggerTransition(item.id as any);
                  }}
                  className={`p-2.5 rounded-xl text-left border cursor-pointer transition-all duration-200 ${
                    (project.transitionStyle || 'flash') === item.id
                      ? 'border-brand-pink bg-brand-pink/10 text-white font-semibold'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <div className="text-xs font-bold">{item.label}</div>
                  <span className="text-[8.5px] text-slate-500 font-normal leading-tight block">
                    {item.desc}
                  </span>
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-mono">Test Selected Effect:</span>
              <button
                type="button"
                onClick={() => triggerTransition(project.transitionStyle || 'flash')}
                className="px-3 py-1 text-[10px] bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold rounded-lg transition-all cursor-pointer"
              >
                🎥 Fire Preview
              </button>
            </div>
          </div>
        </div>

        {/* Audio Mixing background panel */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-brand-cyan" />
              Sonic Library
            </h3>
            <span className="text-[9px] bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800 text-slate-500 font-bold">
              {FREE_MUSIC_TRACKS.length} TRACKS
            </span>
          </div>

          {/* Search & Filter Bar */}
          <div className="space-y-3 mb-4">
            <div className="relative">
              <input 
                type="text"
                placeholder="Search feeling, genre, or artist..."
                value={musicSearchQuery}
                onChange={(e) => setMusicSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-9 py-2 text-xs focus:border-brand-cyan focus:outline-none transition-all placeholder:text-slate-700"
              />
              <Sliders className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
              {(['all', 'lofi', 'hype', 'chill', 'cinematic'] as const).map((mood) => (
                <button
                  key={mood}
                  onClick={() => setActiveMoodFilter(mood)}
                  className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${
                    activeMoodFilter === mood 
                      ? 'bg-brand-cyan/20 border-brand-cyan text-brand-cyan' 
                      : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {mood}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[250px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
            {filteredMusic.length > 0 ? (
              filteredMusic.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    onUpdateProject({ ...project, selectedMusicTrackId: t.id });
                    if (musicAudioRef.current) {
                      musicAudioRef.current.src = t.url;
                      musicAudioRef.current.load();
                      if (isPlaying || continuousMusic) {
                        musicAudioRef.current.play().catch(() => {});
                      }
                    }
                  }}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all duration-200 group ${
                    project.selectedMusicTrackId === t.id
                      ? 'border-brand-cyan bg-brand-cyan/10'
                      : 'border-transparent hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className={`text-xs font-bold truncate ${project.selectedMusicTrackId === t.id ? 'text-brand-cyan' : 'text-slate-200'}`}>
                        {t.name}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">{t.artist} • {t.genre}</div>
                    </div>
                    {project.selectedMusicTrackId === t.id && (
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-pulse shadow-[0_0_8px_#22d3ee]" />
                    )}
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-8 opacity-40">
                <Music className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p className="text-[10px] uppercase font-black">No matches found</p>
              </div>
            )}
          </div>

          {activeMusicTrack && (
            <div className="mt-4 pt-4 border-t border-slate-800/60 space-y-3">
              {/* Music Volume adjustor */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5 font-medium">
                    Master Music Mix
                    {autoDucking && activeSubtitle && (
                      <span className="text-[9px] bg-amber-400/15 text-amber-300 border border-amber-400/20 px-1 py-0.2 rounded font-mono font-bold animate-pulse shrink-0">
                        ⚡ DUCKED
                      </span>
                    )}
                  </span>
                  <span>{Math.round(musicVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={0.5}
                  step={0.01}
                  value={musicVolume}
                  onChange={(e) => setMusicVolume(Number(e.target.value))}
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-brand-cyan"
                />
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Transforms & Lighting grading */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-4 font-sans">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand-cyan animate-pulse" />
              AI Virality Booster
            </h3>
            <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-brand-green font-mono font-bold">
              SCORE: {project.viralityScore}%
            </span>
          </div>

          {/* AI OPTIMIZATION PANEL */}
          {isAnalyzing ? (
            <div className="bg-slate-950 p-4 rounded-xl border border-brand-cyan/25 space-y-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 h-[2px] bg-gradient-to-r from-brand-purple via-brand-cyan to-brand-green animate-[shimmer_1.5s_infinite]" style={{ width: '100%' }}></div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full border-2 border-brand-cyan/30 border-t-brand-cyan animate-spin flex items-center justify-center"></div>
                  <Wand2 className="w-4 h-4 text-brand-cyan absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-bounce" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-slate-200">Booster Algorithm Active</h4>
                  <p className="text-[10px] text-slate-400 font-mono truncate">
                    {analyzeStep === 0 && "🔍 Scanning frame optical velocities..."}
                    {analyzeStep === 1 && "✂️ Trimming silent deadspace..."}
                    {analyzeStep === 2 && "⚡ Aligning audio waveform cues..."}
                    {analyzeStep === 3 && "🎨 Grading cinematic lighting profiles..."}
                    {analyzeStep === 4 && "💥 Embedding micro-zooms..."}
                  </p>
                </div>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-brand-purple to-brand-cyan h-1.5 transition-all duration-300"
                  style={{ width: `${(analyzeStep + 1) * 20}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={runSmartBooster}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-cyan/95 via-brand-purple/95 to-brand-pink/95 hover:from-brand-cyan hover:to-brand-pink text-white font-bold text-xs flex items-center justify-center gap-2 shadow-[0_4px_20px_-4px_rgba(236,72,153,0.3)] transition-all duration-300 active:scale-95 group cursor-pointer"
            >
              <Wand2 className="w-4 h-4 group-hover:rotate-12 transition-transform duration-300" />
              ⚡ AUTO-EDIT FOR MAXIMUM RETENTION
            </button>
          )}

          {/* AI Retention controls */}
          <div className="space-y-2.5 pt-2">
            <label className="block text-[10px] text-slate-500 font-mono uppercase">Fine-Tune Engagement Rails</label>

            <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-950 transition-all hover:border-slate-800">
              <div className="space-y-0.5">
                <span className="text-[11px] text-slate-200 font-semibold block">Jump-Cut Silences</span>
                <span className="text-[9px] text-slate-500 block leading-tight">Fast-forward silent dead air parts</span>
              </div>
              <button
                onClick={() => setJumpCuts(!jumpCuts)}
                className={`w-8 h-4.5 rounded-full p-0.5 transition-all duration-200 cursor-pointer ${
                  jumpCuts ? 'bg-brand-cyan' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full bg-white transition-all duration-200 ${
                    jumpCuts ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-950 transition-all hover:border-slate-800">
              <div className="space-y-0.5">
                <span className="text-[11px] text-slate-200 font-semibold block">Attention-Hook Speed Ramping</span>
                <span className="text-[9px] text-slate-500 block leading-tight">1.10x pacing, normal on punch lines</span>
              </div>
              <button
                onClick={() => setSpeedRamp(!speedRamp)}
                className={`w-8 h-4.5 rounded-full p-0.5 transition-all duration-200 cursor-pointer ${
                  speedRamp ? 'bg-brand-purple' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full bg-white transition-all duration-200 ${
                    speedRamp ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-950 transition-all hover:border-slate-800">
              <div className="space-y-0.5">
                <span className="text-[11px] text-slate-200 font-semibold block">Smart SFX Sparks</span>
                <span className="text-[9px] text-slate-500 block leading-tight">Pop acoustic cue points on title entry</span>
              </div>
              <button
                onClick={() => setSfxSparks(!sfxSparks)}
                className={`w-8 h-4.5 rounded-full p-0.5 transition-all duration-200 cursor-pointer ${
                  sfxSparks ? 'bg-brand-pink' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full bg-white transition-all duration-200 ${
                    sfxSparks ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-950 transition-all hover:border-slate-800">
              <div className="space-y-0.5">
                <span className="text-[11px] text-slate-200 font-semibold block">Emoji Bouncy Overlays</span>
                <span className="text-[9px] text-slate-500 block leading-tight">Scale-bounce dynamic emoji highlights</span>
              </div>
              <button
                onClick={() => setEmojiBounces(!emojiBounces)}
                className={`w-8 h-4.5 rounded-full p-0.5 transition-all duration-200 cursor-pointer ${
                  emojiBounces ? 'bg-brand-green' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full bg-white transition-all duration-200 ${
                    emojiBounces ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-950 transition-all hover:border-slate-800">
              <div className="space-y-0.5">
                <span className="text-[11px] text-slate-300">Dramatic Retention Zooms</span>
                <span className="text-[9px] text-slate-500 block leading-tight">Camera focus coordinates zoom tracking</span>
              </div>
              <button
                onClick={() => setEnableZooms(!enableZooms)}
                className={`w-8 h-4.5 rounded-full p-0.5 transition-all duration-200 cursor-pointer ${
                  enableZooms ? 'bg-indigo-600' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full bg-white transition-all duration-200 ${
                    enableZooms ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* TikTok Pattern Interrupts section */}
            <div className="pt-3 border-t border-slate-800/60 pb-1">
              <span className="block text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-2">⚡ TikTok Smart Pattern Interrupts</span>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-950 transition-all hover:border-slate-800">
                  <div className="space-y-0.5">
                    <span className="text-[11px] text-slate-200 font-semibold block">Auto-Angle Zoom Punches</span>
                    <span className="text-[9px] text-slate-500 block leading-tight">Alternates 1.0x ⇄ 1.22x dynamic perspectives</span>
                  </div>
                  <button
                    onClick={() => setAutoZoomPunch(!autoZoomPunch)}
                    className={`w-8 h-4.5 rounded-full p-0.5 transition-all duration-200 cursor-pointer ${
                      autoZoomPunch ? 'bg-cyan-500' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full bg-white transition-all duration-200 ${
                        autoZoomPunch ? 'translate-x-3.5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-950 transition-all hover:border-slate-800">
                  <div className="space-y-0.5">
                    <span className="text-[11px] text-slate-200 font-semibold block">Focus Guide Cam HUD</span>
                    <span className="text-[9px] text-slate-500 block leading-tight">Retro 1080p recording sights guide box overlay</span>
                  </div>
                  <button
                    onClick={() => setCamRecorderHUD(!camRecorderHUD)}
                    className={`w-8 h-4.5 rounded-full p-0.5 transition-all duration-200 cursor-pointer ${
                      camRecorderHUD ? 'bg-indigo-500' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full bg-white transition-all duration-200 ${
                        camRecorderHUD ? 'translate-x-3.5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-950 transition-all hover:border-slate-800">
                  <div className="space-y-0.5">
                    <span className="text-[11px] text-slate-200 font-semibold block">Camera Punch Rumble</span>
                    <span className="text-[9px] text-slate-500 block leading-tight">Physically tilts / shakes screen on highlight keywords</span>
                  </div>
                  <button
                    onClick={() => setShakeOnPunch(!shakeOnPunch)}
                    className={`w-8 h-4.5 rounded-full p-0.5 transition-all duration-200 cursor-pointer ${
                      shakeOnPunch ? 'bg-brand-pink' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full bg-white transition-all duration-200 ${
                        shakeOnPunch ? 'translate-x-3.5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-950 transition-all hover:border-slate-800">
              <div className="space-y-0.5">
                <span className="text-[11px] text-slate-300">Color Grading Filters</span>
                <span className="text-[9px] text-slate-500 block leading-tight">Custom luts profiles styled for niche</span>
              </div>
              <button
                onClick={() => setEnableColorGrade(!enableColorGrade)}
                className={`w-8 h-4.5 rounded-full p-0.5 transition-all duration-200 cursor-pointer ${
                  enableColorGrade ? 'bg-emerald-600' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full bg-white transition-all duration-200 ${
                    enableColorGrade ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {enableColorGrade && (
            <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
              <label className="block text-[11px] text-slate-500 font-mono uppercase">Color Grade Mood</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'cinematic', label: '🎬 Cinematic' },
                  { id: 'warm_vintage', label: '🌻 Warm Gold' },
                  { id: 'vibrant_pop', label: '🍭 Vibrant Pop' },
                  { id: 'moody_cyber', label: '👾 Moody Cyber' }
                ].map((grade) => (
                  <button
                    key={grade.id}
                    onClick={() => {
                      onUpdateProject({ ...project, colorGrade: grade.id as any });
                    }}
                    className={`p-2 rounded-xl text-left text-[11px] border transition-all duration-150 cursor-pointer ${
                      project.colorGrade === grade.id
                        ? 'border-brand-green bg-brand-green/10 text-white'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {grade.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
