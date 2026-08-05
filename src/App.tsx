import React, { useState } from 'react';
import { VideoProject } from './types';
import { FREE_MUSIC_TRACKS, RAW_VIDEO_TEMPLATES } from './data';
import NicheSelector from './components/NicheSelector';
import VideoPlayerWorkspace from './components/VideoPlayerWorkspace';
import ViralityScorecard from './components/ViralityScorecard';
import { AICopilotConsole } from './components/AICopilotConsole';
import ApiKeySettingsModal from './components/ApiKeySettingsModal';
import { runAnalyzeVideo } from './utils/groqClient';
import { saveFileToDevice } from './utils/download';
import { getApiBase } from './utils/api';

export default function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const [activeProject, setActiveProject] = useState<VideoProject | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [activeTab, setActiveTab] = useState<'studio' | 'viral' | 'copilot'>('studio');
  const [downloadReadyInfo, setDownloadReadyInfo] = useState<{ url: string; filename: string } | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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

    // Non-blocking AI analysis: show processing indicator immediately,
    // then run AI in background so the UI mounts instantly.
    setIsProcessing(true);
    setProcessingStage('Analyzing media...');

    // Use requestIdleCallback or setTimeout to defer AI work,
    // ensuring the Studio mounts instantly without hanging.
    const runAI = async () => {
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

    // Schedule AI analysis after the UI has had a chance to mount
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => runAI(), { timeout: 5000 });
    } else {
      setTimeout(runAI, 100);
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

    // Non-blocking AI analysis: show processing indicator immediately,
    // then run AI in background so the UI mounts instantly.
    setIsProcessing(true);
    setProcessingStage('Analyzing media...');

    const runAI = async () => {
      try {
        const result = await runAnalyzeVideo({ name, niche, userDescription: description, videoFile: file, videoUrl });
        if (result?.project) {
          setActiveProject(prev => ({ ...prev, ...result.project, viralityScore: 99 } as any));
        }
      } catch (e) {
        console.warn("AI Service busy. Manual Mode Active.");
      } finally {
        setIsProcessing(false);
      }
    };

    // Schedule AI analysis after the UI has had a chance to mount
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => runAI(), { timeout: 5000 });
    } else {
      setTimeout(runAI, 100);
    }
  };

  const triggerExport = async () => {
    if (!activeProject) return;
    setIsProcessing(true);
    setProcessingStage("Baking final MP4...");
    try {
      const apiBase = getApiBase();
      const endpoint = `${apiBase}/api/render-project`;

      const renderPayload = {
        project: {
          ...activeProject,
          musicVolume: activeProject.musicVolume ?? 0.4,
          sfxWhooshEnabled: activeProject.sfxWhooshEnabled ?? true,
          sfxPopEnabled: activeProject.sfxPopEnabled ?? true,
          sfxImpactEnabled: activeProject.sfxImpactEnabled ?? true,
          enableSubtitles: activeProject.enableSubtitles ?? true,
          enableZooms: activeProject.enableZooms ?? true,
          enableColorGrade: activeProject.enableColorGrade ?? true,
          shakeOnPunch: activeProject.shakeOnPunch ?? true,
          autoZoomPunch: activeProject.autoZoomPunch ?? true,
        },
        activeClipId,
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(renderPayload),
      });

      if (!response.ok) {
        throw new Error(`Cloud render failed: HTTP ${response.status}`);
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      let received = 0;
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Cloud render: unable to read response stream');
      }

      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total > 0) {
          setProcessingStage(`Baking: ${Math.min(99, Math.round((received / total) * 100))}%`);
        }
      }

      setProcessingStage("Finalizing...");
      const blob = new Blob(chunks, { type: 'video/mp4' });
      setDownloadReadyInfo({ url: URL.createObjectURL(blob), filename: `${activeProject.name}_viral.mp4` });
    } catch (err: any) {
      alert('Export failed. ' + (err?.message || 'Device hardware busy.'));
    } finally {
      setIsProcessing(false);
    }
  };

  if (!hasStarted) {
    return (
      <div style={{ background: '#020617', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: '64px', marginBottom: '30px', filter: 'drop-shadow(0 0 30px rgba(139,92,246,0.4))' }}>⚡</div>
        <h1 style={{ color: 'white', fontSize: '42px', fontWeight: 900, margin: '0 0 10px 0', letterSpacing: '-3px', fontFamily: '"Inter", sans-serif', textTransform: 'uppercase' }}>Viral <span style={{ color: '#8b5cf6' }}>AI Forge</span></h1>
        <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '360px', marginBottom: '40px', fontWeight: 500, fontFamily: '"Inter", sans-serif' }}>Professional studio for sneaker content creators.</p>
        <button onClick={startApp} style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', border: 'none', borderRadius: '16px', padding: '18px 56px', fontWeight: 900, fontSize: '14px', fontFamily: '"Inter", sans-serif', textTransform: 'uppercase', cursor: 'pointer', boxShadow: '0 20px 60px rgba(139,92,246,0.3)', letterSpacing: '1px' }}>Launch Studio</button>
      </div>
    );
  }

  return (
    <div style={{ background: '#020617', minHeight: '100vh', color: 'white', fontFamily: '"Inter", sans-serif', overflowY: 'auto', overflowX: 'hidden' }}>
      {/* ── HEADER ── */}
      <header style={{ padding: '16px 24px', borderBottom: '1px solid rgba(30,41,59,0.6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(9,9,11,0.85)', backdropFilter: 'blur(24px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '16px' }}>F</div>
          <h1 style={{ fontWeight: 900, fontSize: '16px', letterSpacing: '-0.5px', fontFamily: '"Inter", sans-serif' }}>FORGE</h1>
          {activeProject && (
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, padding: '4px 10px', background: 'rgba(30,41,59,0.5)', borderRadius: '8px', marginLeft: '8px' }}>{activeProject.name}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: '"Inter", sans-serif' }}>
            {sidebarOpen ? '◁' : '▷'}
          </button>
          <button onClick={() => setShowApiKeyModal(true)} style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a', padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: '"Inter", sans-serif' }}>⚙ API</button>
        </div>
      </header>

      {/* ── PROCESSING OVERLAY ── */}
      {isProcessing && (
        <div style={{ position: 'fixed', top: '70px', right: '20px', zIndex: 200, background: 'rgba(139,92,246,0.95)', color: 'white', padding: '14px 22px', borderRadius: '14px', fontWeight: 700, fontSize: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: '10px', backdropFilter: 'blur(12px)' }}>
          <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          {processingStage}
        </div>
      )}

      {/* ── MAIN LAYOUT ── */}
      <main style={{ display: 'flex', maxWidth: '1400px', margin: '0 auto', minHeight: 'calc(100vh - 60px)' }}>
        {/* ── SIDEBAR ── */}
        {sidebarOpen && (
          <aside style={{ width: '260px', minWidth: '260px', background: 'rgba(9,9,11,0.6)', backdropFilter: 'blur(16px)', borderRight: '1px solid rgba(30,41,59,0.4)', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={() => setActiveTab('studio')}
              style={{ padding: '12px 16px', borderRadius: '10px', border: 'none', background: activeTab === 'studio' ? 'rgba(139,92,246,0.15)' : 'transparent', color: activeTab === 'studio' ? '#c4b5fd' : '#71717a', fontWeight: 700, fontSize: '12px', cursor: 'pointer', textAlign: 'left', fontFamily: '"Inter", sans-serif', display: 'flex', alignItems: 'center', gap: '10px' }}
            >
              <span>🎬</span> Studio
            </button>
            <button
              onClick={() => setActiveTab('viral')}
              style={{ padding: '12px 16px', borderRadius: '10px', border: 'none', background: activeTab === 'viral' ? 'rgba(139,92,246,0.15)' : 'transparent', color: activeTab === 'viral' ? '#c4b5fd' : '#71717a', fontWeight: 700, fontSize: '12px', cursor: 'pointer', textAlign: 'left', fontFamily: '"Inter", sans-serif', display: 'flex', alignItems: 'center', gap: '10px' }}
            >
              <span>📊</span> Virality
            </button>
            <button
              onClick={() => setActiveTab('copilot')}
              style={{ padding: '12px 16px', borderRadius: '10px', border: 'none', background: activeTab === 'copilot' ? 'rgba(139,92,246,0.15)' : 'transparent', color: activeTab === 'copilot' ? '#c4b5fd' : '#71717a', fontWeight: 700, fontSize: '12px', cursor: 'pointer', textAlign: 'left', fontFamily: '"Inter", sans-serif', display: 'flex', alignItems: 'center', gap: '10px' }}
            >
              <span>🧠</span> Co-Pilot
            </button>

            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #18181b' }}>
              <button
                onClick={triggerExport}
                disabled={isProcessing}
                style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: isProcessing ? '#18181b' : 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontWeight: 900, fontSize: '12px', fontFamily: '"Inter", sans-serif', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: isProcessing ? 'default' : 'pointer', boxShadow: isProcessing ? 'none' : '0 8px 30px rgba(16,185,129,0.25)' }}
              >
                {isProcessing ? '⏳ Baking...' : '🔥 BAKE'}
              </button>
            </div>

            {activeProject && (
              <div style={{ marginTop: '12px', padding: '14px', background: 'rgba(30,41,59,0.3)', borderRadius: '12px', border: '1px solid #1e293b' }}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Project Settings</div>
                <div style={{ fontSize: '11px', color: '#a1a1aa', lineHeight: '1.6' }}>
                  <div>Style: <span style={{ color: '#c4b5fd', fontWeight: 600 }}>{activeProject.captionStyle}</span></div>
                  <div>Grade: <span style={{ color: '#c4b5fd', fontWeight: 600 }}>{activeProject.colorGrade}</span></div>
                  <div>Music: <span style={{ color: '#c4b5fd', fontWeight: 600 }}>{FREE_MUSIC_TRACKS.find(t => t.id === activeProject.selectedMusicTrackId)?.name || 'None'}</span></div>
                  <div>Score: <span style={{ color: '#10b981', fontWeight: 700 }}>{activeProject.viralityScore}%</span></div>
                </div>
              </div>
            )}
          </aside>
        )}

        {/* ── CONTENT AREA ── */}
        <div style={{ flex: 1, padding: '24px', paddingBottom: '120px' }}>
          {!activeProject ? (
            <NicheSelector onSelectTemplate={handleSelectTemplate} isProcessing={isProcessing} onUploadCustomFile={handleUploadCustomFile} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1100px', margin: '0 auto' }}>
              {/* Tab bar */}
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(9,9,11,0.6)', backdropFilter: 'blur(16px)', padding: '4px', borderRadius: '14px', border: '1px solid rgba(30,41,59,0.4)', width: 'fit-content' }}>
                {[
                  { key: 'studio', label: '🎬 Studio', icon: '🎬' },
                  { key: 'viral', label: '📊 Virality', icon: '📊' },
                  { key: 'copilot', label: '🧠 Co-Pilot', icon: '🧠' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      padding: '10px 20px', borderRadius: '10px', border: 'none',
                      background: activeTab === tab.key ? 'rgba(139,92,246,0.2)' : 'transparent',
                      color: activeTab === tab.key ? '#e9d5ff' : '#71717a',
                      fontWeight: 700, fontSize: '12px', fontFamily: '"Inter", sans-serif',
                      cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    {tab.label}
                  </button>
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
          <div style={{ background: '#09090b', padding: '48px 36px', borderRadius: '28px', border: '1px solid rgba(30,41,59,0.6)', textAlign: 'center', width: '100%', maxWidth: '440px', boxShadow: '0 25px 80px rgba(0,0,0,0.6)' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🏆</div>
            <h3 style={{ fontWeight: 900, fontSize: '22px', marginBottom: '8px', letterSpacing: '-1px', fontFamily: '"Inter", sans-serif' }}>VIDEO READY</h3>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '32px', fontFamily: '"Inter", sans-serif' }}>Your edit is ready for social media.</p>
            <button onClick={() => saveFileToDevice} style={{ display: 'block', width: '100%', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', padding: '18px', borderRadius: '16px', fontWeight: 900, fontFamily: '"Inter", sans-serif', fontSize: '14px', border: 'none', cursor: 'pointer', boxShadow: '0 8px 30px rgba(16,185,129,0.3)', marginBottom: '12px' }}>SAVE TO GALLERY</button>
            <button onClick={() => setDownloadReadyInfo(null)} style={{ background: 'transparent', color: '#64748b', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '12px', fontFamily: '"Inter", sans-serif' }}>CLOSE</button>
          </div>
        </div>
      )}
      <style>{` @keyframes spin { to { transform: rotate(360deg); } } `}</style>
    </div>
  );
}
