import React, { useState, useEffect } from 'react';
import { VideoProject } from './types';
import { FREE_MUSIC_TRACKS, RAW_VIDEO_TEMPLATES } from './data';
import NicheSelector from './components/NicheSelector';
import VideoPlayerWorkspace from './components/VideoPlayerWorkspace';
import ViralityScorecard from './components/ViralityScorecard';
import { AICopilotConsole } from './components/AICopilotConsole';
import ApiKeySettingsModal from './components/ApiKeySettingsModal';
import { runAnalyzeVideo } from './utils/groqClient';
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

  const startApp = () => {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) new AudioCtx().resume();
    } catch (e) {}
    setHasStarted(true);
  };

  // Clean up object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (activeProject?.videoUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(activeProject.videoUrl);
      }
    };
  }, [activeProject?.videoUrl]);

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
      selectedMusicTrackId: 'lofi-8',
      captionStyle: 'hormozi',
      colorGrade: 'vibrant_pop',
      enableSubtitles: true, enableZooms: true, musicVolume: 0.4,
      sfxPopEnabled: true, sfxWhooshEnabled: true, autoZoomPunch: true, shakeOnPunch: true,
      createdAt: new Date().toISOString()
    } as any;

    setActiveProject(proj);
    setActiveTab('studio');
    setIsProcessing(true);
    setProcessingStage('Analyzing media...');

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
      const blob = await renderVideoInBrowser(
        activeProject,
        (p) => setProcessingStage(`Baking: ${p}%`),
        activeClipId
      );
      if (blob && blob.size > 100_000) {
        setDownloadReadyInfo({ blob, filename: `${activeProject.name}_viral.mp4` });
      } else {
        alert('Export failed. Rendered file is empty or too small.');
      }
    } catch (err: any) {
      alert('Export failed. ' + (err?.message || 'Device hardware busy.'));
    } finally {
      setIsProcessing(false);
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
          onClick={() => { setActiveTab(tab.key as any); setSidebarOpen(false); }}
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
          {isProcessing ? `⏳ ${processingStage || 'Baking...'}` : '🔥 BAKE FINAL'}
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
            onClick={() => setShowApiKeyModal(true)}
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
          padding: '12px 18px', borderRadius: '12px', fontWeight: 700,
          fontSize: '11px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', gap: '8px',
          backdropFilter: 'blur(12px)', maxWidth: 'calc(100vw - 32px)'
        }}>
          <div style={{
            width: '12px', height: '12px',
            border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0
          }} />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{processingStage}</span>
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
                    onClick={() => setActiveTab(tab.key as any)}
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
                <VideoPlayerWorkspace
                  project={activeProject}
                  onUpdateProject={setActiveProject as any}
                  activeMusicTrack={FREE_MUSIC_TRACKS.find(t => t.id === activeProject.selectedMusicTrackId) || null}
                  activeClipId={activeClipId}
                  onClipSelect={setActiveClipId}
                />
              )}
              {activeTab === 'viral' && <ViralityScorecard project={activeProject} onUpdateProject={setActiveProject as any} />}
              {activeTab === 'copilot' && (
                <AICopilotConsole
                  project={activeProject}
                  onUpdateProject={setActiveProject as any}
                  onUpdateSubtitles={(subs: any) => setActiveProject(p => ({ ...p!, subtitles: subs }))}
                />
              )}
            </div>
          )}
        </div>
      </main>

      <ApiKeySettingsModal isOpen={showApiKeyModal} onClose={() => setShowApiKeyModal(false)} />

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
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '32px', fontFamily: '"Inter", sans-serif' }}>
              Your edit is ready for social media.
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
              onClick={() => setDownloadReadyInfo(null)}
              style={{ background: 'transparent', color: '#64748b', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '12px', fontFamily: '"Inter", sans-serif' }}
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      <style>{`
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
