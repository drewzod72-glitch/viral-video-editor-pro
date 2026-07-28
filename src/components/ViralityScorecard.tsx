import React, { useState } from 'react';
import { VideoProject, CaptionStyle } from '../types';
import { runAnalyzeVideo } from '../utils/geminiClient';
import { Zap, TrendingUp, RefreshCw, ChevronRight, Flame } from 'lucide-react';

const fixDunikTypo = (str: string): string => {
  if (!str) return str;
  return str.replace(/dunik/gi, (match) => {
    const map: Record<string, string> = { 'DUNIK': 'DUNK', 'dunik': 'dunk', 'Dunik': 'Dunk' };
    return map[match] || 'Dunk';
  });
};

export default function ViralityScorecard({ project, onUpdateProject }: any) {
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'booster'>('diagnostics');
  const [isBoosting, setIsBoosting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const archetypes = [
    { id: 'mrbeast_hype', name: 'MrBeast Audience Hype', icon: Zap, stylePreset: 'mrbeast' },
    { id: 'hormozi_value', name: 'Alex Hormozi Business', icon: Flame, stylePreset: 'hormozi' },
    { id: 'asmr_luxury', name: 'Premium ASMR Style', icon: Flame, stylePreset: 'minimalist' }
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

      // SUBTITLE-DERIVED ENHANCEMENT
      const newSubs = result.project.subtitles.map((sub: any) => ({
        ...sub,
        text: fixDunikTypo(sub.text),
      }));

      onUpdateProject({ 
        ...project, 
        ...result.project, 
        subtitles: newSubs,
        captionStyle: chosen.stylePreset, 
        viralityScore: 99 
      });
      setActiveTab('diagnostics');
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally { setIsBoosting(false); }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
      <div className="flex border-b border-slate-800 bg-slate-950/70 p-1.5 gap-2">
        <button onClick={() => setActiveTab('diagnostics')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'diagnostics' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>Scorecard</button>
        <button onClick={() => setActiveTab('booster')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'booster' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>Booster Studio</button>
      </div>

      {activeTab === 'diagnostics' ? (
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-5 bg-slate-950/40 p-4 rounded-2xl border border-slate-800">
            <div className="w-20 h-20 rounded-2xl border-2 border-purple-500 flex flex-col items-center justify-center bg-purple-500/10 shadow-[0_0_20px_rgba(139,92,246,0.2)]">
              <span className="text-[10px] font-black uppercase text-slate-500 leading-none">Score</span>
              <span className="text-3xl font-black text-white mt-1">{project.viralityScore}</span>
            </div>
            <div>
              <h2 className="font-black text-white uppercase tracking-tighter flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-cyan" /> Viral Diagnostics
              </h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Status: <span className="text-emerald-400">Optimal Coverage</span></p>
            </div>
          </div>
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-850">
             <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">AI-Optimized Social Copy</h3>
             <p className="text-xs text-slate-300 leading-relaxed font-mono select-all">{project.description}</p>
          </div>
        </div>
      ) : (
        <div className="p-6 space-y-5">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-purple-400">Creator Style Replica</h2>
            <p className="text-[10px] text-slate-500 mt-1">Select an archetype to instantly re-architect the timeline.</p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {archetypes.map((arch) => (
              <button 
                key={arch.id} 
                disabled={isBoosting}
                onClick={() => handleLaunchBooster(arch.id)}
                className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-left hover:border-purple-500 transition-all group disabled:opacity-50 relative overflow-hidden"
              >
                <div className="flex justify-between items-center relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-900 rounded-lg group-hover:bg-purple-600/20 transition-all"><arch.icon className="w-4 h-4 text-slate-400 group-hover:text-purple-500" /></div>
                    <span className="font-black text-sm text-slate-200 group-hover:text-white">{arch.name}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
                </div>
              </button>
            ))}
          </div>
          {isBoosting && (
            <div className="flex flex-col items-center justify-center p-4 space-y-3 bg-purple-600/5 rounded-2xl border border-purple-500/10">
                <RefreshCw className="w-6 h-6 text-purple-500 animate-spin" />
                <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">AI is forging new viral perspective...</span>
            </div>
          )}
          {errorMessage && (
            <div className="p-3 bg-red-600/10 border border-red-600/20 rounded-xl">
               <p className="text-[10px] text-red-500 font-bold">{errorMessage}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
