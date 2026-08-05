import React, { useState, useEffect, useRef } from 'react';
import { VideoProject } from '../types';
import { runCopilotOptimize } from '../utils/groqClient';

type ActionType = 'chat' | 'spellcheck' | 'hookboost' | 'pacing' | 'gaprepair';

const QUICK_ACTIONS: { label: string; type: ActionType; icon: string }[] = [
  { label: 'Fix Typos', type: 'spellcheck', icon: '✨' },
  { label: 'Boost Hooks', type: 'hookboost', icon: '🚀' },
  { label: 'Snappy Pacing', type: 'pacing', icon: '⚡' },
  { label: 'Clean Gaps', type: 'gaprepair', icon: '🧹' },
];

export const AICopilotConsole: React.FC<any> = ({
  project,
  onUpdateProject,
  onUpdateSubtitles
}) => {
  const [userPrompt, setUserPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string>('// System initialized.\n// Paste a viral link or type a command to begin.');
  const [responseLines, setResponseLines] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [responseLines]);

  const appendLog = (line: string) => {
    setResponseLines(prev => [...prev, line]);
  };

  const runAction = async (actionType: ActionType, cmd?: string) => {
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
      onUpdateProject({ title: data.title, description: data.description });
      onUpdateSubtitles(data.subtitles);

      const advice = data.advice || 'Optimization complete.';
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
    if (!userPrompt.trim()) return;

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
      onUpdateProject({ ...data, viralityScore: 100 });
      onUpdateSubtitles(data.subtitles);
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
      backdropFilter: 'blur(16px)',
      padding: '0',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid rgba(30,41,59,0.5)',
        display: 'flex',
        alignItems: 'center',
        gap: '14px'
      }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '12px',
          background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '18px', flexShrink: 0
        }}>🧠</div>
        <div>
          <div style={{ fontWeight: 900, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: '"Inter", sans-serif', lineHeight: 1.2 }}>
            AI Co-Pilot
          </div>
          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Neural optimization engine
          </div>
        </div>
        {isLoading && (
          <div style={{
            marginLeft: 'auto',
            width: '8px', height: '8px',
            background: '#8b5cf6', borderRadius: '50%',
            animation: 'pulse 1.5s ease-in-out infinite'
          }} />
        )}
      </div>

      <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
        {/* Terminal log */}
        <div style={{
          background: 'rgba(2,6,23,0.8)',
          borderRadius: '16px',
          padding: '16px',
          border: '1px solid rgba(30,41,59,0.5)',
          minHeight: '200px',
          maxHeight: '300px',
          overflowY: 'auto',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '11px',
          lineHeight: 1.7
        }} ref={logRef}>
          <div style={{ color: '#475569', marginBottom: '8px', borderBottom: '1px solid #18181b', paddingBottom: '6px' }}>
            ─── RESPONSE_STREAM.log ───
          </div>
          {responseLines.length === 0 && (
            <div style={{ color: '#475569' }}>
              {aiResponse}
            </div>
          )}
          {responseLines.map((line, i) => (
            <div key={i} style={{
              color: line.startsWith('✗') ? '#ef4444' : line.startsWith('→') ? '#10b981' : '#94a3b8',
              marginBottom: '2px'
            }}>
              {line}
            </div>
          ))}
          {isLoading && (
            <div style={{ color: '#8b5cf6', marginTop: '8px' }}>
              <span style={{ animation: 'pulse 1s ease-in-out infinite' }}>█</span>
            </div>
          )}
        </div>

        {/* Command input */}
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
              transition: 'opacity 0.2s'
            }}
          >
            Send
          </button>
        </form>

        {/* Quick actions */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '8px'
        }}>
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.type}
              onClick={() => runAction(action.type)}
              disabled={isLoading}
              style={{
                background: 'rgba(2,6,23,0.4)',
                border: '1px solid rgba(30,41,59,0.5)',
                color: '#e2e8f0',
                padding: '12px 14px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.3px',
                fontFamily: '"Inter", sans-serif',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                opacity: isLoading ? 0.5 : 1
              }}
            >
              <span>{action.icon}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      <style>{``}</style>
    </div>
  );
};
