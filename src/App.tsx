import React, { useState, useEffect, useRef } from 'react';
import { VideoProject, VideoNiche, SubtitleItem } from './types';
import { RAW_VIDEO_TEMPLATES } from './data';
import NicheSelector from './components/NicheSelector';
import { saveFileToDevice } from './utils/download';
import VideoPlayerWorkspace from './components/VideoPlayerWorkspace';
import ViralityScorecard from './components/ViralityScorecard';
import { CheckCircle, KeyRound, Sparkles, Download, Video } from 'lucide-react';
import ApiKeySettingsModal from './components/ApiKeySettingsModal';
import { runAnalyzeVideo } from './utils/geminiClient';

const fixDunikTypo = (str: string): string => {
  if (typeof str !== 'string' || !str) return str;
  return str.replace(/dunik/gi, (match) => {
    const map: Record<string, string> = { 'DUNIK': 'DUNK', 'dunik': 'dunk', 'Dunik': 'Dunk' };
    return map[match] || 'Dunk';
  });
};

export default function App() {
  const [activeProject, setActiveProject] = useState<VideoProject | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [activeTab, setActiveTab] = useState<'niche' | 'studio' | 'viral'>('niche');
  const [downloadReadyInfo, setDownloadReadyInfo] = useState<{ url: string; filename: string } | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  const triggerVideoExport = async () => {
    if (!activeProject) return;
    setIsProcessing(true);
    setProcessingStage("Initializing Video Engine (FFmpeg)...");
    try {
      // Dynamic import of FFmpeg logic to save memory
      const { renderVideoInBrowser } = await import('./utils/ffmpegClient');
      const editedBlob = await renderVideoInBrowser(activeProject, (prg) => {
        setProcessingStage(`Baking video: ${prg}%`);
      });
      const url = URL.createObjectURL(editedBlob);
      setDownloadReadyInfo({ url, filename: `${activeProject.name}_edited.mp4` });
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    } finally { setIsProcessing(false); }
  };

  const handleSelectTemplate = async (template: any) => {
    setIsProcessing(true);
    setProcessingStage('AI is analyzing content...');
    try {
      const result = await runAnalyzeVideo({ ...template });
      const newProject = { 
        ...result.project, 
        id: `proj-${Date.now()}`, 
        videoUrl: template.videoUrl, 
        name: fixDunikTypo(template.name) 
      };
      setActiveProject(newProject);
      setActiveTab('studio');
    } catch (err: any) {
      alert('AI analysis failed: ' + err.message);
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <header className="p-4 border-b border-slate-900 flex justify-between items-center bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
        <h1 className="font-black tracking-tighter text-lg uppercase flex items-center gap-2">
          <Sparkles className="text-purple-500 w-5 h-5" /> Viral AI Editor
        </h1>
        <button onClick={() => setShowApiKeyModal(true)} className="bg-slate-800 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
          <KeyRound className="w-3 h-3" /> Set API Key
        </button>
      </header>

      {isProcessing && (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-6 text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-md font-bold uppercase tracking-widest">{processingStage}</h2>
          <p className="text-[10px] text-slate-500 mt-2 max-w-[250px]">Please keep this tab active and your phone on. AI processing uses significant device resources.</p>
          <button onClick={() => setIsProcessing(false)} className="mt-8 text-[10px] text-purple-400 font-black uppercase">Cancel & Return</button>
        </div>
      )}

      <main className="max-w-5xl mx-auto p-4 md:p-8">
        {!activeProject ? (
          <NicheSelector onSelectTemplate={handleSelectTemplate} isProcessing={isProcessing} onUploadCustomFile={() => {}} />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2 justify-between items-center bg-slate-900/80 p-4 rounded-3xl border border-slate-800">
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-purple-600/20 rounded-xl"><Video className="text-purple-500 w-4 h-4" /></div>
                 <div>
                   <h2 className="text-xs font-bold text-slate-400 uppercase">Project</h2>
                   <p className="text-sm font-black">{activeProject.name}</p>
                 </div>
               </div>
               <div className="flex gap-2">
                 <button onClick={() => setActiveTab('studio')} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase ${activeTab === 'studio' ? 'bg-white text-black' : 'bg-slate-800 text-slate-400'}`}>Studio</button>
                 <button onClick={() => setActiveTab('viral')} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase ${activeTab === 'viral' ? 'bg-white text-black' : 'bg-slate-800 text-slate-400'}`}>Viral Specs</button>
                 <button onClick={triggerVideoExport} className="bg-purple-600 hover:bg-purple-500 px-6 py-2 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2">
                   <Download className="w-3.5 h-3.5" /> Bake Video
                 </button>
               </div>
            </div>
            
            <div className={activeTab === 'studio' ? 'block' : 'hidden'}>
               <VideoPlayerWorkspace project={activeProject} onUpdateProject={setActiveProject as any} activeMusicTrack={null} musicVolume={0.5} setMusicVolume={() => {}} enableSubtitles={true} setEnableSubtitles={() => {}} enableZooms={true} setEnableZooms={() => {}} enableColorGrade={true} setEnableColorGrade={() => {}} activeClipId={null} onClipSelect={() => {}} />
            </div>

            <div className={activeTab === 'viral' ? 'block' : 'hidden'}>
               <ViralityScorecard project={activeProject} />
            </div>
          </div>
        )}
      </main>
      
      <ApiKeySettingsModal isOpen={showApiKeyModal} onClose={() => setShowApiKeyModal(false)} />
      
      {downloadReadyInfo && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-6 z-50 animate-fade-in">
          <div className="bg-slate-900 p-8 rounded-[40px] text-center border border-slate-800 max-w-sm w-full shadow-2xl">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight mb-2">Video Ready!</h3>
            <p className="text-xs text-slate-400 mb-8 leading-relaxed">Your professional vertical short is fully baked and optimized for TikTok.</p>
            <a href={downloadReadyInfo.url} download={downloadReadyInfo.filename} onClick={() => setDownloadReadyInfo(null)} className="block w-full py-4 bg-green-600 hover:bg-green-500 text-white rounded-2xl font-black text-sm mb-4 transition-all active:scale-95">SAVE TO PHOTOS</a>
            <button onClick={() => setDownloadReadyInfo(null)} className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Keep Editing</button>
          </div>
        </div>
      )}
    </div>
  );
}
