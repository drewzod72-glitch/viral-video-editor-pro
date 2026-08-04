import React, { useState } from 'react';
import { VideoProject, SubtitleItem } from '../types';
import { runCopilotOptimize } from '../utils/geminiClient';
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
    <div style={{ background: '#0f172a', borderRadius: '32px', border: '1px solid #1e293b', padding: '30px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
        <div style={{ fontSize: '30px' }}>🧠</div>
        <div>
          <div style={{ fontWeight: '900', fontSize: '14px', textTransform: 'uppercase' }}>AI Co-Pilot Console</div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>Neural optimization and viral cloning engine</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
        <div style={{ background: '#020617', borderRadius: '20px', padding: '20px', border: '1px solid #1e293b', minHeight: '200px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '10px', color: '#475569', fontWeight: '900', marginBottom: '10px', borderBottom: '1px solid #1e293b', paddingBottom: '5px' }}>RESPONSE_STREAM.log</div>
          <div style={{ flex: 1, color: '#e2e8f0', fontSize: '13px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
            {isLoading ? 'Processing neural request...' : aiResponse}
          </div>
        </div>

        <form onSubmit={handleLinkClone} style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="Paste TikTok link or ask: 'Add fire emojis'"
            style={{ flex: 1, background: '#020617', border: '1px solid #1e293b', borderRadius: '16px', padding: '15px', color: 'white', fontSize: '14px', outline: 'none' }}
          />
          <button 
            type="submit"
            style={{ background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '16px', padding: '0 25px', fontWeight: '900', cursor: 'pointer' }}
          >
            SEND
          </button>
        </form>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
           {[
             { label: 'Fix Typos', type: 'spellcheck' },
             { label: 'Boost Hooks', type: 'hookboost' },
             { label: 'Snappy Pacing', type: 'pacing' },
             { label: 'Clean Gaps', type: 'gaprepair' }
           ].map(b => (
             <button key={b.type} onClick={() => runAction(b.type)} style={{ background: '#1e293b', border: 'none', color: 'white', padding: '12px', borderRadius: '12px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', textTransform: 'uppercase' }}>{b.label}</button>
           ))}
        </div>
      </div>
    </div>
  );
};
