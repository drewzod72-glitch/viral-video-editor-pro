import React, { useRef, useState } from 'react';
import { RAW_VIDEO_TEMPLATES } from '../data';
import { VideoNiche } from '../types';
import { Upload, Video as VideoIcon, Sparkles, Flame } from 'lucide-react';

export default function NicheSelector({ onSelectTemplate, onUploadCustomFile, isProcessing }: any) {
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');
  const [selectedNiche, setSelectedNiche] = useState<VideoNiche>('general');
  const [customDescription, setCustomDescription] = useState('');
  const [customFileName, setCustomFileName] = useState('');
  const [selectedFileObj, setSelectedFileObj] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFileObj(file);
      setCustomFileName(file.name);
      // Removed the auto-setting of customDescription to allow user to type it
    }
  };

  const handleCustomSubmit = () => {
    if (isProcessing) return;
    if (!selectedFileObj) {
      alert("Please choose a video file first by tapping the upload box.");
      return;
    }
    onUploadCustomFile(selectedFileObj, customFileName, selectedNiche, customDescription || 'Analyze this video and make it viral', '', null);
  };

  return (
    <div className="bg-slate-900 rounded-[40px] p-6 border border-slate-800 shadow-2xl space-y-8">
      <div className="flex gap-3 p-1.5 bg-slate-950 rounded-[24px] border border-slate-900">
        <button onClick={() => setActiveTab('presets')} className={`flex-1 py-3 rounded-[18px] text-[10px] uppercase tracking-widest font-black transition-all ${activeTab === 'presets' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Presets</button>
        <button onClick={() => setActiveTab('custom')} className={`flex-1 py-3 rounded-[18px] text-[10px] uppercase tracking-widest font-black transition-all ${activeTab === 'custom' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Custom Upload</button>
      </div>

      {activeTab === 'presets' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {RAW_VIDEO_TEMPLATES.map((tpl) => (
            <button 
              key={tpl.id} 
              onClick={() => onSelectTemplate(tpl)} 
              className="group relative overflow-hidden p-6 bg-slate-950 border border-slate-800 rounded-[32px] text-left hover:border-cyan-500/50 hover:bg-slate-900/40 transition-all duration-300 shadow-xl"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                <VideoIcon className="w-12 h-12 text-white" />
              </div>
              <span className="inline-block px-3 py-1 rounded-full text-[9px] bg-purple-500/10 text-purple-400 font-black uppercase tracking-widest border border-purple-500/20 mb-3">
                {tpl.niche}
              </span>
              <p className="text-sm font-black text-white leading-snug group-hover:text-cyan-400 transition-colors">{tpl.name}</p>
              <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Ready to Forge
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div 
            onClick={() => fileInputRef.current?.click()} 
            className="group relative border-4 border-dashed border-slate-800 hover:border-cyan-500/50 rounded-[40px] p-12 flex flex-col items-center justify-center bg-slate-950/40 hover:bg-slate-900/60 transition-all duration-300 cursor-pointer"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
            <div className="w-16 h-16 bg-slate-800 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-cyan-500/10 transition-all">
              <Upload className="w-8 h-8 text-slate-500 group-hover:text-cyan-400" />
            </div>
            <p className="text-sm font-black text-center text-slate-300 tracking-tight">{customFileName || 'SELECT VIDEO FILE'}</p>
            <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-widest">Supports MP4, MOV, WebM</p>
          </div>
          
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-purple-500" />
              AI Editing Instructions (Prompt)
            </label>
            <textarea
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              placeholder="e.g. 'Add a hook about money, use fire emojis, make cuts fast' or 'Tell a story about this product'..."
              className="w-full bg-slate-950 border border-slate-800 rounded-[24px] p-5 text-sm font-medium min-h-[140px] focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 focus:outline-none transition-all placeholder:text-slate-700 shadow-inner"
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 flex items-center gap-2">
              <Flame className="w-3 h-3 text-orange-500" />
              Content Niche
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 border border-slate-800 rounded-[24px]">
              {[
                { id: 'unboxing', label: 'Unboxing' },
                { id: 'sales', label: 'Sales Pitch' },
                { id: 'general', label: 'Daily Vlog' },
                { id: 'comedy', label: 'Comedy' },
                { id: 'education', label: 'Podcast' },
                { id: 'fitness', label: 'Fitness' }
              ].map((niche) => (
                <button
                  key={niche.id}
                  onClick={() => setSelectedNiche(niche.id as any)}
                  className={`py-3 px-4 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all ${
                    selectedNiche === niche.id 
                      ? 'bg-slate-800 text-white shadow-md' 
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {niche.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCustomSubmit();
            }}
            className="group relative w-full py-6 bg-white text-black font-black text-xl uppercase rounded-[30px] shadow-[0_20px_40px_rgba(255,255,255,0.05)] transition-all active:scale-95 overflow-hidden"
            style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
          >
            <span className="relative z-10">{isProcessing ? 'ENGINEERING...' : 'FORGE VIDEO'}</span>
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-purple-500 opacity-0 group-hover:opacity-10 transition-opacity" />
          </button>
        </div>
      )}
    </div>

  );
}
