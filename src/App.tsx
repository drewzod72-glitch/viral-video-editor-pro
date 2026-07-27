import React, { useState } from 'react';
import { VideoProject } from './types';
import NicheSelector from './components/NicheSelector';
import VideoPlayerWorkspace from './components/VideoPlayerWorkspace';
import ViralityScorecard from './components/ViralityScorecard';
import { CheckCircle, KeyRound, Sparkles, Download, Video as VideoIcon } from 'lucide-react';
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
  const [hasStarted, setHasStarted] = useState(false);
  const [activeProject, setActiveProject] = useState<VideoProject | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [activeTab, setActiveTab] = useState<'studio' | 'viral'>('studio');
  const [downloadReadyInfo, setDownloadReadyInfo] = useState<{ url: string; filename: string } | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  const triggerVideoExport = async () => {
    if (!activeProject) return;
    setIsProcessing(true);
    setProcessingStage("Initializing Video Engine...");
    try {
      const { renderVideoInBrowser } = await import('./utils/ffmpegClient');
      const blob = await renderVideoInBrowser(activeProject, (prg) => {
        setProcessingStage(`Baking video: ${prg}%`);
      });
      setDownloadReadyInfo({ url: URL.createObjectURL(blob), filename: `${activeProject.name}_edited.mp4` });
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

  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-purple-600/20 rounded-[30px] flex items-center justify-center mb-8 animate-pulse">
           <Sparkles className="text-purple-500 w-10 h-10" />
        </div>
        <h1 className="text-2xl font-black text-white uppercase tracking-tighter mb-4">Viral AI Editor</h1>
        <p className="text-slate-400 text-sm max-w-[280px] mb-10 leading-relaxed">Ready to transform your videos with Google Gemini AI?</p>
        <button onClick={() => setHasStarted(true)} className="w-full max-w-[280px] py-4 bg-purple-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-95">Start AI Editor</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="p-4 border-b border-slate-900 flex justify-between items-center bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
        <h1 className="font-black tracking-tighter text-lg uppercase flex items-center gap-2"><Sparkles className="text-purple-500 w-5 h-5" /> Viral AI</h1>
        <button onClick={() => setShowApiKeyModal(true)} className="bg-slate-800 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"><KeyRound className="w-3 h-3" /> API Key</button>
      </header>

      {isProcessing && (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-6 text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-md font-bold uppercase tracking-widest">{processingStage}</h2>
          <button onClick={() => setIsProcessing(false)} className="mt-8 text-[10px] text-purple-400 font-black uppercase">Cancel</button>
        </div>
      )}

      <main className="max-w-5xl mx-auto p-4">
        {!activeProject ? (
          <NicheSelector onSelectTemplate={handleSelectTemplate} isProcessing={isProcessing} onUploadCustomFile={() => {}} />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2 justify-between items-center bg-slate-900/80 p-4 rounded-3xl border border-slate-800">
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-purple-600/20 rounded-xl"><VideoIcon className="text-purple-500 w-4 h-4" /></div>
                 <p className="text-sm font-black">{activeProject.name}</p>
               </div>
               <div className="flex gap-2">
                 <button onClick={() => setActiveTab('studio')} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase ${activeTab === 'studio' ? 'bg-white text-black' : 'bg-slate-800 text-slate-400'}`}>Studio</button>
                 <button onClick={() => setActiveTab('viral')} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase ${activeTab === 'viral' ? 'bg-white text-black' : 'bg-slate-800 text-slate-400'}`}>Viral</button>
                 <button onClick={triggerVideoExport} className="bg-purple-600 px-6 py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-2"><Download className="w-3.5 h-3.5" /> Bake</button>
               </div>
            </div>
            {activeTab === 'studio' ? <VideoPlayerWorkspace project={activeProject} onUpdateProject={setActiveProject as any} activeMusicTrack={null} musicVolume={0.5} setMusicVolume={() => {}} enableSubtitles={true} setEnableSubtitles={() => {}} enableZooms={true} setEnableZooms={() => {}} enableColorGrade={true} setEnableColorGrade={() => {}} activeClipId={null} onClipSelect={() => {}} /> : <ViralityScorecard project={activeProject} />}
          </div>
        )}
      </main>
      <ApiKeySettingsModal isOpen={showApiKeyModal} onClose={() => setShowApiKeyModal(false)} />
      {downloadReadyInfo && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-6 z-50">
          <div className="bg-slate-900 p-8 rounded-[40px] text-center border border-slate-800 max-w-sm w-full shadow-2xl">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-black uppercase tracking-tight mb-2">Ready!</h3>
            <a href={downloadReadyInfo.url} download={downloadReadyInfo.filename} onClick={() => setDownloadReadyInfo(null)} className="block w-full py-4 bg-green-600 text-white rounded-2xl font-black text-sm mb-4">SAVE VIDEO</a>
            <button onClick={() => setDownloadReadyInfo(null)} className="text-[10px] font-black uppercase text-slate-500">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
