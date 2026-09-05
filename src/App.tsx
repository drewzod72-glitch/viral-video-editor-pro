import React, { useState, useEffect, useRef } from 'react';
import { Zap, Settings, Volume2, Infinity as InfinityIcon, Smartphone, Clapperboard, BarChart3, Brain, Menu, X, AlertTriangle, Satellite, Trophy, Loader2, Palette, Check, Eye, Download, Wand2, Command } from 'lucide-react';
import { VideoProject, AspectRatio, BrollClip, ExportQuality, ExportFormat } from './types';
import { FREE_MUSIC_TRACKS, RAW_VIDEO_TEMPLATES, STOCK_FOOTAGE_BROLL } from './data';
import NicheSelector from './components/NicheSelector';
import InspectorPanel from './components/InspectorPanel';
import Timeline from './components/Timeline';
import VideoPlayerWorkspace from './components/VideoPlayerWorkspace';
import ViralityScorecard from './components/ViralityScorecard';
import { AICopilotConsole } from './components/AICopilotConsole';
import ApiKeySettingsModal from './components/ApiKeySettingsModal';
import { runAnalyzeVideo, getApiStatusLog, clearApiStatusLog } from './utils/groqClient';
import { saveFileToDevice } from './utils/download';
import { renderVideoInBrowser } from './utils/ffmpegClient';
import { computeViralityScore } from './utils/viralityScore';
import { renderVideoWithFFmpegWasm, LUT_PRESETS, TRANSITION_PRESETS, detectViralMoments } from './utils/ffmpegWasmRenderer';
import { analyzeReframeCrops, getCropFFmpegFilter } from './utils/reframeAI';
import { colors, borderRadius, INTER, statusColors, TRANSITION, tint } from './utils/styles';
import { parseTextCommand, getCommandSuggestions } from './utils/textCommands';
import { generateImageWithAI, getImageGenModels } from './utils/imageGenAI';
import { BlurRegion, GeneratedImage } from './types';



export default function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const [activeProject, setActiveProject] = useState<VideoProject | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [activeTab, setActiveTab] = useState<'studio' | 'viral' | 'copilot'>('studio');
  const [downloadReadyInfo, setDownloadReadyInfo] = useState<{ blob: Blob; filename: string } | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aiSuccess, setAiSuccess] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<'vision' | 'text' | null>(null);
  const [apiStatusLog, setApiStatusLog] = useState<any[]>([]);
  const [showApiStatus, setShowApiStatus] = useState(false);
  const [renderMode, setRenderMode] = useState<'canvas' | 'ffmpeg'>('ffmpeg');
  const [renderProgress, setRenderProgress] = useState(0);
  const [ffmpegFallback, setFfmpegFallback] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [exportQuality, setExportQuality] = useState<ExportQuality>('high');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('mp4');
  const [commandInput, setCommandInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [commandSuggestions, setCommandSuggestions] = useState<string[]>([]);
  const [voiceoverBlob, setVoiceoverBlob] = useState<Blob | null>(null);
  const [isGeneratingVoiceover, setIsGeneratingVoiceover] = useState(false);
  const [isAnalyzingReframe, setIsAnalyzingReframe] = useState(false);
  const [reframeAnalysis, setReframeAnalysis] = useState<any>(null);
  const [imageGenPrompt, setImageGenPrompt] = useState('');
  const [imageGenModel, setImageGenModel] = useState<'flux' | 'dall-e-3' | 'stable-diffusion'>('flux');
  const [imageGenAspect, setImageGenAspect] = useState<'1:1' | '16:9' | '9:16'>('1:1');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [blurRegions, setBlurRegions] = useState<BlurRegion[]>([]);
  const [enableFaceBlur, setEnableFaceBlur] = useState(false);

  const startApp = () => {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (typeof AudioCtx === 'function') {
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      }
    } catch (e) {
      console.warn('[App] AudioContext initialization failed:', e);
    }
    setHasStarted(true);
  };

  // Clean up object URLs to prevent memory leaks
  const prevProjectRef = useRef<VideoProject | null>(null);
  useEffect(() => {
    const prev = prevProjectRef.current;
    if (prev?.videoUrl?.startsWith('blob:') && prev.videoUrl !== activeProject?.videoUrl) {
      URL.revokeObjectURL(prev.videoUrl);
    }
    prevProjectRef.current = activeProject;
  }, [activeProject]);


  // Poll API status log for UI feedback
  useEffect(() => {
    const interval = setInterval(() => {
      setApiStatusLog(getApiStatusLog());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectTemplate = async (template: any) => {
    const proj: VideoProject = {
      id: `p-${Date.now()}`,
      videoUrl: template.videoUrl,
      name: template.name,
      type: 'sample',
      duration: template.originalDuration || 30,
      originalDuration: template.originalDuration || 30,
      userDescription: template.userDescription || '',
      niche: template.niche,
      title: template.name,
      alternativeTitles: [],
      description: template.userDescription || '',
      tags: [template.niche],
      viralityScore: 0,
      viralityCriteria: { hook: 70, pacing: 70, emotion: 70, visualContrast: 70 },
      viralityFeedback: [],
      highlights: [{ id: '1', title: 'Full Clip', start: 0, end: template.originalDuration || 30, duration: template.originalDuration || 30, viralityScore: 75, description: 'Full video', whyEngaging: 'Complete review', speed: 1.0 }],
      subtitles: [],
      captionStyle: 'hormozi',
      selectedMusicTrackId: 'lofi-1',
      colorGrade: 'vibrant_pop',
      zoomEffects: [],
      enableSubtitles: true, enableZooms: true, enableColorGrade: true, musicVolume: 0.4,
      jumpCuts: false, speedRamp: false, sfxSparks: false, emojiBounces: false,
      autoZoomPunch: true, shakeOnPunch: true, camRecorderHUD: false,
      sfxPopEnabled: true, sfxWhooshEnabled: true,
      createdAt: new Date().toISOString()
    };

    setActiveProject(proj);
    setActiveTab('studio');
    setIsProcessing(true);
    setProcessingStage('Analyzing media...');

     const runAI = async () => {
       try {
         const result = await runAnalyzeVideo({ ...template });
         console.log('[App] AI analysis result:', result);
         if (result?.success && result.project) {
           setActiveProject(prev => {
             if (!prev) return prev;
             const merged = { ...prev, ...result.project } as VideoProject;
             const scored = computeViralityScore(merged);
             return { ...merged, viralityScore: scored.score, viralityFeedback: scored.feedback };
           });
           setAnalysisMode(result.mode || 'text');
           setAiSuccess(true);
           setTimeout(() => { setAiSuccess(false); setAnalysisMode(null); }, 3000);
           
           // Wire content-aware SFX from AI analysis into project state
           if (result.project.contentSfx && typeof result.project.contentSfx === 'object') {
             setActiveProject(prev => prev ? ({ ...prev, contentSfx: result.project.contentSfx }) : prev);
           }
           
           // Auto-detect viral moments and apply as highlights (only if AI didn't provide them — Kilo)
           if (result.project.videoUrl && (!result.project.highlights || result.project.highlights.length === 0)) {
             try {
               const moments = await detectViralMoments(result.project.videoUrl, result.project.duration || 30);
              if (moments.length > 0) {
                setActiveProject(prev => {
                  if (!prev) return prev;
                  const viralHighlights = moments.slice(0, 5).map((m, i) => ({
                    id: `viral-${i}`,
                    title: `Viral Moment ${i + 1}`,
                    start: m.start,
                    end: m.end,
                    duration: m.end - m.start,
                    viralityScore: m.score,
                    description: m.reason,
                    whyEngaging: m.reason,
                    speed: 1.0
                  }));
                  return {
                    ...prev,
                    highlights: [...prev.highlights, ...viralHighlights]
                  } as VideoProject;
                });
              }
            } catch (e) {
              console.warn('Viral moment detection failed:', e);
            }
          }
        } else {
          console.warn('AI offline — manual mode active:', result?.error);
          setActiveProject(prev => {
            const scored = computeViralityScore(prev as any);
            return { ...prev, viralityScore: scored.score, viralityFeedback: scored.feedback };
          });
        }
      } catch (e) {
        console.warn("AI Service busy. Manual Mode Active.", e);
      } finally {
        setIsProcessing(false);
      }
    };

    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => runAI(), { timeout: 5000 });
    } else {
      setTimeout(runAI, 100);
    }
  };

  const handleUploadCustomFile = async (file: File, name: string, niche: any, description: string) => {
    const videoUrl = URL.createObjectURL(file);
    
    // Get actual video duration
    let actualDuration = 30;
    try {
      actualDuration = await new Promise<number>((resolve) => {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.src = videoUrl;
        v.onloadedmetadata = () => {
          actualDuration = v.duration || 30;
          v.remove();
          resolve(actualDuration);
        };
        v.onerror = () => {
          v.remove();
          resolve(30);
        };
      });
    } catch (e) {
      actualDuration = 30;
    }
    
    const proj: VideoProject = {
      id: `c-${Date.now()}`,
      videoUrl,
      name,
      type: 'custom',
      duration: actualDuration,
      originalDuration: actualDuration,
      userDescription: description || '',
      niche,
      title: name,
      alternativeTitles: [],
      description: description || '',
      tags: [niche],
      viralityScore: 0,
      viralityCriteria: { hook: 70, pacing: 70, emotion: 70, visualContrast: 70 },
      viralityFeedback: [],
      highlights: [{ id: '1', title: 'Full Clip', start: 0, end: actualDuration, duration: actualDuration, viralityScore: 75, description: 'Full video', whyEngaging: 'Complete review', speed: 1.0 }],
      subtitles: [],
      captionStyle: 'hormozi',
      selectedMusicTrackId: 'hype-1',
      colorGrade: 'vibrant_pop',
      zoomEffects: [],
      enableSubtitles: true, enableZooms: true, enableColorGrade: true, musicVolume: 0.4,
      jumpCuts: false, speedRamp: false, sfxSparks: false, emojiBounces: false,
      autoZoomPunch: true, shakeOnPunch: true, camRecorderHUD: false,
      sfxPopEnabled: true, sfxWhooshEnabled: true,
      createdAt: new Date().toISOString()
    };

    setActiveProject(proj);
    setActiveTab('studio');
    setIsProcessing(true);
    setProcessingStage('Analyzing media...');

    const runAI = async () => {
      try {
        const result = await runAnalyzeVideo({ name, niche, userDescription: description, videoFile: file, videoUrl });
        console.log('[App] AI analysis result (upload):', result);
        if (result?.success && result.project) {
          setActiveProject(prev => {
            if (!prev) return prev;
            const merged = { ...prev, ...result.project } as VideoProject;
            const scored = computeViralityScore(merged);
            return { ...merged, viralityScore: scored.score, viralityFeedback: scored.feedback };
          });
          setAnalysisMode(result.mode || 'text');
          setAiSuccess(true);
          setTimeout(() => { setAiSuccess(false); setAnalysisMode(null); }, 3000);
          
          // Auto-detect viral moments and apply as highlights (only if AI didn't provide them — Kilo)
          if (result.project.videoUrl && (!result.project.highlights || result.project.highlights.length === 0)) {
            try {
              const moments = await detectViralMoments(result.project.videoUrl, result.project.duration || 30);
              if (moments.length > 0) {
                setActiveProject(prev => {
                  if (!prev) return prev;
                  const viralHighlights = moments.slice(0, 5).map((m, i) => ({
                    id: `viral-${i}`,
                    title: `Viral Moment ${i + 1}`,
                    start: m.start,
                    end: m.end,
                    duration: m.end - m.start,
                    viralityScore: m.score,
                    description: m.reason,
                    whyEngaging: m.reason,
                    speed: 1.0
                  }));
                  return {
                    ...prev,
                    highlights: [...prev.highlights, ...viralHighlights]
                  } as VideoProject;
                });
              }
            } catch (e) {
              console.warn('Viral moment detection failed:', e);
            }
          }
        } else {
          console.warn('AI offline — manual mode active:', result?.error);
          setActiveProject(prev => {
            const scored = computeViralityScore(prev as any);
            return { ...prev, viralityScore: scored.score, viralityFeedback: scored.feedback };
          });
        }
      } catch (e) {
        console.warn("AI Service busy. Manual Mode Active.", e);
      } finally {
        setIsProcessing(false);
      }
    };

    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => runAI(), { timeout: 5000 });
    } else {
      setTimeout(runAI, 100);
    }
  };

  const getBlobDuration = async (blob: Blob): Promise<number> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.src = url;
      const timer = setTimeout(() => {
        URL.revokeObjectURL(url);
        v.remove();
        resolve(0);
      }, 15000);
      v.onloadedmetadata = () => {
        clearTimeout(timer);
        const dur = v.duration || 0;
        URL.revokeObjectURL(url);
        v.remove();
        resolve(dur);
      };
      v.onerror = () => {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
        v.remove();
        resolve(0);
      };
    });
  };

  const triggerExport = async () => {
    if (!activeProject) return;
    setIsProcessing(true);
    setFfmpegFallback(false);
    setExportError(null);
    setProcessingStage("Initializing render engine...");
    setRenderProgress(0);
    try {
      let result: { blob: Blob; filename: string };

      if (renderMode === 'ffmpeg') {
        const blob = await renderVideoWithFFmpegWasm({
          project: activeProject,
          onProgress: (p, stage) => {
            setRenderProgress(p);
            setProcessingStage(stage || `Rendering: ${p}%`);
            if (stage && stage.includes('switching to Fast Canvas')) {
              setFfmpegFallback(true);
            }
          },
          activeClipId,
          mode: 'ffmpeg',
          aspectRatio,
          exportQuality,
          exportFormat
        });
        result = { blob, filename: `${activeProject.name}_${exportQuality}_${exportFormat}.${exportFormat}` };
      } else {
        const canvasResult = await renderVideoInBrowser(
          activeProject,
          (p) => {
            setRenderProgress(p);
            setProcessingStage(`Baking: ${p}%`);
          },
          activeClipId,
          undefined,
          aspectRatio,
          exportQuality,
          exportFormat
        );
        result = { blob: canvasResult.blob, filename: `${activeProject.name}_${exportQuality}_${exportFormat}.${canvasResult.extension}` };
      }

      const expectedDuration = activeProject.highlights?.reduce(
        (s, h) => s + (h.duration || (h.end - h.start)), 0
      ) || activeProject.duration || 30;
      
      const actualDuration = await getBlobDuration(result.blob);
      const durationOk = Math.abs(actualDuration - expectedDuration) < 2.0;
      const sizeOk = result.blob.size > 500_000;
      
      if (sizeOk && durationOk) {
        setDownloadReadyInfo(result);
      } else if (sizeOk && !durationOk) {
        setProcessingStage("Fixing duration...");
        setRenderProgress(0);
        const retryBlob = await renderVideoInBrowser(
          activeProject,
          (p) => {
            setRenderProgress(p);
            setProcessingStage(`Fixing: ${p}%`);
          },
          activeClipId,
          undefined,
          aspectRatio,
          exportQuality,
          exportFormat
        ).then(r => r.blob);
        
        const retryDuration = await getBlobDuration(retryBlob);
        if (retryBlob.size > 500_000 && Math.abs(retryDuration - expectedDuration) < 2.0) {
          setFfmpegFallback(true);
          setDownloadReadyInfo({ blob: retryBlob, filename: result.filename });
        } else {
          setExportError('Export failed: duration mismatch after retry.');
        }
      } else if (result.blob && result.blob.size <= 500_000) {
        setProcessingStage("Re-rendering...");
        setRenderProgress(0);
        const retryBlob = renderMode === 'ffmpeg'
          ? await renderVideoWithFFmpegWasm({
              project: activeProject,
              onProgress: (p, stage) => {
                setRenderProgress(p);
                setProcessingStage(stage || `Retry: ${p}%`);
              },
              activeClipId,
              mode: 'ffmpeg',
              aspectRatio,
              exportQuality,
              exportFormat
            })
          : await renderVideoInBrowser(
              activeProject,
              (p) => {
                setRenderProgress(p);
                setProcessingStage(`Retry: ${p}%`);
              },
              activeClipId,
              undefined,
              aspectRatio,
              exportQuality,
              exportFormat
            ).then(r => r.blob);

        if (retryBlob && retryBlob.size > 500_000) {
          setDownloadReadyInfo({ blob: retryBlob, filename: result.filename });
        } else {
          setExportError('Export failed: rendered file is empty or too small after retry.');
        }
      } else {
        setExportError('Export failed: rendered file is empty or too small.');
      }
    } catch (err: any) {
      setExportError('Export failed: ' + (err?.message || 'Device hardware busy.'));
    } finally {
      setIsProcessing(false);
      setRenderProgress(0);
    }
  };

  const handleTextCommand = () => {
    if (!activeProject || !commandInput.trim()) return;
    const cmd = parseTextCommand(commandInput);
    if (!cmd) return;

    setCommandHistory(prev => [...prev, commandInput.trim()].slice(-20));
    setCommandInput('');
    setCommandSuggestions([]);

    let updated = { ...activeProject };

    switch (cmd.type) {
      case 'remove_silence': {
        const silenceRemoved = (updated.segments || []).filter(s => {
          const gap = s.start - (updated.segments?.find((x: any) => x.end === s.start)?.end ?? 0);
          return gap < 2;
        });
        updated = { ...updated, segments: silenceRemoved.length > 0 ? silenceRemoved : [{ start: 0, end: updated.duration, speed: 1.0 }] };
        break;
      }
      case 'remove_cuts':
        updated = { ...updated, segments: [{ start: 0, end: updated.duration, speed: 1.0 }], cuts: [] };
        break;
      case 'add_zoom':
        updated = {
          ...updated,
          zoomEffects: [...(updated.zoomEffects || []), { timestamp: cmd.timestamp, scale: cmd.scale || 1.5, duration: 1.5 }]
        };
        break;
      case 'change_caption_style':
        updated = { ...updated, captionStyle: cmd.style };
        break;
      case 'add_broll': {
        const newBroll: BrollClip = {
          id: `broll-${Date.now()}`,
          url: STOCK_FOOTAGE_BROLL[Math.floor(Math.random() * STOCK_FOOTAGE_BROLL.length)].url,
          label: 'AI B-Roll',
          timestamp: cmd.timestamp,
          duration: cmd.duration || 3,
          reason: 'AI-suggested overlay clip'
        };
        updated = { ...updated, brollClips: [...(updated.brollClips || []), newBroll] };
        break;
      }
      case 'speed_up':
        updated = { ...updated, segments: (updated.segments || []).map((s: any) => ({ ...s, speed: cmd.factor })) };
        break;
      case 'change_music':
        updated = { ...updated, selectedMusicTrackId: cmd.trackId };
        break;
      case 'change_color_grade':
        updated = { ...updated, colorGrade: cmd.grade as any };
        break;
      case 'add_transition':
        updated = { ...updated, transitionStyle: cmd.style as any };
        break;
      case 'toggle_effect':
        updated = { ...updated, [cmd.effect]: cmd.value };
        break;
      case 'voiceover':
        updated = { ...updated, voiceoverText: cmd.text, voiceoverStart: cmd.start ?? 0 };
        break;
      default:
        break;
    }

    setActiveProject(updated);
  };

  const generateVoiceover = async () => {
    if (!activeProject?.voiceoverText || isGeneratingVoiceover) return;
    setIsGeneratingVoiceover(true);
    try {
      const utterance = new SpeechSynthesisUtterance(activeProject.voiceoverText);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (typeof AudioCtx !== 'function') throw new Error('AudioContext not supported');
      const audioCtx = new AudioCtx();
      const dest = audioCtx.createMediaStreamDestination();
      const source = audioCtx.createMediaStreamSource(dest.stream);
      
      utterance.onend = () => {
        source.disconnect();
      };

      window.speechSynthesis.speak(utterance);
      
      // Capture audio via MediaRecorder if available
      if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported('audio/webm')) {
        throw new Error('MediaRecorder not supported');
      }
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(dest.stream);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setVoiceoverBlob(blob);
        setIsGeneratingVoiceover(false);
      };
      recorder.start();
      setTimeout(() => {
        recorder.stop();
        window.speechSynthesis.cancel();
      }, (activeProject.voiceoverText?.length || 10) * 80);
    } catch (e) {
      console.warn('Voiceover generation failed:', e);
      setIsGeneratingVoiceover(false);
    }
  };

  const runReframeAnalysis = async () => {
    if (!activeProject || isAnalyzingReframe) return;
    setIsAnalyzingReframe(true);
    setReframeAnalysis(null);
    try {
      const result = await analyzeReframeCrops(activeProject.videoUrl, activeProject.duration || 30);
      if (result) {
        setReframeAnalysis(result);
        setActiveProject(prev => prev ? { ...prev, reframeCrops: result.recommended } : prev);
      }
    } catch (e) {
      console.warn('Reframe analysis failed:', e);
    } finally {
      setIsAnalyzingReframe(false);
    }
  };

  const generateImage = async () => {
    if (!imageGenPrompt.trim() || isGeneratingImage) return;
    setIsGeneratingImage(true);
    try {
      const result = await generateImageWithAI({
        prompt: imageGenPrompt.trim(),
        model: imageGenModel,
        aspectRatio: imageGenAspect,
      });
      setGeneratedImages(prev => [...prev, result]);
      setImageGenPrompt('');
    } catch (e: any) {
      console.warn('Image generation failed:', e);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const addBlurRegion = (region: BlurRegion) => {
    setBlurRegions(prev => [...prev, region]);
  };

  const removeBlurRegion = (id: string) => {
    setBlurRegions(prev => prev.filter(r => r.id !== id));
  };

  const applyReframeCrop = (ratio: AspectRatio) => {
    if (!reframeAnalysis || !activeProject) return;
    const crop = reframeAnalysis.recommended[ratio];
    if (!crop) return;
    setActiveProject(prev => prev ? { ...prev, selectedReframe: ratio, aspectRatio: ratio } : prev);
  };

  const handleCommandKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTextCommand();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = commandHistory[commandHistory.length - 1];
      if (prev) setCommandInput(prev);
    }
  };

  const handleCommandChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCommandInput(val);
    if (val.trim().length > 1) {
      setCommandSuggestions(getCommandSuggestions(val));
    } else {
      setCommandSuggestions([]);
    }
  };

  if (!hasStarted) {
    return (
      <div style={{
        background: `linear-gradient(180deg, ${colors.background} 0%, #020617 50%, #09090b 100%)`,
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: `${40}px 20px`,
        fontFamily: INTER,
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `linear-gradient(rgba(236,72,153,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(236,72,153,0.04) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)'
        }} />

        {/* Glow orbs */}
        <div style={{
          position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)',
          width: '500px', height: '500px',
          background: `radial-gradient(circle, ${tint(colors.primary, 0.2)} 0%, transparent 70%)`,
          borderRadius: '50%', filter: 'blur(80px)',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute', bottom: '10%', right: '10%',
          width: '300px', height: '300px',
          background: `radial-gradient(circle, ${tint(colors.accent, 0.12)} 0%, transparent 70%)`,
          borderRadius: '50%', filter: 'blur(60px)',
          pointerEvents: 'none'
        }} />

        <div style={{
          width: '96px', height: '96px', borderRadius: '32px',
          background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '44px', marginBottom: '36px', position: 'relative', zIndex: 1,
          boxShadow: `0 24px 80px ${tint(colors.primary, 0.4)}`,
          animation: 'float 6s ease-in-out infinite'
        }}>
          <Zap size={48} color={colors.onPrimary} />
        </div>

        <h1 style={{
          color: colors.foreground,
          fontSize: 'clamp(48px, 10vw, 80px)',
          fontWeight: 900,
          margin: '0 0 20px 0',
          letterSpacing: '-3px',
          fontFamily: INTER,
          textTransform: 'uppercase',
          lineHeight: 0.95,
          position: 'relative', zIndex: 1
        }}>
          VIRAL<br />
          <span style={{
            background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            AI FORGE
          </span>
        </h1>

        <p style={{
          color: colors.mutedForeground, fontSize: 'clamp(15px, 2.5vw, 17px)',
          maxWidth: '480px', marginBottom: '52px', fontWeight: 500, lineHeight: 1.7,
          position: 'relative', zIndex: 1
        }}>
          Professional video studio. Frame-accurate browser engine.
          Zero hosting cost. Works on every device.
        </p>

        <button
          onClick={startApp}
          style={{
            background: `linear-gradient(135deg, ${colors.accent}, ${colors.secondary})`,
            color: colors.onAccent, border: 'none', borderRadius: '18px',
            padding: '22px 72px', fontWeight: 800, fontSize: '14px',
            fontFamily: INTER, textTransform: 'uppercase',
            cursor: 'pointer',
            boxShadow: `0 20px 60px ${tint(colors.accent, 0.4)}, inset 0 1px 0 rgba(255,255,255,0.2)`,
            letterSpacing: '1.5px',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative', zIndex: 1
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-3px) scale(1.03)';
            e.currentTarget.style.boxShadow = `0 28px 80px ${tint(colors.accent, 0.5)}, inset 0 1px 0 rgba(255,255,255,0.25)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = `0 20px 60px ${tint(colors.accent, 0.4)}, inset 0 1px 0 rgba(255,255,255,0.2)`;
          }}
        >
          Launch Studio <Menu size={16} style={{ display: 'inline', marginLeft: '8px' }} />
        </button>

        <div style={{
          marginTop: '56px', display: 'flex', gap: '10px', flexWrap: 'wrap',
          justifyContent: 'center', position: 'relative', zIndex: 1
        }}>
          {[
            { label: 'Frame Engine', icon: <Settings size={12} /> },
            { label: 'Audio Sync', icon: <Volume2 size={12} /> },
            { label: 'Free Forever', icon: <InfinityIcon size={12} /> },
            { label: 'Native Ready', icon: <Smartphone size={12} /> },
          ].map((f) => (
            <div key={f.label} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              fontSize: '10px', color: colors.mutedForeground, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.8px',
              background: 'rgba(30,41,59,0.3)',
              padding: '10px 16px', borderRadius: '12px',
              border: `1px solid rgba(236,72,153,0.1)`,
              backdropFilter: 'blur(8px)',
              transition: TRANSITION.smooth,
              cursor: 'default'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(30,41,59,0.5)';
              e.currentTarget.style.borderColor = tint(colors.primary, 0.3);
              e.currentTarget.style.color = colors.foreground;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(30,41,59,0.3)';
              e.currentTarget.style.borderColor = tint(colors.primary, 0.1);
              e.currentTarget.style.color = colors.mutedForeground;
            }}
            >
              {f.icon}
              <span>{f.label}</span>
            </div>
          ))}
        </div>

        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }
          @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 20px 60px rgba(236,72,153,0.4), inset 0 1px 0 rgba(255,255,255,0.2); }
            50% { box-shadow: 0 24px 80px rgba(236,72,153,0.5), inset 0 1px 0 rgba(255,255,255,0.2); }
          }
        `}</style>
      </div>
    );
  }

  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%' }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 4px 16px 4px', borderBottom: `1px solid ${colors.border}`, marginBottom: '8px' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '10px',
          background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: '14px', flexShrink: 0,
          boxShadow: `0 0 20px ${tint(colors.primary, 0.3)}`
        }}>F</div>
        <div>
          <div style={{ fontWeight: 900, fontSize: '13px', letterSpacing: '-0.3px', fontFamily: INTER, lineHeight: 1.2, color: colors.foreground }}>FORGE</div>
          <div style={{ fontSize: '9px', color: colors.mutedForeground, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Universal Engine</div>
        </div>
      </div>

      {/* Navigation */}
      {[
        { key: 'studio', label: 'Studio', icon: <Clapperboard size={15} /> },
        { key: 'viral', label: 'Virality', icon: <BarChart3 size={15} /> },
        { key: 'copilot', label: 'Co-Pilot', icon: <Brain size={15} /> },
      ].map(tab => (
        <button
          key={tab.key}
          onClick={() => { setActiveTab(tab.key as 'studio' | 'viral' | 'copilot'); setSidebarOpen(false); }}
          style={{
            padding: '11px 14px', borderRadius: '10px', border: 'none',
            background: activeTab === tab.key ? tint(colors.primary, 0.18) : 'transparent',
            color: activeTab === tab.key ? colors.foreground : colors.mutedForeground,
            fontWeight: 700, fontSize: '12px', cursor: 'pointer',
            textAlign: 'left', fontFamily: INTER,
            display: 'flex', alignItems: 'center', gap: '10px', transition: TRANSITION.smooth,
            position: 'relative', overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            if (activeTab !== tab.key) {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.color = colors.foreground;
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== tab.key) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = colors.mutedForeground;
            }
          }}
        >
          {activeTab === tab.key && (
            <div style={{
              position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
              width: '3px', height: '20px', background: `linear-gradient(180deg, ${colors.primary}, ${colors.accent})`,
              borderRadius: '0 2px 2px 0'
            }} />
          )}
          <span style={{ fontSize: '15px', position: 'relative', zIndex: 1 }}>{tab.icon}</span>
          <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
        </button>
      ))}

      {/* Bake Button */}
      <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Render Mode Selector */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(2,6,23,0.6)', padding: '4px', borderRadius: '10px' }}>
          {[
            { key: 'ffmpeg' as const, label: 'Pro FFmpeg', icon: <Zap size={12} /> },
            { key: 'canvas' as const, label: 'Fast Canvas', icon: <Palette size={12} /> },
          ].map(mode => (
            <button
              key={mode.key}
              onClick={() => setRenderMode(mode.key)}
              style={{
                flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                background: renderMode === mode.key ? tint(colors.primary, 0.25) : 'transparent',
                color: renderMode === mode.key ? colors.foreground : colors.mutedForeground,
                fontWeight: 700, fontSize: '10px', cursor: 'pointer',
                fontFamily: INTER, textTransform: 'uppercase',
                letterSpacing: '0.5px', transition: TRANSITION.smooth,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
              }}
            >
              {mode.icon}
              <span>{mode.label}</span>
            </button>
          ))}
        </div>

        {/* Aspect Ratio Selector */}
        {activeProject && (
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(2,6,23,0.6)', padding: '4px', borderRadius: '10px' }}>
            {([
              { key: '9:16' as AspectRatio, label: '9:16', icon: '📱' },
              { key: '16:9' as AspectRatio, label: '16:9', icon: '🖥' },
              { key: '1:1' as AspectRatio, label: '1:1', icon: '⬜' },
            ]).map(ar => (
              <button
                key={ar.key}
                onClick={() => setAspectRatio(ar.key)}
                style={{
                  flex: 1, padding: '6px', borderRadius: '8px', border: 'none',
                  background: aspectRatio === ar.key ? tint(colors.primary, 0.25) : 'transparent',
                  color: aspectRatio === ar.key ? colors.foreground : colors.mutedForeground,
                  fontWeight: 700, fontSize: '9px', cursor: 'pointer',
                  fontFamily: INTER, textTransform: 'uppercase',
                  letterSpacing: '0.5px', transition: TRANSITION.smooth,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px'
                }}
              >
                <span>{ar.icon}</span>
                <span>{ar.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Quality Selector */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(2,6,23,0.6)', padding: '4px', borderRadius: '10px' }}>
          {([
            { key: 'draft' as ExportQuality, label: 'Draft' },
            { key: 'standard' as ExportQuality, label: 'Standard' },
            { key: 'high' as ExportQuality, label: 'High' },
            { key: 'pro' as ExportQuality, label: 'Pro' },
          ]).map(q => (
            <button
              key={q.key}
              onClick={() => setExportQuality(q.key)}
              style={{
                flex: 1, padding: '6px', borderRadius: '8px', border: 'none',
                background: exportQuality === q.key ? tint(colors.primary, 0.25) : 'transparent',
                color: exportQuality === q.key ? colors.foreground : colors.mutedForeground,
                fontWeight: 700, fontSize: '9px', cursor: 'pointer',
                fontFamily: INTER, textTransform: 'uppercase',
                letterSpacing: '0.5px', transition: TRANSITION.smooth,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px'
              }}
            >
              <span>{q.label}</span>
            </button>
          ))}
        </div>

        {/* Format Selector */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(2,6,23,0.6)', padding: '4px', borderRadius: '10px' }}>
          {([
            { key: 'mp4' as ExportFormat, label: 'MP4' },
            { key: 'webm' as ExportFormat, label: 'WebM' },
            { key: 'mov' as ExportFormat, label: 'MOV' },
          ]).map(f => (
            <button
              key={f.key}
              onClick={() => setExportFormat(f.key)}
              style={{
                flex: 1, padding: '6px', borderRadius: '8px', border: 'none',
                background: exportFormat === f.key ? tint(colors.primary, 0.25) : 'transparent',
                color: exportFormat === f.key ? colors.foreground : colors.mutedForeground,
                fontWeight: 700, fontSize: '9px', cursor: 'pointer',
                fontFamily: INTER, textTransform: 'uppercase',
                letterSpacing: '0.5px', transition: TRANSITION.smooth,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px'
              }}
            >
              <span>{f.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={triggerExport}
          disabled={isProcessing}
          style={{
            width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
            background: isProcessing ? colors.card : `linear-gradient(135deg, ${statusColors.success}, #059669)`,
            color: colors.onAccent, fontWeight: 900, fontSize: '12px',
            fontFamily: INTER, textTransform: 'uppercase',
            letterSpacing: '0.8px', cursor: isProcessing ? 'not-allowed' : 'pointer',
            boxShadow: isProcessing ? 'none' : `0 8px 30px ${tint(statusColors.success, 0.3)}`,
            transition: TRANSITION.smooth,
            opacity: isProcessing ? 0.5 : 1
          }}
        >
          {isProcessing ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
              <span>{processingStage || 'Baking...'}</span>
            </div>
          ) : renderMode === 'ffmpeg' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Zap size={14} />
              <span>BAKE PRO</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Palette size={14} />
              <span>BAKE FINAL</span>
            </div>
          )}
        </button>

        {exportError && (
          <div style={{
            padding: '12px', background: 'rgba(239,68,68,0.12)',
            borderRadius: '10px', border: `1px solid rgba(239,68,68,0.3)`,
            color: statusColors.successText, fontSize: '10px', fontWeight: 600,
            lineHeight: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px'
          }}>
            <span>{exportError}</span>
            <button onClick={() => setExportError(null)} style={{ background: 'transparent', border: 'none', color: statusColors.successText, cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0, transition: TRANSITION.fast }}><X size={14} /></button>
          </div>
        )}

        {activeProject && (
          <div style={{
            padding: '14px', background: 'rgba(30,41,59,0.2)', borderRadius: '12px',
            border: `1px solid ${colors.border}`
          }}>
            <div style={{ fontSize: '9px', color: colors.mutedForeground, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Project</div>
            <div style={{ fontSize: '10px', color: colors.mutedForeground, lineHeight: 1.8, fontFamily: INTER }}>
              <div>Style: <span style={{ color: colors.primary, fontWeight: 700 }}>{activeProject.captionStyle}</span></div>
              <div>Grade: <span style={{ color: colors.primary, fontWeight: 700 }}>{activeProject.colorGrade}</span></div>
              <div>Music: <span style={{ color: colors.primary, fontWeight: 700 }}>{FREE_MUSIC_TRACKS.find(t => t.id === activeProject.selectedMusicTrackId)?.name || 'None'}</span></div>
              <div>Score: <span style={{ color: statusColors.success, fontWeight: 800 }}>{activeProject.viralityScore}%</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div style={{
      background: `linear-gradient(180deg, ${colors.background} 0%, #020617 100%)`,
      minHeight: '100dvh', color: colors.foreground,
      fontFamily: INTER, overflowX: 'hidden'
    }}>
      {/* ── HEADER / MENU BAR ── */}
      <header className="header-bar safe-area-top" style={{
        height: '48px', padding: '0 16px', borderBottom: `1px solid ${colors.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#0f0f0f', position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setActiveProject(null)}
            style={{
              padding: '6px 12px', borderRadius: '6px', border: 'none',
              background: 'transparent', color: '#a1a1aa',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              fontFamily: INTER, transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: '4px'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = '#252525'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span> New
          </button>
          <div style={{ width: '1px', height: '20px', background: colors.border, margin: '0 4px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '8px',
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: '12px', flexShrink: 0
            }}>F</div>
            <span style={{ fontWeight: 700, fontSize: '13px', letterSpacing: '-0.3px', fontFamily: INTER, color: colors.foreground }}>FORGE</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {['File', 'Edit', 'View', 'Export'].map(item => (
            <button key={item} style={{
              padding: '6px 10px', borderRadius: '6px', border: 'none',
              background: 'transparent', color: '#a1a1aa',
              fontSize: '12px', fontWeight: 500, cursor: 'pointer',
              fontFamily: INTER, transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = '#252525'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.background = 'transparent'; }}
            >{item}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {activeProject && (
            <span style={{
              fontSize: '10px', color: colors.mutedForeground, fontWeight: 600,
              padding: '3px 8px', background: 'rgba(30,41,59,0.5)',
              borderRadius: '6px', marginLeft: '4px',
              display: 'none'
            }} className="project-badge">
              {activeProject.name}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => { setShowApiStatus(!showApiStatus); if (!showApiStatus) setApiStatusLog(getApiStatusLog()); }}
            style={{
              background: apiStatusLog.some(l => !l.ok) ? 'rgba(239,68,68,0.15)' : colors.card,
              color: apiStatusLog.some(l => !l.ok) ? colors.destructive : colors.mutedForeground,
              border: `1px solid ${colors.border}`,
              padding: '8px 14px', borderRadius: '10px', fontSize: '11px',
              fontWeight: 700, cursor: 'pointer', fontFamily: INTER,
              transition: TRANSITION.smooth
            }}
          >
            {apiStatusLog.some(l => !l.ok) ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> API ERRORS</div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Satellite size={12} /> API</div>
            )}
          </button>
          <button
            onClick={() => { setShowApiKeyModal(true); clearApiStatusLog(); setApiStatusLog([]); }}
            style={{
              background: colors.card, color: colors.mutedForeground, border: `1px solid ${colors.border}`,
              padding: '8px 14px', borderRadius: '10px', fontSize: '11px',
              fontWeight: 700, cursor: 'pointer', fontFamily: INTER,
              transition: TRANSITION.smooth
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Settings size={12} /> API Key</div>
          </button>
        </div>
      </header>

      {/* ── PROCESSING OVERLAY ── */}
      {isProcessing && (
        <div style={{
          position: 'fixed', top: 'calc(70px + env(safe-area-inset-top, 0px))', right: '16px', zIndex: 200,
          background: tint(colors.primary, 0.92), color: colors.onPrimary,
          padding: '16px 20px', borderRadius: '16px', fontWeight: 700,
          fontSize: '11px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(12px)', maxWidth: 'calc(100vw - 32px)',
          minWidth: '240px', animation: 'slideDown 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{
              width: '14px', height: '14px',
              border: `2px solid ${colors.onPrimary}20`, borderTopColor: colors.onPrimary,
              borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0
            }} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{processingStage}</span>
          </div>
          {/* Progress bar */}
          <div style={{
            height: '4px', background: 'rgba(255,255,255,0.2)',
            borderRadius: '2px', overflow: 'hidden'
          }}>
            <div style={{
              height: '100%', width: `${renderProgress}%`,
              background: `linear-gradient(90deg, ${colors.accent}, ${colors.primary})`,
              borderRadius: '2px', transition: 'width 0.3s ease'
            }} />
          </div>
          <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '6px', fontFamily: '"JetBrains Mono", monospace' }}>
            {renderProgress}%
          </div>
        </div>
      )}

      {/* ── MOBILE OVERLAY SIDEBAR ── */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 150,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)'
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── MAIN EDITOR LAYOUT ── */}
      <main style={{ display: 'flex', height: 'calc(100dvh - 48px)', background: '#0f0f0f' }}>
        {/* ── CENTER: Preview + Timeline ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Preview Area */}
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px', background: '#0a0a0a', overflow: 'hidden'
          }}>
            {!activeProject ? (
              <NicheSelector onSelectTemplate={handleSelectTemplate} isProcessing={isProcessing} onUploadCustomFile={handleUploadCustomFile} />
            ) : (
              <div style={{ width: '100%', maxWidth: '1200px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Tab bar */}
                <div style={{
                  display: 'flex', gap: '4px',
                  background: '#1a1a1a', padding: '4px',
                  borderRadius: '10px', border: '1px solid #333',
                  width: 'fit-content'
                }}>
                  {[
                    { key: 'studio', label: 'Studio', icon: <Clapperboard size={12} /> },
                    { key: 'viral', label: 'Virality', icon: <BarChart3 size={12} /> },
                    { key: 'copilot', label: 'Co-Pilot', icon: <Brain size={12} /> },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key as 'studio' | 'viral' | 'copilot')}
                      style={{
                        padding: '8px 16px', borderRadius: '8px', border: 'none',
                        background: activeTab === tab.key ? '#252525' : 'transparent',
                        color: activeTab === tab.key ? '#fff' : '#a1a1aa',
                        fontWeight: 600, fontSize: '12px', fontFamily: INTER,
                        cursor: 'pointer', transition: 'all 0.15s',
                        display: 'flex', alignItems: 'center', gap: '6px'
                      }}
                    >
                      {tab.icon}
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
                
                {/* Editor Content */}
                <div style={{ flex: 1, display: 'flex', gap: '16px', minHeight: 0 }}>
                  {/* Preview */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
                    {activeTab === 'studio' && (
                      <VideoPlayerWorkspace
                        project={activeProject}
                        onUpdateProject={(up) => setActiveProject(up as VideoProject)}
                        activeMusicTrack={FREE_MUSIC_TRACKS.find(t => t.id === activeProject.selectedMusicTrackId) || null}
                        activeClipId={activeClipId}
                        onClipSelect={setActiveClipId}
                        aspectRatio={aspectRatio}
                        onUpdateAspectRatio={setAspectRatio}
                        commandInput={commandInput}
                        onCommandChange={handleCommandChange}
                        onCommandKeyDown={handleCommandKeyDown}
                        commandSuggestions={commandSuggestions}
                        onCommandSubmit={handleTextCommand}
                        voiceoverText={activeProject.voiceoverText}
                        onGenerateVoiceover={generateVoiceover}
                        isGeneratingVoiceover={isGeneratingVoiceover}
                        brollClips={activeProject.brollClips}
                        reframeAnalysis={reframeAnalysis}
                        onRunReframeAnalysis={runReframeAnalysis}
                        isAnalyzingReframe={isAnalyzingReframe}
                        selectedReframe={activeProject.selectedReframe}
                        onApplyReframe={applyReframeCrop}
                        imageGenPrompt={imageGenPrompt}
                        onImageGenPromptChange={setImageGenPrompt}
                        imageGenModel={imageGenModel}
                        onImageGenModelChange={setImageGenModel}
                        imageGenAspect={imageGenAspect}
                        onImageGenAspectChange={setImageGenAspect}
                        isGeneratingImage={isGeneratingImage}
                        onGenerateImage={generateImage}
                        generatedImages={generatedImages}
                        onSelectImage={(img) => { setGeneratedImages(prev => prev); }}
                        blurRegions={blurRegions}
                        onAddBlurRegion={addBlurRegion}
                        onRemoveBlurRegion={removeBlurRegion}
                        enableFaceBlur={enableFaceBlur}
                        onToggleFaceBlur={setEnableFaceBlur}
                        exportQuality={exportQuality}
                        onUpdateExportQuality={setExportQuality}
                        exportFormat={exportFormat}
                        onUpdateExportFormat={setExportFormat}
                        onTriggerExport={triggerExport}
                        onNewProject={() => setActiveProject(null)}
                      />
                    )}
                    {activeTab === 'viral' && <ViralityScorecard project={activeProject} onUpdateProject={(up) => setActiveProject(up as VideoProject)} />}
                    {activeTab === 'copilot' && (
                      <AICopilotConsole
                        project={activeProject}
                        onUpdateProject={(up) => setActiveProject(up as VideoProject)}
                        onUpdateSubtitles={(subs: any) => setActiveProject(p => ({ ...p!, subtitles: subs }))}
                      />
                    )}
                  </div>
                  
                  {/* Right Inspector Panel */}
                  <div className="inspector-panel" style={{
                    width: '320px', minWidth: '320px',
                    background: '#1a1a1a', borderLeft: '1px solid #333',
                    overflowY: 'auto', borderRadius: '12px 0 0 12px'
                  }}>
                    {/* Inspector content will be rendered here */}
                    <InspectorPanel project={activeProject} onUpdateProject={(up) => setActiveProject(up as VideoProject)} />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Bottom Timeline */}
          <div className="timeline-panel" style={{
            height: '180px', minHeight: '180px',
            background: '#1a1a1a', borderTop: '1px solid #333',
            padding: '12px 16px'
          }}>
            <Timeline project={activeProject} activeClipId={activeClipId} onClipSelect={setActiveClipId} />
          </div>
        </div>
      </main>

      <ApiKeySettingsModal isOpen={showApiKeyModal} onClose={() => setShowApiKeyModal(false)} />

      {/* ── API STATUS PANEL ── */}
      {showApiStatus && (
        <div className="card" style={{
          position: 'fixed', top: 'calc(70px + env(safe-area-inset-top, 0px))', right: '16px', zIndex: 200,
          padding: '16px', borderRadius: '16px', width: '320px', maxWidth: 'calc(100vw - 32px)',
          boxShadow: '0 25px 80px rgba(0,0,0,0.6)', fontFamily: INTER,
          animation: 'slideDown 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontWeight: 800, fontSize: '12px', color: colors.foreground, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              API Status Log
            </div>
            <button onClick={() => setShowApiStatus(false)} style={{ background: 'transparent', border: 'none', color: colors.mutedForeground, cursor: 'pointer', fontSize: '16px', transition: TRANSITION.fast }}
              onMouseEnter={(e) => e.currentTarget.style.color = colors.foreground}
              onMouseLeave={(e) => e.currentTarget.style.color = colors.mutedForeground}
            >
              <X size={16} />
            </button>
          </div>
          <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {apiStatusLog.length === 0 && (
              <div style={{ fontSize: '11px', color: colors.mutedForeground }}>No calls yet. Run AI to see status.</div>
            )}
            {apiStatusLog.map((entry, i) => (
              <div key={i} style={{
                padding: '8px 10px', borderRadius: '8px', fontSize: '10px',
                background: entry.ok ? statusColors.successDim : 'rgba(239,68,68,0.08)',
                border: `1px solid ${entry.ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                color: entry.ok ? statusColors.success : colors.destructive,
                fontFamily: '"JetBrains Mono", monospace'
              }}>
                <div style={{ fontWeight: 700, marginBottom: '2px' }}>{entry.model}</div>
                <div style={{ opacity: 0.8, wordBreak: 'break-word' }}>{entry.detail}</div>
                <div style={{ fontSize: '9px', opacity: 0.6, marginTop: '2px' }}>
                  {new Date(entry.time).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => { clearApiStatusLog(); setApiStatusLog([]); }}
            style={{
              marginTop: '12px', width: '100%', padding: '8px', borderRadius: '8px',
              background: 'rgba(30,41,59,0.3)', border: `1px solid ${colors.border}`,
              color: colors.mutedForeground, fontSize: '10px', fontWeight: 700, cursor: 'pointer',
              fontFamily: INTER, transition: TRANSITION.smooth
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(30,41,59,0.5)';
              e.currentTarget.style.color = colors.foreground;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(30,41,59,0.3)';
              e.currentTarget.style.color = colors.mutedForeground;
            }}
          >
            Clear Log
          </button>
        </div>
      )}

      {/* ── DOWNLOAD MODAL ── */}
      {downloadReadyInfo && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px', backdropFilter: 'blur(20px)'
        }}>
          <div className="card" style={{
            padding: '48px 36px', borderRadius: '28px',
            textAlign: 'center',
            width: '100%', maxWidth: '440px',
            animation: 'scaleIn 0.3s ease-out'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px', animation: 'float 3s ease-in-out infinite' }}>
              <Trophy size={64} color={colors.primary} />
            </div>
            <h3 style={{ fontWeight: 900, fontSize: '22px', marginBottom: '8px', letterSpacing: '-1px', fontFamily: INTER, color: colors.foreground }}>VIDEO READY</h3>
            <p style={{ color: colors.mutedForeground, fontSize: '13px', marginBottom: '8px', fontFamily: INTER }}>
              Your edit is ready for social media.
            </p>
            {ffmpegFallback && (
              <p style={{ color: statusColors.warningText, fontSize: '11px', marginBottom: '16px', fontFamily: INTER, display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                <AlertTriangle size={12} /> Rendered with Fast Canvas (FFmpeg unavailable). Quality may vary.
              </p>
            )}
            <p style={{ color: colors.mutedForeground, fontSize: '11px', marginBottom: '32px', fontFamily: '"JetBrains Mono", monospace' }}>
              {downloadReadyInfo.filename} • {(downloadReadyInfo.blob.size / 1024 / 1024).toFixed(1)} MB
            </p>
            <button
              onClick={async () => {
                setDownloadError(null);
                try {
                  if (downloadReadyInfo) {
                    await saveFileToDevice(downloadReadyInfo.blob, downloadReadyInfo.filename);
                  }
                } catch (err: any) {
                  setDownloadError('Download failed: ' + (err?.message || 'Storage busy.'));
                }
              }}
              style={{
                display: 'block', width: '100%',
                background: `linear-gradient(135deg, ${statusColors.success}, #059669)`,
                color: colors.onAccent, padding: '18px', borderRadius: '16px',
                fontWeight: 900, fontFamily: INTER, fontSize: '14px',
                border: 'none', cursor: 'pointer',
                boxShadow: `0 8px 30px ${tint(statusColors.success, 0.3)}`, marginBottom: '12px',
                transition: TRANSITION.smooth
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = `0 12px 40px ${tint(statusColors.success, 0.4)}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = `0 8px 30px ${tint(statusColors.success, 0.3)}`;
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Download size={16} />
                SAVE TO GALLERY
              </div>
            </button>
            {downloadError && (
              <p style={{ color: statusColors.errorText, fontSize: '11px', marginBottom: '12px', fontFamily: INTER }}>
                {downloadError}
              </p>
            )}
            <button
              onClick={() => {
                setDownloadReadyInfo(null);
              }}
              style={{ background: 'transparent', color: colors.mutedForeground, border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '12px', fontFamily: INTER, transition: TRANSITION.fast }}
              onMouseEnter={(e) => e.currentTarget.style.color = colors.foreground}
              onMouseLeave={(e) => e.currentTarget.style.color = colors.mutedForeground}
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 20px 60px rgba(236,72,153,0.4), inset 0 1px 0 rgba(255,255,255,0.2); }
          50% { box-shadow: 0 24px 80px rgba(236,72,153,0.5), inset 0 1px 0 rgba(255,255,255,0.2); }
        }
        @media (max-width: 640px) {
          .project-badge { display: none !important; }
          .mobile-project-badge { display: block !important; }
          .header-subtitle { display: none !important; }
        }
        @media (min-width: 641px) {
          .mobile-project-badge { display: none !important; }
          .header-subtitle { display: block !important; }
        }
      `}</style>
    </div>
  );
}
