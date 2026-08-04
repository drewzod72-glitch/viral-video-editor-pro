import React, { useState } from 'react';
import { runAnalyzeVideo } from '../utils/geminiClient';

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
    <div style={{ background: '#0f172a', borderRadius: '32px', border: '1px solid #1e293b', overflow: 'hidden' }}>
      <div style={{ display: 'flex', background: '#020617', padding: '5px' }}>
        <button onClick={() => setActiveTab('diagnostics')} style={{ flex: 1, padding: '12px', border: 'none', background: activeTab === 'diagnostics' ? '#1e293b' : 'transparent', color: 'white', fontWeight: '900', fontSize: '11px', borderRadius: '12px', cursor: 'pointer' }}>SCORECARD</button>
        <button onClick={() => setActiveTab('booster')} style={{ flex: 1, padding: '12px', border: 'none', background: activeTab === 'booster' ? '#1e293b' : 'transparent', color: 'white', fontWeight: '900', fontSize: '11px', borderRadius: '12px', cursor: 'pointer' }}>BOOSTER</button>
      </div>

      <div style={{ padding: '30px' }}>
        {activeTab === 'diagnostics' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '20px', border: '3px solid #8b5cf6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(139,92,246,0.1)' }}>
                <div style={{ fontSize: '10px', fontWeight: '900', color: '#64748b' }}>SCORE</div>
                <div style={{ fontSize: '30px', fontWeight: '900' }}>{project.viralityScore}</div>
              </div>
              <div>
                <div style={{ fontWeight: '900', fontSize: '16px' }}>VIRAL DIAGNOSTICS</div>
                <div style={{ color: '#10b981', fontSize: '11px', fontWeight: '900', marginTop: '5px' }}>● SYSTEM OPTIMAL</div>
              </div>
            </div>
            <div style={{ background: '#020617', padding: '20px', borderRadius: '20px', border: '1px solid #1e293b' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '900', marginBottom: '10px' }}>AI SOCIAL COPY</div>
              <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: '1.6' }}>{project.description}</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
             <div style={{ fontWeight: '900', fontSize: '14px' }}>CREATOR STYLE REPLICA</div>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                {['MrBeast Style', 'Hormozi Style', 'Luxury ASMR'].map(a => (
                  <button key={a} onClick={() => handleLaunchBooster(a)} style={{ background: '#020617', border: '1px solid #1e293b', padding: '15px', borderRadius: '16px', color: 'white', textAlign: 'left', fontWeight: '900', fontSize: '13px', cursor: 'pointer' }}>{a.toUpperCase()}</button>
                ))}
             </div>
             {isBoosting && <div style={{ textAlign: 'center', fontSize: '11px', color: '#8b5cf6', fontWeight: '900', marginTop: '10px' }}>ENGINEERING NEW VIBE...</div>}
          </div>
        )}
      </div>
    </div>
  );
}
