import React, { useState, useEffect, useRef } from 'react';
import { VideoProject } from './types';
import { FREE_MUSIC_TRACKS, RAW_VIDEO_TEMPLATES } from './data';
import NicheSelector from './components/NicheSelector';
import VideoPlayerWorkspace from './components/VideoPlayerWorkspace';
import ViralityScorecard from './components/ViralityScorecard';
import { AICopilotConsole } from './components/AICopilotConsole';
import ApiKeySettingsModal from './components/ApiKeySettingsModal';
import { runAnalyzeVideo, getApiStatusLog, clearApiStatusLog } from './utils/groqClient';
import { saveFileToDevice } from './utils/download';
import { renderVideoInBrowser } from './utils/ffmpegClient';
import { computeViralityScore } from './utils/viralityScore';
import { renderVideoWithFFmpegWasm, LUT_PRESETS, TRANSITION_PRESETS, detectViralMoments } from './utils/ffmpegWasmRenderer';



export default function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const [activeProject, setActiveProject] = useState<VideoProject | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [activeTab, setActiveTab] = useState<'studio' | 'viral' | 'copilot'>('studio');
  const [downloadReadyInfo, setDownloadReadyInfo] = useState<{ blob: Blob; filename: string } | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiSuccess, setAiSuccess] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<'vision' | 'text' | null>(null);
  const [apiStatusLog, setApiStatusLog] = useState<any[]>([]);
  const [showApiStatus, setShowApiStatus] = useState(false);
  const [renderMode, setRenderMode] = useState<'canvas' | 'ffmpeg'>('ffmpeg');
  const [renderProgress, setRenderProgress] = useState(0);
  const [ffmpegFallback, setFfmpegFallback] = useState(false);

  const startApp = () => {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) new AudioCtx().resume();
    } catch (e) {}
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
          URL.revokeObjectURL(v.src);
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
      v.onloadedmetadata = () => {
        const dur = v.duration || 0;
        URL.revokeObjectURL(url);
        v.remove();
        resolve(dur);
      };
      v.onerror = () => {
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
    setProcessingStage("Initializing render engine...");
    setRenderProgress(0);
    try {
      let result: { blob: Blob; filename: string };

      if (renderMode === 'ffmpeg') {
        // Professional FFmpeg.wasm render
        const blob = await renderVideoWithFFmpegWasm({
          project: activeProject,
          onProgress: (p, stage) => {
            setRenderProgress(p);
            setProcessingStage(stage || `Rendering: ${p}%`);
            // Wire Kilo's fallback indicator: the renderer signals canvas
            // fallback via this stage message when FFmpeg.wasm fails.
            if (stage && stage.includes('switching to Fast Canvas')) {
              setFfmpegFallback(true);
            }
          },
          activeClipId,
          mode: 'ffmpeg'
        });
        result = { blob, filename: `${activeProject.name}_pro.mp4` };
      } else {
        // Canvas fallback
        const canvasResult = await renderVideoInBrowser(
          activeProject,
          (p) => {
            setRenderProgress(p);
            setProcessingStage(`Baking: ${p}%`);
          },
          activeClipId
        );
        result = { blob: canvasResult.blob, filename: `${activeProject.name}_viral.${canvasResult.extension}` };
      }

      // Size-Gate + Duration-Gate: verify blob is valid and duration matches expected
      const expectedDuration = activeProject.highlights?.reduce(
        (s, h) => s + (h.duration || (h.end - h.start)), 0
      ) || activeProject.duration || 30;
      
      const actualDuration = await getBlobDuration(result.blob);
      const durationOk = Math.abs(actualDuration - expectedDuration) < 2.0; // Allow 2s tolerance
      const sizeOk = result.blob.size > 500_000;
      
      if (sizeOk && durationOk) {
        setDownloadReadyInfo(result);
      } else if (sizeOk && !durationOk) {
        // Duration mismatch - re-render once with canvas fallback
        setProcessingStage("Fixing duration...");
        setRenderProgress(0);
        const retryBlob = await renderVideoInBrowser(
          activeProject,
          (p) => {
            setRenderProgress(p);
            setProcessingStage(`Fixing: ${p}%`);
          },
          activeClipId
        ).then(r => r.blob);
        
        const retryDuration = await getBlobDuration(retryBlob);
        if (retryBlob.size > 500_000 && Math.abs(retryDuration - expectedDuration) < 2.0) {
          setFfmpegFallback(true);
          setDownloadReadyInfo({ blob: retryBlob, filename: result.filename });
        } else {
          alert('Export failed. Duration mismatch after retry.');
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
              mode: 'ffmpeg'
            })
          : await renderVideoInBrowser(
              activeProject,
              (p) => {
                setRenderProgress(p);
                setProcessingStage(`Retry: ${p}%`);
              },
              activeClipId
            ).then(r => r.blob);

        if (retryBlob && retryBlob.size > 500_000) {
          setDownloadReadyInfo({ blob: retryBlob, filename: result.filename });
        } else {
          alert('Export failed. Rendered file is empty or too small after retry.');
        }
      } else {
        alert('Export failed. Rendered file is empty or too small.');
      }
    } catch (err: any) {
      alert('Export failed. ' + (err?.message || 'Device hardware busy.'));
    } finally {
      setIsProcessing(false);
      setRenderProgress(0);
    }
  };

  if (!hasStarted) {
    return (
      <div style={{
        background: 'linear-gradient(180deg, #0f172a 0%, #020617 50%, #09090b 100%)',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '40px 20px',
        fontFamily: '"Inter", sans-serif',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(139,92,246,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.03) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 70%)'
        }} />

        {/* Glow orbs */}
        <div style={{
          position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
          width: '400px', height: '400px',
          background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
          borderRadius: '50%', filter: 'blur(60px)',
          pointerEvents: 'none'
        }} />

        <div style={{
          width: '88px', height: '88px', borderRadius: '28px',
          background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '40px', marginBottom: '28px', position: 'relative', zIndex: 1,
          boxShadow: '0 24px 80px rgba(139,92,246,0.4)',
          animation: 'float 6s ease-in-out infinite'
        }}>⚡</div>

        <h1 style={{
          color: 'white',
          fontSize: 'clamp(36px, 8vw, 64px)',
          fontWeight: 900,
          margin: '0 0 14px 0',
          letterSpacing: '-3px',
          fontFamily: '"Inter", sans-serif',
          textTransform: 'uppercase',
          lineHeight: 0.95,
          position: 'relative', zIndex: 1
        }}>
          VIRAL<br />
          <span style={{
            background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>AI FORGE</span>
        </h1>

        <p style={{
          color: '#94a3b8', fontSize: 'clamp(13px, 2.5vw, 15px)',
          maxWidth: '420px', marginBottom: '44px', fontWeight: 500, lineHeight: 1.7,
          position: 'relative', zIndex: 1
        }}>
          Professional video studio. Frame-accurate browser engine.
          Zero hosting cost. Works on every device.
        </p>

        <button
          onClick={startApp}
          style={{
            background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            color: 'white', border: 'none', borderRadius: '16px',
            padding: '20px 64px', fontWeight: 900, fontSize: '14px',
            fontFamily: '"Inter", sans-serif', textTransform: 'uppercase',
            cursor: 'pointer',
            boxShadow: '0 20px 60px rgba(139,92,246,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
            letterSpacing: '1.5px',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative', zIndex: 1,
            animation: 'pulse-glow 3s ease-in-out infinite'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
            e.currentTarget.style.boxShadow = '0 24px 80px rgba(139,92,246,0.5), inset 0 1px 0 rgba(255,255,255,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 20px 60px rgba(139,92,246,0.4), inset 0 1px 0 rgba(255,255,255,0.2)';
          }}
        >
          Launch Studio →
        </button>

        <div style={{
          marginTop: '48px', display: 'flex', gap: '12px', flexWrap: 'wrap',
          justifyContent: 'center', position: 'relative', zIndex: 1
        }}>
          {[
            { label: 'Frame Engine', icon: '⚙' },
            { label: 'Audio Sync', icon: '🔊' },
            { label: 'Free Forever', icon: '∞' },
            { label: 'Native Ready', icon: '📱' },
          ].map((f) => (
            <div key={f.label} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '10px', color: '#64748b', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.8px',
              background: 'rgba(30,41,59,0.3)',
              padding: '8px 14px', borderRadius: '10px',
              border: '1px solid rgba(30,41,59,0.4)',
              backdropFilter: 'blur(8px)'
            }}>
              <span>{f.icon}</span>
              <span>{f.label}</span>
            </div>
          ))}
        </div>

        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
          @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 20px 60px rgba(139,92,246,0.4), inset 0 1px 0 rgba(255,255,255,0.2); }
            50% { box-shadow: 0 24px 80px rgba(139,92,246,0.5), inset 0 1px 0 rgba(255,255,255,0.2); }
          }
        `}</style>
      </div>
    );
  }

  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%' }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 4px 16px 4px', borderBottom: '1px solid rgba(30,41,59,0.5)', marginBottom: '8px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '14px', flexShrink: 0 }}>F</div>
        <div>
          <div style={{ fontWeight: 900, fontSize: '13px', letterSpacing: '-0.3px', fontFamily: '"Inter", sans-serif', lineHeight: 1.2 }}>FORGE</div>
          <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Universal Engine</div>
        </div>
      </div>

      {/* Navigation */}
      {[
        { key: 'studio', label: 'Studio', icon: '🎬' },
        { key: 'viral', label: 'Virality', icon: '📊' },
        { key: 'copilot', label: 'Co-Pilot', icon: '🧠' },
      ].map(tab => (
        <button
          key={tab.key}
          onClick={() => { setActiveTab(tab.key as 'studio' | 'viral' | 'copilot'); setSidebarOpen(false); }}
          style={{
            padding: '11px 14px', borderRadius: '10px', border: 'none',
            background: activeTab === tab.key ? 'rgba(139,92,246,0.18)' : 'transparent',
            color: activeTab === tab.key ? '#c4b5fd' : '#a1a1aa',
            fontWeight: 700, fontSize: '12px', cursor: 'pointer',
            textAlign: 'left', fontFamily: '"Inter", sans-serif',
            display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.2s'
          }}
        >
          <span style={{ fontSize: '15px' }}>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}

      {/* Bake Button */}
      <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid rgba(30,41,59,0.5)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Render Mode Selector */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(2,6,23,0.6)', padding: '4px', borderRadius: '10px' }}>
          {[
            { key: 'ffmpeg' as const, label: 'Pro FFmpeg', icon: '⚡' },
            { key: 'canvas' as const, label: 'Fast Canvas', icon: '🎨' },
          ].map(mode => (
            <button
              key={mode.key}
              onClick={() => setRenderMode(mode.key)}
              style={{
                flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                background: renderMode === mode.key ? 'rgba(139,92,246,0.25)' : 'transparent',
                color: renderMode === mode.key ? '#e9d5ff' : '#71717a',
                fontWeight: 700, fontSize: '10px', cursor: 'pointer',
                fontFamily: '"Inter", sans-serif', textTransform: 'uppercase',
                letterSpacing: '0.5px', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
              }}
            >
              <span>{mode.icon}</span>
              <span>{mode.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={triggerExport}
          disabled={isProcessing}
          style={{
            width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
            background: isProcessing ? '#18181b' : 'linear-gradient(135deg, #10b981, #059669)',
            color: 'white', fontWeight: 900, fontSize: '12px',
            fontFamily: '"Inter", sans-serif', textTransform: 'uppercase',
            letterSpacing: '0.8px', cursor: isProcessing ? 'not-allowed' : 'pointer',
            boxShadow: isProcessing ? 'none' : '0 8px 30px rgba(16,185,129,0.3)',
            transition: 'all 0.2s'
          }}
        >
          {isProcessing ? `⏳ ${processingStage || 'Baking...'}` : renderMode === 'ffmpeg' ? '⚡ BAKE PRO' : '🎨 BAKE FINAL'}
        </button>

        {activeProject && (
          <div style={{ padding: '12px', background: 'rgba(30,41,59,0.2)', borderRadius: '10px', border: '1px solid rgba(30,41,59,0.4)' }}>
            <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Project</div>
            <div style={{ fontSize: '10px', color: '#a1a1aa', lineHeight: 1.7 }}>
              <div>Style: <span style={{ color: '#c4b5fd', fontWeight: 700 }}>{activeProject.captionStyle}</span></div>
              <div>Grade: <span style={{ color: '#c4b5fd', fontWeight: 700 }}>{activeProject.colorGrade}</span></div>
              <div>Music: <span style={{ color: '#c4b5fd', fontWeight: 700 }}>{FREE_MUSIC_TRACKS.find(t => t.id === activeProject.selectedMusicTrackId)?.name || 'None'}</span></div>
              <div>Score: <span style={{ color: '#10b981', fontWeight: 800 }}>{activeProject.viralityScore}%</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{
      background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',
      minHeight: '100dvh', color: 'white',
      fontFamily: '"Inter", sans-serif', overflowX: 'hidden'
    }}>
      {/* ── HEADER ── */}
      <header style={{
        padding: '14px 20px', borderBottom: '1px solid rgba(30,41,59,0.6)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'rgba(9,9,11,0.9)', backdropFilter: 'blur(24px)',
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a',
              padding: '8px 12px', borderRadius: '10px', fontSize: '12px',
              fontWeight: 700, cursor: 'pointer', fontFamily: '"Inter", sans-serif',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            {sidebarOpen ? '✕' : '☰'}
          </button>
          <div style={{ fontWeight: 900, fontSize: '15px', letterSpacing: '-0.5px', fontFamily: '"Inter", sans-serif' }}>
            FORGE
          </div>
          {activeProject && (
            <span style={{
              fontSize: '10px', color: '#64748b', fontWeight: 600,
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
              background: apiStatusLog.some(l => !l.ok) ? 'rgba(239,68,68,0.15)' : '#18181b',
              color: apiStatusLog.some(l => !l.ok) ? '#ef4444' : '#a1a1aa',
              border: '1px solid #27272a',
              padding: '8px 14px', borderRadius: '10px', fontSize: '11px',
              fontWeight: 700, cursor: 'pointer', fontFamily: '"Inter", sans-serif'
            }}
          >
            {apiStatusLog.some(l => !l.ok) ? '⚠ API ERRORS' : '📡 API'}
          </button>
          <button
            onClick={() => { setShowApiKeyModal(true); clearApiStatusLog(); setApiStatusLog([]); }}
            style={{
              background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a',
              padding: '8px 14px', borderRadius: '10px', fontSize: '11px',
              fontWeight: 700, cursor: 'pointer', fontFamily: '"Inter", sans-serif'
            }}
          >
            ⚙ API Key
          </button>
        </div>
      </header>

      {/* ── PROCESSING OVERLAY ── */}
      {isProcessing && (
        <div style={{
          position: 'fixed', top: '70px', right: '16px', zIndex: 200,
          background: 'rgba(139,92,246,0.95)', color: 'white',
          padding: '16px 20px', borderRadius: '16px', fontWeight: 700,
          fontSize: '11px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(12px)', maxWidth: 'calc(100vw - 32px)',
          minWidth: '240px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{
              width: '14px', height: '14px',
              border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white',
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
              background: 'linear-gradient(90deg, #06b6d4, #8b5cf6)',
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

      {/* ── MAIN LAYOUT ── */}
      <main style={{ display: 'flex', maxWidth: '1400px', margin: '0 auto', minHeight: 'calc(100dvh - 60px)', position: 'relative' }}>
        {/* ── SIDEBAR ── */}
        <aside style={{
          width: sidebarOpen ? '260px' : '0px', minWidth: sidebarOpen ? '260px' : '0px',
          background: 'rgba(9,9,11,0.95)', backdropFilter: 'blur(20px)',
          borderRight: sidebarOpen ? '1px solid rgba(30,41,59,0.5)' : '1px solid transparent',
          padding: sidebarOpen ? '20px 16px' : '20px 0',
          overflowY: 'auto', overflowX: 'hidden',
          position: 'sticky', top: '60px', height: 'calc(100dvh - 60px)',
          transition: 'all 0.3s ease', zIndex: 160
        }}>
          {sidebarContent}
        </aside>

        {/* ── CONTENT AREA ── */}
        <div style={{
          flex: 1, padding: '20px', paddingBottom: '120px',
          maxWidth: '1100px', margin: '0 auto', width: '100%',
          boxSizing: 'border-box'
        }}>
          {/* Mobile project badge */}
          {activeProject && (
            <div style={{
              display: 'none', marginBottom: '16px', padding: '10px 14px',
              background: 'rgba(30,41,59,0.4)', borderRadius: '12px',
              border: '1px solid rgba(30,41,59,0.5)',
              fontSize: '11px', color: '#a1a1aa', fontWeight: 600
            }} className="mobile-project-badge">
              {activeProject.name} — {activeProject.niche}
            </div>
          )}

          {!activeProject ? (
            <NicheSelector onSelectTemplate={handleSelectTemplate} isProcessing={isProcessing} onUploadCustomFile={handleUploadCustomFile} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Tab bar */}
              <div style={{
                display: 'flex', gap: '4px',
                background: 'rgba(9,9,11,0.8)', backdropFilter: 'blur(20px)',
                padding: '4px', borderRadius: '14px',
                border: '1px solid rgba(30,41,59,0.5)', width: 'fit-content'
              }}>
                {[
                  { key: 'studio', label: '🎬 Studio' },
                  { key: 'viral', label: '📊 Virality' },
                  { key: 'copilot', label: '🧠 Co-Pilot' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as 'studio' | 'viral' | 'copilot')}
                    style={{
                      padding: '10px 20px', borderRadius: '10px', border: 'none',
                      background: activeTab === tab.key ? 'rgba(139,92,246,0.25)' : 'transparent',
                      color: activeTab === tab.key ? '#e9d5ff' : '#71717a',
                      fontWeight: 700, fontSize: '12px', fontFamily: '"Inter", sans-serif',
                      cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === 'studio' && (
                <div style={{ position: 'relative' }}>
                  {aiSuccess && (
                    <div style={{
                      position: 'absolute', top: '-8px', left: '50%', transform: 'translateX(-50%)',
                      background: analysisMode === 'vision' 
                        ? 'linear-gradient(135deg, #06b6d4, #0891b2)' 
                        : 'linear-gradient(135deg, #10b981, #059669)',
                      color: 'white', padding: '6px 16px', borderRadius: '20px',
                      fontSize: '10px', fontWeight: 800, zIndex: 50,
                      textTransform: 'uppercase', letterSpacing: '0.5px',
                      boxShadow: analysisMode === 'vision'
                        ? '0 4px 20px rgba(6,182,212,0.4)'
                        : '0 4px 20px rgba(16,185,129,0.4)',
                      animation: 'pulse-glow 2s ease-in-out infinite',
                      whiteSpace: 'nowrap'
                    }}>
                      {analysisMode === 'vision' ? '👁 VISION AI EDIT APPLIED' : '✓ AI EDIT APPLIED'}
                    </div>
                  )}
                  <VideoPlayerWorkspace
                    project={activeProject}
                    onUpdateProject={(up) => setActiveProject(up as VideoProject)}
                    activeMusicTrack={FREE_MUSIC_TRACKS.find(t => t.id === activeProject.selectedMusicTrackId) || null}
                    activeClipId={activeClipId}
                    onClipSelect={setActiveClipId}
                  />
                </div>
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
          )}
        </div>
      </main>

      <ApiKeySettingsModal isOpen={showApiKeyModal} onClose={() => setShowApiKeyModal(false)} />

      {/* ── API STATUS PANEL ── */}
      {showApiStatus && (
        <div style={{
          position: 'fixed', top: '70px', right: '16px', zIndex: 200,
          background: '#09090b', padding: '16px', borderRadius: '16px',
          border: '1px solid rgba(30,41,59,0.6)', width: '320px', maxWidth: 'calc(100vw - 32px)',
          boxShadow: '0 25px 80px rgba(0,0,0,0.6)', fontFamily: '"Inter", sans-serif'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontWeight: 800, fontSize: '12px', color: 'white', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              API Status Log
            </div>
            <button onClick={() => setShowApiStatus(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '16px' }}>×</button>
          </div>
          <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {apiStatusLog.length === 0 && (
              <div style={{ fontSize: '11px', color: '#64748b' }}>No calls yet. Run AI to see status.</div>
            )}
            {apiStatusLog.map((entry, i) => (
              <div key={i} style={{
                padding: '8px 10px', borderRadius: '8px', fontSize: '10px',
                background: entry.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${entry.ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                color: entry.ok ? '#10b981' : '#ef4444',
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
              background: 'rgba(30,41,59,0.3)', border: '1px solid rgba(30,41,59,0.5)',
              color: '#a1a1aa', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
              fontFamily: '"Inter", sans-serif'
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
          <div style={{
            background: '#09090b', padding: '48px 36px', borderRadius: '28px',
            border: '1px solid rgba(30,41,59,0.6)', textAlign: 'center',
            width: '100%', maxWidth: '440px',
            boxShadow: '0 25px 80px rgba(0,0,0,0.6)'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🏆</div>
            <h3 style={{ fontWeight: 900, fontSize: '22px', marginBottom: '8px', letterSpacing: '-1px', fontFamily: '"Inter", sans-serif' }}>VIDEO READY</h3>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '8px', fontFamily: '"Inter", sans-serif' }}>
              Your edit is ready for social media.
            </p>
            {ffmpegFallback && (
              <p style={{ color: '#f59e0b', fontSize: '11px', marginBottom: '16px', fontFamily: '"Inter", sans-serif' }}>
                ⚠ Rendered with Fast Canvas (FFmpeg unavailable). Quality may vary.
              </p>
            )}
            <p style={{ color: '#64748b', fontSize: '11px', marginBottom: '32px', fontFamily: '"Inter", sans-serif' }}>
              {downloadReadyInfo.filename} • {(downloadReadyInfo.blob.size / 1024 / 1024).toFixed(1)} MB
            </p>
            <button
              onClick={async () => {
                try {
                  if (downloadReadyInfo) {
                    await saveFileToDevice(downloadReadyInfo.blob, downloadReadyInfo.filename);
                  }
                } catch (err: any) {
                  alert('Download failed. ' + (err?.message || 'Storage busy.'));
                }
              }}
              style={{
                display: 'block', width: '100%',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: 'white', padding: '18px', borderRadius: '16px',
                fontWeight: 900, fontFamily: '"Inter", sans-serif', fontSize: '14px',
                border: 'none', cursor: 'pointer',
                boxShadow: '0 8px 30px rgba(16,185,129,0.3)', marginBottom: '12px'
              }}
            >
              SAVE TO GALLERY
            </button>
            <button
              onClick={() => {
                setDownloadReadyInfo(null);
              }}
              style={{ background: 'transparent', color: '#64748b', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '12px', fontFamily: '"Inter", sans-serif' }}
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 20px 60px rgba(139,92,246,0.4), inset 0 1px 0 rgba(255,255,255,0.2); }
          50% { box-shadow: 0 24px 80px rgba(139,92,246,0.5), inset 0 1px 0 rgba(255,255,255,0.2); }
        }
        @media (max-width: 640px) {
          .project-badge { display: none !important; }
          .mobile-project-badge { display: block !important; }
        }
        @media (min-width: 641px) {
          .mobile-project-badge { display: none !important; }
        }
      `}</style>
    </div>
  );
}
