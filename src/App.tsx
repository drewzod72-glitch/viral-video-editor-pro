import React, { useState, useEffect } from 'react';
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
  const [showAiSuccess, setShowAiSuccess] = useState(false);
  
  // API Status Panel States
  const [showStatusPanel, setShowStatusPanel] = useState(false);
  const [apiLogs, setApiLogs] = useState<any[]>([]);
  const hasApiError = apiLogs.some(log => log.status === 'failure');

  useEffect(() => {
    if (showStatusPanel) {
      const interval = setInterval(() => {
        setApiLogs(getApiStatusLog());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [showStatusPanel]);

  const startApp = () => {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) new AudioCtx().resume();
    } catch (e) {}
    setHasStarted(true);
  };

  useEffect(() => {
    return () => { if (activeProject?.videoUrl?.startsWith('blob:')) URL.revokeObjectURL(activeProject.videoUrl); };
  }, [activeProject?.videoUrl]);

  const handleSelectTemplate = async (template: any) => {
    const proj: VideoProject = {
      id: `p-${Date.now()}`, videoUrl: template.videoUrl, name: template.name, niche: template.niche,
      title: template.name, description: template.userDescription || '',
      subtitles: [], highlights: [{ id: '1', title: 'Full Clip', start: 0, end: 30 }],
      selectedMusicTrackId: 'lofi-8', captionStyle: 'hormozi', colorGrade: 'vibrant_pop',
      enableSubtitles: true, enableZooms: true, musicVolume: 0.4,
      sfxPopEnabled: true, sfxWhooshEnabled: true, autoZoomPunch: true, shakeOnPunch: true,
      createdAt: new Date().toISOString()
    } as any;
    setActiveProject(proj); setActiveTab('studio');
    setIsProcessing(true); setProcessingStage('Analyzing media...');
    try {
      const result = await runAnalyzeVideo({ ...template });
      console.log('[App] AI analysis result:', result);
      if (result?.project) {
        setActiveProject(prev => ({ ...prev, ...result.project, viralityScore: 99 } as any));
        setShowAiSuccess(true); setTimeout(() => setShowAiSuccess(false), 2500);
      }
    } catch (e) { console.warn("AI Service busy. Manual Mode Active."); }
    finally { setIsProcessing(false); }
  };

  const handleUploadCustomFile = async (file: File, name: string, niche: any, description: string) => {
    const videoUrl = URL.createObjectURL(file);
    const proj: VideoProject = {
      id: `c-${Date.now()}`, videoUrl, name, niche, title: name, description: description || '',
      subtitles: [], highlights: [{ id: '1', title: 'Full Clip', start: 0, end: 30 }],
      selectedMusicTrackId: 'hype-1', captionStyle: 'hormozi',
      enableSubtitles: true, enableZooms: true, musicVolume: 0.4,
      sfxPopEnabled: true, sfxWhooshEnabled: true, autoZoomPunch: true, shakeOnPunch: true,
      createdAt: new Date().toISOString()
    } as any;
    setActiveProject(proj); setActiveTab('studio');
    setIsProcessing(true); setProcessingStage('Analyzing media...');
    try {
      const result = await runAnalyzeVideo({ name, niche, userDescription: description, videoFile: file, videoUrl });
      console.log('[App] AI analysis result:', result);
      if (result?.project) {
        setActiveProject(prev => ({ ...prev, ...result.project, viralityScore: 99 } as any));
        setShowAiSuccess(true); setTimeout(() => setShowAiSuccess(false), 2500);
      }
    } catch (e) { console.warn("AI Service busy. Manual Mode Active."); }
    finally { setIsProcessing(false); }
  };

  const triggerExport = async (isRetry = false) => {
    if (!activeProject) return;
    setIsProcessing(true); setProcessingStage(isRetry ? "Retrying bake..." : "Baking final MP4...");
    try {
      const { blob, extension } = await renderVideoInBrowser(activeProject, (p) => setProcessingStage(`${isRetry ? 'Retry: ' : 'Baking: '}${p}%`), activeClipId);
      if (blob && blob.size > 100_000) {
        setDownloadReadyInfo({ blob, filename: `${activeProject.name}_viral.${extension}` });
      } else if (!isRetry) {
        await triggerExport(true);
      } else {
        throw new Error('Exported file too small. Encoding failed.');
      }
    } catch (err: any) { alert('Export failed. ' + (err?.message || 'Device hardware busy.')); }
    finally { setIsProcessing(false); }
  };

  if (!hasStarted) {
    return (
      <div style={{
        background: 'linear-gradient(180deg, #0f172a 0%, #020617 50%, #09090b 100%)',
        minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 20px', fontFamily: '"Inter", sans-serif', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(139,92,246,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.03) 1px, transparent 1px)', backgroundSize: '60px 60px', maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 70%)' }} />
        <div style={{ width: '88px', height: '88px', borderRadius: '28px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', marginBottom: '28px', position: 'relative', zIndex: 1, boxShadow: '0 24px 80px rgba(139,92,246,0.4)', animation: 'float 6s ease-in-out infinite' }}>⚡</div>
        <h1 style={{ color: 'white', fontSize: 'clamp(36px, 8vw, 64px)', fontWeight: 900, margin: '0 0 14px 0', letterSpacing: '-3px', textTransform: 'uppercase', lineHeight: 0.95, position: 'relative', zIndex: 1 }}>VIRAL<br /><span style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>AI FORGE</span></h1>
        <button onClick={startApp} style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', border: 'none', borderRadius: '16px', padding: '20px 64px', fontWeight: 900, fontSize: '14px', textTransform: 'uppercase', cursor: 'pointer', boxShadow: '0 20px 60px rgba(139,92,246,0.4), inset 0 1px 0 rgba(255,255,255,0.2)', letterSpacing: '1.5px', position: 'relative', zIndex: 1 }}>Launch Studio →</button>
      </div>
    );
  }

  return (
    <div style={{ background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)', minHeight: '100dvh', color: 'white', fontFamily: '"Inter", sans-serif', overflowX: 'hidden' }}>
      <header style={{ padding: '14px 20px', borderBottom: '1px solid rgba(30,41,59,0.6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(9,9,11,0.9)', backdropFilter: 'blur(24px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a', padding: '8px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>{sidebarOpen ? '✕' : '☰'}</button>
          <div style={{ fontWeight: 900, fontSize: '15px', letterSpacing: '-0.5px' }}>FORGE</div>
          {showAiSuccess && <span style={{ fontSize: '9px', background: '#10b981', color: 'white', padding: '3px 8px', borderRadius: '6px', fontWeight: 800, marginLeft: '10px', animation: 'pulse 1s infinite' }}>✓ AI EDIT APPLIED</span>}
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
          <button 
            onClick={() => { setShowStatusPanel(!showStatusPanel); setApiLogs(getApiStatusLog()); }} 
            style={{ 
              background: hasApiError ? '#ef4444' : '#18181b', 
              color: 'white', border: '1px solid #27272a', padding: '8px 14px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' 
            }}
          >
            📊 API STATUS
          </button>
          
          {showStatusPanel && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '12px', width: '280px', background: '#09090b', border: '1px solid #27272a', borderRadius: '16px', padding: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', zIndex: 200 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>API Log Stream</span>
                <button onClick={() => { clearApiStatusLog(); setApiLogs([]); }} style={{ background: 'transparent', border: 'none', color: '#8b5cf6', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>CLEAR</button>
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {apiLogs.length === 0 ? <div style={{ fontSize: '11px', color: '#475569', textAlign: 'center', padding: '20px 0' }}>No calls recorded.</div> : apiLogs.map((log, i) => (
                  <div key={i} style={{ padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderLeft: `3px solid ${log.status === 'success' ? '#10b981' : '#ef4444'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 800 }}>
                      <span style={{ color: 'white' }}>{log.model}</span>
                      <span style={{ color: '#64748b' }}>{log.timestamp}</span>
                    </div>
                    {log.error && <div style={{ fontSize: '9px', color: '#ef4444', marginTop: '4px', fontFamily: 'monospace', wordBreak: 'break-all' }}>{log.error}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <button onClick={() => setShowApiKeyModal(true)} style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a', padding: '8px 14px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>⚙ API Key</button>
        </div>
      </header>
      <main style={{ display: 'flex', maxWidth: '1400px', margin: '0 auto', minHeight: 'calc(100dvh - 60px)', position: 'relative' }}>
        <aside style={{ width: sidebarOpen ? '260px' : '0px', minWidth: sidebarOpen ? '260px' : '0px', background: 'rgba(9,9,11,0.95)', backdropFilter: 'blur(20px)', borderRight: sidebarOpen ? '1px solid rgba(30,41,59,0.5)' : '1px solid transparent', padding: sidebarOpen ? '20px 16px' : '20px 0', overflowY: 'auto', overflowX: 'hidden', position: 'sticky', top: '60px', height: 'calc(100dvh - 60px)', transition: 'all 0.3s ease', zIndex: 160 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%' }}>
            {['studio', 'viral', 'copilot'].map(tab => (
              <button key={tab} onClick={() => { setActiveTab(tab as any); setSidebarOpen(false); }} style={{ padding: '11px 14px', borderRadius: '10px', border: 'none', background: activeTab === tab ? 'rgba(139,92,246,0.18)' : 'transparent', color: activeTab === tab ? '#c4b5fd' : '#a1a1aa', fontWeight: 700, fontSize: '12px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }}>{tab.toUpperCase()}</button>
            ))}
            <button onClick={() => triggerExport()} disabled={isProcessing} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: isProcessing ? '#18181b' : 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontWeight: 900, fontSize: '12px', textTransform: 'uppercase', marginTop: 'auto', cursor: isProcessing ? 'not-allowed' : 'pointer' }}>{isProcessing ? processingStage : '🔥 BAKE FINAL'}</button>
          </div>
        </aside>
        <div style={{ flex: 1, padding: '20px', paddingBottom: '120px', maxWidth: '1100px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          {!activeProject ? (
            <NicheSelector onSelectTemplate={handleSelectTemplate} isProcessing={isProcessing} onUploadCustomFile={handleUploadCustomFile} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(9,9,11,0.8)', padding: '4px', borderRadius: '14px', border: '1px solid rgba(30,41,59,0.5)', width: 'fit-content' }}>
                {['studio', 'viral', 'copilot'].map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab as any)} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: activeTab === tab ? 'rgba(139,92,246,0.25)' : 'transparent', color: activeTab === tab ? '#e9d5ff' : '#71717a', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>{tab.toUpperCase()}</button>
                ))}
              </div>
              {activeTab === 'studio' && <VideoPlayerWorkspace project={activeProject} onUpdateProject={setActiveProject as any} activeMusicTrack={FREE_MUSIC_TRACKS.find(t => t.id === activeProject.selectedMusicTrackId) || null} activeClipId={activeClipId} onClipSelect={setActiveClipId} />}
              {activeTab === 'viral' && <ViralityScorecard project={activeProject} onUpdateProject={setActiveProject as any} />}
              {activeTab === 'copilot' && <AICopilotConsole project={activeProject} onUpdateProject={setActiveProject as any} onUpdateSubtitles={(subs: any) => setActiveProject(p => ({ ...p!, subtitles: subs }))} />}
            </div>
          )}
        </div>
      </main>
      <ApiKeySettingsModal isOpen={showApiKeyModal} onClose={() => setShowApiKeyModal(false)} />
      {downloadReadyInfo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(20px)' }}>
          <div style={{ background: '#09090b', padding: '48px 36px', borderRadius: '28px', border: '1px solid rgba(30,41,59,0.6)', textAlign: 'center', width: '100%', maxWidth: '440px' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🏆</div>
            <h3 style={{ fontWeight: 900, fontSize: '22px', marginBottom: '8px' }}>VIDEO READY</h3>
            <button onClick={() => saveFileToDevice(downloadReadyInfo.blob, downloadReadyInfo.filename)} style={{ display: 'block', width: '100%', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', padding: '18px', borderRadius: '16px', fontWeight: 900, fontSize: '14px', border: 'none', cursor: 'pointer', marginBottom: '12px' }}>SAVE TO GALLERY</button>
            <button onClick={() => setDownloadReadyInfo(null)} style={{ background: 'transparent', color: '#64748b', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>CLOSE</button>
          </div>
        </div>
      )}
      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
}
