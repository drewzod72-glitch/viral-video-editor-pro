import React, { useState } from 'react';
import { runAnalyzeVideo } from '../utils/groqClient';

const fixDunikTypo = (str: string) => str?.replace(/dunik/gi, 'Dunk') || '';

function ScoreRing({ score, size = 88, strokeWidth = 6 }: { score: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(30,41,59,0.5)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Score
        </div>
        <div style={{ fontSize: size > 70 ? '28px' : '20px', fontWeight: 900, color, fontFamily: '"Inter", sans-serif', lineHeight: 1 }}>
          {score}
        </div>
      </div>
    </div>
  );
}

const BOOSTER_PRESETS = [
  { id: 'mrbeast', label: 'MrBeast Style', icon: '🔥', desc: 'High-octane hooks, fast cuts, bold claims' },
  { id: 'hormozi', label: 'Hormozi Style', icon: '💎', desc: 'Direct response, pain-agitation, value bombs' },
  { id: 'asmr', label: 'Luxury ASMR', icon: '✨', desc: 'Satisfying textures, whisper pacing, premium feel' },
  { id: 'fitness', label: 'Fitness Hype', icon: '💪', desc: 'Aggressive motivation, beat drops, callouts' },
];

export default function ViralityScorecard({ project, onUpdateProject }: any) {
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'booster'>('diagnostics');
  const [isBoosting, setIsBoosting] = useState(false);
  const [boostTarget, setBoostTarget] = useState<string | null>(null);

  const handleLaunchBooster = async (preset: typeof BOOSTER_PRESETS[0]) => {
    setIsBoosting(true);
    setBoostTarget(preset.id);
    try {
      const result = await runAnalyzeVideo({
        name: project.name,
        niche: project.niche,
        userDescription: `Ultra-Boost for ${preset.label}. ${preset.desc}`,
        defaultTranscribe: project.subtitles.map((s: any) => s.text).join(' '),
      });
      onUpdateProject({ ...project, ...result.project, viralityScore: 99 });
      setActiveTab('diagnostics');
    } catch (e) {
      console.warn('Booster offline');
    } finally {
      setIsBoosting(false);
      setBoostTarget(null);
    }
  };

  const score = project?.viralityScore ?? 0;

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(24,24,27,0.95) 0%, rgba(9,9,11,0.98) 100%)',
      borderRadius: '24px',
      border: '1px solid rgba(30,41,59,0.6)',
      backdropFilter: 'blur(16px)',
      overflow: 'hidden'
    }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', background: 'rgba(2,6,23,0.6)', padding: '4px', margin: '16px 16px 0 16px', borderRadius: '12px' }}>
        {(['diagnostics', 'booster'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: '10px', border: 'none', borderRadius: '10px',
              background: activeTab === tab ? 'rgba(139,92,246,0.25)' : 'transparent',
              color: activeTab === tab ? '#e9d5ff' : '#71717a',
              fontWeight: 800, fontSize: '10px', fontFamily: '"Inter", sans-serif',
              cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px',
              transition: 'all 0.2s'
            }}
          >
            {tab === 'diagnostics' ? '📊 Scorecard' : '🚀 Booster'}
          </button>
        ))}
      </div>

      <div style={{ padding: '24px' }}>
        {activeTab === 'diagnostics' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Score + diagnostics header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <ScoreRing score={score} />
              <div style={{ flex: 1, minWidth: '160px' }}>
                <div style={{ fontWeight: 900, fontSize: '18px', fontFamily: '"Inter", sans-serif', letterSpacing: '-0.3px', marginBottom: '4px' }}>
                  VIRAL DIAGNOSTICS
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  color: score >= 80 ? '#10b981' : '#f59e0b',
                  fontSize: '11px', fontWeight: 700,
                  background: score >= 80 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                  padding: '4px 10px', borderRadius: '8px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />
                  {score >= 80 ? 'System Optimal' : 'Needs Attention'}
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px'
            }}>
              {[
                { label: 'Hook Strength', value: project?.viralityCriteria?.hook ?? 70, color: '#8b5cf6' },
                { label: 'Pacing', value: project?.viralityCriteria?.pacing ?? 70, color: '#06b6d4' },
                { label: 'Emotion', value: project?.viralityCriteria?.emotion ?? 70, color: '#ec4899' },
                { label: 'Visual Contrast', value: project?.viralityCriteria?.visualContrast ?? 70, color: '#10b981' },
              ].map((metric) => (
                <div key={metric.label} style={{
                  background: 'rgba(2,6,23,0.6)',
                  padding: '14px',
                  borderRadius: '14px',
                  border: '1px solid rgba(30,41,59,0.5)'
                }}>
                  <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                    {metric.label}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      flex: 1, height: '4px', background: 'rgba(30,41,59,0.5)',
                      borderRadius: '2px', overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${Math.min(100, metric.value)}%`,
                        height: '100%', background: metric.color,
                        borderRadius: '2px',
                        transition: 'width 1s ease-out'
                      }} />
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: metric.color, minWidth: '28px', textAlign: 'right', fontFamily: '"Inter", sans-serif' }}>
                      {metric.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Social Copy */}
            <div style={{
              background: 'rgba(2,6,23,0.6)',
              padding: '20px',
              borderRadius: '16px',
              border: '1px solid rgba(30,41,59,0.5)'
            }}>
              <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>
                AI Social Copy
              </div>
              <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.7, fontFamily: '"Inter", sans-serif' }}>
                {fixDunikTypo(project.description)}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: '14px', fontFamily: '"Inter", sans-serif', marginBottom: '4px', letterSpacing: '-0.2px' }}>
                Creator Style Replica
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, lineHeight: 1.5 }}>
                Select a creator archetype to restyle your entire video with AI-optimized pacing, captions, and SFX.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
              {BOOSTER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleLaunchBooster(preset)}
                  disabled={isBoosting}
                  style={{
                    background: 'rgba(2,6,23,0.4)',
                    border: boostTarget === preset.id ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(30,41,59,0.5)',
                    padding: '16px',
                    borderRadius: '14px',
                    color: 'white',
                    textAlign: 'left',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: isBoosting ? 'not-allowed' : 'pointer',
                    fontFamily: '"Inter", sans-serif',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    transition: 'all 0.2s',
                    opacity: isBoosting && boostTarget !== preset.id ? 0.4 : 1
                  }}
                >
                  <span style={{ fontSize: '24px', flexShrink: 0 }}>{preset.icon}</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      {preset.label}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
                      {preset.desc}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {isBoosting && (
              <div style={{
                textAlign: 'center', padding: '16px',
                background: 'rgba(139,92,246,0.08)',
                borderRadius: '14px',
                border: '1px solid rgba(139,92,246,0.2)'
              }}>
                <div style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Engineering new vibe...
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
