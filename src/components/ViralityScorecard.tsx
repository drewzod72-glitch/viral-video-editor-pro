import React, { useState } from 'react';
import { runAnalyzeVideo } from '../utils/groqClient';

const fixDunikTypo = (str: string) => str?.replace(/dunik/gi, 'Dunk') || '';

export default function ViralityScorecard({ project, onUpdateProject }: any) {
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'booster'>('diagnostics');
  const [isBoosting, setIsBoosting] = useState(false);

  const handleLaunchBooster = async (arch: string) => {
    setIsBoosting(true);
    try {
      const result = await runAnalyzeVideo({
        name: project.name,
        niche: project.niche,
        userDescription: `Ultra-Boost for ${arch}.`,
        defaultTranscribe: project.subtitles.map((s: any) => s.text).join(' '),
      });
      onUpdateProject({ ...project, ...result.project, viralityScore: 99 });
      setActiveTab('diagnostics');
    } catch (e) { alert('Booster Offline.'); } finally { setIsBoosting(false); }
  };

  return (
    <div style={{ background: '#09090b', borderRadius: '24px', border: '1px solid rgba(30,41,59,0.5)', backdropFilter: 'blur(12px)', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', background: '#020617', padding: '4px' }}>
        <button onClick={() => setActiveTab('diagnostics')} style={{ flex: 1, padding: '12px', border: 'none', background: activeTab === 'diagnostics' ? 'rgba(139,92,246,0.2)' : 'transparent', color: activeTab === 'diagnostics' ? '#e9d5ff' : '#71717a', fontWeight: 700, fontSize: '11px', fontFamily: '"Inter", sans-serif', borderRadius: '10px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SCORECARD</button>
        <button onClick={() => setActiveTab('booster')} style={{ flex: 1, padding: '12px', border: 'none', background: activeTab === 'booster' ? 'rgba(139,92,246,0.2)' : 'transparent', color: activeTab === 'booster' ? '#e9d5ff' : '#71717a', fontWeight: 700, fontSize: '11px', fontFamily: '"Inter", sans-serif', borderRadius: '10px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}>BOOSTER</button>
      </div>

      <div style={{ padding: '28px' }}>
        {activeTab === 'diagnostics' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '20px', border: '2px solid rgba(139,92,246,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(139,92,246,0.08)', backdropFilter: 'blur(8px)' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>SCORE</div>
                <div style={{ fontSize: '32px', fontWeight: 900, color: '#8b5cf6', fontFamily: '"Inter", sans-serif' }}>{project.viralityScore}</div>
              </div>
              <div>
                <div style={{ fontWeight: 900, fontSize: '16px', fontFamily: '"Inter", sans-serif' }}>VIRAL DIAGNOSTICS</div>
                <div style={{ color: '#10b981', fontSize: '11px', fontWeight: 700, marginTop: '4px' }}>● SYSTEM OPTIMAL</div>
              </div>
            </div>
            <div style={{ background: '#020617', padding: '20px', borderRadius: '16px', border: '1px solid rgba(30,41,59,0.5)' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>AI SOCIAL COPY</div>
              <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: '1.6', fontFamily: '"Inter", sans-serif' }}>{fixDunikTypo(project.description)}</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontWeight: 900, fontSize: '14px', fontFamily: '"Inter", sans-serif' }}>CREATOR STYLE REPLICA</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
              {['MrBeast Style', 'Hormozi Style', 'Luxury ASMR'].map(a => (
                <button key={a} onClick={() => handleLaunchBooster(a)} style={{ background: '#020617', border: '1px solid rgba(30,41,59,0.5)', padding: '16px', borderRadius: '14px', color: 'white', textAlign: 'left', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: '"Inter", sans-serif', transition: 'border-color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)')} onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(30,41,59,0.5)')}>
                  {a.toUpperCase()}
                </button>
              ))}
            </div>
            {isBoosting && <div style={{ textAlign: 'center', fontSize: '11px', color: '#8b5cf6', fontWeight: 700, marginTop: '10px' }}>ENGINEERING NEW VIBE...</div>}
          </div>
        )}
      </div>
    </div>
  );
}
