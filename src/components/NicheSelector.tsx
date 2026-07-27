import React, { useRef, useState } from 'react';
import { RAW_VIDEO_TEMPLATES } from '../data';
import { VideoNiche } from '../types';
import { Sparkles, Upload, FileText, Film, ArrowRight, Lightbulb, Zap } from 'lucide-react';

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
      if (!customDescription) setCustomDescription(`User-uploaded raw footage clip: ${file.name}`);
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

  const handleCustomSubmit = () => {
    console.log('[NicheSelector] Manual button click triggered.');
    if (isProcessing) return;
    if (!selectedFileObj && !customFileName) {
      alert("Please select a video file first.");
      return;
    }
    
    // Call the parent handler
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
    <div id="niche-selector" className="bg-slate-900 border border-slate-805 rounded-2xl p-6 shadow-2xl space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
            <Film className="text-brand-purple w-5 h-5 animate-pulse" />
            1. Source Raw Footage
          </h2>
          <p className="text-sm text-slate-400 mt-1">Import preset or upload raw vertical footage.</p>
        </div>
      </div>

      <div className="flex border-b border-slate-800 bg-slate-950/50 p-1 rounded-lg">
        <button type="button" onClick={() => setActiveTab('presets')} className={`flex-1 py-1.5 px-4 rounded-md text-xs font-semibold transition-all ${activeTab === 'presets' ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-400'}`}>Preset Library</button>
        <button type="button" onClick={() => setActiveTab('custom')} className={`flex-1 py-1.5 px-4 rounded-md text-xs font-semibold transition-all ${activeTab === 'custom' ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-400'}`}>Upload File</button>
      </div>

      {activeTab === 'presets' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {RAW_VIDEO_TEMPLATES.map((tpl) => (
            <div key={tpl.id} onClick={() => selectPreset(tpl)} className="group cursor-pointer bg-slate-950/60 border border-slate-850 hover:border-brand-purple/60 rounded-xl p-4 transition-all">
              <h3 className="text-xs font-bold text-slate-200">{tpl.name}</h3>
              <p className="text-[10px] text-slate-400 mt-2 line-clamp-2">"{tpl.userDescription}"</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-950/20 hover:bg-slate-950/60 cursor-pointer">
              <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
              <Upload className="w-8 h-8 text-slate-500 mb-2" />
              <p className="text-xs font-semibold text-slate-300">{customFileName || 'Tap to choose a video'}</p>
            </div>
            <div className="space-y-3">
              <select value={selectedNiche} onChange={(e) => setSelectedNiche(e.target.value as any)} className="w-full text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2">
                <option value="unboxing">product unboxing</option>
                <option value="sales">direct sales pitch</option>
                <option value="general">general vlog</option>
              </select>
              <textarea value={customDescription} onChange={(e) => setCustomDescription(e.target.value)} placeholder="What happens in this video?" rows={2} className="w-full text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-300 px-3 py-2 focus:outline-none" />
            </div>
          </div>
          <button
            onClick={handleCustomSubmit}
            disabled={isProcessing || (!selectedFileObj && !customFileName)}
            className="w-full py-4 bg-brand-cyan hover:bg-cyan-400 text-black font-black text-sm uppercase rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-40"
          >
            {isProcessing ? 'Processing...' : 'Forge and Edit Custom Video'}
          </button>
        </div>
      )}
    </div>
  );
}
