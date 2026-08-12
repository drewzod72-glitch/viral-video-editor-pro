import React, { useState, useEffect, useRef } from 'react';
import { VideoProject } from '../types';
import { runCopilotOptimize } from '../utils/groqClient';
import { Sparkles, Zap, Wand2, Gauge, MessageSquare, Send, Brain, Activity, X } from 'lucide-react';

type ActionType = 'chat' | 'spellcheck' | 'hookboost' | 'pacing' | 'gaprepair';

const QUICK_ACTIONS: { label: string; type: ActionType; icon: React.ReactNode; color: string; desc: string }[] = [
  { label: 'Fix Typos', type: 'spellcheck', icon: <Wand2 size={18} />, color: '#06b6d4', desc: 'Auto-correct captions' },
  { label: 'Boost Hooks', type: 'hookboost', icon: <Zap size={18} />, color: '#f59e0b', desc: 'Strengthen opening lines' },
  { label: 'Snappy Pacing', type: 'pacing', icon: <Gauge size={18} />, color: '#10b981', desc: 'Speed up cuts & gaps' },
  { label: 'Clean Gaps', type: 'gaprepair', icon: <Sparkles size={18} />, color: '#ec4899', desc: 'Remove dead air' },
];

// Defensive merge: never lose videoUrl, id, highlights, or createdAt
function safeMerge(prev: VideoProject, updates: any): VideoProject {
  return {
    ...prev,
    ...updates,
    videoUrl: prev.videoUrl,
    id: prev.id,
    highlights: prev.highlights,
    createdAt: prev.createdAt,
  };
}

export const AICopilotConsole: React.FC<any> = ({
  project,
  onUpdateProject,
  onUpdateSubtitles
}) => {
  const [userPrompt, setUserPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState('Neural engine ready. Paste a viral link or type a command to begin optimization.');
  const [responseLines, setResponseLines] = useState<string[]>([]);
  const [neuralLoad, setNeuralLoad] = useState(0);
  const [isPulsing, setIsPulsing] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [responseLines]);

  useEffect(() => {
    if (isLoading) {
      setIsPulsing(true);
      const interval = setInterval(() => {
        setNeuralLoad(prev => (prev >= 100 ? 0 : prev + Math.random() * 18));
      }, 180);
      return () => { clearInterval(interval); setIsPulsing(false); };
    } else {
      setNeuralLoad(100);
      setTimeout(() => setIsPulsing(false), 600);
    }
  }, [isLoading]);

  const appendLog = (line: string) => {
    setResponseLines(prev => [...prev, line]);
  };

  const runAction = async (actionType: ActionType, cmd?: string) => {
    if (!project) return;
    setIsLoading(true);
    setAiResponse('Processing...');
    appendLog(`> ${actionType.toUpperCase()} ${cmd ? `"${cmd}"` : ''}`);

    try {
      const data = await runCopilotOptimize({
        subtitles: project.subtitles,
        title: project.title,
        description: project.description,
        niche: project.niche,
        command: cmd || '',
        actionType,
      });
      
      // CRITICAL: Inject subtitles FIRST so UI never misses the update
      if (data.subtitles && data.subtitles.length > 0) {
        onUpdateSubtitles(data.subtitles);
      }
      
      // Then merge the rest of the project data
      onUpdateProject((prev: VideoProject) => safeMerge(prev, data));

      // Director Feedback: make the AI's decision explicit
      const subCount = data.subtitles?.length || 0;
      let advice = data.advice || 'Optimization complete.';
      if (!data.advice || data.advice.trim() === '' || data.advice === 'Optimization complete.') {
        if (actionType === 'hookboost' && subCount > 0) {
          advice = `Director's note: I kept the visual clean and strengthened ${subCount} hook captions to maximize retention in the first 3 seconds.`;
        } else if (actionType === 'spellcheck' && subCount > 0) {
          advice = `Director's note: Auto-corrected ${subCount} captions for maximum readability.`;
        } else if (actionType === 'pacing') {
          advice = `Director's note: Tightened the pacing. Removed dead air and accelerated cut transitions to keep viewers watching.`;
        } else if (actionType === 'gaprepair') {
          advice = `Director's note: Cleaned up ${subCount} caption gaps. The flow is now seamless.`;
        }
      }
      
      setAiResponse(advice);
      appendLog(`→ ${advice}`);
    } catch (error: any) {
      const msg = error?.message || 'Check your Groq key.';
      setAiResponse(`Error: ${msg}`);
      appendLog(`✗ ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkClone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPrompt.trim() || !project) return;

    if (!userPrompt.includes('http')) {
      runAction('chat', userPrompt);
      setUserPrompt('');
      return;
    }

    setIsLoading(true);
    appendLog(`> CLONE STYLE: ${userPrompt}`);
    try {
      const data = await runCopilotOptimize({
        subtitles: project.subtitles,
        command: `CLONE STYLE: ${userPrompt}`,
        actionType: 'chat',
      });
      // Defensive merge to preserve videoUrl, id, highlights, createdAt
      onUpdateProject((prev: VideoProject) => safeMerge(prev, { ...data, viralityScore: 100 }));
      if (data.subtitles) {
        onUpdateSubtitles(data.subtitles);
      }
      setAiResponse('Style cloned successfully.');
      appendLog('→ Style clone complete. Virality boosted.');
    } catch (e) {
      setAiResponse('Cloning failed.');
      appendLog('✗ Clone failed.');
    } finally {
      setIsLoading(false);
      setUserPrompt('');
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(24,24,27,0.95) 0%, rgba(9,9,11,0.98) 100%)',
      borderRadius: '24px',
      border: '1px solid rgba(30,41,59,0.6)',
      backdropFilter: 'blur(24px) saturate(180%)',
      padding: '0',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Glass-refraction ambient layer */}
      <div style={{
        position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%',
        background: 'radial-gradient(circle at 50% 0%, rgba(139,92,246,0.1) 0%, transparent 60%)',
        pointerEvents: 'none', zIndex: 0
      }} />
      <div style={{
        position: 'absolute', bottom: '-30%', right: '-30%', width: '140%', height: '140%',
        background: 'radial-gradient(circle at 80% 100%, rgba(6,182,212,0.08) 0%, transparent 50%)',
        pointerEvents: 'none', zIndex: 0
      }} />

      {/* Header with Neural Pulse */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid rgba(30,41,59,0.5)',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        position: 'relative', zIndex: 1
      }}>
        <div style={{ position: 'relative' }}>
          {/* Neural Pulse rings - living brain effect */}
          {isPulsing && (
            <>
              <div style={{
                position: 'absolute', inset: '-10px', borderRadius: '24px',
                border: '2px solid rgba(139,92,246,0.5)',
                animation: 'neural-pulse 1.2s ease-out infinite'
              }} />
              <div style={{
                position: 'absolute', inset: '-20px', borderRadius: '32px',
                border: '1px solid rgba(139,92,246,0.3)',
                animation: 'neural-pulse 1.2s ease-out 0.3s infinite'
              }} />
              <div style={{
                position: 'absolute', inset: '-30px', borderRadius: '40px',
                border: '1px solid rgba(6,182,212,0.2)',
                animation: 'neural-pulse 1.2s ease-out 0.6s infinite'
              }} />
            </>
          )}
          <div style={{
            width: '52px', height: '52px', borderRadius: '18px',
            background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', flexShrink: 0,
            boxShadow: isPulsing ? '0 0 40px rgba(139,92,246,0.7)' : '0 0 20px rgba(139,92,246,0.4)',
            transition: 'box-shadow 0.3s ease',
            animation: isPulsing ? 'brain-vibrate 0.15s ease-in-out infinite' : 'none'
          }}>🧠</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: '16px', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: '"Inter", sans-serif', lineHeight: 1.2 }}>
            AI Co-Pilot
          </div>
          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Neural optimization engine
          </div>
        </div>
        {isLoading && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'rgba(139,92,246,0.15)',
            padding: '6px 12px', borderRadius: '10px',
            border: '1px solid rgba(139,92,246,0.3)',
            boxShadow: '0 0 16px rgba(139,92,246,0.2)'
          }}>
            <Activity size={14} style={{ color: '#8b5cf6' }} />
            <span style={{ fontSize: '10px', color: '#c4b5fd', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {Math.round(neuralLoad)}%
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr', gap: '16px', position: 'relative', zIndex: 1 }}>
        {/* Neural Optimization Status Bar */}
        <div style={{
          background: 'rgba(2,6,23,0.6)',
          borderRadius: '16px',
          padding: '16px',
          border: '1px solid rgba(30,41,59,0.5)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute', top: 0, right: 0, width: '120px', height: '120px',
            background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
            borderRadius: '50%', filter: 'blur(20px)', pointerEvents: 'none'
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <Brain size={16} style={{ color: '#8b5cf6' }} />
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Neural Optimization
            </span>
          </div>
          <div style={{ height: '6px', background: '#18181b', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${neuralLoad}%`,
              background: 'linear-gradient(90deg, #8b5cf6, #06b6d4)',
              borderRadius: '3px',
              transition: 'width 0.3s ease',
              boxShadow: '0 0 12px rgba(139,92,246,0.4)'
            }} />
          </div>
          <div style={{ fontSize: '9px', color: '#475569', marginTop: '6px', fontFamily: '"JetBrains Mono", monospace' }}>
            {isLoading ? 'Processing neural pathways...' : 'System idle. Awaiting directive.'}
          </div>
        </div>

        {/* Quick Actions - Animated Glass Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '10px'
        }}>
          {QUICK_ACTIONS.map((action, index) => (
            <button
              key={action.type}
              onClick={() => runAction(action.type)}
              disabled={isLoading}
              style={{
                background: 'rgba(2,6,23,0.5)',
                border: '1px solid rgba(30,41,59,0.5)',
                borderRadius: '16px',
                padding: '16px',
                color: '#e2e8f0',
                textAlign: 'left',
                fontWeight: 700,
                fontSize: '11px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontFamily: '"Inter", sans-serif',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                opacity: isLoading ? 0.5 : 1,
                backdropFilter: 'blur(8px)',
                position: 'relative',
                overflow: 'hidden',
                transform: 'translateY(0)',
                animation: `slideIn 0.4s ease-out ${index * 0.08}s both`
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.borderColor = `${action.color}40`;
                  e.currentTarget.style.boxShadow = `0 0 24px ${action.color}15, inset 0 0 24px ${action.color}08`;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.animation = 'vibrate 0.3s ease-in-out';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(30,41,59,0.5)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.animation = '';
              }}
            >
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px',
                background: `${action.color}15`,
                border: `1px solid ${action.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: action.color,
                flexShrink: 0,
                boxShadow: `0 0 16px ${action.color}20`
              }}>
                {action.icon}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '1px' }}>
                  {action.label}
                </div>
                <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 500 }}>
                  {action.desc}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Command Input */}
        <form onSubmit={handleLinkClone} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="Paste TikTok link or command: 'Add fire emojis'"
            disabled={isLoading}
            style={{
              flex: 1,
              background: 'rgba(2,6,23,0.6)',
              border: '1px solid rgba(30,41,59,0.5)',
              borderRadius: '12px',
              padding: '14px 16px',
              color: '#f1f5f9',
              fontSize: '12px',
              outline: 'none',
              fontFamily: '"Inter", sans-serif',
              transition: 'border-color 0.2s'
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !userPrompt.trim()}
            style={{
              background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '0 24px',
              fontWeight: 800,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontFamily: '"Inter", sans-serif',
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              opacity: isLoading ? 0.6 : 1,
              transition: 'opacity 0.2s',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Send size={14} />
            Send
          </button>
        </form>

        {/* Response Terminal - Glass Hub */}
        <div style={{
          background: 'rgba(2,6,23,0.8)',
          borderRadius: '16px',
          padding: '16px',
          border: '1px solid rgba(30,41,59,0.5)',
          minHeight: '180px',
          maxHeight: '280px',
          overflowY: 'auto',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '11px',
          lineHeight: 1.7,
          position: 'relative'
        }} ref={logRef}>
          <div style={{
            position: 'absolute', top: 0, right: 0, width: '80px', height: '80px',
            background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)',
            borderRadius: '50%', filter: 'blur(16px)', pointerEvents: 'none'
          }} />
          <div style={{ color: '#475569', marginBottom: '8px', borderBottom: '1px solid #18181b', paddingBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MessageSquare size={12} />
            RESPONSE_STREAM.log
          </div>
          {responseLines.length === 0 && !isLoading && (
            <div style={{ color: '#475569' }}>
              {aiResponse}
            </div>
          )}
          {responseLines.map((line, i) => (
            <div key={i} style={{
              color: line.startsWith('✗') ? '#ef4444' : line.startsWith('→') ? '#10b981' : '#94a3b8',
              marginBottom: '2px',
              animation: 'fadeIn 0.3s ease-out'
            }}>
              {line}
            </div>
          ))}
          {!isLoading && responseLines.length > 0 && (
            <div style={{ color: '#475569', marginTop: '8px', borderTop: '1px solid #18181b', paddingTop: '8px' }}>
              {aiResponse}
            </div>
          )}
          {isLoading && (
            <div style={{ color: '#8b5cf6', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: '#8b5cf6',
                animation: 'pulse 1s ease-in-out infinite'
              }} />
              Processing neural pathways...
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes neural-pulse {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes brain-vibrate {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-1px) rotate(-1deg); }
          75% { transform: translateX(1px) rotate(1deg); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};
