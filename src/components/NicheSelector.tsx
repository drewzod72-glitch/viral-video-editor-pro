import React, { useRef, useState } from 'react';
import { RAW_VIDEO_TEMPLATES } from '../data';
import { VideoNiche } from '../types';
import { Upload } from 'lucide-react';

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
      setCustomDescription(`Custom video: ${file.name}`);
    }
  };

  const handleCustomSubmit = () => {
    if (isProcessing) return;
    if (!selectedFileObj) {
      alert("Please choose a video file first by tapping the upload box.");
      return;
    }
    onUploadCustomFile(selectedFileObj, customFileName, selectedNiche, customDescription, '', null);
  };

  return (
    <div className="bg-slate-900 rounded-3xl p-4 space-y-6">
      <div className="flex gap-2 p-1 bg-slate-950 rounded-xl">
        <button onClick={() => setActiveTab('presets')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${activeTab === 'presets' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>Presets</button>
        <button onClick={() => setActiveTab('custom')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${activeTab === 'custom' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>Custom Upload</button>
      </div>

      {activeTab === 'presets' ? (
        <div className="grid grid-cols-2 gap-3">
          {RAW_VIDEO_TEMPLATES.slice(0, 4).map((tpl) => (
            <button key={tpl.id} onClick={() => onSelectTemplate(tpl)} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-left hover:border-purple-500 transition-all">
              <span className="text-[10px] text-purple-400 font-bold uppercase">{tpl.niche}</span>
              <p className="text-xs font-bold text-white mt-1">{tpl.name}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div 
            onClick={() => fileInputRef.current?.click()} 
            className="border-4 border-dashed border-slate-800 rounded-[30px] p-10 flex flex-col items-center justify-center bg-slate-950/40 active:bg-slate-900 transition-colors"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
            <Upload className="w-10 h-10 text-slate-600 mb-4" />
            <p className="text-sm font-black text-center text-slate-300">{customFileName || 'TAP HERE TO CHOOSE VIDEO'}</p>
          </div>
          
          <select value={selectedNiche} onChange={(e) => setSelectedNiche(e.target.value as any)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm font-bold">
            <option value="unboxing">Product Unboxing</option>
            <option value="sales">Sales Pitch</option>
            <option value="general">Daily Vlog</option>
          </select>

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCustomSubmit();
            }}
            className="w-full py-5 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-lg uppercase rounded-[30px] shadow-2xl transition-all active:scale-95"
            style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
          >
            {isProcessing ? 'Processing...' : 'Forge Video'}
          </button>
        </div>
      )}
    </div>
  );
}
