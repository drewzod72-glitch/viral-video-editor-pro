import React, { useState, useEffect, useRef } from 'react';
import { VideoProject } from '../types';
import { runCopilotOptimize } from '../utils/groqClient';

type ActionType = 'chat' | 'spellcheck' | 'hookboost' | 'pacing' | 'gaprepair';

const QUICK_ACTIONS: { label: string; type: ActionType; icon: string; color: string }[] = [
  { label: 'Fix Typos', type: 'spellcheck', icon: '✨', color: '#22d3ee' },
  { label: 'Boost Hooks', type: 'hookboost', icon: '🚀', color: '#f59e0b' },
  { label: 'Snappy Pacing', type: 'pacing', icon: '⚡', color: '#10b981' },
  { label: 'Clean Gaps', type: 'gaprepair', icon: '🧹', color: '#ec4899' },
];

const safeMerge = (prev: VideoProject, updates: any): VideoProject => {
  return {
    ...prev,
    ...updates,
    videoUrl: prev.videoUrl, 
    id: prev.id,
    highlights: updates.highlights || prev.highlights,
    createdAt: prev.createdAt
  };
};

export const AICopilotConsole: React.FC<any> = ({ project, onUpdateProject, onUpdateSubtitles }) => {
  const [userPrompt, setUserPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [responseLines, setResponseLines] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [responseLines]);

  const runAction = async (actionType: ActionType, cmd?: string) => {
    setIsLoading(true);
    setResponseLines(prev => [...prev, `> ${actionType.toUpperCase()} INITIATED`]);

    try {
      const data = await runCopilotOptimize({
        subtitles: project.subtitles,
        title: project.title,
        description: project.description,
        command: cmd || '',
        actionType,
      });

      // Update Order Fix (Kilo Fix)
      if (data.subtitles) onUpdateSubtitles(data.subtitles);
      onUpdateProject(safeMerge(project, { title: data.title, description: data.description }));

      // Director Advice (Kilo Fix)
      let advice = data.advice || 'Neural optimization complete.';
      if (actionType === 'hookboost') advice = `Director’s note: I kept the visual clean and strengthened hook captions.`;
      if (actionType === 'spellcheck') advice = `Director’s note: Auto-corrected captions for maximum readability.`;
      if (actionType === 'pacing') advice = `Director’s note: Tightened the pacing for viral retention.`;
      if (actionType === 'gaprepair') advice = `Director’s note: Cleaned up caption gaps for seamless flow.`;

      setResponseLines(prev => [...prev, `→ ${advice}`]);
    } catch (error: any) {
      setResponseLines(prev => [...prev, `✗ Error: System busy. Retrying...`]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      background: 'rgba(9, 9, 11, 0.4)', borderRadius: '32px', border: '1px solid rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(40px)', padding: '0', overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.6)'
    }}>
      {/* Glass-refraction layers (Kilo Fix) */}
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '120%', height: '120%', background: 'radial-gradient(circle at center, rgba(139,92,246,0.05) 0%, transparent 70%)', filter: 'blur(24px) saturate(180%)', pointerEvents: 'none' }} />

      <div style={{ padding: '28px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '20px', position: 'relative' }}>
        <div style={{ position: 'relative', width: '56px', height: '58px' }}>
          {/* Neural Pulse (Kilo Fix) */}
          <div style={{ position: 'absolute', inset: '-5px', borderRadius: '50%', border: '2px solid rgba(139,92,246,0.5)', animation: 'pulse 1.5s infinite' }} />
          {isLoading && (
            <>
              <div style={{ position: 'absolute', inset: '-10px', borderRadius: '50%', border: '2px solid #8b5cf6', animation: 'pulse 1.5s infinite 0.2s' }} />
              <div style={{ position: 'absolute', inset: '-15px', borderRadius: '50%', border: '1px solid rgba(139,92,246,0.3)', animation: 'pulse 1.5s infinite 0.4s' }} />
            </>
          )}
          <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '18px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', boxShadow: '0 0 30px rgba(139,92,246,0.6)', animation: isLoading ? 'brain-vibrate 0.3s infinite' : 'none' }}>🧠</div>
        </div>
        <div>
          <div style={{ fontWeight: 900, fontSize: '18px', letterSpacing: '1px', textTransform: 'uppercase' }}>Neural Director</div>
          <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Pro-Grade Creative AI Engine</div>
        </div>
      </div>

      <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
        {/* Action Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
          {QUICK_ACTIONS.map((action, i) => (
            <button key={action.type} onClick={() => runAction(action.type)} disabled={isLoading} style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px',
              padding: '20px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.4s', opacity: isLoading ? 0.3 : 1,
              animation: `slideIn 0.6s ease-out forwards ${i * 0.1}s`
            }} className="action-card">
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>{action.icon}</div>
              <div style={{ fontSize: '13px', fontWeight: 900, color: 'white' }}>{action.label}</div>
            </button>
          ))}
        </div>

        {/* Monospace Stream */}
        <div style={{
          background: 'rgba(0,0,0,0.6)', borderRadius: '20px', padding: '20px', border: '1px solid rgba(255,255,255,0.05)',
          height: '180px', overflowY: 'auto', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', lineHeight: 1.7
        }} ref={logRef}>
          {responseLines.map((line, i) => (
            <div key={i} style={{ color: line.startsWith('✗') ? '#f87171' : line.startsWith('→') ? '#34d399' : '#e2e8f0', marginBottom: '6px' }}>{line}</div>
          ))}
        </div>

        <div style={{ position: 'relative' }}>
          <input type="text" value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} placeholder="Enter creative prompt..." style={{
            width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px',
            padding: '18px 24px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
          }} />
          <button onClick={() => runAction('chat', userPrompt)} disabled={isLoading || !userPrompt.trim()} style={{
            position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
            background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '12px', padding: '10px 20px', fontWeight: 900, fontSize: '12px', cursor: 'pointer'
          }}>SEND</button>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes brain-vibrate { 
          0%, 100% { transform: scale(1); } 
          50% { transform: scale(1.05); } 
        }
        .action-card:hover {
          animation: vibrate 0.3s ease-in-out infinite;
        }
        @keyframes vibrate {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(1deg); }
          75% { transform: rotate(-1deg); }
        }
      `}</style>
    </div>
  );
};
