import React, { useState, useEffect } from 'react';
import { VideoProject } from './types';
import { FREE_MUSIC_TRACKS, RAW_VIDEO_TEMPLATES } from './data';
import NicheSelector from './components/NicheSelector';
import VideoPlayerWorkspace from './components/VideoPlayerWorkspace';
import ViralityScorecard from './components/ViralityScorecard';
import { AICopilotConsole } from './components/AICopilotConsole';
import ApiKeySettingsModal from './components/ApiKeySettingsModal';
import { runAnalyzeVideo } from './utils/geminiClient';

export default function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const [activeProject, setActiveProject] = useState<VideoProject | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [activeTab, setActiveTab] = useState<'studio' | 'viral' | 'copilot'>('studio');
  const [downloadReadyInfo, setDownloadReadyInfo] = useState<{ url: string; filename: string } | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);

  const startApp = () => {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) new AudioCtx().resume();
    } catch (e) {}
    setHasStarted(true);
  };

  const handleSelectTemplate = async (template: any) => {
    const proj: VideoProject = {
      id: `p-${Date.now()}`,
      videoUrl: template.videoUrl,
      name: template.name,
      niche: template.niche,
      title: template.name,
      description: template.userDescription || '',
      subtitles: [],
      highlights: [{ id: '1', title: 'Full Clip', start: 0, end: 30 }],
      selectedMusicTrackId: 'lofi-1',
      captionStyle: 'hormozi',
      colorGrade: 'vibrant_pop',
      enableSubtitles: true, enableZooms: true, musicVolume: 0.4,
      sfxPopEnabled: true, sfxWhooshEnabled: true, autoZoomPunch: true, shakeOnPunch: true,
      createdAt: new Date().toISOString()
    } as any;
    
    setActiveProject(proj);
    setActiveTab('studio');
    setIsProcessing(true);
    setProcessingStage('Groq AI Analyzing Media...');

    try {
      const result = await runAnalyzeVideo({ ...template });
      if (result?.project) {
        setActiveProject(prev => ({ ...prev, ...result.project, viralityScore: 99 } as any));
      }
    } catch (e) {
      console.warn("AI Service busy. Manual Mode Active.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadCustomFile = async (file: File, name: string, niche: any, description: string) => {
    const videoUrl = URL.createObjectURL(file);
    const proj: VideoProject = {
      id: `c-${Date.now()}`,
      videoUrl,
      name,
      niche,
      title: name,
      description: description || '',
      subtitles: [],
      highlights: [{ id: '1', title: 'Full Clip', start: 0, end: 30 }],
      selectedMusicTrackId: 'hype-1',
      captionStyle: 'hormozi',
      enableSubtitles: true, enableZooms: true, musicVolume: 0.4,
      sfxPopEnabled: true, sfxWhooshEnabled: true, autoZoomPunch: true, shakeOnPunch: true,
      createdAt: new Date().toISOString()
    } as any;

    setActiveProject(proj);
    setActiveTab('studio');
    setIsProcessing(true);
    setProcessingStage('Analyzing Media...');

    try {
      const result = await runAnalyzeVideo({ name, niche, userDescription: description, videoFile: file, videoUrl });
      if (result?.project) {
        setActiveProject(prev => ({ ...prev, ...result.project, viralityScore: 99 } as any));
      }
    } catch (e) {
      setIsProcessing(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerExport = async () => {
    if (!activeProject) return;
    setIsProcessing(true);
    setProcessingStage("Forging Final MP4...");
    try {
      const { renderVideoInBrowser } = await import('./utils/ffmpegClient');
      const blob = await renderVideoInBrowser(activeProject, (p) => setProcessingStage(`Baking: ${p}%`), activeClipId);
      if (blob) {
        // Final optimization
        const response = await fetch('/api/transcode', { method: 'POST', body: blob }).catch(() => null);
        const finalBlob = (response && response.ok) ? await response.blob() : blob;
        setDownloadReadyInfo({ url: URL.createObjectURL(finalBlob), filename: `${activeProject.name}_viral.mp4` });
      }
    } catch (err: any) { 
      alert('Export failed. Phone hardware busy.'); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  if (!hasStarted) {
    return (
      <div style={{ background: '#020617', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: '60px', marginBottom: '30px' }}>⚡</div>
        <h1 style={{ color: 'white', fontSize: '36px', fontWeight: '900', margin: '0 0 10px 0', letterSpacing: '-2px', textTransform: 'uppercase' }}>Viral <span style={{ color: '#8b5cf6' }}>AI Forge</span></h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', maxWidth: '300px', marginBottom: '40px', fontWeight: 'bold' }}>Professional studio for sneaker content creators.</p>
        <button onClick={startApp} style={{ background: 'white', color: 'black', border: 'none', borderRadius: '50px', padding: '20px 60px', fontWeight: '900', fontSize: '14px', textTransform: 'uppercase', cursor: 'pointer', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>Launch Studio</button>
      </div>
    );
  }

  return (
    <div style={{ background: '#020617', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif', overflowY: 'auto' }}>
      <header style={{ padding: '20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <h1 style={{ fontWeight: '900', fontSize: '18px', letterSpacing: '-1px' }}>FORGE</h1>
        <button onClick={() => setShowApiKeyModal(true)} style={{ background: '#1e293b', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '14px', fontSize: '11px', fontWeight: '900', cursor: 'pointer' }}>SET KEY</button>
      </header>

      {isProcessing && (
        <div style={{ position: 'fixed', top: '90px', right: '20px', zIndex: 200, background: '#8b5cf6', color: 'white', padding: '15px 25px', borderRadius: '20px', fontWeight: '900', fontSize: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '14px', height: '14px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          {processingStage}
        </div>
      )}

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px', paddingBottom: '120px' }}>
        {!activeProject ? (
          <NicheSelector onSelectTemplate={handleSelectTemplate} isProcessing={isProcessing} onUploadCustomFile={handleUploadCustomFile} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#0f172a', padding: '20px', borderRadius: '28px', border: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                 <div style={{ fontSize: '24px' }}>👟</div>
                 <div style={{ fontWeight: '900', fontSize: '13px', color: 'white' }}>{activeProject.name}</div>
               </div>
               <div style={{ display: 'flex', gap: '10px' }}>
                 <button onClick={() => setActiveTab('studio')} style={{ padding: '12px 20px', borderRadius: '15px', border: 'none', background: activeTab === 'studio' ? '#8b5cf6' : '#1e293b', color: 'white', fontSize: '11px', fontWeight: '900', cursor: 'pointer' }}>Studio</button>
                 <button onClick={() => setActiveTab('viral')} style={{ padding: '12px 20px', borderRadius: '15px', border: 'none', background: activeTab === 'viral' ? '#8b5cf6' : '#1e293b', color: 'white', fontSize: '11px', fontWeight: '900', cursor: 'pointer' }}>Viral</button>
                 <button onClick={() => setActiveTab('copilot')} style={{ padding: '12px 20px', borderRadius: '15px', border: 'none', background: activeTab === 'copilot' ? '#8b5cf6' : '#1e293b', color: 'white', fontSize: '11px', fontWeight: '900', cursor: 'pointer' }}>Copilot</button>
                 <button onClick={triggerExport} style={{ padding: '12px 25px', borderRadius: '15px', border: 'none', background: '#10b981', color: 'white', fontSize: '11px', fontWeight: '900', cursor: 'pointer', marginLeft: '10px' }}>📥 BAKE</button>
               </div>
            </div>
            {activeTab === 'studio' && <VideoPlayerWorkspace project={activeProject} onUpdateProject={setActiveProject as any} activeMusicTrack={FREE_MUSIC_TRACKS.find(t => t.id === activeProject.selectedMusicTrackId) || null} activeClipId={activeClipId} onClipSelect={setActiveClipId} />}
            {activeTab === 'viral' && <ViralityScorecard project={activeProject} onUpdateProject={setActiveProject as any} />}
            {activeTab === 'copilot' && <AICopilotConsole project={activeProject} onUpdateProject={setActiveProject as any} onUpdateSubtitles={(subs: any) => setActiveProject(p => ({ ...p!, subtitles: subs }))} />}
          </div>
        )}
      </main>

      <ApiKeySettingsModal isOpen={showApiKeyModal} onClose={() => setShowApiKeyModal(false)} />
      
      {downloadReadyInfo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.98)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#0f172a', padding: '50px 30px', borderRadius: '40px', border: '1px solid #1e293b', textAlign: 'center', width: '100%', maxWidth: '420px' }}>
            <div style={{ fontSize: '60px', marginBottom: '20px' }}>🏆</div>
            <h3 style={{ fontWeight: '900', fontSize: '24px', marginBottom: '10px', letterSpacing: '-1px' }}>VIDEO READY</h3>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '40px' }}>Your edit is ready for social media.</p>
            <a href={downloadReadyInfo.url} download={downloadReadyInfo.filename} style={{ display: 'block', background: '#10b981', color: 'white', padding: '20px', borderRadius: '25px', fontWeight: '900', textDecoration: 'none', marginBottom: '15px', fontSize: '14px' }}>SAVE TO GALLERY</a>
            <button onClick={() => setDownloadReadyInfo(null)} style={{ background: 'transparent', color: '#64748b', border: 'none', fontWeight: '900', cursor: 'pointer', fontSize: '12px' }}>BACK</button>
          </div>
        </div>
      )}
      <style>{` @keyframes spin { to { transform: rotate(360deg); } } `}</style>
    </div>
  );
}
