import React, { useState } from 'react';
import { VideoProject, SubtitleItem } from '../types';
import { runCopilotOptimize } from '../utils/groqClient';
import { getStoredApiKey } from '../utils/apiKeyStore';

export const AICopilotConsole: React.FC<any> = ({
  project,
  onUpdateProject,
  onUpdateSubtitles
}) => {
  const [userPrompt, setUserPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string>('System active. Enter a command below.');

  const runAction = async (actionType: string, cmd?: string) => {
    setIsLoading(true);
    setAiResponse('Engineering high-retention logic...');
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
      setAiResponse(data.advice || 'Optimized!');
    } catch (error: any) {
      setAiResponse('Error: Check your Groq key.');
    } finally { setIsLoading(false); }
  };

  const handleLinkClone = async (e: any) => {
    e.preventDefault();
    if (!userPrompt.includes('http')) {
      runAction('chat', userPrompt);
      setUserPrompt('');
      return;
    }
    setIsLoading(true);
    setAiResponse('🧬 VIRE Engine: Cloning viral pacing matrix...');
    try {
      const data = await runCopilotOptimize({
        subtitles: project.subtitles,
        command: `CLONE STYLE: ${userPrompt}`,
        actionType: 'chat',
      });
      onUpdateProject({ ...data, viralityScore: 100 });
      onUpdateSubtitles(data.subtitles);
      setAiResponse('✅ Style Cloned Successfully.');
    } catch (e) { setAiResponse('Cloning Failed.'); } finally { setIsLoading(false); setUserPrompt(''); }
  };

  return (
    <div style={{ background: '#09090b', borderRadius: '24px', border: '1px solid rgba(30,41,59,0.5)', backdropFilter: 'blur(12px)', padding: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🧠</div>
        <div>
          <div style={{ fontWeight: 900, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: '"Inter", sans-serif' }}>AI Co-Pilot Console</div>
          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 500 }}>Neural optimization and viral cloning engine</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
        <div style={{ background: '#020617', borderRadius: '16px', padding: '20px', border: '1px solid rgba(30,41,59,0.5)', minHeight: '180px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '10px', color: '#475569', fontWeight: 700, marginBottom: '10px', borderBottom: '1px solid #18181b', paddingBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>RESPONSE_STREAM.log</div>
          <div style={{ flex: 1, color: '#e2e8f0', fontSize: '13px', lineHeight: '1.6', fontFamily: '"Inter", sans-serif' }}>
            {isLoading ? 'Processing neural request...' : aiResponse}
          </div>
        </div>

        <form onSubmit={handleLinkClone} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="Paste TikTok link or ask: 'Add fire emojis'"
            style={{ flex: 1, background: '#020617', border: '1px solid rgba(30,41,59,0.5)', borderRadius: '12px', padding: '14px', color: 'white', fontSize: '13px', outline: 'none', fontFamily: '"Inter", sans-serif' }}
          />
          <button
            type="submit"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', border: 'none', borderRadius: '12px', padding: '0 20px', fontWeight: 700, cursor: 'pointer', fontFamily: '"Inter", sans-serif', fontSize: '12px' }}
          >
            SEND
          </button>
        </form>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {[
            { label: 'Fix Typos', type: 'spellcheck' },
            { label: 'Boost Hooks', type: 'hookboost' },
            { label: 'Snappy Pacing', type: 'pacing' },
            { label: 'Clean Gaps', type: 'gaprepair' }
          ].map(b => (
            <button key={b.type} onClick={() => runAction(b.type)} style={{ background: '#18181b', border: '1px solid #27272a', color: 'white', padding: '12px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: '"Inter", sans-serif' }}>{b.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
};
