import React, { useState, useEffect } from 'react';
import { VideoProject } from './types';
import NicheSelector from './components/NicheSelector';
import VideoPlayerWorkspace from './components/VideoPlayerWorkspace';
import ViralityScorecard from './components/ViralityScorecard';
import { AICopilotConsole } from './components/AICopilotConsole';
import { Sparkles, Download, CheckCircle, KeyRound } from 'lucide-react';
import ApiKeySettingsModal from './components/ApiKeySettingsModal';
import { runAnalyzeVideo } from './utils/geminiClient';
import { renderVideoInBrowser } from './utils/ffmpegClient';

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
  const [activeTab, setActiveTab] = useState<'studio' | 'viral' | 'copilot'>('studio');
  const [downloadReadyInfo, setDownloadReadyInfo] = useState<{ url: string; filename: string } | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  const triggerVideoExport = async () => {
    if (!activeProject) return;
    setIsProcessing(true);
    setProcessingStage("Warming Engine...");
    try {
      const editedBlob = await renderVideoInBrowser(activeProject, (prg) => {
        setProcessingStage(`Baking: ${prg}%`);
      });
      setDownloadReadyInfo({ url: URL.createObjectURL(editedBlob), filename: `${activeProject.name}_edit.mp4` });
    } catch (err: any) { alert(err.message); }
    finally { setIsProcessing(false); }
  };

  const handleSelectTemplate = async (template: any) => {
    setIsProcessing(true);
    setProcessingStage('AI Analysis...');
    try {
      const result = await runAnalyzeVideo(template);
      setActiveProject({ ...result.project, id: `proj-${Date.now()}`, videoUrl: template.videoUrl, name: template.name });
    } catch (err: any) { alert(err.message); }
    finally { setIsProcessing(false); }
  };

  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8">
        <button onClick={() => setHasStarted(true)} className="px-10 py-5 bg-purple-600 text-white rounded-3xl font-black uppercase tracking-widest shadow-2xl">Start AI Editor</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <header className="p-4 border-b border-slate-900 flex justify-between items-center bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
        <h1 className="font-black text-lg uppercase flex items-center gap-2"><Sparkles className="text-purple-500 w-5 h-5" /> Viral AI</h1>
        <button onClick={() => setShowApiKeyModal(true)} className="bg-slate-800 px-4 py-2 rounded-xl text-[10px] font-bold uppercase"><KeyRound className="inline w-3 h-3 mr-1" /> API Key</button>
      </header>
      {isProcessing && <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-6 text-center">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-md font-bold uppercase">{processingStage}</h2>
      </div>}
      <main className="max-w-5xl mx-auto p-4">
        {!activeProject ? (
          <NicheSelector onSelectTemplate={handleSelectTemplate} isProcessing={isProcessing} />
        ) : (
          <div className="space-y-6">
            <div className="flex gap-2 justify-between items-center bg-slate-900/80 p-4 rounded-3xl border border-slate-800 shadow-xl">
               <span className="text-sm font-black truncate max-w-[150px]">{activeProject.name}</span>
               <div className="flex gap-2">
                 <button onClick={() => setActiveTab('studio')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${activeTab === 'studio' ? 'bg-white text-black' : 'bg-slate-800 text-slate-400'}`}>Studio</button>
                 <button onClick={() => setActiveTab('viral')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${activeTab === 'viral' ? 'bg-white text-black' : 'bg-slate-800 text-slate-400'}`}>Specs</button>
                 <button onClick={() => setActiveTab('copilot')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${activeTab === 'copilot' ? 'bg-white text-black' : 'bg-slate-800 text-slate-400'}`}>Copilot</button>
                 <button onClick={triggerVideoExport} className="bg-purple-600 px-4 py-2 rounded-xl font-black text-[10px] uppercase">Bake Video</button>
               </div>
            </div>
            {activeTab === 'studio' && <VideoPlayerWorkspace project={activeProject} onUpdateProject={setActiveProject as any} activeMusicTrack={null} musicVolume={0.5} setMusicVolume={() => {}} enableSubtitles={true} setEnableSubtitles={() => {}} enableZooms={true} setEnableZooms={() => {}} enableColorGrade={true} setEnableColorGrade={() => {}} activeClipId={null} onClipSelect={() => {}} />}
            {activeTab === 'viral' && <ViralityScorecard project={activeProject} onUpdateProject={setActiveProject as any} />}
            {activeTab === 'copilot' && <AICopilotConsole project={activeProject} onUpdateProject={setActiveProject as any} onUpdateSubtitles={(subs) => setActiveProject({ ...activeProject, subtitles: subs })} />}
          </div>
        )}
      </main>
      <ApiKeySettingsModal isOpen={showApiKeyModal} onClose={() => setShowApiKeyModal(false)} />
      {downloadReadyInfo && <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-6 z-50">
          <div className="bg-slate-900 p-8 rounded-[40px] text-center border border-slate-800 max-w-sm w-full shadow-2xl">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-6" />
            <h3 className="text-xl font-black uppercase mb-2">Video Ready!</h3>
            <a href={downloadReadyInfo.url} download={downloadReadyInfo.filename} className="block w-full py-4 bg-green-600 text-white rounded-2xl font-black text-sm mb-4">SAVE TO PHOTOS</a>
            <button onClick={() => setDownloadReadyInfo(null)} className="text-[10px] font-black uppercase text-slate-500">Back</button>
          </div>
      </div>}
    </div>
  );
}
