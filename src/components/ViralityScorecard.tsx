import React, { useState } from 'react';
import { VideoProject, CaptionStyle } from '../types';
import { runAnalyzeVideo } from '../utils/geminiClient';
import { 
  Zap, Copy, Check, Info, TrendingUp, Sparkles, 
  MessageCircle, Cpu, RefreshCw, ChevronRight, Compass, Flame
} from 'lucide-react';

const fixDunikTypo = (str: string): string => {
  if (!str) return str;
  return str.replace(/dunik/gi, (match) => {
    const map: Record<string, string> = { 'DUNIK': 'DUNK', 'dunik': 'dunk', 'Dunik': 'Dunk' };
    return map[match] || 'Dunk';
  });
};

export default function ViralityScorecard({ project, onUpdateProject, onRequestApiKey }: any) {
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'booster'>('diagnostics');
  const [isBoosting, setIsBoosting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const archetypes = [
    { id: 'mrbeast_hype', name: 'MrBeast Audience Hype', icon: Zap, stylePreset: 'mrbeast' },
    { id: 'hormozi_value', name: 'Alex Hormozi Business', icon: Flame, stylePreset: 'hormozi' },
    { id: 'asmr_luxury', name: 'Premium ASMR Style', icon: Sparkles, stylePreset: 'minimalist' }
  ];

  const handleLaunchBooster = async (archetypeId: string) => {
    setIsBoosting(true);
    setErrorMessage(null);
    const chosen = archetypes.find(a => a.id === archetypeId) || archetypes[0];
    try {
      const result = await runAnalyzeVideo({
        name: project.name,
        niche: project.niche,
        originalDuration: project.duration,
        userDescription: `Ultra-Boost for ${chosen.name}.`,
        defaultTranscribe: project.subtitles.map((s: any) => s.text).join(' '),
        imitationOptions: { archetype: chosen.name, referenceSource: chosen.name, copyInstructions: 'Enhance virality.' }
      });
      onUpdateProject({ ...project, ...result.project, captionStyle: chosen.stylePreset, viralityScore: 99 });
      setActiveTab('diagnostics');
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally { setIsBoosting(false); }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="flex border-b border-slate-800 bg-slate-950/70 p-2 gap-2">
        <button onClick={() => setActiveTab('diagnostics')} className={`px-4 py-2 text-xs font-bold rounded-lg ${activeTab === 'diagnostics' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>Scorecard</button>
        <button onClick={() => setActiveTab('booster')} className={`px-4 py-2 text-xs font-bold rounded-lg ${activeTab === 'booster' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>Booster Studio</button>
      </div>

      {activeTab === 'diagnostics' ? (
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl border-2 border-purple-500 flex flex-col items-center justify-center bg-purple-500/5">
              <span className="text-[10px] uppercase text-slate-500">Score</span>
              <span className="text-2xl font-black">{project.viralityScore}%</span>
            </div>
            <div>
              <h2 className="font-bold text-white uppercase tracking-tighter">AI Viral Analysis</h2>
              <p className="text-xs text-slate-400 mt-1">Niche: {project.niche}</p>
            </div>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
             <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Optimized Caption</h3>
             <p className="text-xs text-slate-300 leading-relaxed font-mono">{project.description}</p>
          </div>
        </div>
      ) : (
        <div className="p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-purple-400">Creator Style Replica</h2>
          <div className="grid grid-cols-1 gap-3">
            {archetypes.map((arch) => (
              <button 
                key={arch.id} 
                disabled={isBoosting}
                onClick={() => handleLaunchBooster(arch.id)}
                className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-left hover:border-purple-500 transition-all group disabled:opacity-50"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm">{arch.name}</span>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-purple-500" />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Tap to apply viral pacing and subtitle styles.</p>
              </button>
            ))}
          </div>
          {isBoosting && <div className="text-center p-4 text-xs text-purple-400 animate-pulse font-bold">AI IS RE-ARCHITECTING TIMELINE...</div>}
          {errorMessage && <p className="text-xs text-red-500">{errorMessage}</p>}
        </div>
      )}
    </div>
  );
}
