import React, { useRef, useState } from 'react';
import { RAW_VIDEO_TEMPLATES } from '../data';
import { VideoNiche } from '../types';
import { Sparkles, Upload, FileText, Globe, Film, ArrowRight, Lightbulb, Copy, Zap } from 'lucide-react';

interface NicheSelectorProps {
  onSelectTemplate: (template: typeof RAW_VIDEO_TEMPLATES[0], imitationOptions?: any) => void;
  onUploadCustomFile: (
    file: File,
    name: string,
    niche: VideoNiche,
    description: string,
    rawTranscribe: string,
    imitationOptions?: any
  ) => void;
  isProcessing: boolean;
}

export default function NicheSelector({
  onSelectTemplate,
  onUploadCustomFile,
  isProcessing,
}: NicheSelectorProps) {
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');
  const [selectedNiche, setSelectedNiche] = useState<VideoNiche>('general');
  const [customDescription, setCustomDescription] = useState('');
  const [customTranscribe, setCustomTranscribe] = useState('');
  const [customFileName, setCustomFileName] = useState('');
  const [selectedFileObj, setSelectedFileObj] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Viral Inspiration Replica Engine States
  const [enableImitation, setEnableImitation] = useState(false);
  const [imitationArchetype, setImitationArchetype] = useState<string>('asmr_sales');
  const [inspirationUrlOrText, setInspirationUrlOrText] = useState('');
  const [customInspirationFileName, setCustomInspirationFileName] = useState('');
  const [inspirationFileObj, setInspirationFileObj] = useState<File | null>(null);
  const inspirationInputRef = useRef<HTMLInputElement>(null);
  const [imitationInstructions, setImitationInstructions] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFileObj(file);
      setCustomFileName(file.name);
      if (!customDescription) {
        setCustomDescription(`User-uploaded raw footage clip: ${file.name}`);
      }
    }
  };

  const handleInspirationFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInspirationFileObj(file);
      setCustomInspirationFileName(file.name);
    }
  };

  const getImitationBlob = () => {
    if (!enableImitation) return null;
    return {
      archetype: imitationArchetype,
      referenceSource: customInspirationFileName ? `Uploaded file: ${customInspirationFileName}` : (inspirationUrlOrText || 'Selected archetype profile'),
      copyInstructions: imitationInstructions || 'Mimic video pacing, subtitle alignment, and visual appeal hooks.'
    };
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[NicheSelector] Submitting custom file:', customFileName);
    
    if (!selectedFileObj && !customFileName) {
      alert("Please select a video file first.");
      return;
    }
    
    // Fallback file/name if user uploaded something
    const file = selectedFileObj || new File([], customFileName || 'custom-video.mp4');
    
    onUploadCustomFile(
      file,
      customFileName || 'uploaded-footage.mp4',
      selectedNiche,
      customDescription || 'Custom uploaded raw vlog clip',
      customTranscribe || '',
      getImitationBlob()
    );
  };

  const selectPreset = (preset: typeof RAW_VIDEO_TEMPLATES[0]) => {
    if (isProcessing) return;
    onSelectTemplate(preset, getImitationBlob());
  };

  return (
    <div id="niche-selector" className="bg-slate-900 border border-slate-805 rounded-2xl p-6 shadow-2xl backdrop-blur-md space-y-6">
      
      {/* Header section of footage inputs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
            <Film className="text-brand-purple w-5 h-5 animate-pulse" />
            1. Source Raw Footage
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Import a vertical preset clip or upload your raw vlogs/unboxing footage for AI processing.
          </p>
        </div>
      </div>

      {/* Main Tabs switcher */}
      <div className="flex border-b border-slate-800 bg-slate-950/50 p-1 rounded-lg">
        <button
          type="button"
          onClick={() => setActiveTab('presets')}
          className={`flex-1 py-1.5 px-4 rounded-md text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
            activeTab === 'presets'
              ? 'bg-slate-800 text-white shadow-sm border border-slate-700/55'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-brand-purple" />
          High-Engaging Preset Library
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('custom')}
          className={`flex-1 py-1.5 px-4 rounded-md text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
            activeTab === 'custom'
              ? 'bg-slate-800 text-white shadow-sm border border-slate-700/55'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Upload className="w-3.5 h-3.5 text-brand-cyan" />
          Upload My Raw Video File
        </button>
      </div>

      {activeTab === 'presets' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {RAW_VIDEO_TEMPLATES.map((tpl) => (
            <div
              key={tpl.id}
              onClick={() => selectPreset(tpl)}
              className="group relative cursor-pointer bg-slate-950/60 hover:bg-slate-950 border border-slate-850 hover:border-brand-purple/60 rounded-xl p-4 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-brand-purple/10 text-brand-purple border border-brand-purple/20">
                    {tpl.niche}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">{tpl.originalDuration}s Clip</span>
                </div>
                <h3 className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors duration-150">
                  {tpl.name}
                </h3>
                <p className="text-[10px] text-slate-400 mt-2 line-clamp-3 italic leading-relaxed">
                  "{tpl.userDescription}"
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-900 flex items-center justify-between text-[10px] text-brand-cyan font-semibold opacity-80 group-hover:opacity-100">
                <span className="flex items-center gap-1 font-mono">
                  <FileText className="w-3 h-3" />
                  Fast Autopilot
                </span>
                <ArrowRight className="w-3 h-3 transform group-hover:translate-x-0.5 transition-transform duration-200" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleCustomSubmit(e);
          }} 
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* File Upload zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-800 hover:border-brand-cyan/50 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-950/20 hover:bg-slate-950/60 transition-all duration-200 cursor-pointer text-center group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload className="w-8 h-8 text-slate-500 mb-2 group-hover:text-brand-cyan transition-colors" />
              {customFileName ? (
                <div>
                  <p className="text-xs text-brand-cyan font-bold flex items-center gap-1 justify-center">
                    <Zap className="w-3 h-3 text-brand-cyan fill-brand-cyan" />
                    Footage Ready!
                  </p>
                  <p className="text-xs text-white truncate max-w-[200px] font-mono mt-1">{customFileName}</p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-semibold text-slate-300">Tap to choose a video</p>
                  <p className="text-[10px] text-slate-500 mt-1">Accepts MP4, MOV, WebM vertical footage</p>
                </div>
              )}
            </div>

            {/* Config metadata fields */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Target Channel Niche / Goal</label>
                <select
                  value={selectedNiche}
                  onChange={(e) => setSelectedNiche(e.target.value as VideoNiche)}
                  className="w-full text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 focus:outline-none focus:border-brand-cyan"
                >
                  <option value="unboxing">📦 product unboxing & physical reviews</option>
                  <option value="sales">💰 high-ticket direct sales & DTC pitch</option>
                  <option value="general">💎 general lifestyle & personal vlog</option>
                  <option value="cooking">🍳 cooking, baking & food reels</option>
                  <option value="education">🧠 educational explanations & podcasts</option>
                  <option value="fitness">💪 active workouts & motivation drops</option>
                  <option value="comedy">🎭 reaction humor, comedy & gaming</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">What happens in this raw video?</label>
                <textarea
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder="e.g., Shoe unboxing of white limited edition sneakers. Pulling them out of custom vintage box and showing soft leather stitching."
                  rows={2}
                  className="w-full text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-300 px-3 py-2 focus:outline-none focus:border-brand-cyan placeholder:text-slate-600 font-medium"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-semibold text-slate-400">
                Spoken Script Dialogue (Optional input)
              </label>
              <span className="text-[10px] text-slate-500 font-mono">Whisper voice aligner backup</span>
            </div>
            <textarea
              value={customTranscribe}
              onChange={(e) => setCustomTranscribe(e.target.value)}
              placeholder="Leave empty for auto voice transcription! Or type what is spoken to guarantee 100% correct subtitle alignments."
              rows={2}
              className="w-full text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-300 px-3 py-2 focus:outline-none focus:border-brand-cyan placeholder:text-slate-600"
            />
          </div>

          {/* Main trigger button for custom file submission - MOVED INSIDE FORM */}
          <button
            type="submit"
            disabled={isProcessing || (!selectedFileObj && !customFileName)}
            className="w-full py-4 px-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all duration-200 flex items-center justify-center gap-3 text-black bg-brand-cyan hover:bg-cyan-400 hover:shadow-cyan-950/20 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer mt-2"
          >
            <Sparkles className="w-5 h-5 text-black animate-spin" style={{ animationDuration: '3s' }} />
            Forge and Edit Custom Video
          </button>
        </form>
      )}

      {/* 🧠 VIRAL INSPIRATION REPLICA ENGINE (VIRE) PANEL */}
      <div className="border border-slate-800/80 bg-slate-950/40 rounded-xl p-5 space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enableImitation}
            onChange={(e) => setEnableImitation(e.target.checked)}
            className="mt-1 rounded border-slate-700 text-brand-cyan focus:ring-brand-cyan"
          />
          <div>
            <span className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
              <Lightbulb className="w-4 h-4 text-brand-cyan fill-brand-cyan/20" />
              Viral Inspiration Copycat Engine (VIRE)
            </span>
            <p className="text-[10px] text-slate-400">
              Provide an edited reference clip or paste a viral style link. The AI will analyze and replicate the precise caption style, visual hook speed, and pacing on your raw file!
            </p>
          </div>
        </label>

        {enableImitation && (
          <div className="p-4 rounded-lg bg-slate-950 border border-brand-cyan/20 space-y-4 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                  Replication Archetype Profile
                </label>
                <select
                  value={imitationArchetype}
                  onChange={(e) => setImitationArchetype(e.target.value)}
                  className="w-full text-xs rounded-lg bg-slate-900 border border-slate-800 text-slate-200 px-3 py-2 focus:outline-none focus:border-brand-cyan"
                >
                  <option value="asmr_sales">📦 Aesthetic ASMR Unboxing & Direct Sales (High converting)</option>
                  <option value="aggressive_sell">💰 Hormozi High-Ticket Urgency Pitch (Problem & Solution calls)</option>
                  <option value="mrbeast">🔥 Extreme Soundboard Retention (Fast cuts, heavy emojis)</option>
                  <option value="minimalist">🌿 Quiet Luxury Clean Vlog (Minimal text & vintage pop color)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                  Reference Video Source (Upload clip or Paste Link)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inspirationUrlOrText}
                    onChange={(e) => setInspirationUrlOrText(e.target.value)}
                    placeholder="Paste TikTok/Reels link or channel name (e.g. @SneakerHead)"
                    className="flex-1 text-xs rounded-lg bg-slate-900 border border-slate-800 text-slate-300 px-3 py-2 focus:outline-none focus:border-brand-cyan placeholder:text-slate-600 font-mono"
                  />
                  
                  <button
                    type="button"
                    onClick={() => inspirationInputRef.current?.click()}
                    className="px-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[10px] font-semibold text-slate-300 flex items-center gap-1"
                    title="Upload reference video"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {customInspirationFileName ? 'Cloned!' : 'Add File'}
                  </button>
                  <input
                    ref={inspirationInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleInspirationFileChange}
                    className="hidden"
                  />
                </div>
                {customInspirationFileName && (
                  <p className="text-[10px] text-brand-green font-mono mt-1">✓ Cloned attributes from: {customInspirationFileName}</p>
                )}
              </div>

            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                Special Mimicry Directives for the AI
              </label>
              <textarea
                value={imitationInstructions}
                onChange={(e) => setImitationInstructions(e.target.value)}
                placeholder="Tell the AI what to copy: e.g., 'Copy the rapid big bold yellow font overlays from the sneakers video and add high-energy transition sound snaps.'"
                rows={2}
                className="w-full text-xs rounded-lg bg-slate-900 border border-slate-800 text-slate-300 px-3 py-2 focus:outline-none focus:border-brand-cyan placeholder:text-slate-600"
              />
            </div>
          </div>
        )}

        {/* Main trigger button for custom file submission - MOVED INSIDE FORM */}
        {activeTab === 'custom' && (
          <button
            onClick={handleCustomSubmit}
            type="submit"
            disabled={isProcessing || (!selectedFileObj && !customFileName)}
            className="w-full py-4 px-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all duration-200 flex items-center justify-center gap-3 text-black bg-brand-cyan hover:bg-cyan-400 hover:shadow-cyan-950/20 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer mt-4"
          >
            <Sparkles className="w-5 h-5 text-black animate-spin" style={{ animationDuration: '3s' }} />
            Forge and Edit Custom Video
          </button>
        )}
      </div>

      {/* User-friendly info note about presets */}
      {activeTab === 'presets' && enableImitation && (
        <div className="p-3 text-center rounded-xl bg-brand-cyan/5 border border-brand-cyan/20 text-[10px] text-brand-cyan font-semibold">
          💡 Copycat imitation is active! Click any preset above to forge beautiful vertical video matching your selected creator style!
        </div>
      )}
    </div>
  );
}
