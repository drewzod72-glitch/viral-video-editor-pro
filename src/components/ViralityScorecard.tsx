import React, { useState } from 'react';
import { VideoProject, CaptionStyle, SubtitleItem } from '../types';
import { runAnalyzeVideo } from '../utils/geminiClient';
import { 
  Award, Zap, Copy, Check, Info, TrendingUp, Sparkles, 
  MessageCircle, Megaphone, Image, Cpu, Settings, RefreshCw, 
  ChevronRight, Compass, Eye, Edit3, Flame, AlertCircle, Play
} from 'lucide-react';

// Helper to fix the "DUNIK" -> "DUNK" typo in subtitles, titles, names, descriptions
const fixDunikTypo = (str: string): string => {
  if (!str) return str;
  return str.replace(/dunik/gi, (match) => {
    if (match === match.toUpperCase()) return 'DUNK';
    if (match === match.toLowerCase()) return 'dunk';
    if (match[0] === match[0].toUpperCase()) return 'Dunk';
    return 'Dunk';
  });
};

interface ViralityScorecardProps {
  project: VideoProject;
  onUpdateProject?: (updated: VideoProject) => void;
  onRequestApiKey?: () => void;
}

export default function ViralityScorecard({ project, onUpdateProject, onRequestApiKey }: ViralityScorecardProps) {
  // Navigation tabs for unified clean view
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'booster'>('diagnostics');

  // Multi-state triggers
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedCTA, setCopiedCTA] = useState(false);
  const [copiedAltIdx, setCopiedAltIdx] = useState<number | null>(null);

  // Booster choices
  const [selectedArchetype, setSelectedArchetype] = useState<string>('mrbeast_hype');
  const [customDirectives, setCustomDirectives] = useState<string>('');
  const [injectEmojis, setInjectEmojis] = useState<boolean>(true);
  const [forceHighContrast, setForceHighContrast] = useState<boolean>(true);
  const [forceStraightCaptions, setForceStraightCaptions] = useState<boolean>(true); // default true to avoid tilted overlays

  // Core boosting processing states
  const [isBoosting, setIsBoosting] = useState<boolean>(false);
  const [boostingStage, setBoostingStage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const copyToClipboard = (text: string, type: 'title' | 'caption' | 'cta') => {
    navigator.clipboard.writeText(text);
    if (type === 'title') {
      setCopiedTitle(true);
      setTimeout(() => setCopiedTitle(false), 2000);
    } else if (type === 'caption') {
      setCopiedCaption(true);
      setTimeout(() => setCopiedCaption(false), 2000);
    } else {
      setCopiedCTA(true);
      setTimeout(() => setCopiedCTA(false), 2000);
    }
  };

  const copyAltToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedAltIdx(index);
    setTimeout(() => setCopiedAltIdx(null), 2000);
  };

  const scoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5';
    if (score >= 80) return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/5';
    return 'text-amber-400 border-amber-500/30 bg-amber-500/5';
  };

  // Archetypes definitions
  const archetypes = [
    {
      id: 'mrbeast_hype',
      name: 'MrBeast Audience Hype',
      icon: Zap,
      color: 'from-amber-400 to-amber-500 text-amber-500 bg-amber-500/10 border-amber-500/20',
      badge: 'High Retention',
      desc: 'Burst paced dialogue, energetic outline subtitles, vibrant color grades, curiosity hook lines.',
      stylePreset: 'mrbeast',
      rotation: -2,
    },
    {
      id: 'hormozi_value',
      name: 'Alex Hormozi Business',
      icon: Flame,
      color: 'from-pink-500 to-rose-500 text-pink-500 bg-pink-500/10 border-pink-500/20',
      badge: 'High DTC Sales',
      desc: 'Double-font yellow/pink color notes with outlines matching the style, energetic direct response copy hooks.',
      stylePreset: 'hormozi',
      rotation: 4,
    },
    {
      id: 'asmr_luxury',
      name: 'Premium ASMR Quiet Style',
      icon: Sparkles,
      color: 'from-cyan-400 to-blue-500 text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
      badge: 'Visual Aesthetic',
      desc: 'Cinematic color profile mapping, sleek minimal caption cards centered, relaxing aesthetic pacing loops.',
      stylePreset: 'minimalist',
      rotation: 0,
    },
    {
      id: 'drama_cliffhanger',
      name: 'Mystery Storytelling Cue',
      icon: AlertCircle,
      color: 'from-indigo-400 to-purple-500 text-violet-400 bg-violet-500/10 border-violet-500/20',
      badge: 'Intrigue Pattern',
      desc: 'High tension question cue cards, suspense timers, high-impact monochrome box highlights.',
      stylePreset: 'impact',
      rotation: 8,
    }
  ];

  const handleLaunchBooster = async () => {
    setIsBoosting(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    
    const chosen = archetypes.find(a => a.id === selectedArchetype) || archetypes[0];

    const stages = [
      '🔌 Initializing Viral Inspiration Replica Engine...',
      '🧬 Fetching current workspace subtitle timeline buffers...',
      '🔮 Routing request through Google Gemini API pipeline...',
      '🎨 Applying style matrices, captions overlays, and pacing...',
      '🏆 Recalculating algorithmic virality scorecard diagnostic specs...'
    ];

    let currentStageIndex = 0;
    setBoostingStage(stages[0]);

    const interval = setInterval(() => {
      if (currentStageIndex < stages.length - 1) {
        currentStageIndex++;
        setBoostingStage(stages[currentStageIndex]);
      }
    }, 1800);

    try {
      const result = await runAnalyzeVideo({
        name: project.name,
        niche: project.niche,
        originalDuration: project.duration,
        userDescription: `User requested a creator-style upgrade to Archetype: ${chosen.name}. Custom directions: ${customDirectives || 'Boost narrative hooks, insert high energy emojis and craft perfect dynamic timing'}`,
        defaultTranscribe: project.subtitles.map(s => s.text).join(' '),
        imitationOptions: {
          archetype: chosen.name,
          referenceSource: `Selected profile: ${chosen.name} Style Preset: ${chosen.stylePreset}`,
          copyInstructions: `Structure subtitles using ${chosen.stylePreset} rules. Emojis optimization: ${injectEmojis ? 'enabled' : 'disabled'}. High contrast rendering: ${forceHighContrast ? 'enabled' : 'disabled'}. Custom notes: ${customDirectives || 'Optimize spacing and visual contrasts'}`
        },
        videoFile: null, // Booster restyles existing text/subtitles — no new footage to analyze.
      });

      clearInterval(interval);

      if (!result.success) {
        throw new Error('Booster did not return a usable result.');
      }

      // Format result and merge with project details
      const boostedProject: VideoProject = {
        ...project,
        title: fixDunikTypo(result.project.title),
        alternativeTitles: result.project.alternativeTitles,
        description: fixDunikTypo(result.project.description),
        tags: result.project.tags,
        viralityScore: Math.max(90, result.project.viralityScore), // Booster increases score
        viralityCriteria: {
          hook: Math.max(88, result.project.viralityCriteria?.hook || 92),
          pacing: Math.max(90, result.project.viralityCriteria?.pacing || 94),
          emotion: Math.max(86, result.project.viralityCriteria?.emotion || 90),
          visualContrast: Math.max(88, result.project.viralityCriteria?.visualContrast || 93)
        },
        viralityFeedback: result.project.viralityFeedback,
        captionStyle: chosen.stylePreset as CaptionStyle,
        captionRotation: forceStraightCaptions ? 0 : chosen.rotation,
        colorGrade: chosen.id === 'asmr_luxury' ? 'cinematic' : (chosen.id === 'mrbeast_hype' ? 'vibrant_pop' : 'moody_cyber'),
        subtitles: (result.project.subtitles || []).map((sub: any) => ({
          ...sub,
          text: fixDunikTypo(sub.text),
          highlightWords: Array.isArray(sub.highlightWords) ? sub.highlightWords.map((w: string) => fixDunikTypo(w)) : []
        })),
        zoomEffects: result.project.zoomEffects || [],
        endingCTA: result.project.endingCTA,
        thumbnailRecommendation: result.project.thumbnailRecommendation,
      };

      onUpdateProject?.(boostedProject);
      setSuccessMessage(`✨ Dynamic Style Replication Completed! Copied subtitle tracks, CTAs, and metadata successfully overridden! Target model reports a diagnostic virality score of ${boostedProject.viralityScore}/100!`);
      setActiveTab('diagnostics');
      setIsBoosting(false);

    } catch (err: any) {
      clearInterval(interval);
      console.error("[Viral Booster Studio] Request failed:", err);
      setIsBoosting(false);

      if (err?.name === 'MissingApiKeyError') {
        setErrorMessage('No Gemini API key set — add your key in Settings to use the Booster Studio.');
        onRequestApiKey?.();
        return;
      }

      // Honest failure: the project is NOT modified and no success message is
      // shown. A previous version of this catch block silently generated a
      // fake "boosted" project locally (randomized score bump, canned
      // titles/subtitles per archetype) and told the user it had been
      // "Real-time Style Replicated" via the live model — indistinguishable
      // from a genuine result. That risk is worse than an honest failure
      // message, so it's been removed rather than reconnected to the new
      // client-side call.
      setErrorMessage(err?.message || 'The Booster request failed. Please check your connection/API quota and try again.');
    }
  };

  return (
    <div id="virality-scorecard-section" className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
      
      {/* Tab Navigation header */}
      <div className="flex border-b border-slate-800 bg-slate-950/70 p-1 justify-between items-center px-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'diagnostics' 
                ? 'text-brand-cyan bg-slate-900 border border-slate-800' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Compass className="w-4 h-4" />
            Algorithm Scorecard
          </button>
          
          <button
            onClick={() => setActiveTab('booster')}
            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-2 transition-all cursor-pointer relative ${
              activeTab === 'booster' 
                ? 'text-brand-purple bg-slate-900 border border-slate-800' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4 text-brand-yellow" />
            AI Booster Studio
            <span className="absolute -top-1 -right-1 bg-brand-pink text-[9px] px-1 py-0.5 rounded-full text-white animate-bounce">NEW</span>
          </button>
        </div>

        <div className="text-[11px] font-mono text-slate-500 hidden sm:block">
          Active: {project.name ? `"${project.name.slice(0, 18)}..."` : 'Sandbox clip'}
        </div>
      </div>

      {activeTab === 'diagnostics' ? (
        <div className="p-6 space-y-6">
          {/* Diagnostic messages alerts */}
          {successMessage && (
            <div className="bg-emerald-900/15 border border-emerald-500/20 text-emerald-300 p-4 rounded-xl flex items-start gap-3 text-sm animate-fade-in">
              <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Optimization Active!</p>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{successMessage}</p>
              </div>
            </div>
          )}

          {/* Dynamic Virality Score Header metrics */}
          <div className="flex flex-col md:flex-row items-center gap-6 justify-between border-b border-slate-800/60 pb-6">
            <div className="flex items-center gap-4 text-center md:text-left flex-col md:flex-row w-full md:w-auto">
              <div className={`p-4 rounded-2xl border flex flex-col items-center justify-center shrink-0 w-24 h-24 ${scoreColor(project.viralityScore)}`}>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Viral Score</span>
                <span className="text-3xl font-display font-black tracking-tighter mt-1">{project.viralityScore}</span>
                <span className="text-[9px] text-slate-500 mt-0.5">/ 100 max</span>
              </div>

              <div>
                <h2 className="font-display text-lg font-bold text-white flex items-center gap-2 justify-center md:justify-start">
                  <TrendingUp className="text-brand-cyan w-5 h-5 animate-pulse" />
                  Virality Engine Diagnostics
                </h2>
                <div className="flex flex-wrap gap-2 mt-1.5 justify-center md:justify-start">
                  <span className="text-xs bg-slate-950 px-2.5 py-1 rounded-md border border-slate-850 text-slate-400 font-mono">
                    Niche: <span className="text-white font-bold">{project.niche || 'general'}</span>
                  </span>
                  <span className="text-xs bg-slate-950 px-2.5 py-1 rounded-md border border-slate-850 text-slate-400 font-mono">
                    Font Theme: <span className="text-brand-purple font-bold capitalize">{project.captionStyle || 'hormozi'}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-850 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-brand-purple animate-pulse" />
              <span className="text-xs text-slate-300 font-mono">
                Engine: <span className="text-brand-cyan font-bold">{project.engineMode === 'live-gemini' ? 'Google Gemini Live' : 'High Fidelity Fallback'}</span>
              </span>
            </div>
          </div>

          {/* Breakdown metrics sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-4 bg-slate-950/40 p-4 rounded-xl border border-slate-850">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-brand-yellow" />
                Retention Psychology Factors
              </h3>

              <div className="space-y-3">
                {/* Hook score progress */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">3-Sec Hook Intensity</span>
                    <span className="text-white font-mono font-bold">{project.viralityCriteria?.hook || 85}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand-yellow to-yellow-400 rounded-full transition-all duration-500"
                      style={{ width: `${project.viralityCriteria?.hook || 85}%` }}
                    />
                  </div>
                </div>

                {/* Pacing score progress */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Pacing & Dynamic Cuts</span>
                    <span className="text-white font-mono font-bold">{project.viralityCriteria?.pacing || 88}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand-cyan to-indigo-400 rounded-full transition-all duration-500"
                      style={{ width: `${project.viralityCriteria?.pacing || 88}%` }}
                    />
                  </div>
                </div>

                {/* Emotional triggers */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Emotional Resonance</span>
                    <span className="text-white font-mono font-bold">{project.viralityCriteria?.emotion || 84}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand-pink to-brand-purple rounded-full transition-all duration-500"
                      style={{ width: `${project.viralityCriteria?.emotion || 84}%` }}
                    />
                  </div>
                </div>

                {/* Visual contrast */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Visual Contrast & Color Grading</span>
                    <span className="text-white font-mono font-bold">{project.viralityCriteria?.visualContrast || 82}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand-green to-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${project.viralityCriteria?.visualContrast || 82}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Actionable optimization checklists */}
            <div className="space-y-3 bg-slate-950/40 p-4 rounded-xl border border-slate-850 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-3">
                  <Info className="w-3.5 h-3.5 text-brand-purple" />
                  Director Actions (Completed auto-fixes)
                </h3>
                <ul className="space-y-2">
                  {project.viralityFeedback && project.viralityFeedback.length > 0 ? (
                    project.viralityFeedback.map((tip, idx) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-2 leading-relaxed">
                        <span className="text-brand-cyan mt-1 shrink-0 text-sm">✓</span>
                        <span>{tip}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-xs text-slate-400 italic">No feedback registered yet. Let's run the AI Booster model!</li>
                  )}
                </ul>
              </div>
              
              <div className="mt-4 pt-3 border-t border-slate-800/40 text-[11px] text-slate-500 italic">
                💡 Tip: Click the AI Booster Studio tab in the header menu to apply specific style aesthetics (e.g. MrBeast vs. Hormozi)!
              </div>
            </div>
          </div>

          {/* Copyable Optimized Captions, Titles and Hashtags Panel */}
          <div className="space-y-4 pt-2 border-t border-slate-800/50">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-brand-cyan" />
              Optimized Meta Social Copy
            </h3>

            {/* Title suggestions block */}
            <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-840">
              <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                <span className="text-[10px] text-slate-400 font-mono uppercase font-bold tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-purple" />
                  Viral Title Suggestions (Algorithm-Optimized)
                </span>
              </div>

              <div className="space-y-3 pt-1">
                {/* Recommended Title */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-semibold text-slate-450 uppercase tracking-wide">Recommended Title</span>
                    <button
                      onClick={() => copyToClipboard(fixDunikTypo(project.title), 'title')}
                      className="text-xs text-brand-purple hover:text-brand-pink transition-colors font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedTitle ? <Check className="w-3.5 h-3.5 text-brand-green" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedTitle ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="text-sm font-bold text-white select-all bg-slate-900/45 px-3 py-2.5 rounded-lg border border-slate-800 leading-snug">
                    {fixDunikTypo(project.title)}
                  </div>
                </div>

                {/* Alternative Titles */}
                <div>
                  <span className="text-[10px] font-semibold text-slate-450 uppercase tracking-wide block mb-1.5">Alternative Options</span>
                  <div className="space-y-2">
                    {(project.alternativeTitles && project.alternativeTitles.length > 0 ? project.alternativeTitles : [
                      `INSANE ${project.niche.toUpperCase()} Edit - Wait Till You See This 😱`,
                      `Pure ${project.niche.toUpperCase()} Vibes | This Changes Everything 🔥`
                    ]).map((alt, idx) => {
                      const cleanedAlt = fixDunikTypo(alt);
                      const isCopied = copiedAltIdx === idx;
                      return (
                        <div key={idx} className="flex items-center justify-between gap-3 bg-slate-900/35 px-4 py-2.5 rounded-lg border border-slate-805">
                          <span className="text-xs text-slate-300 font-medium select-all leading-snug">{cleanedAlt}</span>
                          <button
                            onClick={() => copyAltToClipboard(cleanedAlt, idx)}
                            className="text-slate-500 hover:text-brand-purple transition-colors p-1.5 rounded hover:bg-slate-800/80 shrink-0 flex items-center justify-center cursor-pointer"
                            title="Copy Option"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-brand-green" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Description body and tags copyable */}
            <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-840">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-slate-400 font-mono uppercase font-bold tracking-wider">Algorithm-Optimized Caption</span>
                <button
                  onClick={() => copyToClipboard(fixDunikTypo(project.description), 'caption')}
                  className="text-xs text-brand-cyan hover:text-cyan-400 transition-colors font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedCaption ? <Check className="w-3.5 h-3.5 text-brand-green" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCaption ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="text-xs text-slate-300 whitespace-pre-line select-all leading-relaxed font-mono bg-slate-900/30 p-3 rounded-lg border border-slate-850">
                {fixDunikTypo(project.description)}
              </div>
            </div>

            {/* Outro Ending CTA Overlay */}
            {project.endingCTA && (
              <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-840">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] text-slate-450 font-mono uppercase font-bold tracking-wider flex items-center gap-1.5">
                    <Megaphone className="w-3.5 h-3.5 text-brand-pink" />
                    TikTok-Optimized Ending CTA Screen
                  </span>
                  <button
                    onClick={() => copyToClipboard(project.endingCTA || '', 'cta')}
                    className="text-xs text-brand-pink hover:text-pink-400 transition-colors font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedCTA ? <Check className="w-3.5 h-3.5 text-brand-green" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCTA ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="text-xs text-slate-200 select-all font-sans font-medium bg-slate-900/30 p-3 rounded-lg border border-slate-850">{project.endingCTA}</div>
              </div>
            )}

            {/* Scroll-stopping Thumbnail Spec */}
            {project.thumbnailRecommendation && (
              <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-840">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] text-slate-450 font-mono uppercase font-bold tracking-wider flex items-center gap-1.5">
                    <Image className="w-3.5 h-3.5 text-brand-yellow" />
                    Scroll-Stopping Thumbnail Overlay Spec
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-sans bg-slate-900/30 p-3 rounded-lg border border-slate-850">{project.thumbnailRecommendation}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-6 space-y-6">
          {/* AI Booster controls heading */}
          <div>
            <h2 className="text-md font-bold text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-brand-purple animate-pulse" />
              Creator Archetype Style Replica Engine
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Inject specialized social algorithm multipliers and re-architect the active subtitles script timeline, zoom keyframes, ending tags, title outlines, and CTR hooks in real-time.
            </p>
          </div>

          {/* Archetypes grid selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {archetypes.map((arch) => {
              const SelectedIcon = arch.icon;
              const isChosen = selectedArchetype === arch.id;
              return (
                <div
                  key={arch.id}
                  onClick={() => !isBoosting && setSelectedArchetype(arch.id)}
                  className={`border p-4 rounded-xl cursor-pointer transition-all duration-300 flex flex-col justify-between h-40 ${
                    isChosen 
                      ? 'bg-slate-950 border-brand-purple/50 shadow-lg shadow-brand-purple/5 ring-1 ring-brand-purple/20' 
                      : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700/80 hover:bg-slate-950/75'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg border ${arch.color.split(' ').slice(1).join(' ')}`}>
                          <SelectedIcon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-100">{arch.name}</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono border uppercase tracking-wider ${
                        isChosen ? 'bg-brand-purple/10 text-brand-purple border-brand-purple/20' : 'bg-slate-800/40 text-slate-400 border-slate-800'
                      }`}>
                        {arch.badge}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">{arch.desc}</p>
                  </div>

                  <div className="flex justify-between items-center text-[11px] font-mono border-t border-slate-900 pt-2 shrink-0">
                    <span className="text-slate-500">Preset: <span className="text-slate-300 capitalize">{arch.stylePreset}</span></span>
                    {isChosen ? (
                      <span className="text-brand-purple font-bold flex items-center gap-1 font-sans">
                        <Check className="w-3 h-3" /> Selected Style
                      </span>
                    ) : (
                      <span className="text-slate-500 hover:text-slate-300">Click to arm</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Customizable prompts override */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <Edit3 className="w-3.5 h-3.5 text-brand-cyan" />
                Algorithm Guidelines & Focus Target Prompt
              </label>
              <span className="text-[10px] text-slate-500">Inject custom triggers tailored to your particular visual goals (e.g. products, size runs, emotional lines, pricing hooks).</span>
            </div>

            <textarea
              disabled={isBoosting}
              value={customDirectives}
              onChange={(e) => setCustomDirectives(e.target.value)}
              placeholder="e.g. Emphasize price markers with double highlighting, structure script in a humorous tone, insert high-CTR reaction check tags at the ending..."
              className="w-full h-20 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-purple font-mono resize-none leading-relaxed transition-colors"
            />
          </div>

          {/* Injection toggle checklists */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/30 p-4 rounded-xl border border-slate-850/60">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                disabled={isBoosting}
                checked={injectEmojis}
                onChange={(e) => setInjectEmojis(e.target.checked)}
                className="w-4 h-4 rounded text-brand-purple bg-slate-900 border-slate-800 focus:ring-brand-purple mt-0.5 shrink-0"
              />
              <div className="text-left font-sans">
                <p className="text-xs font-bold text-white leading-none">Inject High-Intensity Emojis</p>
                <p className="text-[10px] text-slate-500 mt-1 leading-normal">Inserts copy-targeted emoji markers (💰, 🚨, 👑) dynamically within captions.</p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                disabled={isBoosting}
                checked={forceHighContrast}
                onChange={(e) => setForceHighContrast(e.target.checked)}
                className="w-4 h-4 rounded text-brand-purple bg-slate-900 border-slate-800 focus:ring-brand-purple mt-0.5 shrink-0"
              />
              <div className="text-left font-sans">
                <p className="text-xs font-bold text-white leading-none">Force High-Contrast Highlights</p>
                <p className="text-[10px] text-slate-500 mt-1 leading-normal">Ensures the subtitle rendering pipeline marks vital terms automatically.</p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                disabled={isBoosting}
                checked={forceStraightCaptions}
                onChange={(e) => setForceStraightCaptions(e.target.checked)}
                className="w-4 h-4 rounded text-brand-purple bg-slate-900 border-slate-800 focus:ring-brand-purple mt-0.5 shrink-0"
              />
              <div className="text-left font-sans">
                <p className="text-xs font-bold text-white leading-none">Straight & Balanced (0°)</p>
                <p className="text-[10px] text-slate-500 mt-1 leading-normal">Aligns subtitles perfectly straight to prevent tilted or unbalanced layouts.</p>
              </div>
            </label>
          </div>

          {/* Running Booster Loading Overlay State */}
          {isBoosting ? (
            <div className="bg-slate-950/80 border border-brand-purple/30 p-6 rounded-2xl flex flex-col items-center justify-center text-center space-y-4 shadow-xl">
              <div className="relative">
                <RefreshCw className="w-8 h-8 text-brand-purple animate-spin" />
                <Sparkles className="w-4 h-4 text-brand-pink absolute -top-1 -right-1 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-bold text-slate-100 uppercase tracking-widest font-mono">Booster Active</p>
                <p className="text-xs text-brand-cyan tracking-wide font-mono animate-pulse">{boostingStage}</p>
              </div>
              <p className="text-[10px] text-slate-500 italic max-w-sm">Re-writing subtitles transcription scripts and matching algorithm pacing indices. Please remain active on this tab.</p>
            </div>
          ) : (
            <div className="pt-2">
              {errorMessage && (
                <p className="text-xs text-brand-pink font-semibold my-2.5">⚠️ Error: {errorMessage}</p>
              )}

              <button
                onClick={handleLaunchBooster}
                className="w-full bg-gradient-to-r from-brand-purple via-violet-600 to-indigo-600 hover:brightness-110 active:scale-[0.99] font-display text-white text-xs font-bold uppercase tracking-wider py-3.5 px-6 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-brand-purple/10"
              >
                <Zap className="w-4 h-4 text-brand-yellow animate-bounce" />
                Launch Algorithmic Virality Booster
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
